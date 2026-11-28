// Phase 4: the Locators tab (docs/phase4-spec.md, idea 50). Written from the spec only; "FMn" is failure mode n.
import { test, expect, goTo, load, reload, saved, progress, importFile, exportFile, PAGE_URL } from './fixtures';
import { corruptParts } from './code-helpers';
import type { Page, FrameLocator, Locator } from '@playwright/test';
import fs from 'node:fs';

type Info = { pages: { id: string; title: string; case: number; caseTitle: string; doc: string }[]; tasks: { id: string; page: string; task: string; answer: string }[] };
const info: Info = JSON.parse(fs.readFileSync('src/locators/tasks.json', 'utf8'));
const titleOf = (id: string) => info.pages.find(p => p.id === id)!.title;
const tasksOf = (id: string) => info.tasks.filter(t => t.page === id);
const taskById = (id: string) => info.tasks.find(t => t.id === id)!;

const MSG = {
  empty: "Type a locator, for example getByRole('button', { name: 'Save' }).",
  unsupported: "This is not a locator the trainer can read. Start with getByRole, getByText, getByLabel, getByPlaceholder, getByAltText, getByTitle, getByTestId or locator, and leave out actions such as click().",
  none: 'No element matches.',
  one: '1 element matches.',
  many: (n: number) => `${n} elements match. An action such as click() would fail in strict mode; narrow it down.`,
  unpack: 'This browser cannot unpack the locator trainer. Use a current Chrome, Edge, Firefox or Safari.',
};
const plural = (n: number) => (n === 1 ? '1 element' : `${n} elements`);

// ---- helpers ----
const state = (p: Page) => p.locator('#loc-state');
const frameOf = (p: Page): FrameLocator => p.frameLocator('#loc-frame');
// What the trainer reads: the text without "await ", "page." in front and ";" at the end, then real Playwright builds it on the frame.
const real = (p: Page, text: string): Locator => {
  const s = text.trim().replace(/^await /, '').replace(/;\s*$/, '');
  return new Function('page', 'return ' + (s.startsWith('page.') ? s : 'page.' + s))(frameOf(p));
};
async function openLoc(p: Page) {
  await goTo(p, 'learn', '01-playwright'); await p.locator('#drill-open').click();
  await expect(p.locator('#locators')).toBeVisible();
  await expect(frameOf(p).locator('body *').first()).toBeAttached();
}
async function choosePage(p: Page, id: string) {
  await p.locator('#loc-page').selectOption(id);
  await expect(p.locator('#loc-frame')).toHaveAttribute('title', `Frozen page: ${titleOf(id)}`);
  await expect(frameOf(p).locator('body *').first()).toBeAttached();
}
// Types the text (from an emptied box, so the same text twice still waits for a new result) and waits for the answer to that text.
async function typeLoc(p: Page, text: string) {
  await p.locator('#loc-input').fill('');
  await expect(state(p)).toHaveAttribute('data-input', '');
  await p.locator('#loc-input').fill(text);
  await expect(state(p)).toHaveAttribute('data-input', text);
}
const marks = (p: Page) => frameOf(p).locator('[data-qa-match]');
async function openOn(p: Page, id: string) { await openLoc(p); await choosePage(p, id); }
// A passed task's button name ends with ", passed" (spec, tasks 3).
const taskBtn = (p: Page, id: string) => p.locator('#loc-tasks').getByRole('button', { name: new RegExp(`^${taskById(id).task.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(, passed)?$`) });
const verdict = (p: Page) => p.locator('#loc-verdict');
const sameSetOf = async (p: Page, text: string) => real(p, text).count();

