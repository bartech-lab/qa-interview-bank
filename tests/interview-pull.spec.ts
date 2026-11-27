import {
  test, expect, ymd, addDays, saved, bankData, goTo, openQuestion, progress, marks, quizThese, rateOne, reload } from './fixtures';
import type { Page } from '@playwright/test';

// Written from docs/phase2-spec.md ("Interview date": pulling reviews forward) only.
const NOW = new Date(2026, 0, 15, 12, 0);
const D = (n: number) => ymd(addDays(NOW, n));
const KEY = 'qa-bank';

type Entry = { box: number; last: string; due: string; was?: unknown };
type Srs = Record<string, Entry>;

const ids = async (page: Page) => (await bankData(page)).map(q => q.id);
const lineFor = (n: number | null) =>
  n === null ? 'No interview date set' : n < 0 ? 'The interview date has passed'
    : n === 0 ? 'Interview today' : n === 1 ? 'Interview tomorrow' : `Interview in ${n} days`;

// A person types the date, then we wait for the visible line and for storage to hold the date.
async function setExam(page: Page, n: number) {
  await page.locator('#exam-date').fill(D(n));
  await expect(page.locator('#exam-line')).toHaveText(lineFor(n));
  await expect.poll(async () => (await saved(page)).exam).toBe(D(n));
}
async function clearExam(page: Page) {
  await page.locator('#exam-clear').click();
  await expect(page.locator('#exam-line')).toHaveText(lineFor(null));
  await expect.poll(async () => (await saved(page)).exam ?? null).toBeNull();
}
const srsOf = async (page: Page): Promise<Srs> => (await saved(page)).srs;

// Seeds progress (marks for every real id, plus the entries) and opens the page on NOW.
// Entries are inserted in reverse so that "bank order" cannot be mistaken for storage order.
async function openWith(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, srs: Srs, extra: Record<string, unknown> = {}) {
  const probe = await open({ time: NOW });
  const bankIds = new Set(await ids(probe));
  const reversed: Srs = {};
  for (const id of Object.keys(srs).reverse()) reversed[id] = srs[id];
  const known = marks(Object.keys(srs).filter(i => bankIds.has(i)));
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, progress({ known, srs: reversed, ...extra })]);
  await reload(probe);
  return probe;
}
const e = (due: number | string, box = 2, last = -5): Entry => ({ box, last: D(last), due: typeof due === 'number' ? D(due) : due });

// The rule from the spec, as a model: undo the old pull, then pull for exam offset n (null = none).
function model(seed: Srs, order: string[], n: number | null): Srs {
  const out: Srs = {};
  for (const [id, v] of Object.entries(seed)) {
    const { was, ...rest } = v;
    const valid = typeof was === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(was) && ymd(new Date(+was.slice(0, 4), +was.slice(5, 7) - 1, +was.slice(8))) === was;
    out[id] = valid ? { ...rest, due: was as string } : { ...rest };
  }
  if (n !== null && n >= 2) {
    const N = n - 1;
    let i = 0;
    for (const id of order) {
      const v = out[id];
      if (v && v.due > D(n - 1)) { v.was = v.due; v.due = D(1 + (i % N)); i++; }
    }
  }
  return out;
}

test('pull: interview in 10 days moves only entries due after exam minus 1, in bank order, keeping box and last', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  const seed: Srs = {
    [a[0]]: e(9, 1, -1),    // E-1: stays
    [a[1]]: e(40, 3, -2),   // moves, first in bank order -> tomorrow
    [a[2]]: e(0, 0, -7),    // due today: stays
    [a[3]]: e(10, 4, -3),   // due on E: moves -> day after tomorrow
    [a[4]]: e(-3, 2, -9),   // overdue: stays
    [a[5]]: e(11, 1, -4),   // moves -> D(3)
    [a[6]]: e(2, 0, -1),    // due early: stays
  };
  const page = await openWith(open, seed);
  await setExam(page, 10);
  const s = await srsOf(page);
  expect(s[a[0]]).toEqual(seed[a[0]]);
  expect(s[a[1]]).toEqual({ box: 3, last: D(-2), due: D(1), was: D(40) });
  expect(s[a[2]]).toEqual(seed[a[2]]);
  expect(s[a[3]]).toEqual({ box: 4, last: D(-3), due: D(2), was: D(10) });
  expect(s[a[4]]).toEqual(seed[a[4]]);
  expect(s[a[5]]).toEqual({ box: 1, last: D(-4), due: D(3), was: D(11) });
  expect(s[a[6]]).toEqual(seed[a[6]]);
});

