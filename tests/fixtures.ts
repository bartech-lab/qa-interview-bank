import { test as base, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// QIB_PAGE points the tests at another built page, for example a copy from before a change, to watch new tests fail.
export const PAGE_URL = pathToFileURL(path.resolve(process.env.QIB_PAGE || 'dist/index.html')).href;

// The page unpacks its questions after load and sets <html data-ready="1"> once home is drawn (docs/phase3-spec.md).
// Pages built before phase 3 have no packed parts and are ready at load.
export const ready = (page: Page) => page.waitForFunction(() => document.documentElement.dataset.ready === '1' || !document.getElementById('pack-data'));
// goto and reload that wait for the ready flag.
export async function load(page: Page, url = PAGE_URL) { await page.goto(url); await ready(page); }
export async function reload(page: Page) { await page.reload(); await ready(page); }

export type OpenOpts = {
  time?: Date;                       // page.clock.install before goto
  seed?: Record<string, string>;     // localStorage entries written from the page after the first load; the page then reloads
  fullStorage?: boolean;             // setItem throws QuotaExceededError while window.__full is true
  blockRead?: boolean;               // getItem throws SecurityError (storage blocked)
};
type Fixtures = {
  bank: Page;
  fitsScreen: () => Promise<void>;
  secondTab: Page;
  open: (o?: OpenOpts) => Promise<Page>;
  watched: Page;
};

function watch(page: Page, problems: string[]) {
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
  page.on('dialog', d => { problems.push('browser dialog: ' + d.type()); void d.dismiss(); });
}

// Opens the built page from file:// (the way people use it) and fails the test on any page error,
// console error or browser dialog.
export const test = base.extend<Fixtures>({
  bank: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', e => problems.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
    page.on('dialog', d => { problems.push('browser dialog: ' + d.type()); void d.dismiss(); });
    await load(page);
    await use(page);
    expect(problems, 'errors on the page').toEqual([]);
  },
  // A second tab of the same file in the same browser context as `bank`; closed after the test.
  secondTab: async ({ bank }, use) => {
    const problems: string[] = [];
    const tab = await bank.context().newPage();
    watch(tab, problems);
    await load(tab);
    await use(tab);
    await tab.close();
    expect(problems, 'errors on the second tab').toEqual([]);
  },
  // Opens the page with a controlled clock, seeded storage, or broken storage; same error checks as `bank`.
  open: async ({ page }, use) => {
    const problems: string[] = [];
    watch(page, problems);
    await use(async (o = {}) => {
      if (o.time) await page.clock.install({ time: o.time });
      if (o.fullStorage) {
        await page.addInitScript(() => {
          const w = window as unknown as { __full: boolean };
          w.__full = false;
          const orig = Storage.prototype.setItem;
          Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
            if (w.__full) throw new DOMException('full', 'QuotaExceededError');
            return orig.call(this, k, v);
          };
        });
      }
      if (o.blockRead) {
        await page.addInitScript(() => {
          Storage.prototype.getItem = function () { throw new DOMException('blocked', 'SecurityError'); };
        });
      }
      await load(page);
      // Seed by writing storage from the page, then reload: Firefox refuses localStorage inside an init script on file://.
      if (o.seed) {
        await page.evaluate((seed: Record<string, string>) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, o.seed);
        await reload(page);
      }
      return page;
    });
    expect(problems, 'errors on the page').toEqual([]);
  },
  // The page with the same error checks as `bank`, but not opened yet: the test adds init scripts, then calls load(page).
  watched: async ({ page }, use) => {
    const problems: string[] = [];
    watch(page, problems);
    await use(page);
    // Firefox logs a failed gzip read itself when a test corrupts a packed part on purpose; that is the browser, not the page.
    expect(problems.filter(p => !/ReadableStream|incorrect header check/.test(p)), 'errors on the page').toEqual([]);
  },
  fitsScreen: async ({ page }, use) => {
    await use(async () => {
      const wider = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(wider, 'page is wider than the screen').toBe(false);
    });
  },
});
export { expect };

