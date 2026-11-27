import fs from 'node:fs';
import {
  test, expect, PAGE_URL, ymd, addDays, raw, saved, store, bankData, goTo, currentId, openQuestion,
  progress, marks, ratingButton, rateOne, rateAll, quizThese, rowIds, importFile, exportFile,
} from './fixtures';
import type { Page } from '@playwright/test';

// Fixed local "today" for every clocked test: 2026-01-15 12:00 (local time; January avoids DST edges).
const NOW = new Date(2026, 0, 15, 12, 0);
const D = (n: number) => ymd(addDays(NOW, n));
const DAYS = [1, 3, 7, 14, 30];
const BOX_KEY = 'qa-bank';

const ids = async (page: Page) => (await bankData(page)).map(q => q.id);
const firstTopicFirstQuestion = async (page: Page) => { await page.locator('.card.topic').first().click(); };
const setFull = (page: Page, on: boolean) => page.evaluate(v => { (window as unknown as { __full: boolean }).__full = v; }, on);
const bgOf = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const sorted = (a: string[]) => [...a].sort();

// Opens a clocked page that holds one question in the review queue (via a note) and runs a one-question quiz.
async function rateSeeded(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, p: Record<string, unknown>, how: 'missed' | 'shaky' | 'known', by: 'click' | 'key' = 'click') {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes: { q0001: 'n' }, ...p }) } });
  await goTo(page, 'review');
  await expect(quizThese(page)).toHaveText(/Quiz these 1/);
  await quizThese(page).click();
  await rateOne(page, how, by);
  return page;
}

// ---------------------------------------------------------------------------------------------
// Failure modes 2-5: old, corrupt, wrongly typed and newer saved progress
// ---------------------------------------------------------------------------------------------

test('mode 2: current shape without v loads unchanged; the first change writes v 2 and keeps known and code', async ({ open }) => {
  const page = await open({ seed: { [BOX_KEY]: JSON.stringify({ known: { q0001: 1 }, code: { q0001: '// mine' } }) } });
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  const all = await ids(page);
  await openQuestion(page, all[1]);
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(s.v).toBe(2);
  expect(sorted(Object.keys(s.known))).toEqual(sorted(['q0001', all[1]]));
  expect(s.code).toEqual({ q0001: '// mine' });
});

test('mode 0: known marks saved before v get a first review spread over 14 days, in bank order', async ({ open }) => {
  const page = await open({ time: NOW });
  const known = (await ids(page)).slice(0, 16);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, JSON.stringify({ known: marks(known), code: {} })]);
  await page.reload();
  await expect.poll(async () => Object.keys((await saved(page)).srs ?? {}).length).toBe(16);
  const s = await saved(page);
  known.forEach((id, i) => expect(s.srs[id]).toEqual({ box: 1, last: D(0), due: D(3 + (i % 14)) }));
  expect(sorted(Object.keys(s.known))).toEqual(sorted(known));
  expect(s.v).toBe(2);
  await page.clock.setSystemTime(addDays(NOW, 3));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#due-count')).toHaveText('2');
  await goTo(page, 'review');
  await page.locator('#review').getByRole('button', { name: 'Due', exact: true }).click();
  expect(sorted((await rowIds(page)) as string[])).toEqual(sorted([known[0], known[14]]));
});

test('mode 0: progress that already has v keeps a known mark without an srs entry', async ({ open }) => {
  const page = await open({ time: NOW });
  const id = (await ids(page))[0];
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({ known: marks([id]) })]);
  await page.reload();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await goTo(page, 'review');
  await goTo(page, 'home');
  const s = await saved(page);
  expect(s.known).toEqual({ [id]: 1 });
  expect(s.srs ?? {}).toEqual({});
});

test('mode 3: corrupt JSON loads empty, copies the broken text once, and later saves do not overwrite the copy', async ({ open }) => {
  const broken = '{"known":';
  const page = await open({ seed: { [BOX_KEY]: broken } });
  await expect(page.locator('.card.topic')).toHaveCount(12);
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  expect(await store(page, 'qa-bank-broken')).toBe(broken);
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  expect(Object.keys((await saved(page)).known)).toEqual(['q0001']);
  expect(await store(page, 'qa-bank-broken')).toBe(broken);
  await page.reload();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  expect(await store(page, 'qa-bank-broken')).toBe(broken);
});

test('mode 4: bad parts are dropped, good parts load (known as a string)', async ({ open }) => {
  const bad = {
    known: 'oops',
    shaky: { q0005: 1 },
    notes: { q0006: 'hi' },
    code: { q0001: 5, q0002: '// ok' },
    srs: {
      q0001: { box: 2 },
      q0002: { box: 1, last: '2020-01-01', due: 'not-a-date' },
      q0003: { box: 2, last: '2019-12-30', due: '2020-01-01' },
    },
    exam: 'tomorrow',
  };
  const page = await open({ seed: { [BOX_KEY]: JSON.stringify(bad) } });
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  await goTo(page, 'review');
  await expect.poll(() => rowIds(page).then(sorted)).toEqual(['q0003', 'q0005', 'q0006']);
  await goTo(page, 'home');
  await expect(page.locator('#exam-line')).toHaveText('No interview date set');
  await openQuestion(page, 'q0009');
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(Object.keys(s.known)).toEqual(['q0009']);
  expect(s.shaky).toEqual({ q0005: 1 });
  expect(s.notes).toEqual({ q0006: 'hi' });
  expect(s.code).toEqual({ q0002: '// ok' });
  expect(sorted(Object.keys(s.srs))).toEqual(['q0003', 'q0009']);
  expect(s.exam ?? null).toBeNull();
});

test('mode 4: known as an array is dropped and does not count', async ({ open }) => {
  const page = await open({ seed: { [BOX_KEY]: JSON.stringify({ known: ['q0001', 'q0002'], code: { q0001: 7 }, notes: { q0004: 'keep' } }) } });
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  await openQuestion(page, 'q0003');
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(Object.keys(s.known)).toEqual(['q0003']);
  expect(s.notes).toEqual({ q0004: 'keep' });
  expect(s.code ?? {}).toEqual({});
});

test('mode 5: progress from a newer version keeps its unknown key and v 99 after a change', async ({ open }) => {
  const page = await open({ seed: { [BOX_KEY]: JSON.stringify({ v: 99, known: { q0001: 1 }, future: { a: 1 } }) } });
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await openQuestion(page, 'q0002');
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(s.v).toBe(99);
  expect(s.future).toEqual({ a: 1 });
  expect(sorted(Object.keys(s.known))).toEqual(['q0001', 'q0002']);
});

// ---------------------------------------------------------------------------------------------
// Failure modes 6-14: bad import files and Cancel
// ---------------------------------------------------------------------------------------------

async function importSetup(page: Page) {
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  await expect.poll(() => raw(page)).not.toBeNull();
  await goTo(page, 'home');
  return (await raw(page))!;
}
const good = { v: 2, known: { q0002: 1, q0003: 1 } };

