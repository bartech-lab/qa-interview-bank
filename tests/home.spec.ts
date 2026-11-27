import { test, expect, ymd, addDays, bankData, goTo, progress, marks, ratingButton, type Q } from './fixtures';
import type { Page } from '@playwright/test';

// Fixed local "today" for every clocked test: 2026-01-15 12:00.
const NOW = new Date(2026, 0, 15, 12, 0);
const D = (n: number) => ymd(addDays(NOW, n));
const BOX_KEY = 'qa-bank';

// Seeded order is deliberately not bank order and spreads over the whole bank.
const PERM = [7, 2, 9, 0, 5, 3, 8, 1, 6, 4];
async function pick(page: Page, n = 10): Promise<{ bank: Q[]; ids: string[] }> {
  const bank = await bankData(page);
  const step = Math.floor(bank.length / n);
  const ids = PERM.filter(v => v < n).map(i => bank[i * step].id);
  return { bank, ids };
}
// Opens an empty page first (to read the bank), then seeds and reloads.
async function openWith(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, build: (bank: Q[], ids: string[]) => Record<string, unknown>, n = 10) {
  const page = await open({ time: NOW });
  const { bank, ids } = await pick(page, n);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress(build(bank, ids))]);
  await page.reload();
  return { page, bank, ids };
}
const done = (id: string) => ({ box: 0, last: D(0), due: D(1) });
const norm = (s: string) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
const byId = (bank: Q[], id: string) => bank.find(q => q.id === id)!;

// The question the quiz shows now: the longest bank question text found in the page text.
async function asked(page: Page, bank: Q[]): Promise<string | undefined> {
  const text = norm(await page.locator('body').innerText());
  return bank.filter(q => text.includes(norm(q.q))).sort((a, b) => b.q.length - a.q.length)[0]?.id;
}
async function askAll(page: Page, bank: Q[], count: number): Promise<(string | undefined)[]> {
  const seen: (string | undefined)[] = [];
  for (let i = 0; i < count; i++) {
    const show = page.getByRole('button', { name: /Show answer/ });
    await expect(show).toBeVisible();
    seen.push(await asked(page, bank));
    await show.click();
    await ratingButton(page, 'known').click();
  }
  return seen;
}

// ---- 1. Mix order ----
test('#mix-start asks the whole mix in exactly mix.ids order', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({ mix: { day: D(0), ids }, mixSize: 10 }));
  await page.locator('#mix-start').click();
  expect(await askAll(page, bank, ids.length)).toEqual(ids);
  await expect(page.getByRole('button', { name: /Show answer/ })).toHaveCount(0);
  expect(ids.map(i => byId(bank, i).file), 'seeded ids must not already be in bank order').not.toEqual(ids.map(i => byId(bank, i).file).sort());
});

test('#mix-start skips questions done today and keeps the order of the rest', async ({ open }) => {
  const doneIdx = [1, 4, 5];
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({
    known: marks(doneIdx.map(i => ids[i])),
    srs: Object.fromEntries(doneIdx.map(i => [ids[i], { ...done(ids[i]), box: 1 }])),
    mix: { day: D(0), ids }, mixSize: 10,
  }));
  await expect(page.locator('#mix-progress')).toHaveText('3 / 10 done today');
  await page.locator('#mix-start').click();
  const rest = ids.filter((_, i) => !doneIdx.includes(i));
  expect(await askAll(page, bank, rest.length)).toEqual(rest);
  await expect(page.getByRole('button', { name: /Show answer/ })).toHaveCount(0);
});

// ---- 3. Mix card ----
// The short topic name the page uses (q.topic in the data is a long description): the option text of #rq-topic for that file.
// The options exist once the Review view has rendered; this visits it and returns to home.
const topicName = async (page: Page, file: string) => {
  await goTo(page, 'review');
  const t = await page.locator(`#rq-topic option[value="${file}"]`).evaluate(o => o.textContent ?? '');
  await goTo(page, 'home');
  return norm(t).replace(/^\P{L}+/u, '').replace(/\s*\(\d+\)$/, '');
};
const cardShows = async (page: Page, q: Q) => {
  const text = norm(await page.locator('#mix-card').innerText());
  expect(text).toContain(norm(q.q));
  expect(text).toContain(await topicName(page, q.file));
};

test('#mix-card shows the first mix question that is not done, with its topic name', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({ mix: { day: D(0), ids }, mixSize: 10 }));
  await cardShows(page, byId(bank, ids[0]));
  expect(norm(await page.locator('#mix-card').innerText())).not.toContain(norm(byId(bank, ids[1]).q));
});