test('pull: more entries than days spread over tomorrow..E-1 and wrap (i mod N)', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  const seed: Srs = {};
  for (let i = 0; i < 20; i++) seed[a[i]] = e(60 + i);
  const page = await openWith(open, seed);
  await setExam(page, 10); // N = 9
  const s = await srsOf(page);
  const days = new Set<string>();
  for (let i = 0; i < 20; i++) {
    expect(s[a[i]].due, `entry ${i}`).toBe(D(1 + (i % 9)));
    expect(s[a[i]].was).toBe(D(60 + i));
    expect(s[a[i]].due >= D(1) && s[a[i]].due <= D(9)).toBe(true);
    days.add(s[a[i]].due);
  }
  expect(days.size).toBe(9);
});

for (const [n, expected] of [[2, [1, 1, 1, 1]], [3, [1, 2, 1, 2]], [4, [1, 2, 3, 1]]] as [number, number[]][]) {
  test(`pull: interview in ${n} days gives N = ${n - 1} spread day(s)`, async ({ open }) => {
    const probe = await open({ time: NOW });
    const a = await ids(probe);
    const seed: Srs = { [a[0]]: e(30), [a[1]]: e(31), [a[2]]: e(32), [a[3]]: e(33) };
    const page = await openWith(open, seed);
    await setExam(page, n);
    const s = await srsOf(page);
    expect(Object.values(seed).map((_, i) => s[a[i]].due)).toEqual(expected.map(D));
  });
}

for (const n of [1, 0, -4]) {
  test(`pull: interview ${n === 1 ? 'tomorrow' : n === 0 ? 'today' : 'in the past'} moves nothing and adds no was`, async ({ open }) => {
    const probe = await open({ time: NOW });
    const a = await ids(probe);
    const seed: Srs = { [a[0]]: e(30), [a[1]]: e(5), [a[2]]: e(60, 4), [a[3]]: e(-2, 0) };
    const page = await openWith(open, seed);
    await setExam(page, n);
    expect(await srsOf(page)).toEqual(seed);
  });
}

test('pull: clearing the date gives every pulled entry its old due back and removes was', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  const seed: Srs = { [a[0]]: e(30, 3), [a[1]]: e(5, 1), [a[2]]: e(20, 2), [a[3]]: e(-1, 0), [a[4]]: e(45, 4) };
  const page = await openWith(open, seed);
  await setExam(page, 10);
  const pulled = await srsOf(page);
  expect(pulled[a[0]].was).toBe(D(30)); // the pull really happened
  await clearExam(page);
  expect(await srsOf(page)).toEqual(seed);
});

test('pull: 10 days, then 5, then 20 equals setting 20 directly (entries move back out)', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  const seed: Srs = {
    [a[0]]: e(3), [a[1]]: e(8, 1), [a[2]]: e(15, 2), [a[3]]: e(30, 3), [a[4]]: e(60, 4),
    [a[5]]: e(0, 0), [a[6]]: e(-2, 1), [a[7]]: e(19, 2), [a[8]]: e(25, 3),
  };
  const page = await openWith(open, seed);
  await setExam(page, 10);
  expect(await srsOf(page)).toEqual(model(seed, a, 10));
  await setExam(page, 5);
  expect(await srsOf(page)).toEqual(model(seed, a, 5));
  await setExam(page, 20);
  const final = await srsOf(page);
  expect(final).toEqual(model(seed, a, 20));
  // the entry due in 8 days was pulled for 5 days, and must be back at 8 (not pulled, 8 <= 19)
  expect(final[a[1]]).toEqual(seed[a[1]]);
});