const badFiles: [string, string, ReturnType<typeof importFile>, RegExp?][] = [
  ['6 not JSON', 'x', importFile('this is not json')],
  ['6 truncated JSON', 'x', importFile('{"app":"qa-interview-bank","format":1,')],
  ['7 empty file', 'x', { name: 'p.json', mimeType: 'application/json', buffer: Buffer.alloc(0) }],
  ['8 array', 'x', importFile('[]')],
  ['8 string', 'x', importFile('"x"')],
  ['8 null', 'x', importFile('null')],
  ['9 app missing', 'x', importFile({ format: 1, exported: '2026-01-10T10:00:00.000Z', progress: good })],
  ['9 app wrong', 'x', importFile({ ...exportFile(good), app: 'other-app' })],
  ['10 format 2', 'x', importFile({ ...exportFile(good), format: 2 }), /newer version/i],
  ['11 progress missing', 'x', importFile({ app: 'qa-interview-bank', format: 1, exported: '2026-01-10T10:00:00.000Z' })],
  ['12 known is an array', 'x', importFile(exportFile({ ...good, known: ['q0002'] }))],
  ['12 known is a string', 'x', importFile(exportFile({ ...good, known: 'q0002' }))],
  ['12 code holds a number', 'x', importFile(exportFile({ ...good, code: { q0002: 5 } }))],
  ['12 srs entry misses fields', 'x', importFile(exportFile({ ...good, srs: { q0002: { box: 1 } } }))],
  ['12 srs entry has a bad date', 'x', importFile(exportFile({ ...good, srs: { q0002: { box: 1, last: '2026-01-01', due: '2026-13-45' } } }))],
  ['12 exam is "tomorrow"', 'x', importFile(exportFile({ ...good, exam: 'tomorrow' }))],
  ['13 larger than 5,000,000 bytes', 'x', importFile(JSON.stringify(exportFile(good)) + ' '.repeat(5_000_001)), /too large/i],
];
for (const [name, , file, msg] of badFiles) {
  test(`mode ${name}: error message, no confirm, storage byte-identical`, async ({ bank }) => {
    const before = await importSetup(bank);
    await bank.locator('#import-input').setInputFiles(file);
    await expect(bank.locator('#import-msg')).toHaveAttribute('data-kind', 'error');
    if (msg) await expect(bank.locator('#import-msg')).toHaveText(msg);
    await expect(bank.locator('#import-msg')).not.toBeEmpty();
    await expect(bank.locator('#import-ask')).toBeHidden();
    await expect(bank.locator('#import-yes')).toBeHidden();
    expect(await raw(bank)).toBe(before);
    await bank.reload();
    expect(await raw(bank)).toBe(before);
  });
}

test('mode 14: choosing a valid file and pressing No changes nothing', async ({ bank }) => {
  const before = await importSetup(bank);
  await bank.locator('#import-input').setInputFiles(importFile(exportFile({ v: 2, known: { q0002: 1, q0003: 1, q0004: 1 } })));
  await expect(bank.locator('#import-ask')).toHaveText(/Replace 1 known marks? here with 3 from the file\?/);
  await bank.locator('#import-no').click();
  await expect(bank.locator('#import-ask')).toBeHidden();
  expect(await raw(bank)).toBe(before);
  await bank.reload();
  expect(await raw(bank)).toBe(before);
});

// ---------------------------------------------------------------------------------------------
// Import and export rules
// ---------------------------------------------------------------------------------------------

test('import: confirm names both counts, Yes replaces progress, sets backup from the file, keeps the theme', async ({ open }) => {
  const page = await open({
    time: NOW,
    seed: { [BOX_KEY]: progress({ known: marks(['q0001', 'q0002']), notes: { q0001: 'old note' }, backup: D(0) }), 'qa-bank-theme': 'dark' },
  });
  await page.locator('#import-input').setInputFiles(importFile(exportFile(
    { v: 2, known: marks(['q0003', 'q0004', 'q0005']), shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: '2025-06-06', mixSize: 5 })));
  await expect(page.locator('#import-ask')).toHaveText(/Replace 2 known marks here with 3 from the file\?/);
  await expect(page.locator('#import-yes')).toBeVisible();
  await expect(page.locator('#import-no')).toBeVisible();
  await page.locator('#import-yes').click();
  await expect(page.locator('#import-msg')).toHaveAttribute('data-kind', 'ok');
  await expect(page.locator('#import-msg')).not.toHaveText(/not in this version/);
  const s = await saved(page);
  expect(sorted(Object.keys(s.known))).toEqual(['q0003', 'q0004', 'q0005']);
  expect(s.notes ?? {}).toEqual({});
  expect(s.backup).toBe('2026-01-10');
  expect(s.mixSize).toBe(5);
  await expect(page.locator('#backup-line')).toContainText('Last backup: 5 days ago');
  expect(await store(page, 'qa-bank-theme')).toBe('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('import: ids that are not in this bank are kept and counted in the message', async ({ bank }) => {
  await bank.locator('#import-input').setInputFiles(importFile(exportFile(
    { v: 2, known: { q0003: 1, q9999: 1 }, shaky: { q9998: 1 }, notes: {}, code: {}, srs: {}, exam: null, backup: null })));
  await bank.locator('#import-yes').click();
  const msg = bank.locator('#import-msg');
  await expect(msg).toHaveAttribute('data-kind', 'ok');
  await expect(msg).toHaveText(/(\d+) questions? in the file (is|are) not in this version/);
  expect(/(\d+) questions?/.exec((await msg.textContent())!)![1]).toBe('2');
  const s = await saved(bank);
  expect(sorted(Object.keys(s.known))).toEqual(['q0003', 'q9999']);
  expect(s.shaky).toEqual({ q9998: 1 });
});

test('export: file name and JSON shape, backup set to today, theme not exported', async ({ open }) => {
  const page = await open({
    time: NOW,
    seed: { [BOX_KEY]: progress({ known: marks(['q0001']), notes: { q0002: 'a "quoted" note\nline 2' } }), 'qa-bank-theme': 'dark' },
  });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  expect(download.suggestedFilename()).toBe('qa-interview-bank-progress-2026-01-15.json');
  const file = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(Object.keys(file).sort()).toEqual(['app', 'exported', 'format', 'progress']);
  expect(file.app).toBe('qa-interview-bank');
  expect(file.format).toBe(1);
  expect(file.exported).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d/);
  expect(Number.isNaN(Date.parse(file.exported))).toBe(false);
  expect(file.progress.known).toEqual({ q0001: 1 });
  expect(file.progress.notes).toEqual({ q0002: 'a "quoted" note\nline 2' });
  expect(file.progress.backup).toBe('2026-01-15');
  expect(JSON.stringify(file)).not.toMatch(/theme|dark/);
  expect((await saved(page)).backup).toBe('2026-01-15');
  await expect(page.locator('#backup-line')).toContainText('Last backup: today');
});

test('export then import in the same browser round-trips the progress', async ({ open }) => {
  const seedP = { known: marks(['q0001']), shaky: marks(['q0002']), missed: marks(['q0003']), notes: { q0004: 'n' }, srs: { q0001: { box: 1, last: D(0), due: D(3) } }, exam: D(20) };
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress(seedP) } });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  const file = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  await page.evaluate(() => localStorage.removeItem('qa-bank'));
  await page.reload();
  await page.locator('#import-input').setInputFiles(importFile(file));
  await page.locator('#import-yes').click();
  const s = await saved(page);
  for (const k of ['known', 'shaky', 'missed', 'notes', 'srs'] as const) expect(s[k]).toEqual((seedP as Record<string, unknown>)[k]);
  expect(s.exam).toBe(D(20));
});