// ---------------------------------------------------------------- parts, ids and names
test('parts: header button, view, picker, frame, box, result line, task list, verdict', async ({ bank }) => {
  const tab = bank.locator('#tab-learn');
  await expect(bank.locator('#tab-locators')).toHaveCount(0);
  await expect(bank.locator('#locators')).toBeHidden();
  await expect(bank.locator('#tab-review')).not.toHaveClass(/\bon\b/);
  await goTo(bank, 'learn', '01-playwright'); await bank.locator('#drill-open').click();
  await expect(bank.locator('#locators')).toBeVisible();
  await expect(tab).toHaveClass(/\bon\b/);
  await goTo(bank, 'home');
  await expect(bank.locator('#locators')).toBeHidden();
  await expect(bank.locator('#tab-review')).not.toHaveClass(/\bon\b/);
  await goTo(bank, 'locators');
  await expect(bank.locator('#locators')).toBeVisible();

  const picker = bank.getByRole('combobox', { name: 'Frozen page' });
  await expect(picker).toHaveAttribute('id', 'loc-page');
  expect(await picker.locator('option').evaluateAll(os => os.map(o => [(o as HTMLOptionElement).value, o.textContent]))).toEqual(info.pages.map(p => [p.id, p.title]));
  await expect(bank.locator('#loc-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(bank.locator('#loc-frame')).toHaveAttribute('title', `Frozen page: ${info.pages[0].title}`);
  expect(await bank.locator('#loc-frame').evaluate(e => e.tagName)).toBe('IFRAME');
  await expect(bank.getByRole('textbox', { name: 'Locator' })).toHaveAttribute('id', 'loc-input');
  await expect(bank.getByRole('status').and(bank.locator('#loc-state'))).toHaveCount(1);
  await expect(bank.getByRole('status').and(bank.locator('#loc-verdict'))).toHaveCount(1);
  await expect(verdict(bank)).toHaveText('');
  const list = bank.getByRole('list', { name: 'Tasks on this page' });
  await expect(list).toHaveAttribute('id', 'loc-tasks');
  await expect(list.getByRole('listitem')).toHaveCount(tasksOf(info.pages[0].id).length);
  await expect(bank.getByRole('button', { name: 'Show an answer' })).toBeHidden();
});

test('parts: task list shows one item per task of the page, each with a button named by the task text', async ({ bank }) => {
  await openLoc(bank);
  for (const p of info.pages) {
    await choosePage(bank, p.id);
    const items = bank.getByRole('list', { name: 'Tasks on this page' }).getByRole('listitem');
    await expect(items).toHaveCount(tasksOf(p.id).length);
    for (const [i, t] of tasksOf(p.id).entries()) await expect(items.nth(i).getByRole('button')).toHaveAccessibleName(t.task);
    const link = bank.locator('#loc-case');
    await expect(link).toHaveAccessibleName(`Case ${p.case} on e2e-casebook: ${p.caseTitle}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('href', `https://github.com/bartech-lab/e2e-casebook/blob/main/${p.doc}`);
  }
});

// ---------------------------------------------------------------- behaviour 1 and 6 of tasks: page choice
test('1: the first page shows first; choosing a page keeps the text, evaluates it again and leaves no old highlight', async ({ bank }) => {
  await openLoc(bank);
  await expect(bank.locator('#loc-page')).toHaveValue(info.pages[0].id);
  await choosePage(bank, 'shop');
  await typeLoc(bank, "getByRole('button', { name: 'Add Pen' })");
  await expect(state(bank)).toHaveAttribute('data-state', 'one');
  await expect(marks(bank)).toHaveCount(1);
  await bank.locator('#loc-page').selectOption('signup');
  await expect(bank.locator('#loc-frame')).toHaveAttribute('title', 'Frozen page: ' + titleOf('signup'));
  await expect(bank.locator('#loc-input')).toHaveValue("getByRole('button', { name: 'Add Pen' })");
  await expect(state(bank)).toHaveAttribute('data-state', 'none');
  await expect(marks(bank)).toHaveCount(0);
  await bank.locator('#loc-page').selectOption('shop');
  await expect(state(bank)).toHaveAttribute('data-state', 'one');
  await expect(marks(bank)).toHaveCount(1);
});

test('FM7 switching page while the text matches on both pages shows the new page\'s own result', async ({ bank }) => {
  await openOn(bank, 'orders');
  await typeLoc(bank, "getByRole('row')");
  const n1 = await real(bank, "getByRole('row')").count();
  await expect(state(bank)).toHaveAttribute('data-count', String(n1));
  await choosePage(bank, 'playlist');
  const n2 = await real(bank, "getByRole('row')").count();
  expect(n2, 'the two pages differ').not.toBe(n1);
  await expect(state(bank)).toHaveAttribute('data-count', String(n2));
  await expect(marks(bank)).toHaveCount(n2);
});

test('6: the chosen page is saved, an unknown saved page falls back to the first', async ({ open }) => {
  const page = await open({ seed: { 'qa-bank': progress({ locPage: 'orders' }) } });
  await openLoc(page);
  await expect(page.locator('#loc-page')).toHaveValue('orders');
  await expect(page.locator('#loc-frame')).toHaveAttribute('title', 'Frozen page: ' + titleOf('orders'));
  await choosePage(page, 'gallery');
  await reload(page);
  await openLoc(page);
  await expect(page.locator('#loc-page')).toHaveValue('gallery');
});

test('6: an unknown saved page id falls back to the first page', async ({ open }) => {
  const page = await open({ seed: { 'qa-bank': progress({ locPage: 'no-such-page' }) } });
  await openLoc(page);
  await expect(page.locator('#loc-page')).toHaveValue(info.pages[0].id);
  await expect(page.locator('#loc-frame')).toHaveAttribute('title', 'Frozen page: ' + info.pages[0].title);
});

// ---------------------------------------------------------------- states
test('FM1 empty box and spaces only: state empty with the hint', async ({ bank }) => {
  await openOn(bank, 'shop');
  await typeLoc(bank, "getByTestId('order-total')");
  await expect(marks(bank)).toHaveCount(1);
  await typeLoc(bank, '');
  await expect(state(bank)).toHaveAttribute('data-state', 'empty');
  await expect(state(bank)).toHaveText(MSG.empty);
  await expect(marks(bank)).toHaveCount(0);
  await typeLoc(bank, '   ');
  await expect(state(bank)).toHaveAttribute('data-state', 'empty');
  await expect(state(bank)).toHaveText(MSG.empty);
});

const notLocators = ['foo()', "getByRole(", "getByRole('button').click()", "getByRole('button').or(foo())", "frameLocator('#x').getByRole('button')",
  "getByRole('button').and(getByRole('link')"];

test('FM2 .or(), .and() and a filter with two options are read, also inside has:', async ({ bank }) => {
  await openOn(bank, 'notes');
  await typeLoc(bank, "page.getByRole('button', { name: 'Star' }).or(page.getByRole('button', { name: 'Archive' }))");
  await expect(state(bank)).toHaveAttribute('data-state', 'many');
  await expect(state(bank)).toHaveAttribute('data-count', '2');
  await typeLoc(bank, "getByRole('checkbox').and(getByLabel('Trip ideas'))");
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  await expect(frameOf(bank).getByRole('checkbox', { name: 'Trip ideas', exact: true })).toHaveAttribute('data-qa-match', '');
  await typeLoc(bank, "getByRole('listitem').filter({ hasText: 'ideas', has: getByRole('checkbox', { name: 'Gift ideas' }) })");
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  await typeLoc(bank, "getByRole('listitem').filter({ has: getByRole('checkbox', { name: 'Book notes' }).or(getByRole('checkbox', { name: 'Gift ideas' })) })");
  await expect(state(bank)).toHaveAttribute('data-count', '2');
});
for (const text of notLocators) {
  test(`FM2 not a locator: ${text}`, async ({ bank }) => {
    await openOn(bank, 'signup');
    await typeLoc(bank, text);
    await expect(state(bank)).toHaveAttribute('data-state', 'unsupported');
    await expect(state(bank)).toHaveText(MSG.unsupported);
    await expect(marks(bank)).toHaveCount(0);
    await expect(state(bank)).not.toHaveAttribute('data-count', /.*/);
  });
}

for (const text of ["locator('button[')", "locator('foo=bar')"]) {
  test(`FM3 read but rejected by the engine: ${text}`, async ({ bank }) => {
    await openOn(bank, 'signup');
    await typeLoc(bank, text);
    await expect(state(bank)).toHaveAttribute('data-state', 'invalid');
    await expect(state(bank)).toHaveText(/^Playwright would reject this locator: \S/);
    await expect(marks(bank)).toHaveCount(0);
  });
}

test('FM4 none, one and many matches, with the right number in the text', async ({ bank }) => {
  await openOn(bank, 'orders');
  await typeLoc(bank, "getByText('no such words anywhere')");
  await expect(state(bank)).toHaveAttribute('data-state', 'none');
  await expect(state(bank)).toHaveText(MSG.none);
  await expect(marks(bank)).toHaveCount(0);
  await typeLoc(bank, "getByText('Page 1 of 3', { exact: true })");
  await expect(state(bank)).toHaveAttribute('data-state', 'one');
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  await expect(state(bank)).toHaveText(MSG.one);
  await typeLoc(bank, "locator('tbody tr')");
  const n = await sameSetOf(bank, "locator('tbody tr')");
  expect(n).toBeGreaterThan(1);
  await expect(state(bank)).toHaveAttribute('data-state', 'many');
  await expect(state(bank)).toHaveAttribute('data-count', String(n));
  await expect(state(bank)).toHaveText(MSG.many(n));
  await expect(marks(bank)).toHaveCount(n);
});

const variants = (core: string) => [`await ${core}`, `page.${core}`, `${core};`, `await page.${core};`, `   page.${core}   `, `await page.${core}  ;`];
test('FM5 prefixes await, page. and ; are removed; the answer still names the exact typed text', async ({ bank }) => {
  await openOn(bank, 'shop');
  const core = "getByTestId('order-total')";
  for (const v of variants(core)) {
    await typeLoc(bank, v);
    await expect(state(bank), v).toHaveAttribute('data-state', 'one');
    await expect(marks(bank), v).toHaveCount(1);
  }
});

test('FM5 page. inside has: is removed, so the filter matches like real Playwright', async ({ bank }) => {
  await openOn(bank, 'shop');
  const text = "getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Reviews for Pen' }) })";
  const n = await sameSetOf(bank, text);
  expect(n).toBeGreaterThan(0);
  await typeLoc(bank, text);
  await expect(state(bank)).not.toHaveAttribute('data-state', /unsupported|invalid/);
  await expect(marks(bank)).toHaveCount(n);
  await typeLoc(bank, 'await ' + text + ';');
  await expect(marks(bank)).toHaveCount(n);
});

test('FM5 a string that contains page. keeps it', async ({ bank }) => {
  await openOn(bank, 'shop');
  // Phase 6: the frozen pages lost the case menu, so the control text is a word the shop page itself shows.
  const control = await sameSetOf(bank, "getByText('Pen')");
  expect(control, 'text without "page." would match here').toBeGreaterThan(0);
  await typeLoc(bank, "getByText('page.Pen')");
  await expect(state(bank)).toHaveAttribute('data-state', 'none');
  await expect(marks(bank)).toHaveCount(0);
  await typeLoc(bank, "page.getByText('page.Pen');");
  await expect(state(bank)).toHaveAttribute('data-state', 'none');
});

// ---------------------------------------------------------------- behaviour 2: timing
test('FM6 fast typing evaluates only the final text; no result for an older text shows after a newer one', async ({ bank }) => {
  await openOn(bank, 'orders');
  await bank.evaluate(() => {
    const w = window as unknown as { __log: (string | null)[] };
    w.__log = [];
    new MutationObserver(() => w.__log.push(document.getElementById('loc-state')!.getAttribute('data-input')))
      .observe(document.getElementById('loc-state')!, { attributes: true, attributeFilter: ['data-input'] });
  });
  const slow = "locator('*:has(*:has(*:has(*:has(*:has(*:has(*:has(*)))))))')";
  const fast = "getByText('Page 1 of 3', { exact: true })";
  await bank.locator('#loc-input').fill(slow);
  // the slow text is evaluated (more than 150 ms pass), then the fast text replaces it before the slow result is guaranteed back
  await bank.evaluate(() => new Promise(r => setTimeout(r, 250)));
  await bank.locator('#loc-input').fill(fast);
  await expect(state(bank)).toHaveAttribute('data-input', fast);
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  await bank.evaluate(() => new Promise(r => setTimeout(r, 600)));
  await expect(state(bank)).toHaveAttribute('data-input', fast);
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  await expect(marks(bank)).toHaveCount(1);
  const log = await bank.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log.at(-1)).toBe(fast);
  const lastSlow = log.lastIndexOf(slow);
  expect(lastSlow, 'the slow result never shows after the fast one').toBeLessThan(log.indexOf(fast));
});

test('FM6 typing key by key evaluates once, 150 ms after the last key, not at every key', async ({ bank }) => {
  await openOn(bank, 'orders');
  await bank.evaluate(() => {
    const w = window as unknown as { __log: (string | null)[] };
    w.__log = [];
    new MutationObserver(() => w.__log.push(document.getElementById('loc-state')!.getAttribute('data-input')))
      .observe(document.getElementById('loc-state')!, { attributes: true, attributeFilter: ['data-input'] });
  });
  const text = "getByText('Page 1 of 3', { exact: true })";
  await bank.locator('#loc-input').pressSequentially(text);
  await expect(state(bank)).toHaveAttribute('data-input', text);
  await expect(state(bank)).toHaveAttribute('data-count', '1');
  const log = await bank.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log, 'only the final text was evaluated').toEqual([text]);
});

// ---------------------------------------------------------------- behaviour 5 to 7
test('5: matched elements carry data-qa-match and an outline; a new result removes old marks; 0 matches mark nothing', async ({ bank }) => {
  await openOn(bank, 'playlist');
  await typeLoc(bank, "getByRole('listitem')");
  const n = await real(bank, "getByRole('listitem')").count();
  expect(n).toBeGreaterThan(1);
  await expect(marks(bank)).toHaveCount(n);
  const outlined = await marks(bank).first().evaluate(e => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' && s.outlineWidth !== '0px'; });
  expect(outlined, 'a marked element is outlined').toBe(true);
  const plain = await frameOf(bank).locator('body *:not([data-qa-match])').first().evaluate(e => { const s = getComputedStyle(e); return s.outlineStyle === 'none' || s.outlineWidth === '0px'; });
  expect(plain, 'an unmarked element is not outlined').toBe(true);
  await typeLoc(bank, "getByRole('button', { name: 'Move Slow Train' })");
  await expect(marks(bank)).toHaveCount(1);
  await typeLoc(bank, "getByText('no such words anywhere')");
  await expect(marks(bank)).toHaveCount(0);
  await typeLoc(bank, "getByRole('listitem')");
  await expect(marks(bank)).toHaveCount(n);
  await typeLoc(bank, 'foo()');
  await expect(marks(bank)).toHaveCount(0);
});

test('6: the first match scrolls into view inside the frame and the bank page does not scroll', async ({ bank }) => {
  await openLoc(bank);
  let picked = '';
  for (const p of info.pages) {
    await choosePage(bank, p.id);
    const found = await frameOf(bank).locator('body').evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('[data-probe]').forEach(e => e.removeAttribute('data-probe'));
      const el = [...document.querySelectorAll('body *')].find(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.width > 0 && r.top > window.innerHeight + 100 && e.children.length === 0; });
      if (el) el.setAttribute('data-probe', '1');
      return !!el;
    });
    if (found) { picked = p.id; break; }
  }
  expect(picked, 'some frozen page has an element below the frame fold').not.toBe('');
  await bank.evaluate(() => window.scrollTo(0, 0));
  const before = await bank.evaluate(() => [window.scrollX, window.scrollY]);
  await typeLoc(bank, "locator('[data-probe=\"1\"]')");
  await expect(state(bank)).toHaveAttribute('data-state', 'one');
  await expect.poll(() => frameOf(bank).locator('[data-probe]').evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; })).toBe(true);
  expect(await bank.evaluate(() => [window.scrollX, window.scrollY])).toEqual(before);
});

