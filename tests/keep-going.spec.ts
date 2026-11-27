import { test, expect, ymd, addDays, bankData, goTo, progress, marks, ratingButton, openQuestion, type Q, reload } from './fixtures';
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
async function openWith(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, build: (bank: Q[], ids: string[]) => Record<string, unknown>, n = 5) {
  const page = await open({ time: NOW });
  const { bank, ids } = await pick(page, n);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress(build(bank, ids))]);
  await reload(page);
  return { page, bank, ids };
}
const done = (_id: string) => ({ box: 0, last: D(0), due: D(1) });
const norm = (s: string) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
const byId = (bank: Q[], id: string) => bank.find(q => q.id === id)!;
// Questions that are not in the mix, in bank order.
const outside = (bank: Q[], ids: string[]) => bank.filter(q => !ids.includes(q.id)).map(q => q.id);
// A state where the mix (5 questions) is finished today and nothing else was rated.
const mixDone = (ids: string[]) => ({
  known: marks(ids), srs: Object.fromEntries(ids.map(i => [i, done(i)])), mix: { day: D(0), ids }, mixSize: 5,
});

async function asked(page: Page, bank: Q[]): Promise<string | undefined> {
  const text = norm(await page.locator('body').innerText());
  return bank.filter(q => text.includes(norm(q.q))).sort((a, b) => b.q.length - a.q.length)[0]?.id;
}
// Asks `count` questions, rating each one as given; returns the ids in the order asked.
async function askAll(page: Page, bank: Q[], count: number, how: 'missed' | 'shaky' | 'known' = 'known'): Promise<(string | undefined)[]> {
  const seen: (string | undefined)[] = [];
  for (let i = 0; i < count; i++) {
    const show = page.getByRole('button', { name: /Show answer/ });
    await expect(show).toBeVisible();
    seen.push(await asked(page, bank));
    await show.click();
    await ratingButton(page, how).click();
  }
  return seen;
}
const start = (page: Page) => page.locator('#mix-start');

test('with the mix done, #mix-start reads "Keep going" and asks a question outside the mix', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => mixDone(ids));
  await expect(start(page)).toBeEnabled();
  await expect(start(page)).toHaveText('Keep going');
  await start(page).click();
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  const id = await asked(page, bank);
  expect(id, 'a question must be on screen').toBeDefined();
  expect(ids).not.toContain(id);
});

test('Keep going asks due (oldest due first), then shaky, then missed (bank order), skipping the mix', async ({ open }) => {
  let expected: string[] = [];
  const { page, bank } = await openWith(open, (b, ids) => {
    const pool = outside(b, ids);
    // Due ones sit late in the bank, shaky early and missed in between, so bank order alone gives a different sequence.
    const due = [[pool[50], -1], [pool[40], -5], [pool[45], -3]] as const;
    const shaky = [pool[8], pool[3]];
    const missed = [pool[30], pool[15]];
    expected = [pool[40], pool[45], pool[50], pool[3], pool[8], pool[15], pool[30]];
    return {
      ...mixDone(ids),
      known: { ...marks(ids), ...marks(due.map(d => d[0])) },
      srs: { ...Object.fromEntries(ids.map(i => [i, done(i)])), ...Object.fromEntries(due.map(([id, n]) => [id, { box: 1, last: D(n - 3), due: D(n) }])) },
      shaky: marks(shaky), missed: marks(missed),
    };
  });
  await start(page).click();
  expect(await askAll(page, bank, expected.length)).toEqual(expected);
});

test('Keep going never repeats a question in the round and skips a question rated today', async ({ open }) => {
  let ratedToday = '', s1 = '', s2 = '';
  const { page, bank } = await openWith(open, (b, ids) => {
    const pool = outside(b, ids);
    [ratedToday, s1, s2] = [pool[2], pool[6], pool[9]];
    return {
      ...mixDone(ids),
      shaky: marks([ratedToday, s1, s2]),
      srs: { ...mixDone(ids).srs, [ratedToday]: { box: 0, last: D(0), due: D(1) } },
    };
  });
  await start(page).click();
  // Rating "Didn't know" keeps a question in the missed list, so a naive picker would ask it again.
  const seen = await askAll(page, bank, 6, 'missed');
  expect(new Set(seen).size, 'no repeats').toBe(6);
  expect(seen).not.toContain(ratedToday);
  expect(seen.slice(0, 2)).toEqual([s1, s2]);
});

test('Keep going has no count: after more answers than the daily goal it still asks', async ({ open }) => {
  const { page, bank } = await openWith(open, (_b, ids) => mixDone(ids));
  await start(page).click();
  const seen = await askAll(page, bank, 8);
  expect(new Set(seen).size).toBe(8);
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
});

test('the Keep going header shows no "N / total" count on the first question or after answers', async ({ open }) => {
  const { page, bank } = await openWith(open, (_b, ids) => mixDone(ids));
  await start(page).click();
  const text = async () => {
    const q = byId(bank, (await asked(page, bank))!);
    return norm(await page.locator('#quiz').innerText()).replace(norm(q.q), '');
  };
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  expect(await text()).not.toMatch(/\b\d+ \/ \d+\b/);
  await askAll(page, bank, 3);
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  expect(await text()).not.toMatch(/\b\d+ \/ \d+\b/);
});