test('export works from memory when storage is blocked', async ({ open }) => {
  const page = await open({ blockRead: true });
  await expect(page.locator('#save-error')).toBeVisible();
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  await goTo(page, 'home');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  const file = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
  expect(file.progress.known).toEqual({ q0001: 1 });
  expect(file.progress.backup).toBe(ymd(new Date()));
});

// ---------------------------------------------------------------------------------------------
// Backup line
// ---------------------------------------------------------------------------------------------

const backupCases: [string, string | null, string, boolean][] = [
  ['never', null, 'Last backup: never', true],
  ['today', D(0), 'Last backup: today', false],
  ['1 day ago', D(-1), 'Last backup: 1 day ago', false],
  ['6 days ago', D(-6), 'Last backup: 6 days ago', false],
  ['7 days ago warns', D(-7), 'Last backup: 7 days ago', true],
  ['30 days ago warns', D(-30), 'Last backup: 30 days ago', true],
  ['a backup date in the future reads today', D(10), 'Last backup: today', false],
];
for (const [name, backup, text, warn] of backupCases) {
  test(`backup line (with progress): ${name}`, async ({ open }) => {
    const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ known: marks(['q0001']), backup }) } });
    const line = page.locator('#backup-line');
    await expect(line).toContainText('Progress is saved in this browser only, for this file location.');
    await expect(line).toContainText(text);
    await expect(line).not.toContainText(/-\d/);
    if (warn) await expect(line).toHaveClass(/warn/);
    else await expect(line).not.toHaveClass(/warn/);
  });
}

test('backup line does not warn when there is no progress at all', async ({ open }) => {
  const page = await open({ time: NOW });
  await expect(page.locator('.card.topic')).toHaveCount(12);
  expect(await page.evaluate(() => document.querySelector('#backup-line')?.classList.contains('warn') ?? false)).toBe(false);
});

// ---------------------------------------------------------------------------------------------
// Failure modes 15-17: storage full or blocked
// ---------------------------------------------------------------------------------------------

test('mode 15: a failing save shows #save-error, and the change still shows on the page', async ({ open }) => {
  const page = await open({ fullStorage: true });
  await expect(page.locator('#save-error')).toBeHidden();
  const before = await raw(page);  // opening the page may already save today's daily mix
  await setFull(page, true);
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await expect(page.locator('.known-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#save-error')).toBeVisible();
  await expect(page.locator('#save-error')).toHaveAttribute('role', 'alert');
  expect(await raw(page)).toBe(before);
});