test('FM8 clicks on links, buttons and submit buttons and a form submit change nothing; no network or file request', async ({ bank }) => {
  await openOn(bank, 'signup');
  const urls: string[] = [];
  bank.on('request', r => urls.push(r.url()));
  const frame = frameOf(bank);
  await frame.locator('body').evaluate(b => b.setAttribute('data-mark', 'kept'));
  const pageUrl = bank.url();
  const frameUrl = bank.frames().find(f => f !== bank.mainFrame())!.url();
  // Phase 6: signup lost its links with the case menu; the shop page's own links are clicked below.
  await frame.getByRole('button', { name: 'Create account' }).click();
  await frame.getByRole('button', { name: 'Show password' }).click();
  await frame.getByLabel('Email').fill('a@b.c');
  await frame.getByLabel('Email').press('Enter');
  await bank.locator('#loc-input').fill("getByRole('button')");
  await expect(state(bank)).toHaveAttribute('data-input', "getByRole('button')");
  await expect(frame.locator('body')).toHaveAttribute('data-mark', 'kept');
  expect(bank.url()).toBe(pageUrl);
  expect(bank.frames().find(f => f !== bank.mainFrame())!.url()).toBe(frameUrl);
  await choosePage(bank, 'shop');
  await frame.locator('body').evaluate(b => b.setAttribute('data-mark', 'kept'));
  for (const link of await frame.getByRole('link').all()) await link.click();
  await expect(frame.locator('body')).toHaveAttribute('data-mark', 'kept');
  expect(bank.url()).toBe(pageUrl);
  for (const p of info.pages) await choosePage(bank, p.id);
  expect(urls.filter(u => /^(https?|file|ftp):/.test(u)), 'requests made while the frame was in use').toEqual([]);
});