test('#mix-card skips a first question that is done today', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({
    known: marks([ids[0], ids[1]]), srs: { [ids[0]]: done(ids[0]), [ids[1]]: done(ids[1]) },
    mix: { day: D(0), ids }, mixSize: 10,
  }));
  await cardShows(page, byId(bank, ids[2]));
  const text = norm(await page.locator('#mix-card').innerText());
  expect(text).not.toContain(norm(byId(bank, ids[0]).q));
  expect(text).not.toContain(norm(byId(bank, ids[1]).q));
});

test('#mix-card moves to the next mix question after rating the first one', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({ mix: { day: D(0), ids }, mixSize: 10 }));
  await page.locator('#mix-start').click();
  await page.getByRole('button', { name: /Show answer/ }).click();
  await ratingButton(page, 'known').click();
  await goTo(page, 'home');
  await cardShows(page, byId(bank, ids[1]));
  expect(norm(await page.locator('#mix-card').innerText())).not.toContain(norm(byId(bank, ids[0]).q));
});

test('#mix-card shows no mix question text when every mix question is done', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({
    known: marks(ids), srs: Object.fromEntries(ids.map(i => [i, done(i)])), mix: { day: D(0), ids }, mixSize: 10,
  }));
  await expect(page.locator('#mix-progress')).toHaveText('10 / 10 done today');
  const text = norm(await page.locator('#mix-card').innerText());
  for (const id of ids) expect(text, id).not.toContain(norm(byId(bank, id).q));
});

// ---- 4. Mix intro ----
const intro = (page: Page) => expect(page.locator('#mix-intro'));
for (const size of [5, 10]) {
  test(`#mix-intro with no progress names the mix size (${size})`, async ({ open }) => {
    const { page } = await openWith(open, (_b, ids) => ({ mix: { day: D(0), ids }, mixSize: size }), size);
    await intro(page).toHaveText(`Today's ${size} questions are Core questions, taken from the topics in turn.`);
  });
}
test('#mix-intro with no progress follows the size chosen in #mix-size', async ({ open }) => {
  const page = await open({ time: NOW });
  await page.locator('#mix-size').selectOption('5');
  await intro(page).toHaveText("Today's 5 questions are Core questions, taken from the topics in turn.");
  await page.locator('#mix-size').selectOption('20');
  await intro(page).toHaveText("Today's 20 questions are Core questions, taken from the topics in turn.");
});
test('#mix-intro when every mix question is done', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({
    known: marks(ids), srs: Object.fromEntries(ids.map(i => [i, done(i)])), mix: { day: D(0), ids }, mixSize: 5,
  }), 5);
  await intro(page).toHaveText("Today's mix is done. A new one is ready tomorrow.");
});
test('#mix-intro for an empty mix', async ({ open }) => {
  const { page } = await openWith(open, () => ({ mix: { day: D(0), ids: [] }, mixSize: 5 }), 5);
  await intro(page).toHaveText("Today's mix is done. A new one is ready tomorrow.");
});
test('#mix-intro for an empty mix with other progress saved', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({ known: marks([ids[0]]), mix: { day: D(0), ids: [] }, mixSize: 5 }), 5);
  await intro(page).toHaveText("Today's mix is done. A new one is ready tomorrow.");
});
test('#mix-intro when the rest holds questions to review and new ones (done ones do not count)', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({
    shaky: marks([ids[0]]), known: marks([ids[3]]), srs: { [ids[3]]: done(ids[3]) },
    mix: { day: D(0), ids: ids.slice(0, 4) }, mixSize: 5,
  }), 5);
  await intro(page).toHaveText("Today's mix starts with questions to review, then new ones.");
});
test('#mix-intro when the rest holds only questions to review (a new one is already done)', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({
    shaky: marks([ids[0]]), known: marks([ids[1], ids[2]]),
    srs: { [ids[1]]: { box: 1, last: D(-3), due: D(-1) }, [ids[2]]: done(ids[2]) },
    mix: { day: D(0), ids: ids.slice(0, 3) }, mixSize: 5,
  }), 5);
  await intro(page).toHaveText("Today's mix is questions to review.");
});
test('#mix-intro when the rest holds only new questions, even with progress elsewhere', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({
    known: marks([ids[0], ids[4]]), srs: { [ids[0]]: done(ids[0]) },
    mix: { day: D(0), ids: ids.slice(0, 4) }, mixSize: 5,
  }), 5);
  await intro(page).toHaveText("Today's mix is new questions, taken from the topics in turn.");
});