test('End stops Keep going: the quiz is left and no further question is asked', async ({ open }) => {
  const { page, bank } = await openWith(open, (_b, ids) => mixDone(ids));
  await start(page).click();
  await askAll(page, bank, 2);
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await page.getByRole('button', { name: /^End/ }).click();
  await expect(page.getByRole('button', { name: /Show answer/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^End/ })).toHaveCount(0);
});

test('#mix-extra reads "plus N more" with the number answered in Keep going', async ({ open }) => {
  const { page, bank } = await openWith(open, (_b, ids) => mixDone(ids));
  await start(page).click();
  await askAll(page, bank, 3);
  await page.getByRole('button', { name: /^End/ }).click();
  await goTo(page, 'home');
  await expect(page.locator('#mix-extra')).toHaveText('plus 3 more');
});

test('#mix-extra is hidden when only mix questions were rated today', async ({ open }) => {
  const { page } = await openWith(open, (_b, ids) => mixDone(ids));
  await expect(page.locator('#mix-progress')).toHaveText('5 / 5 done today');
  await expect(page.locator('#mix-extra')).toBeHidden();
});

test('#mix-extra counts "Mark as known" in Learn on a question outside the mix', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => mixDone(ids));
  const target = outside(bank, ids)[20];
  await openQuestion(page, target);
  await page.locator('.known-btn').click();
  await goTo(page, 'home');
  await expect(page.locator('#mix-extra')).toHaveText('plus 1 more');
});

test('a daily-mix round that finishes the mix ends on a summary with a Keep going button that asks outside the mix', async ({ open }) => {
  const { page, bank, ids } = await openWith(open, (_b, ids) => ({
    known: marks(ids.slice(0, 4)), srs: Object.fromEntries(ids.slice(0, 4).map(i => [i, done(i)])), mix: { day: D(0), ids }, mixSize: 5,
  }));
  await expect(start(page)).toHaveText(/^(?!Keep going)/);
  await start(page).click();
  await askAll(page, bank, 1);
  await expect(page.getByRole('button', { name: /Show answer/ })).toHaveCount(0);
  const more = page.getByRole('button', { name: 'Keep going', exact: true });
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
  expect(ids).not.toContain(await asked(page, bank));
});

// Every bank question known, not due, not rated today; mix questions rated today (or an empty mix).
for (const emptyMix of [false, true]) {
  test(`nothing left today (${emptyMix ? 'empty mix' : 'mix done'}): button disabled, intro and card say so`, async ({ open }) => {
    const { page, bank } = await openWith(open, (b, ids) => {
      const mixIds = emptyMix ? [] : ids;
      const rest = b.filter(q => !mixIds.includes(q.id)).map(q => q.id);
      return {
        known: marks(b.map(q => q.id)),
        srs: { ...Object.fromEntries(mixIds.map(i => [i, done(i)])), ...Object.fromEntries(rest.map(i => [i, { box: 2, last: D(-2), due: D(5) }])) },
        mix: { day: D(0), ids: mixIds }, mixSize: 5,
      };
    });
    await expect(start(page)).toBeDisabled();
    await expect(start(page)).toHaveText('Nothing left today');
    await expect(page.locator('#mix-intro')).toHaveText('Nothing left today. A new mix is ready tomorrow.');
    const card = norm(await page.locator('#mix-card').innerText());
    expect(bank.filter(q => card.includes(norm(q.q))).map(q => q.id), 'question texts in #mix-card').toEqual([]);
  });
}

for (const emptyMix of [false, true]) {
  test(`#mix-intro reaches the goal sentence and #mix-card shows the question Keep going asks first (${emptyMix ? 'empty mix' : 'mix done'})`, async ({ open }) => {
    let first = '';
    const { page, bank } = await openWith(open, (b, ids) => {
      const pool = outside(b, ids);
      first = pool[40];
      const base = mixDone(ids);
      // One due question outside the mix, late in the bank: it must come first, ahead of the unseen Core questions.
      return {
        ...base,
        ...(emptyMix ? { mix: { day: D(0), ids: [] }, known: { [first]: 1 }, srs: {} } : { known: { ...base.known, [first]: 1 } }),
        srs: { ...(emptyMix ? {} : base.srs), [first]: { box: 1, last: D(-6), due: D(-2) } },
      };
    });
    await expect(page.locator('#mix-intro')).toHaveText("You reached today's goal. Keep going for more, or stop here.");
    const card = norm(await page.locator('#mix-card').innerText());
    expect(card).toContain(norm(byId(bank, first).q));
    await start(page).click();
    await expect(page.getByRole('button', { name: /Show answer/ })).toBeVisible();
    expect(await asked(page, bank)).toBe(first);
  });
}

test('select#mix-size has the accessible name "Daily goal"', async ({ open }) => {
  const page = await open({ time: NOW });
  await expect(page.getByRole('combobox', { name: 'Daily goal', exact: true })).toHaveId('mix-size');
});