test('FM9 the frame has no same-origin access; the page ignores a message that does not come from the frame', async ({ bank }) => {
  await openOn(bank, 'shop');
  await typeLoc(bank, "getByTestId('order-total')");
  // Probing the frame from the page makes WebKit log a page error itself, so the page side is checked by the sandbox attribute.
  await expect(bank.locator('#loc-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  const fromInside = await frameOf(bank).locator('body').evaluate(() => {
    const r: Record<string, string> = {};
    try { r.ls = String(parent.localStorage.length); } catch { r.ls = 'blocked'; }
    try { r.doc = String(parent.document.title); } catch { r.doc = 'blocked'; }
    return r;
  });
  expect(fromInside).toEqual({ ls: 'blocked', doc: 'blocked' });

  const before = await state(bank).evaluate(e => ({ text: e.textContent, attrs: [...e.attributes].map(a => [a.name, a.value]) }));
  const marked = await marks(bank).count();
  await bank.evaluate(() => new Promise<void>(done => {
    const fakes: unknown[] = [
      { input: 'FAKE', state: 'many', count: 99 },
      { type: 'result', input: 'FAKE', state: 'many', count: 99, matches: [0, 1, 2] },
      { type: 'loc-result', input: 'FAKE', state: 'many', count: 99 },
      JSON.stringify({ input: 'FAKE', state: 'many', count: 99 }),
      { id: 1, input: 'FAKE', state: 'none', count: 0, ok: true },
    ];
    window.addEventListener('message', () => { if (--left === 0) done(); });
    let left = fakes.length;
    for (const m of fakes) window.postMessage(m, '*');
  }));
  expect(await state(bank).evaluate(e => ({ text: e.textContent, attrs: [...e.attributes].map(a => [a.name, a.value]) }))).toEqual(before);
  await expect(marks(bank)).toHaveCount(marked);
});