test('mode 16: when saving works again the next change saves every change made while it failed', async ({ open }) => {
  const page = await open({ fullStorage: true });
  const before = await raw(page);  // opening the page may already save today's daily mix
  await setFull(page, true);
  await firstTopicFirstQuestion(page);
  const first = (await currentId(page))!;
  await page.locator('.known-btn').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  const second = (await currentId(page))!;
  await page.locator('.known-btn').click();
  await expect(page.locator('#ov-text')).toHaveText(/^2 \//);
  await expect(page.locator('#save-error')).toBeVisible();
  expect(await raw(page)).toBe(before);
  await setFull(page, false);
  await page.getByRole('button', { name: 'Next →' }).click();
  const third = (await currentId(page))!;
  await page.locator('.known-btn').click();
  await expect(page.locator('#save-error')).toBeHidden();
  const s = await saved(page);
  expect(sorted(Object.keys(s.known))).toEqual(sorted([first, second, third]));
  await page.reload();
  await expect(page.locator('#ov-text')).toHaveText(/^3 \//);
});

test('mode 16: a note typed while saving failed is saved by the next successful change', async ({ open }) => {
  const page = await open({ fullStorage: true });
  await setFull(page, true);
  await firstTopicFirstQuestion(page);
  await page.getByRole('textbox', { name: 'My note' }).fill('typed while full');
  await expect(page.locator('#save-error')).toBeVisible();
  await setFull(page, false);
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(s.notes).toEqual({ q0001: 'typed while full' });
  expect(s.known).toEqual({ q0001: 1 });
});

test('mode 17: storage blocked on load: page works with empty progress and shows #save-error', async ({ open }) => {
  const page = await open({ blockRead: true });
  await expect(page.locator('.card.topic')).toHaveCount(12);
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  await expect(page.locator('#save-error')).toBeVisible();
  await expect(page.locator('#save-error')).toHaveAttribute('role', 'alert');
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await page.locator('#tab-quiz').click();
  await expect(page.locator('.startrow .btn.primary')).toBeVisible();
});

// ---------------------------------------------------------------------------------------------
// Failure modes 18-20: clock changes
// ---------------------------------------------------------------------------------------------

test('mode 18: clock moved back 10 days after a rating: not due, no crash, no negative backup days', async ({ open }) => {
  const page = await rateSeeded(open, { backup: D(0), srs: { q0001: { box: 0, last: D(-1), due: D(0) } } }, 'known');
  const s = await saved(page);
  expect(s.srs.q0001).toEqual({ box: 1, last: D(0), due: D(3) });
  await page.clock.setSystemTime(addDays(NOW, -10));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#due-count')).toHaveText('0');
  await expect(page.locator('#tab-review .badge')).toBeHidden();
  await expect(page.locator('#backup-line')).toContainText('Last backup: today');
  await expect(page.locator('#backup-line')).not.toContainText(/-\d/);
  await goTo(page, 'review');
  await page.locator('#review').getByRole('button', { name: 'Due', exact: true }).click();
  await expect(page.locator('.rq-row')).toHaveCount(0);
});

test('mode 18: an srs entry whose last date is after today is not due while its due date is in the future', async ({ open }) => {
  const page = await open({ time: addDays(NOW, -10), seed: { [BOX_KEY]: progress({ known: marks(['q0001']), srs: { q0001: { box: 1, last: D(0), due: D(3) } } }) } });
  await expect(page.locator('#due-count')).toHaveText('0');
  await expect(page.locator('#tab-review .badge')).toBeHidden();
});

test('mode 19: clock moved forward past the due date makes the question due', async ({ open }) => {
  const page = await rateSeeded(open, { srs: { q0001: { box: 0, last: D(-1), due: D(0) } } }, 'known'); // due D(3)
  await page.clock.setSystemTime(addDays(NOW, 2));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#due-count')).toHaveText('0');
  await page.clock.setSystemTime(addDays(NOW, 5));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#due-count')).toHaveText('1');
  await expect(page.locator('#tab-review .badge')).toHaveText('1');
  await goTo(page, 'review');
  await page.locator('#review').getByRole('button', { name: 'Due', exact: true }).click();
  expect(await rowIds(page)).toEqual(['q0001']);
});

test('mode 19: a question is due on its due date itself', async ({ open }) => {
  const page = await open({ time: addDays(NOW, 3), seed: { [BOX_KEY]: progress({ known: marks(['q0001']), srs: { q0001: { box: 1, last: D(0), due: D(3) } } }) } });
  await expect(page.locator('#due-count')).toHaveText('1');
});

test('mode 20: midnight with the page open: the next render uses the new day and the mix is rebuilt', async ({ open }) => {
  const page = await open({ time: new Date(2026, 0, 15, 23, 59) });
  await expect(page.locator('#mix-progress')).toHaveText('0 / 10 done today');
  const day1 = (await saved(page)).mix;
  expect(day1.day).toBe('2026-01-15');
  await page.clock.setSystemTime(new Date(2026, 0, 16, 0, 1));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText('0 / 10 done today');
  const day2 = (await saved(page)).mix;
  expect(day2.day).toBe('2026-01-16');
  expect(day2.ids).not.toEqual(day1.ids);
});

test('mode 20: questions rated yesterday are not done today', async ({ open }) => {
  const page = await open({ time: new Date(2026, 0, 15, 23, 50) });
  await page.locator('#mix-size').selectOption('5');
  await page.locator('#mix-start').click();
  await rateOne(page, 'known');
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText('1 / 5 done today');
  await page.clock.setSystemTime(new Date(2026, 0, 16, 0, 5));
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText(/^0 \/ \d+ done today$/);
});

// ---------------------------------------------------------------------------------------------
// Failure modes 21-24: two tabs
// ---------------------------------------------------------------------------------------------

test('mode 21: a stale second tab does not lose the first tab\'s mark', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  await openQuestion(b, all[1]);
  await openQuestion(a, all[0]);
  await a.locator('.known-btn').click();
  await expect.poll(async () => Object.keys((await saved(a)).known)).toEqual([all[0]]);
  await b.locator('.known-btn').click();
  await expect.poll(async () => sorted(Object.keys((await saved(a)).known))).toEqual(sorted([all[0], all[1]]));
});

test('mode 22: after tab A resets, stale tab B marking one question leaves only that mark', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  await openQuestion(a, all[0]);
  await a.locator('.known-btn').click();
  await a.locator('#tab-learn').click();
  await b.reload();
  await expect(b.locator('#ov-text')).toHaveText(/^1 \//);
  await openQuestion(b, all[2]);
  await a.locator('#reset-btn').click();
  await a.locator('#reset-yes').click();
  await expect(a.locator('#ov-text')).toHaveText(/^0 \//);
  await b.locator('.known-btn').click();
  const s = await saved(a);
  expect(Object.keys(s.known)).toEqual([all[2]]);
  await a.reload();
  await expect(a.locator('#ov-text')).toHaveText(/^1 \//);
});

test('mode 23: after tab A imports a file, stale tab B marking one question keeps the imported progress', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  await openQuestion(b, all[3]);
  await a.locator('#import-input').setInputFiles(importFile(exportFile(
    { v: 2, known: marks([all[9], all[10]]), shaky: marks([all[11]]), missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null })));
  await a.locator('#import-yes').click();
  await expect(a.locator('#import-msg')).toHaveAttribute('data-kind', 'ok');
  await b.locator('.known-btn').click();
  const s = await saved(a);
  expect(sorted(Object.keys(s.known))).toEqual(sorted([all[3], all[9], all[10]]));
  expect(s.shaky).toEqual(marks([all[11]]));
});

test('mode 24: a note written in tab A survives a stale tab B marking another question', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  await openQuestion(b, all[1]);
  await openQuestion(a, all[0]);
  await a.getByRole('textbox', { name: 'My note' }).fill('keep me');
  await expect.poll(async () => (await saved(a)).notes?.[all[0]]).toBe('keep me');
  await b.locator('.known-btn').click();
  const s = await saved(a);
  expect(s.notes[all[0]]).toBe('keep me');
  expect(Object.keys(s.known)).toEqual([all[1]]);
});

test('two tabs: a stale tab shaky mark and an exam date from the other tab both survive', async ({ bank: a, secondTab: b }) => {
  const all = await ids(a);
  await openQuestion(b, all[1]);
  await a.locator('#exam-date').fill('2030-05-05');
  await expect.poll(async () => (await saved(a)).exam).toBe('2030-05-05');
  await b.locator('.shaky-btn').click();
  const s = await saved(a);
  expect(s.exam).toBe('2030-05-05');
  expect(Object.keys(s.shaky)).toEqual([all[1]]);
});

test('daily mix: both tabs see the same set on the same day', async ({ bank: a, secondTab: b }) => {
  await b.reload();
  const fromA = (await saved(a)).mix;
  const fromB = (await saved(b)).mix;
  expect(fromA.ids).toHaveLength(10);
  expect(fromB).toEqual(fromA);
});

// ---------------------------------------------------------------------------------------------
// Failure mode 25: narrow screen (the mobile projects run at 390 px)
// ---------------------------------------------------------------------------------------------

const longNote = 'This is a deliberately long note about a flaky locator that keeps wrapping across several lines on a narrow phone screen without any sideways scroll.';

test('mode 25: Home with the Today card, exam line and pace, backup warning and import confirm fits', async ({ open, fitsScreen }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ known: marks(['q0001', 'q0002']), shaky: marks(['q0003']), exam: D(10), backup: D(-20) }) } });
  await expect(page.locator('#today')).toBeVisible();
  await expect(page.locator('#exam-line')).toHaveText('Interview in 10 days');
  await expect(page.locator('#backup-line')).toHaveClass(/warn/);
  await fitsScreen();
  await page.locator('#import-input').setInputFiles(importFile(exportFile({ v: 2, known: marks(['q0003', 'q0004']) })));
  await expect(page.locator('#import-ask')).toBeVisible();
  await fitsScreen();
  await page.locator('#import-no').click();
  await page.locator('#import-input').setInputFiles(importFile('not json'));
  await expect(page.locator('#import-msg')).toHaveAttribute('data-kind', 'error');
  await fitsScreen();
});

test('mode 25: Review with filters, topic select and many rows fits', async ({ open, fitsScreen }) => {
  const notes = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['q' + String(i + 1).padStart(4, '0'), longNote]));
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes, shaky: marks(['q0001', 'q0002']), srs: { q0003: { box: 0, last: D(-3), due: D(-1) } }, known: marks(['q0003']) }) } });
  await goTo(page, 'review');
  await expect(page.locator('.rq-row').first()).toBeVisible();
  await expect(page.locator('#rq-topic')).toBeVisible();
  await fitsScreen();
});

test('mode 25: Learn with the shaky button and the note fits', async ({ bank, fitsScreen }) => {
  await firstTopicFirstQuestion(bank);
  await bank.locator('.shaky-btn').click();
  await bank.getByRole('textbox', { name: 'My note' }).fill(longNote);
  await expect(bank.locator('.known-btn')).toBeVisible();
  await expect(bank.locator('.shaky-btn')).toBeVisible();
  await fitsScreen();
});

test('mode 25: the quiz rating row with three buttons fits', async ({ open, fitsScreen }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes: { q0001: 'n' } }) } });
  await goTo(page, 'review');
  await quizThese(page).click();
  await page.getByRole('button', { name: /Show answer/ }).click();
  for (const how of ['missed', 'shaky', 'known'] as const) await expect(ratingButton(page, how)).toBeVisible();
  await fitsScreen();
});

// ---------------------------------------------------------------------------------------------
// Failure mode 26 and interview-date rules
// ---------------------------------------------------------------------------------------------