test('pull: a was that is not a valid day is removed and never used as due', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  for (const n of [10, 0]) {
    const seed: Srs = {
      [a[0]]: { ...e(5), was: 'soon' },
      [a[1]]: { ...e(6), was: '2026-02-30' },
      [a[2]]: { ...e(7), was: '2026-13-01' },
      [a[3]]: { ...e(40), was: 'later' },     // invalid was, but due is after E-1: pulled afterwards
      [a[4]]: { ...e(8), was: D(50) },        // valid was: restored, then pulled again if n = 10
    };
    const page = await openWith(open, seed);
    await setExam(page, n);
    const s = await srsOf(page);
    expect(s, `exam in ${n} days`).toEqual(model(seed, a, n));
    for (const i of [0, 1, 2]) {
      expect(s[a[i]]).toEqual({ box: 2, last: D(-5), due: D(5 + i) });
    }
    if (n === 0) expect(s[a[3]]).toEqual({ box: 2, last: D(-5), due: D(40) });
    else expect(s[a[3]]).toEqual({ box: 2, last: D(-5), due: D(1), was: D(40) });
  }
});

test('pull: an entry whose id is not in the bank is not pulled and takes no place in the spread', async ({ open }) => {
  const probe = await open({ time: NOW });
  const a = await ids(probe);
  const seed: Srs = { 'zz-unknown': e(40, 3), [a[0]]: e(30), [a[1]]: e(31) };
  const page = await openWith(open, seed);
  await setExam(page, 10);
  const s = await srsOf(page);
  expect(s['zz-unknown']).toEqual(seed['zz-unknown']);
  expect(s[a[0]].due).toBe(D(1));
  expect(s[a[1]].due).toBe(D(2));
});

test('pull: rating a pulled question in a quiz replaces its entry, so it has no was', async ({ open }) => {
  const seed: Srs = { q0001: e(30, 3) };
  const page = await open({ time: NOW, seed: { [KEY]: progress({ notes: { q0001: 'n' }, known: marks(['q0001']), srs: seed }) } });
  await setExam(page, 10);
  expect((await srsOf(page)).q0001).toEqual({ box: 3, last: D(-5), due: D(1), was: D(30) });
  await goTo(page, 'review');
  await expect(quizThese(page)).toHaveText(/Quiz these 1/);
  await quizThese(page).click();
  await rateOne(page, 'known');
  await expect.poll(async () => (await srsOf(page)).q0001.box).toBe(4);
  expect((await srsOf(page)).q0001).toEqual({ box: 4, last: D(0), due: D(9) });
});

test('two tabs: stale tab B sets the date after tab A rated; the pull uses storage as B re-read it and keeps A\'s rating', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  const today = new Date();
  const T = (n: number) => ymd(addDays(today, n));
  const srs: Srs = {
    [all[0]]: { box: 1, last: T(-5), due: T(40) },
    [all[1]]: { box: 2, last: T(-5), due: T(41) },
    [all[2]]: { box: 3, last: T(-5), due: T(42) },
    [all[3]]: { box: 1, last: T(-5), due: T(2) },
  };
  await a.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, progress({ known: marks(Object.keys(srs)), srs })]);
  await reload(a);
  await reload(b);
  // A rates all[0] "Shaky" (it is marked known, so this is one box down: box 1 -> 0, due tomorrow).
  await openQuestion(a, all[0]);
  await a.locator('.shaky-btn').click();
  await expect.poll(async () => (await saved(a)).srs[all[0]]?.box).toBe(0);
  const afterA = (await saved(a)).srs[all[0]] as Entry;
  // B is stale: it still holds all[0] as due in 40 days. It sets the date through the field.
  await b.locator('#exam-date').fill(T(10));
  await expect(b.locator('#exam-line')).toHaveText('Interview in 10 days');
  await expect.poll(async () => (await saved(a)).exam).toBe(T(10));
  const s = (await saved(a)).srs as Srs;
  expect(s[all[0]], 'A\'s change to all[0] survives').toEqual(afterA);
  expect(s[all[0]]).toEqual({ box: 0, last: T(0), due: T(1) });
  expect(s[all[1]]).toEqual({ box: 2, last: T(-5), due: T(1), was: T(41) });
  expect(s[all[2]]).toEqual({ box: 3, last: T(-5), due: T(2), was: T(42) });
  expect(s[all[3]]).toEqual(srs[all[3]]);
});