// ---------------------------------------------------------------- tasks
test('tasks 1: choosing a task sets aria-pressed, keeps the typed text and checks it at once', async ({ bank }) => {
  await openOn(bank, 'signup');
  const t = taskById('signup-1');
  await typeLoc(bank, t.answer);
  await expect(verdict(bank)).toHaveText('');
  await expect(bank.getByRole('button', { name: 'Show an answer' })).toBeHidden();
  await taskBtn(bank, 'signup-1').click();
  await expect(taskBtn(bank, 'signup-1')).toHaveAttribute('aria-pressed', 'true');
  for (const o of tasksOf('signup').filter(x => x.id !== 'signup-1')) await expect(taskBtn(bank, o.id)).toHaveAttribute('aria-pressed', 'false');
  await expect(bank.locator('#loc-input')).toHaveValue(t.answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  await expect(bank.getByRole('button', { name: 'Show an answer' })).toBeVisible();
  await taskBtn(bank, 'signup-2').click();
  await expect(taskBtn(bank, 'signup-1')).toHaveAttribute('aria-pressed', 'false');
  await expect(taskBtn(bank, 'signup-2')).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.locator('#loc-input')).toHaveValue(t.answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'other');
});

test('tasks 2: pass, count (singular and plural, zero) and same count but other elements', async ({ bank }) => {
  await openOn(bank, 'signup');
  await taskBtn(bank, 'signup-1').click();
  const v = verdict(bank);
  await typeLoc(bank, taskById('signup-1').answer);
  await expect(v).toHaveAttribute('data-verdict', 'pass');
  await expect(v).toHaveText('Passed: your locator matches exactly what the task asks for.');
  // other elements, same count: the account button is one element, like the Email field
  const wrong = "getByRole('button', { name: 'Create account' })";
  expect(await sameSetOf(bank, wrong)).toBe(await sameSetOf(bank, taskById('signup-1').answer));
  await typeLoc(bank, wrong);
  await expect(v).toHaveAttribute('data-verdict', 'other');
  await expect(v).toHaveText('Not yet: your locator matches other elements than the task asks for.');
  // wrong count, plural
  const many = "getByRole('button')";
  const n = await sameSetOf(bank, many);
  expect(n).toBeGreaterThan(1);
  await typeLoc(bank, many);
  await expect(v).toHaveAttribute('data-verdict', 'count');
  await expect(v).toHaveText(`Not yet: your locator matches ${plural(n)}; the task wants 1 element.`);
  // zero matches is a count verdict
  await typeLoc(bank, "getByText('no such words anywhere')");
  await expect(v).toHaveAttribute('data-verdict', 'count');
  await expect(v).toHaveText('Not yet: your locator matches 0 elements; the task wants 1 element.');
  // task wanting 3: singular on the learner's side
  await taskBtn(bank, 'signup-3').click();
  const want = await sameSetOf(bank, taskById('signup-3').answer);
  await typeLoc(bank, "getByLabel('Email')");
  await expect(v).toHaveAttribute('data-verdict', 'count');
  await expect(v).toHaveText(`Not yet: your locator matches 1 element; the task wants ${plural(want)}.`);
  await typeLoc(bank, taskById('signup-3').answer);
  await expect(v).toHaveAttribute('data-verdict', 'pass');
});