// ---- 5. No due count on home ----
test('home repeats no due count; the Review badge holds it', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => ({
    known: marks(ids.slice(0, 3)),
    srs: Object.fromEntries(ids.slice(0, 3).map(i => [i, { box: 1, last: D(-5), due: D(-1) }])),
  }));
  await expect(page.locator('#tab-review .badge')).toHaveText('3');
  await expect(page.locator('#home #due-count')).toHaveCount(0);
  await expect(page.locator('#home')).not.toHaveText(/due for review/i);
});

// ---- 6. Document order ----
test('#today is the first element in #home and #mix-start is its first button', async ({ open }) => {
  const page = await open({ time: NOW });
  await expect(page.locator('#home')).toBeVisible();
  expect(await page.locator('#home').evaluate(h => h.firstElementChild?.id)).toBe('today');
  expect(await page.locator('#home').evaluate(h => h.querySelector('button')?.id)).toBe('mix-start');
});

// ---- 7. Topics ----
test('12 topic buttons in bank order show the name and K / N, and open Learn for that topic', async ({ open }) => {
  const page = await open({ time: NOW });
  const bank = await bankData(page);
  const files = [...new Set(bank.map(q => q.file))];
  const inFile = (f: string) => bank.filter(q => q.file === f);
  const knownIds = [...inFile(files[0]).slice(0, 3), ...inFile(files[5]).slice(0, 2)].map(q => q.id);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({ known: marks(knownIds) })]);
  await page.reload();
  expect(files).toHaveLength(12);
  const topics = page.locator('.topic');
  await expect(topics).toHaveCount(12);
  for (let i = 0; i < 12; i++) {
    const qs = inFile(files[i]);
    const k = knownIds.filter(id => qs.some(q => q.id === id)).length;
    const text = norm(await topics.nth(i).innerText());
    expect(text, `topic ${i}`).toContain(await topicName(page, files[i]));
    expect(text, `topic ${i}`).toMatch(new RegExp(`(^|\\s)${k} / ${qs.length}(\\s|$)`));
  }
  await topics.nth(2).click();
  const qs = inFile(files[2]);
  await expect(page.locator('body')).toContainText(norm(qs[0].q).slice(0, 60));
  const text = norm(await page.locator('body').innerText());
  expect(text).not.toContain(norm(inFile(files[0])[0].q));
  expect(await asked(page, bank).then(id => id && byId(bank, id).file)).toBe(files[2]);
});

// ---- 8. Contrast of grey text ----
const bgBehind = (page: Page, selector: string) => page.locator(selector).first().evaluate(el => {
  const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = (c: number[]) => {
    const [r, g, b] = c.slice(0, 3).map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  let bg = [255, 255, 255];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = rgba(getComputedStyle(n).backgroundColor);
    if (c.length >= 3 && (c.length === 3 || c[3] > 0)) { bg = c; break; }
  }
  const a = lum(rgba(getComputedStyle(el).color)), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
});
const themes: [string, string | null, 'light' | 'dark'][] = [
  ['Light', 'light', 'dark'], ['Dark', 'dark', 'light'], ['Auto with a dark system', null, 'dark'], ['Auto with a light system', null, 'light'],
];
for (const [name, choice, system] of themes) {
  test(`contrast: #exam-line and the K / N count reach 4.5:1 in ${name}`, async ({ open }) => {
    const seed: Record<string, string> = { [BOX_KEY]: progress({ known: marks(['q0001', 'q0002']) }) };
    if (choice) seed['qa-bank-theme'] = choice;
    const page = await open({ time: NOW, seed });
    await page.emulateMedia({ colorScheme: system });
    await expect(page.locator('#exam-line')).toBeVisible();
    // The smallest element in the first topic whose own text is "K / N".
    const marked = await page.locator('.topic').first().evaluate(t => {
      const el = [...t.querySelectorAll('*')].find(e => !e.children.length && /^\d+ \/ \d+$/.test((e.textContent ?? '').trim()));
      if (!el) return false;
      el.setAttribute('data-kn', '1');
      return true;
    });
    expect(marked, 'no element inside .topic holds just "K / N"').toBe(true);
    for (const sel of ['#exam-line', '.topic [data-kn]']) {
      expect(await bgBehind(page, sel), `${sel} in ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

// ---- 9. Narrow screen ----
test('at 390 px home fits and #mix-start is on the first screen', { tag: '@narrow' }, async ({ open, page, fitsScreen }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open({ time: NOW, seed: { [BOX_KEY]: progress({ known: marks(['q0001', 'q0002', 'q0003']) }) } });
  await expect(page.locator('#mix-card')).toBeVisible();
  await expect(page.locator('#mix-start')).toBeVisible();
  await fitsScreen();
  const box = await page.locator('#mix-start').boundingBox();
  expect(box!.y + box!.height, 'bottom of #mix-start').toBeLessThanOrEqual(844);
});