// ---- helpers shared by the phase 2 tests ----
export type Q = { id: string; file: string; topic: string; section: string; q: string; body: string; tier: 'Core' | 'Standard' | 'Niche' };

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

export const raw = (page: Page) => page.evaluate(() => localStorage.getItem('qa-bank'));
export const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('qa-bank') || '{}'));
export const store = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key);

export async function bankData(page: Page): Promise<Q[]> {
  // Pages before phase 3 keep the questions in #data; later pages unpack them into the global Q.
  const rows: Omit<Q, 'tier'>[] = await page.evaluate(() => {
    const el = document.getElementById('data');
    if (el) return JSON.parse(el.textContent!);
    return (window as unknown as { eval: (s: string) => Omit<Q, 'tier'>[] }).eval('Q').map(({ id, file, topic, section, q, body }) => ({ id, file, topic, section, q, body }));
  });
  return rows.map(r => ({ ...r, tier: (/\| (Core|Standard|Niche) \|/.exec(r.body)?.[1] ?? 'Standard') as Q['tier'] }));
}

type Win = { go: (v: string, a?: string) => void };
export const goTo = (page: Page, view: string, arg?: string) =>
  page.evaluate(([v, a]) => (window as unknown as Win).go(v, a), [view, arg] as [string, string | undefined]);

export async function currentId(page: Page): Promise<string | null> {
  const href = await page.getByRole('link', { name: 'Report a problem with this answer' }).first().getAttribute('href');
  return href ? /^\[(q\d+)\]/.exec(new URL(href).searchParams.get('title') || '')?.[1] ?? null : null;
}

// Opens the Learn view on one question directly: its topic, then pick(index). Faster than openQuestion.
export async function openById(page: Page, id: string) {
  await page.evaluate(id => (window as unknown as { eval: (s: string) => (id: string) => void }).eval('(id) => { const q = Q.find(x => x.id === id); go("learn", q.file); pick(q.i); }')(id), id);
}

// Opens the Learn view on one question through the UI (topic file, then Next until the id matches).
export async function openQuestion(page: Page, id: string) {
  const q = (await bankData(page)).find(x => x.id === id)!;
  await goTo(page, 'learn', q.file);
  for (let i = 0; i < 400; i++) {
    if ((await currentId(page)) === id) return;
    await page.getByRole('button', { name: 'Next →' }).click();
  }
  throw new Error('could not reach ' + id);
}

export const progress = (p: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 2, known: {}, shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null, ...p });
export const marks = (ids: string[]) => Object.fromEntries(ids.map(i => [i, 1]));

export const ratingButton = (page: Page, how: 'missed' | 'shaky' | 'known') =>
  page.getByRole('button', { name: how === 'missed' ? /Didn['’]t know/ : how === 'shaky' ? /Shaky/ : /Knew it/ });

export async function rateOne(page: Page, how: 'missed' | 'shaky' | 'known', by: 'click' | 'key' = 'click') {
  await page.getByRole('button', { name: /Show answer/ }).click();
  if (by === 'key') await page.keyboard.press({ missed: '1', shaky: '2', known: '3' }[how]);
  else await ratingButton(page, how).click();
}

// Rates every question the running quiz still offers; returns how many it rated.
export async function rateAll(page: Page, how: 'missed' | 'shaky' | 'known' = 'known'): Promise<number> {
  let n = 0;
  while (n < 80) {
    try { await page.getByRole('button', { name: /Show answer/ }).click({ timeout: 1500 }); } catch { break; }
    await ratingButton(page, how).click();
    n++;
  }
  return n;
}

export const quizThese = (page: Page) => page.getByRole('button', { name: /Quiz these \d+/ });
export const rowIds = (page: Page) => page.locator('.rq-row').evaluateAll(els => els.map(e => e.getAttribute('data-id')));
export const importFile = (o: unknown) => ({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)) });
export const exportFile = (progressObj: unknown, exported = '2026-01-10T10:00:00.000Z') =>
  ({ app: 'qa-interview-bank', format: 1, exported, progress: progressObj });