test('tasks 2: the same elements reached another way pass; the first row is other elements', async ({ bank }) => {
  await openOn(bank, 'orders');
  await taskBtn(bank, 'orders-4').click();
  await typeLoc(bank, "getByRole('row').last()");
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  await typeLoc(bank, "getByRole('row').first()");
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'other');
});

test('tasks 2: no verdict for empty, unsupported and invalid text', async ({ bank }) => {
  await openOn(bank, 'signup');
  await taskBtn(bank, 'signup-1').click();
  await typeLoc(bank, taskById('signup-1').answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  for (const text of ['', '  ', 'foo()', "locator('button[')"]) {
    await typeLoc(bank, text);
    await expect(verdict(bank), JSON.stringify(text)).not.toHaveAttribute('data-verdict', /.*/);
    await expect(verdict(bank)).toHaveText('');
  }
});

test('tasks 3: a passed task shows class passed and ", passed" in its name, is saved, and survives a reload', async ({ bank }) => {
  await openOn(bank, 'signup');
  const t = taskById('signup-1');
  await taskBtn(bank, t.id).click();
  await typeLoc(bank, t.answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  const item = bank.locator('#loc-tasks > li, #loc-tasks li').filter({ has: bank.getByRole('button', { name: `${t.task}, passed`, exact: true }) });
  await expect(item).toHaveClass(/\bpassed\b/);
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(1);
  await expect.poll(async () => (await saved(bank)).locators).toEqual({ 'signup-1': 1 });
  await reload(bank);
  await openLoc(bank);
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(1);
  await expect(bank.getByRole('button', { name: `${t.task}, passed`, exact: true })).toBeVisible();
  await expect(bank.locator('#loc-tasks').getByRole('button', { name: taskById('signup-2').task, exact: true })).toBeVisible();
});

test('tasks 3: a wrong answer is not saved', async ({ bank }) => {
  await openOn(bank, 'signup');
  await taskBtn(bank, 'signup-1').click();
  await typeLoc(bank, "getByRole('button', { name: 'Create account' })");
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'other');
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(0);
  expect((await saved(bank)).locators ?? {}).toEqual({});
});

test('FM10 two tabs: passing a task in each keeps both (read before write)', async ({ bank, secondTab }) => {
  for (const p of [bank, secondTab]) await openOn(p, 'signup');
  await taskBtn(bank, 'signup-1').click();
  await typeLoc(bank, taskById('signup-1').answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  await expect.poll(async () => (await saved(bank)).locators).toEqual({ 'signup-1': 1 });
  await taskBtn(secondTab, 'signup-2').click();
  await typeLoc(secondTab, taskById('signup-2').answer);
  await expect(verdict(secondTab)).toHaveAttribute('data-verdict', 'pass');
  await expect.poll(async () => (await saved(bank)).locators).toEqual({ 'signup-1': 1, 'signup-2': 1 });
  await reload(bank);
  await openOn(bank, 'signup');
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(2);
});

test('tasks 4 FM10: progress from before phase 4 loads and shows no task as passed', async ({ open }) => {
  const page = await open({ seed: { 'qa-bank': JSON.stringify({ v: 2, known: { q0001: 1 }, shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null }) } });
  await openLoc(page);
  for (const p of info.pages) {
    await choosePage(page, p.id);
    await expect(page.locator('#loc-tasks .passed')).toHaveCount(0);
  }
});

test('tasks 5 FM11: Show an answer reveals the answer only; the box and the saved progress stay as they were', async ({ bank }) => {
  await openOn(bank, 'signup');
  const t = taskById('signup-2');
  await taskBtn(bank, t.id).click();
  await typeLoc(bank, "getByText('nothing')");
  await expect(bank.locator('#loc-answer')).not.toContainText(t.answer);
  await bank.getByRole('button', { name: 'Show an answer' }).click();
  await expect(bank.locator('#loc-answer')).toContainText(t.answer);
  await expect(bank.locator('#loc-input')).toHaveValue("getByText('nothing')");
  await expect(verdict(bank)).not.toHaveAttribute('data-verdict', 'pass');
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(0);
  expect((await saved(bank)).locators ?? {}).toEqual({});
  await reload(bank);
  await openLoc(bank);
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(0);
});

test('tasks 3: export carries the passed tasks; import takes them back', async ({ bank }) => {
  await openOn(bank, 'signup');
  await taskBtn(bank, 'signup-1').click();
  await typeLoc(bank, taskById('signup-1').answer);
  await expect(verdict(bank)).toHaveAttribute('data-verdict', 'pass');
  await expect.poll(async () => (await saved(bank)).locators).toEqual({ 'signup-1': 1 });
  await goTo(bank, 'home');
  const [download] = await Promise.all([bank.waitForEvent('download'), bank.locator('#export-btn').click()]);
  const file = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(file.progress.locators).toEqual({ 'signup-1': 1 });
  // import a file with two passed tasks into a page that has none
  await bank.evaluate(() => localStorage.removeItem('qa-bank'));
  await reload(bank);
  await bank.locator('#import-input').setInputFiles(importFile(exportFile(JSON.parse(JSON.stringify({ ...file.progress, locators: { 'signup-1': 1, 'shop-3': 1 } })))));
  await bank.locator('#import-yes').click();
  await expect(bank.locator('#import-msg')).toHaveAttribute('data-kind', 'ok');
  expect((await saved(bank)).locators).toEqual({ 'signup-1': 1, 'shop-3': 1 });
  await openOn(bank, 'shop');
  await expect(bank.locator('#loc-tasks .passed')).toHaveCount(1);
});

for (const [name, bad] of [['an array', []], ['a string', 'x'], ['a value that is not 1', { 'signup-1': 2 }], ['null', null]] as [string, unknown][]) {
  test(`FM10 import with locators as ${name} reports locators as a bad part and saves no bad value`, async ({ bank }) => {
    const msg = bank.locator('#import-msg');
    await bank.locator('#import-input').setInputFiles(importFile(exportFile({ v: 2, known: { q0002: 1 }, locators: bad })));
    await expect(bank.locator('#import-ask, #import-msg:not(:empty)').first()).toBeVisible();
    if (await bank.locator('#import-ask').isVisible()) await bank.locator('#import-yes').click();
    await expect(msg).toHaveText(/locators/i);
    const l = (await saved(bank)).locators;
    expect(l === undefined || (typeof l === 'object' && l !== null && !Array.isArray(l) && Object.values(l).every(v => v === 1))).toBe(true);
  });
}

// ---------------------------------------------------------------- packed parts
test('parts 2: only the Locators tab unpacks the trainer, once per page load', async ({ watched: page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __ds: number; DecompressionStream: typeof DecompressionStream };
    const D = w.DecompressionStream;
    w.__ds = 0;
    w.DecompressionStream = class extends D { constructor(f: CompressionFormat) { super(f); w.__ds++; } } as typeof DecompressionStream;
  });
  await load(page);
  const ds = () => page.evaluate(() => (window as unknown as { __ds: number }).__ds);
  const atHome = await ds();
  for (const [v, arg] of [['learn', '01-playwright'], ['setup', undefined], ['review', undefined], ['home', undefined]] as const) {
    await goTo(page, v, arg);
    expect(await ds(), `${v} unpacks nothing more`).toBe(atHome);
  }
  await openLoc(page);
  const afterLoc = await ds();
  expect(afterLoc, 'the Locators tab unpacks its parts').toBeGreaterThan(atHome);
  await choosePage(page, 'shop');
  await typeLoc(page, "getByTestId('order-total')");
  await goTo(page, 'home');
  await openLoc(page);
  await choosePage(page, 'orders');
  expect(await ds(), 'the parts unpack once').toBe(afterLoc);
});