const examLines: [string, number, string][] = [
  ['in the past', -5, 'The interview date has passed'],
  ['yesterday', -1, 'The interview date has passed'],
  ['today', 0, 'Interview today'],
  ['tomorrow', 1, 'Interview tomorrow'],
  ['in 2 days', 2, 'Interview in 2 days'],
  ['in 10 days', 10, 'Interview in 10 days'],
];
for (const [name, n, line] of examLines) {
  test(`mode 26: interview date ${name} (typed in the date field)`, async ({ open }) => {
    const page = await open({ time: NOW });
    await expect(page.locator('#exam-line')).toHaveText('No interview date set');
    await expect(page.locator('#exam-pace')).toBeHidden();
    await page.locator('#exam-date').fill(D(n));
    await expect(page.locator('#exam-line')).toHaveText(line);
    expect((await saved(page)).exam).toBe(D(n));
    if (n <= 0) await expect(page.locator('#exam-pace')).toBeHidden();
    else await expect(page.locator('#exam-pace')).toBeVisible();
    await page.reload();
    await expect(page.locator('#exam-line')).toHaveText(line);
    await expect(page.locator('#exam-date')).toHaveValue(D(n));
  });
}

test('mode 26: clearing the interview date resets the line, the pace and the saved value', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ exam: D(10) }) } });
  await expect(page.locator('#exam-line')).toHaveText('Interview in 10 days');
  await page.locator('#exam-clear').click();
  await expect(page.locator('#exam-line')).toHaveText('No interview date set');
  await expect(page.locator('#exam-pace')).toBeHidden();
  await expect(page.locator('#exam-date')).toHaveValue('');
  expect((await saved(page)).exam ?? null).toBeNull();
  await page.reload();
  await expect(page.locator('#exam-line')).toHaveText('No interview date set');
});

test('interview pace: unseen Core questions divided by days left, rounded up', async ({ open }) => {
  const probe = await open({ time: NOW });
  const core = (await bankData(probe)).filter(q => q.tier === 'Core').map(q => q.id);
  expect(core.length).toBeGreaterThan(10);
  const seen = core.slice(0, 3);
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({ known: marks(seen) })]);
  await probe.reload();
  const unseen = core.length - seen.length;
  for (const days of [1, 2, 3, 7, 10]) {
    await probe.locator('#exam-date').fill(D(days));
    await expect(probe.locator('#exam-pace')).toHaveText(`To see every unseen Core question: ${Math.ceil(unseen / days)} a day`);
  }
});

test('interview pace is hidden when every Core question has been seen', async ({ open }) => {
  const probe = await open({ time: NOW });
  const core = (await bankData(probe)).filter(q => q.tier === 'Core').map(q => q.id);
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({ known: marks(core), exam: D(10) })]);
  await probe.reload();
  await expect(probe.locator('#exam-line')).toHaveText('Interview in 10 days');
  await expect(probe.locator('#exam-pace')).toBeHidden();
});

// ---------------------------------------------------------------------------------------------
// Spaced review table
// ---------------------------------------------------------------------------------------------

type Rate = 'known' | 'shaky' | 'missed';
const table: [string, Rate, number | null, number][] = [
  ['Knew it, no entry', 'known', null, 1],
  ['Knew it, box 0', 'known', 0, 1],
  ['Knew it, box 1', 'known', 1, 2],
  ['Knew it, box 3', 'known', 3, 4],
  ['Knew it, box 4 stays at the cap', 'known', 4, 4],
  ['Shaky, no entry', 'shaky', null, 0],
  ['Shaky, box 3', 'shaky', 3, 2],
  ['Shaky, box 1', 'shaky', 1, 0],
  ['Shaky, box 0 stays at the floor', 'shaky', 0, 0],
  ['Didn\'t know, no entry', 'missed', null, 0],
  ['Didn\'t know, box 4', 'missed', 4, 0],
];
const otherMark = (r: Rate) => (r === 'known' ? 'missed' : 'known');
for (const [name, rate, from, box] of table) {
  test(`scheduler: ${name} -> box ${box}, due in ${DAYS[box]} days, one mark only`, async ({ open }) => {
    const seed = from === null ? { [otherMark(rate)]: marks(['q0001']) }
      : { [otherMark(rate)]: marks(['q0001']), srs: { q0001: { box: from, last: D(-5), due: D(0) } } };
    const page = await rateSeeded(open, seed, rate);
    const s = await saved(page);
    expect(s.srs.q0001).toEqual({ box, last: D(0), due: D(DAYS[box]) });
    const field = { known: 'known', shaky: 'shaky', missed: 'missed' }[rate];
    expect(s[field]).toEqual({ q0001: 1 });
    for (const other of ['known', 'shaky', 'missed'].filter(f => f !== field)) expect(s[other] ?? {}).toEqual({});
  });
}

test('scheduler: a question climbs one box per day over repeated Knew it ratings (not always 1 day)', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes: { q0001: 'n' } }) } });
  let day = 0;
  for (const expectBox of [1, 2, 3, 4, 4]) {
    await goTo(page, 'review');
    await quizThese(page).click();
    await rateOne(page, 'known');
    const e = (await saved(page)).srs.q0001;
    expect(e).toEqual({ box: expectBox, last: D(day), due: D(day + DAYS[expectBox]) });
    day += DAYS[expectBox];
    await page.clock.setSystemTime(addDays(NOW, day));
  }
});

// Interview-date clamp: [name, exam offset, rating, from box, expected due offset]
const clamp: [string, number, Rate, number | null, number][] = [
  ['exam in 10 days caps a 30-day wait at exam minus 1', 10, 'known', 3, 9],
  ['exam in 10 days leaves a 3-day wait alone', 10, 'known', null, 3],
  ['exam in 2 days pulls a 3-day wait to tomorrow', 2, 'known', null, 1],
  ['exam in 2 days: due is never earlier than tomorrow even for the longest wait', 2, 'known', 4, 1],
  ['exam in 5 days caps a 7-day wait at exam minus 1', 5, 'known', 1, 4],
  ['exam tomorrow does not change due', 1, 'known', 3, 30],
  ['exam today does not change due', 0, 'known', 3, 30],
  ['exam in the past does not change due', -5, 'known', 3, 30],
  ['exam in 10 days leaves a 1-day wait alone', 10, 'missed', 4, 1],
  ['exam in 2 days keeps a 1-day wait at tomorrow', 2, 'missed', null, 1],
];
for (const [name, exam, rate, from, due] of clamp) {
  test(`interview clamp: ${name}`, async ({ open }) => {
    const seed: Record<string, unknown> = { exam: D(exam) };
    if (from !== null) seed.srs = { q0001: { box: from, last: D(-5), due: D(0) } };
    const page = await rateSeeded(open, seed, rate);
    expect((await saved(page)).srs.q0001.due).toBe(D(due));
  });
}

// ---------------------------------------------------------------------------------------------
// Learn view: known, shaky, note
// ---------------------------------------------------------------------------------------------