for (const part of ['pwi', 'frozen']) {
  test(`FM13 part ${part} cannot be unpacked: the alert shows, no page error`, async ({ watched: page }) => {
    await corruptParts(page, [part]);
    await load(page);
    await goTo(page, 'learn', '01-playwright'); await page.locator('#drill-open').click();
    await expect(page.locator('#locators').getByRole('alert')).toHaveText(MSG.unpack);
    await goTo(page, 'home');
    await expect(page.locator('#locators')).toBeHidden();
  });
}

test('FM13 no DecompressionStream: the alert shows, no page error', async ({ watched: page }) => {
  await page.addInitScript(() => {
    try { delete (window as unknown as Record<string, unknown>).DecompressionStream; } catch { /* keep going */ }
    (window as unknown as Record<string, unknown>).DecompressionStream = undefined;
  });
  await page.goto(PAGE_URL);
  // Phase 6: no header tab; without DecompressionStream the page cannot boot, so the drill is opened directly.
  await page.evaluate(() => (window as unknown as { go: (v: string) => void }).go('locators'));
  await expect(page.locator('#locators').getByRole('alert')).toHaveText(MSG.unpack);
});

// Design review 2026-11-28: at 390 px the box scrolled a typical locator sideways and hid its first letter.
test('drill: a typical 37-character locator fits the Locator box without scrolling', { tag: '@narrow' }, async ({ bank }) => {
  await openOn(bank, 'billing-details');
  await typeLoc(bank, "getByRole('radio', { checked: true })");
  await bank.locator('#loc-input').evaluate(e => { (e as HTMLInputElement).setSelectionRange(0, 0); });
  expect(await bank.locator('#loc-input').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
});