test('learn: known, then shaky, then shaky again follows the box table and removes the entry', async ({ open }) => {
  const page = await open({ time: NOW });
  await firstTopicFirstQuestion(page);
  const known = page.locator('.known-btn');
  const shaky = page.locator('.shaky-btn');
  await expect(known).toHaveAttribute('aria-pressed', 'false');
  await expect(shaky).toHaveAttribute('aria-pressed', 'false');
  await known.click();
  await expect(known).toHaveAttribute('aria-pressed', 'true');
  let s = await saved(page);
  expect(s.srs.q0001).toEqual({ box: 1, last: D(0), due: D(3) });
  expect(s.known).toEqual({ q0001: 1 });
  await shaky.click();
  await expect(shaky).toHaveAttribute('aria-pressed', 'true');
  await expect(known).toHaveAttribute('aria-pressed', 'false');
  s = await saved(page);
  expect(s.srs.q0001).toEqual({ box: 0, last: D(0), due: D(1) });
  expect(s.shaky).toEqual({ q0001: 1 });
  expect(s.known ?? {}).toEqual({});
  await shaky.click();
  await expect(shaky).toHaveAttribute('aria-pressed', 'false');
  s = await saved(page);
  expect(s.srs ?? {}).toEqual({});
  expect(s.shaky ?? {}).toEqual({});
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
});

test('learn: pressing Mark as known twice makes the question new again; a first Shaky starts at box 0', async ({ open }) => {
  const page = await open({ time: NOW });
  await firstTopicFirstQuestion(page);
  await page.locator('.known-btn').click();
  await page.locator('.known-btn').click();
  let s = await saved(page);
  expect(s.srs ?? {}).toEqual({});
  expect(s.known ?? {}).toEqual({});
  await page.locator('.shaky-btn').click();
  s = await saved(page);
  expect(s.srs.q0001).toEqual({ box: 0, last: D(0), due: D(1) });
});

test('learn: the shaky mark survives a reload and lands in Review under Shaky', async ({ bank }) => {
  await firstTopicFirstQuestion(bank);
  await bank.locator('.shaky-btn').click();
  await bank.reload();
  await firstTopicFirstQuestion(bank);
  await expect(bank.locator('.shaky-btn')).toHaveAttribute('aria-pressed', 'true');
  await goTo(bank, 'review');
  await bank.locator('#review').getByRole('button', { name: 'Shaky', exact: true }).click();
  expect(await rowIds(bank)).toEqual(['q0001']);
});

test('learn: a note is saved on input, removed when emptied, and shows after reload and in Review', async ({ bank }) => {
  await firstTopicFirstQuestion(bank);
  const note = bank.getByRole('textbox', { name: 'My note' });
  const text = 'check "quotes", <tags> & line\nbreak';
  await note.fill(text);
  await expect.poll(async () => (await saved(bank)).notes?.q0001).toBe(text);
  await bank.reload();
  await firstTopicFirstQuestion(bank);
  await expect(note).toHaveValue(text);
  await goTo(bank, 'review');
  await bank.locator('#review').getByRole('button', { name: 'With note', exact: true }).click();
  expect(await rowIds(bank)).toEqual(['q0001']);
  await bank.locator('.rq-row').click();
  await note.fill('');
  await expect.poll(async () => (await saved(bank)).notes ?? {}).toEqual({});
});

test('learn: a note on its own does not count as known', async ({ bank }) => {
  await firstTopicFirstQuestion(bank);
  await bank.getByRole('textbox', { name: 'My note' }).fill('only a note');
  await expect(bank.locator('#ov-text')).toHaveText(/^0 \//);
  await expect(bank.locator('.known-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(bank.locator('.shaky-btn')).toHaveAttribute('aria-pressed', 'false');
});

// ---------------------------------------------------------------------------------------------
// Quiz: three buttons and keys
// ---------------------------------------------------------------------------------------------

test('quiz: three rating buttons appear after the answer is shown', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes: { q0001: 'n' } }) } });
  await goTo(page, 'review');
  await quizThese(page).click();
  await page.getByRole('button', { name: /Show answer/ }).click();
  for (const how of ['missed', 'shaky', 'known'] as const) await expect(ratingButton(page, how)).toHaveCount(1);
});

const keys: [string, Rate, number][] = [['1', 'missed', 0], ['2', 'shaky', 1], ['3', 'known', 3]];
for (const [key, rate, box] of keys) {
  test(`quiz: key ${key} is ${rate === 'missed' ? "Didn't know" : rate === 'shaky' ? 'Shaky' : 'Knew it'}`, async ({ open }) => {
    const page = await rateSeeded(open, { srs: { q0001: { box: 2, last: D(-5), due: D(0) } } }, rate, 'key');
    const s = await saved(page);
    expect(s.srs.q0001).toEqual({ box, last: D(0), due: D(DAYS[box]) });
    expect(Object.keys(s[rate])).toEqual(['q0001']);
  });
}

// ---------------------------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------------------------

async function seedQueue(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>) {
  const probe = await open({ time: NOW });
  const data = await bankData(probe);
  const files = [...new Set(data.map(q => q.file))];
  const inFile = (i: number) => data.filter(q => q.file === files[i]).map(q => q.id);
  const f0 = inFile(0)[0], f0b = inFile(0)[1], f1 = inFile(1)[0], f2 = inFile(2)[0], f3 = inFile(3)[0], f4 = inFile(4)[0];
  const order = data.map(q => q.id);
  const bankOrder = (xs: string[]) => [...xs].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({
    known: marks([f0, f1, f4]),
    shaky: marks([f2]),
    missed: marks([f0b]),
    notes: { [f2]: 'shaky and noted', [f3]: 'only a note' },
    srs: {
      [f0]: { box: 1, last: D(-5), due: D(-3) },    // due, newer
      [f1]: { box: 0, last: D(-9), due: D(-5) },    // due, older
      [f4]: { box: 2, last: D(0), due: D(7) },      // future: not due, no note: not listed
    },
  })]);
  await probe.reload();
  await goTo(probe, 'review');
  return { page: probe, files, f0, f0b, f1, f2, f3, f4, bankOrder };
}

test('review: All lists due first (oldest due first), then the rest in bank order; future-due known is absent', async ({ open }) => {
  const { page, f0, f0b, f1, f2, f3, f4, bankOrder } = await seedQueue(open);
  await expect(page.locator('#review').getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await rowIds(page)).toEqual([f1, f0, ...bankOrder([f0b, f2, f3])]);
  expect(await rowIds(page)).not.toContain(f4);
  await expect(quizThese(page)).toHaveText(/Quiz these 5/);
});

test('review: each filter shows only its rows and is the only one pressed', async ({ open }) => {
  const { page, f0, f0b, f1, f2, f3, bankOrder } = await seedQueue(open);
  const names = ['All', 'Due', 'Shaky', 'Missed', 'With note'];
  const expected: Record<string, string[]> = {
    Due: [f1, f0], Shaky: [f2], Missed: [f0b], 'With note': bankOrder([f2, f3]),
  };
  for (const name of Object.keys(expected)) {
    await page.locator('#review').getByRole('button', { name, exact: true }).click();
    expect(await rowIds(page)).toEqual(expected[name]);
    for (const other of names) {
      await expect(page.locator('#review').getByRole('button', { name: other, exact: true }))
        .toHaveAttribute('aria-pressed', other === name ? 'true' : 'false');
    }
    await expect(quizThese(page)).toHaveText(new RegExp(`Quiz these ${expected[name].length}\\b`));
  }
});

test('review: topic filter lists one option per topic and narrows the rows (also with a filter button)', async ({ open }) => {
  const { page, files, f0, f0b, f1, f2, f3 } = await seedQueue(open);
  const select = page.locator('select#rq-topic');
  const options = await select.locator('option').evaluateAll(os => os.map(o => [(o as HTMLOptionElement).value, o.textContent]));
  expect(options[0]).toEqual(['', 'All topics']);
  expect(options.slice(1).map(o => o[0])).toEqual(files);
  await select.selectOption(files[0]);
  expect(await rowIds(page)).toEqual([f0, f0b]);
  await expect(quizThese(page)).toHaveText(/Quiz these 2/);
  await page.locator('#review').getByRole('button', { name: 'Missed', exact: true }).click();
  expect(await rowIds(page)).toEqual([f0b]);
  await page.locator('#review').getByRole('button', { name: 'All', exact: true }).click();
  await select.selectOption(files[1]);
  expect(await rowIds(page)).toEqual([f1]);
  await select.selectOption('');
  expect(await rowIds(page)).toHaveLength(5);
  void f2; void f3;
});

test('review: "Quiz these N" quizzes exactly the shown questions', async ({ open }) => {
  const { page, files, f0, f0b, f1, f4 } = await seedQueue(open);
  await page.locator('select#rq-topic').selectOption(files[0]);
  await quizThese(page).click();
  expect(await rateAll(page, 'known')).toBe(2);
  const s = await saved(page);
  expect(sorted(Object.keys(s.srs))).toEqual(sorted([f0, f0b, f1, f4]));
  expect(s.srs[f0b].box).toBe(1);
  expect(s.srs[f0].box).toBe(2);
  expect(s.srs[f1]).toEqual({ box: 0, last: D(-9), due: D(-5) });
  expect(s.srs[f4]).toEqual({ box: 2, last: D(0), due: D(7) });
});

test('review: clicking a row opens that question in the Learn view', async ({ open }) => {
  const { page, f3 } = await seedQueue(open);
  await page.locator(`.rq-row[data-id="${f3}"]`).click();
  await expect(page.locator('.known-btn')).toBeVisible();
  expect(await currentId(page)).toBe(f3);
  await expect(page.getByRole('textbox', { name: 'My note' })).toHaveValue('only a note');
});

test('review: empty queue says so and offers no quiz of zero questions', async ({ open }) => {
  const page = await open({ time: NOW });
  await goTo(page, 'review');
  await expect(page.locator('#review')).toHaveText(/nothing to review/i);
  await expect(page.locator('.rq-row')).toHaveCount(0);
  const btn = quizThese(page);
  if (await btn.count()) await expect(btn).toBeHidden();
});

test('review: a filter with no rows hides or disables the quiz button', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ notes: { q0001: 'n' } }) } });
  await goTo(page, 'review');
  await page.locator('#review').getByRole('button', { name: 'Shaky', exact: true }).click();
  await expect(page.locator('.rq-row')).toHaveCount(0);
  const btn = quizThese(page);
  if (await btn.count() && await btn.isVisible()) await expect(btn).toBeDisabled();
});

test('review: tab badge shows the due count only when above 0', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ known: marks(['q0001', 'q0002', 'q0003']), srs: {
    q0001: { box: 0, last: D(-2), due: D(-1) }, q0002: { box: 0, last: D(-2), due: D(0) }, q0003: { box: 3, last: D(0), due: D(14) } } }) } });
  await expect(page.locator('#due-count')).toHaveText('2');
  await expect(page.locator('#tab-review .badge')).toHaveText('2');
});

// ---------------------------------------------------------------------------------------------
// Daily mix
// ---------------------------------------------------------------------------------------------

test('daily mix: default 10 distinct questions, one topic at a time, stable across reload and after progress', async ({ open }) => {
  const page = await open({ time: NOW });
  await expect(page.locator('#mix-size')).toHaveValue('10');
  await expect(page.locator('#mix-progress')).toHaveText('0 / 10 done today');
  const data = await bankData(page);
  const mix = (await saved(page)).mix;
  expect(mix.day).toBe(D(0));
  expect(mix.ids).toHaveLength(10);
  expect(new Set(mix.ids).size).toBe(10);
  const byId = new Map(data.map(q => [q.id, q]));
  const coreTopics = new Set(data.filter(q => q.tier === 'Core').map(q => q.file));
  const files = mix.ids.map((id: string) => byId.get(id)!.file);
  expect(mix.ids.every((id: string) => byId.get(id)!.tier === 'Core')).toBe(true);
  expect(new Set(files).size).toBe(Math.min(10, coreTopics.size));
  await page.reload();
  expect((await saved(page)).mix).toEqual(mix);
  await page.locator('#mix-start').click();
  await rateOne(page, 'known');
  await page.reload();
  expect((await saved(page)).mix).toEqual(mix);
  await expect(page.locator('#mix-progress')).toHaveText('1 / 10 done today');
});

for (const size of [5, 20]) {
  test(`daily mix: size ${size} rebuilds today's mix and is remembered`, async ({ open }) => {
    const page = await open({ time: NOW });
    await page.locator('#mix-size').selectOption(String(size));
    await expect(page.locator('#mix-progress')).toHaveText(`0 / ${size} done today`);
    const s = await saved(page);
    expect(s.mixSize).toBe(size);
    expect(s.mix.ids).toHaveLength(size);
    expect(new Set(s.mix.ids).size).toBe(size);
    await page.reload();
    await expect(page.locator('#mix-size')).toHaveValue(String(size));
    expect((await saved(page)).mix).toEqual(s.mix);
  });
}

test('daily mix: due first (oldest first), then shaky, then missed, then nothing unseen when the size is full', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({
    known: marks(['q0020', 'q0021']),
    shaky: marks(['q0030', 'q0031']),
    missed: marks(['q0040', 'q0041', 'q0042']),
    srs: { q0020: { box: 0, last: D(-9), due: D(-2) }, q0021: { box: 0, last: D(-9), due: D(-6) } },
    mixSize: 5,
  }) } });
  await expect(page.locator('#mix-progress')).toHaveText('0 / 5 done today');
  const ids5 = (await saved(page)).mix.ids as string[];
  expect(ids5.slice(0, 2)).toEqual(['q0021', 'q0020']);
  expect(sorted(ids5.slice(2, 4))).toEqual(['q0030', 'q0031']);
  expect(['q0040', 'q0041', 'q0042']).toContain(ids5[4]);
});

test('daily mix: a question that is both due and shaky appears once; a small pool gives a smaller mix', async ({ open }) => {
  const probe = await open({ time: NOW });
  const all = await ids(probe);
  const three = [all[3], all[4], all[5]];
  const rest = all.filter(i => !three.includes(i));
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({
    known: marks(rest), shaky: marks(three), srs: { [three[0]]: { box: 0, last: D(-3), due: D(-1) } }, mixSize: 20,
  })]);
  await probe.reload();
  const mix = (await saved(probe)).mix;
  expect(mix.day).toBe(D(0));
  expect(sorted(mix.ids)).toEqual(sorted(three));
  await expect(probe.locator('#mix-progress')).toHaveText('0 / 3 done today');
});

test('daily mix: unseen Core before unseen Standard, and unseen Niche is never picked', async ({ open }) => {
  const probe = await open({ time: NOW });
  const data = await bankData(probe);
  const pick = (tier: string, n: number) => data.filter(q => q.tier === tier).slice(0, n).map(q => q.id);
  const core = pick('Core', 3), std = pick('Standard', 3), niche = pick('Niche', 2);
  const open_ = new Set([...core, ...std, ...niche]);
  const rest = data.map(q => q.id).filter(i => !open_.has(i));
  await probe.evaluate(([k, v]) => localStorage.setItem(k, v), [BOX_KEY, progress({ known: marks(rest), mixSize: 20 })]);
  await probe.reload();
  const mixIds = (await saved(probe)).mix.ids as string[];
  expect(sorted(mixIds)).toEqual(sorted([...core, ...std]));
  expect(sorted(mixIds.slice(0, 3))).toEqual(sorted(core));
  await probe.locator('#mix-size').selectOption('5');
  const five = (await saved(probe)).mix.ids as string[];
  expect(sorted(five.slice(0, 3))).toEqual(sorted(core));
  expect(five.slice(3).every(i => std.includes(i))).toBe(true);
});

test('daily mix: start quizzes only what is not done; done count; all done disables the button', async ({ open }) => {
  const page = await open({ time: NOW });
  await page.locator('#mix-size').selectOption('5');
  const mixIds = (await saved(page)).mix.ids as string[];
  await page.locator('#mix-start').click();
  await rateOne(page, 'known');
  await goTo(page, 'review');
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText('1 / 5 done today');
  await page.locator('#mix-start').click();
  await rateOne(page, 'shaky');
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText('2 / 5 done today');
  await expect(page.locator('#mix-start')).toBeEnabled();
  await page.locator('#mix-start').click();
  expect(await rateAll(page, 'known')).toBe(3);
  await goTo(page, 'home');
  await expect(page.locator('#mix-progress')).toHaveText('5 / 5 done today');
  await expect(page.locator('#mix-start')).toBeDisabled();
  await expect(page.locator('#mix-start')).toHaveText(/Daily mix done/);
  const s = await saved(page);
  expect(sorted(Object.keys(s.srs))).toEqual(sorted(mixIds));
  expect((await saved(page)).mix.ids).toEqual(mixIds);
});

test('daily mix: the Today card fits the screen with the exam line and pace', async ({ open, fitsScreen }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({ exam: D(3) }) } });
  await expect(page.locator('#exam-pace')).toBeVisible();
  await expect(page.locator('#today')).toBeVisible();
  await fitsScreen();
});

// ---------------------------------------------------------------------------------------------
// Light and dark
// ---------------------------------------------------------------------------------------------

const LIGHT = 'rgb(246, 247, 249)';
const DARK = 'rgb(14, 16, 21)';

test('theme: the button cycles Auto, Light, Dark, Auto with attribute, background and storage', async ({ bank }) => {
  await bank.emulateMedia({ colorScheme: 'light' });
  const btn = bank.locator('#theme-btn');
  const html = bank.locator('html');
  await expect(btn).toHaveAccessibleName(/Theme: Auto/);
  await expect(html).not.toHaveAttribute('data-theme', /.*/);
  expect(await bgOf(bank)).toBe(LIGHT);
  await btn.click();
  await expect(btn).toHaveAccessibleName(/Theme: Light/);
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await bgOf(bank)).toBe(LIGHT);
  expect(await store(bank, 'qa-bank-theme')).toBe('light');
  await btn.click();
  await expect(btn).toHaveAccessibleName(/Theme: Dark/);
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await bgOf(bank)).toBe(DARK);
  expect(await store(bank, 'qa-bank-theme')).toBe('dark');
  await btn.click();
  await expect(btn).toHaveAccessibleName(/Theme: Auto/);
  await expect(html).not.toHaveAttribute('data-theme', /.*/);
  expect(await store(bank, 'qa-bank-theme')).toBeNull();
});

test('theme: Auto follows the system, an explicit choice does not', async ({ bank }) => {
  await bank.emulateMedia({ colorScheme: 'dark' });
  expect(await bgOf(bank)).toBe(DARK);
  await bank.emulateMedia({ colorScheme: 'light' });
  expect(await bgOf(bank)).toBe(LIGHT);
  await bank.locator('#theme-btn').click(); // Light
  await bank.emulateMedia({ colorScheme: 'dark' });
  expect(await bgOf(bank)).toBe(LIGHT);
  await bank.locator('#theme-btn').click(); // Dark
  await bank.emulateMedia({ colorScheme: 'light' });
  expect(await bgOf(bank)).toBe(DARK);
});

test('theme: the choice persists across a reload', async ({ bank }) => {
  await bank.emulateMedia({ colorScheme: 'light' });
  await bank.locator('#theme-btn').click();
  await bank.locator('#theme-btn').click(); // Dark
  await bank.reload();
  await expect(bank.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(bank.locator('#theme-btn')).toHaveAccessibleName(/Theme: Dark/);
  expect(await bgOf(bank)).toBe(DARK);
});

test('theme: it is already set when the document finishes parsing (no flash of the other theme)', async ({ open }) => {
  const page = await open({ seed: { 'qa-bank-theme': 'dark' } });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { __themeAtParse: string }).__themeAtParse = document.documentElement.getAttribute('data-theme') ?? 'none';
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { __themeAtParse: string }).__themeAtParse)).toBe('dark');
});

test('theme: Reset my progress does not touch the theme; the theme is not part of the progress', async ({ bank }) => {
  await bank.locator('#theme-btn').click(); // Light
  await bank.locator('#theme-btn').click(); // Dark
  await firstTopicFirstQuestion(bank);
  await bank.locator('.known-btn').click();
  await goTo(bank, 'home');
  await bank.locator('#reset-btn').click();
  await bank.locator('#reset-yes').click();
  await expect(bank.locator('#ov-text')).toHaveText(/^0 \//);
  expect(await store(bank, 'qa-bank-theme')).toBe('dark');
  await expect(bank.locator('html')).toHaveAttribute('data-theme', 'dark');
  await bank.reload();
  await expect(bank.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await store(bank, 'qa-bank')).not.toMatch(/theme|dark/);
});

test('reset clears every kind of progress, notes, marks, exam and backup', async ({ open }) => {
  const page = await open({ time: NOW, seed: { [BOX_KEY]: progress({
    known: marks(['q0001']), shaky: marks(['q0002']), missed: marks(['q0003']), notes: { q0004: 'n' }, code: { q0005: 'c' },
    srs: { q0001: { box: 1, last: D(0), due: D(3) } }, exam: D(9), backup: D(-2) }) } });
  await page.locator('#reset-btn').click();
  await page.locator('#reset-yes').click();
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  await expect(page.locator('#exam-line')).toHaveText('No interview date set');
  const s = await saved(page);
  for (const k of ['known', 'shaky', 'missed', 'notes', 'code', 'srs']) expect(s[k] ?? {}).toEqual({});
  expect(s.exam ?? null).toBeNull();
  expect(s.backup ?? null).toBeNull();
  await page.reload();
  await expect(page.locator('#ov-text')).toHaveText(/^0 \//);
  await expect(page.locator('#backup-line')).toContainText('Last backup: never');
});

// PAGE_URL is imported so the file fails to load if the fixture export disappears.
void PAGE_URL;
