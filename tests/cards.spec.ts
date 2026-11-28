// Phase 6, section 2: own cards (docs/phase6-spec.md, idea 63). Written from the spec only; "FMn" is failure mode n.
import { test, expect, goTo, reload, marks, ratingButton, ymd, addDays } from './fixtures';
import fs from 'node:fs';
import { KEY, NOW, TODAY, card, cardsOf, seedWith, exportOf, file, store, rawStore, addCardViaForm, openSetup, startBtn, setupRoot, modeBtn, sizeBtn, topicRows } from './phase6-helpers';
import type { Page } from '@playwright/test';

const A = 'u0aaa', B = 'u0bbb', C = 'u0ccc', D = 'u0ddd';
const trio = () => ({
  [A]: card('Acme question one?', 'Acme answer one', 'Acme', '2026-01-01'),
  [B]: card('Acme question two?', 'Acme answer two', 'Acme', '2026-01-02'),
  [C]: card('Zeta question?', 'Zeta answer', 'Zeta', '2026-01-03'),
  [D]: card('Loose question?', 'Loose answer', '', '2026-01-04'),
});
const side = (p: Page) => p.locator('#side');
const learnText = (p: Page) => p.locator('#learn').innerText();
async function openCards(page: Page) { await goTo(page, 'learn', 'my-cards'); await expect(page.locator('#learn')).toBeVisible(); }
async function pickCard(page: Page, q: string) {
  await page.locator('#side-list .qlink').filter({ hasText: q }).click();
  await expect(page.locator('#learn')).toContainText(q);
}
const withCards = (open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, cards: Record<string, unknown>, extra: Record<string, unknown> = {}, time = true) =>
  open({ ...(time ? { time: NOW } : {}), seed: seedWith({ cards, ...extra }) });

// ---------------------------------------------------------------- home
test('home: with no cards #my-cards says how to start and offers #card-add', async ({ bank }) => {
  const box = bank.locator('#my-cards');
  await expect(box.getByRole('heading', { name: 'My cards' })).toBeVisible();
  await expect(box).toContainText('Add your own questions, for example one a company asked you. They stay in this browser and go into Export progress.');
  await expect(box.getByRole('button', { name: 'Add a card' })).toHaveAttribute('id', 'card-add');
  await expect(box.locator('.card-company')).toBeHidden();
  // it sits below the topics
  const topics = await bank.locator('.topic').last().boundingBox();
  const mine = await box.boundingBox();
  expect(mine!.y).toBeGreaterThan(topics!.y);
});

test('home: one row per company in name order, "No company" last, each named "<company> · N card(s)"', async ({ open }) => {
  const page = await withCards(open, { ...trio(), u0eee: card('Third Acme?', '', 'Acme') });
  const rows = page.locator('#my-cards .card-company');
  await expect(rows).toHaveCount(3);
  expect(await rows.allInnerTexts()).toEqual(['Acme · 3 cards', 'Zeta · 1 card', 'No company · 1 card']);
  await expect(rows.first()).toHaveRole('button');
  await expect(page.locator('#my-cards #card-add')).toHaveAccessibleName('Add a card');
});

test('home: a company row opens Learn on the cards at that company\'s first card', async ({ open }) => {
  const page = await withCards(open, trio());
  await page.locator('#my-cards .card-company', { hasText: 'Zeta' }).click();
  await expect(page.locator('#learn')).toBeVisible();
  await expect(page.locator('#learn')).toContainText('Zeta question?');
  await goTo(page, 'home');
  await page.locator('#my-cards .card-company', { hasText: 'Acme' }).click();
  await expect(page.locator('#learn')).toContainText('Acme question one?');
  await goTo(page, 'home');
  await page.locator('#my-cards .card-company', { hasText: 'No company' }).click();
  await expect(page.locator('#learn')).toContainText('Loose question?');
});

// ---------------------------------------------------------------- Learn on cards
test('Learn on cards: side title "My cards", #card-add-side, one section per company, "No company" last', async ({ open }) => {
  const page = await withCards(open, trio());
  await openCards(page);
  await expect(side(page).locator('.side-title')).toHaveText('My cards');
  await expect(side(page).getByRole('button', { name: 'Add a card' })).toHaveAttribute('id', 'card-add-side');
  const t = await side(page).innerText();
  const at = ['Acme', 'Zeta', 'No company'].map(n => t.indexOf(n));
  expect(at.every(i => i >= 0), 'every company is a section: ' + t).toBe(true);
  expect(at).toEqual([...at].sort((a, b) => a - b));
  expect(t.indexOf('Acme question one?')).toBeLessThan(t.indexOf('Acme question two?'));
  await expect(page.locator('#side-list .qlink')).toHaveCount(4);
});

test('card article: crumbs "My card" and company, no tier badge, question heading, answer, Edit and Delete', async ({ open }) => {
  const page = await withCards(open, trio());
  await openCards(page);
  await pickCard(page, 'Acme question two?');
  const text = await learnText(page);
  expect(text).toContain('My card');
  expect(text).toContain('Acme answer two');
  await expect(page.locator('#learn').getByRole('heading', { name: 'Acme question two?' })).toBeVisible();
  expect(await page.locator('#learn .tier').evaluateAll(els => els.filter(e => !e.closest('#side')).length)).toBe(0);
  await expect(page.locator('#card-edit')).toHaveAccessibleName('Edit card');
  await expect(page.locator('#card-delete')).toHaveAccessibleName('Delete card');
  await pickCard(page, 'Loose question?');
  const loose = await learnText(page);
  expect(loose).toContain('My card');
  await expect(page.locator('.company-note'), 'a card without a company has no company note').toBeHidden();
});

test('FM12 a card never shows a Report link or an e2e-casebook block; card text reaches no issue link', async ({ open }) => {
  const page = await withCards(open, { [A]: card('Locator strictness getByRole?', 'Use getByRole', 'Acme') });
  await openCards(page);
  await expect(page.locator('#learn')).toContainText('Locator strictness');
  await expect(page.getByRole('link', { name: 'Report a problem with this answer' })).toBeHidden();
  await expect(page.locator('.casebook')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Practise on e2e-casebook' })).toBeHidden();
  await expect(page.locator('.drill-link')).toBeHidden();
  const issueLinks = () => page.evaluate(() => [...document.querySelectorAll('#learn a[href]')].map(a => (a as HTMLAnchorElement).href).filter(h => /\/issues\/new|issues\?|[?&]title=/.test(h)));
  expect(await issueLinks()).toEqual([]);
  await page.locator('#card-edit').click();
  await expect(page.locator('#card-form')).toBeVisible();
  expect(await issueLinks()).toEqual([]);
  await page.locator('#card-cancel').click();
  await page.locator('#card-delete').click();
  expect(await issueLinks()).toEqual([]);
  // the page text still holds the card text only in the page: nothing in an href
  expect(await page.evaluate(() => [...document.querySelectorAll('#learn a[href]')].some(a => (a as HTMLAnchorElement).href.includes('Locator'))), 'card text in a link').toBe(false);
  // control: a bank question still carries its Report link
  await goTo(page, 'learn', '01-playwright');
  await expect(page.getByRole('link', { name: 'Report a problem with this answer' })).toHaveCount(1);
});

test('company note: a text box "Note for <company>" shared by the company\'s cards, saved, emptied = deleted', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'Remote first', Zeta: 'Zeta note' } });
  await openCards(page);
  await pickCard(page, 'Acme question one?');
  const note = page.getByRole('textbox', { name: 'Note for Acme' });
  await expect(note).toHaveClass(/company-note/);
  await expect(note).toHaveValue('Remote first');
  await note.fill('Asks about locators');
  await expect.poll(async () => (await store(page)).companies.Acme).toBe('Asks about locators');
  expect((await store(page)).companies.Zeta, 'another company is untouched').toBe('Zeta note');
  await pickCard(page, 'Acme question two?');
  await expect(page.getByRole('textbox', { name: 'Note for Acme' })).toHaveValue('Asks about locators');
  await page.getByRole('textbox', { name: 'Note for Acme' }).fill('');
  await expect.poll(async () => Object.keys((await store(page)).companies)).toEqual(['Zeta']);
  await reload(page);
  await openCards(page);
  await pickCard(page, 'Acme question one?');
  await expect(page.getByRole('textbox', { name: 'Note for Acme' })).toHaveValue('');
});

test('marks, My note, Next and Previous work for a card and use its id', async ({ open }) => {
  const page = await withCards(open, trio());
  await openCards(page);
  await pickCard(page, 'Acme question one?');
  await page.locator('.known-btn').click();
  await expect(page.locator('.known-btn')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'My note' }).fill('card note');
  await expect.poll(async () => (await store(page)).notes?.[A]).toBe('card note');
  let s = await store(page);
  expect(s.known).toEqual({ [A]: 1 });
  expect(s.srs[A].due, 'a known card gets a review date like a bank question').toMatch(/^\d{4}-\d\d-\d\d$/);
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.locator('#learn')).toContainText('Acme question two?');
  await page.locator('.shaky-btn').click();
  await expect.poll(async () => (await store(page)).shaky).toEqual({ [B]: 1 });
  await page.getByRole('button', { name: /Previous/ }).click();
  await expect(page.locator('#learn')).toContainText('Acme question one?');
  await expect(page.locator('.known-btn')).toHaveAttribute('aria-pressed', 'true');
  s = await store(page);
  expect(Object.keys(s.known)).toEqual([A]);
});

// ---------------------------------------------------------------- rendering (FM3)
const EVIL_Q = 'Why <img src=x onerror="window.__pwned=1"> and <b>bold</b>?';
const EVIL_A = 'Click [x](javascript:alert(1)) or [y](JavaScript:alert(2)) or [z](data:text/html,<script>alert(3)</script>) <script>window.__pwned=2</script> <a href="javascript:alert(4)">raw</a> [ok](https://example.com/ok) [rel](/relative) [ftp](ftp://example.com/f) **strong**';
async function expectSafe(page: Page) {
  const body = page.locator('#learn');
  await expect(body).toContainText('<img src=x onerror="window.__pwned=1">');
  await expect(body).toContainText('<script>window.__pwned=2</script>');
  expect(await page.locator('#learn img, #learn script').evaluateAll(els => els.filter(e => !e.closest('#side') && !e.closest('.editor')).length), 'no element made from card text').toBe(0);
  await expect(page.locator('#learn b, #learn strong').filter({ hasText: /^bold$/ })).toBeHidden();
  expect(await page.evaluate(() => [...document.querySelectorAll('#learn a[href]')].map(a => (a as HTMLAnchorElement).getAttribute('href')))).toEqual(['https://example.com/ok']);
  await expect(page.locator('#learn').getByRole('link', { name: 'ok', exact: true })).toHaveAttribute('href', 'https://example.com/ok');
  await expect(page.locator('#learn b, #learn strong').filter({ hasText: /^strong$/ })).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
}
test('FM3 card text with <img onerror> and javascript: links shows as text: no element, no unsafe link, no dialog, no page error', async ({ open }) => {
  const page = await withCards(open, { [A]: card(EVIL_Q, EVIL_A, 'Acme') });
  await openCards(page);
  await expectSafe(page);
});

test('FM3 the same text typed in the form is saved as typed, shows as text, and the edit form gives it back unchanged', async ({ open }) => {
  const page = await open({ time: NOW });
  await addCardViaForm(page, { q: EVIL_Q, a: EVIL_A, company: 'Acme' });
  await expect(page.locator('#learn')).toBeVisible();
  await expectSafe(page);
  const s = await store(page);
  const [id] = Object.keys(s.cards);
  expect(s.cards[id].q).toBe(EVIL_Q);
  expect(s.cards[id].a).toBe(EVIL_A);
  await page.locator('#card-edit').click();
  await expect(page.locator('#card-q')).toHaveValue(EVIL_Q);
  await expect(page.locator('#card-a')).toHaveValue(EVIL_A);
});

test('rendering: card Markdown goes through the answer reader (bold, code, lists); a link needs http:// or https://', async ({ open }) => {
  const page = await withCards(open, { [A]: card('Format?', 'Use `code` and **bold**.\n\n- one\n- two\n\nSee [http](http://example.com/p) and [bare](example.com).') });
  await openCards(page);
  await expect(page.locator('#learn b, #learn strong').filter({ hasText: 'bold' })).toHaveCount(1);
  await expect(page.locator('#learn code').filter({ hasText: 'code' }).first()).toBeVisible();
  await expect(page.locator('#learn li').filter({ hasText: 'two' })).toHaveCount(1);
  await expect(page.locator('#learn').getByRole('link', { name: 'http', exact: true })).toHaveAttribute('href', 'http://example.com/p');
  await expect(page.locator('#learn').getByRole('link', { name: 'bare' })).toBeHidden();
});

// ---------------------------------------------------------------- form
test('form: fields, names and ids; Cancel saves nothing; #card-company suggests used company names', async ({ open }) => {
  const page = await withCards(open, trio());
  await page.locator('#card-add').click();
  const form = page.locator('#card-form');
  await expect(form).toBeVisible();
  await expect(form.getByRole('textbox', { name: 'Question', exact: true })).toHaveAttribute('id', 'card-q');
  await expect(form.getByRole('textbox', { name: 'Answer', exact: true })).toHaveAttribute('id', 'card-a');
  await expect(form.getByLabel('Company (optional)')).toHaveAttribute('id', 'card-company');
  await expect(form.getByRole('button', { name: 'Save card' })).toHaveAttribute('id', 'card-save');
  await expect(form.getByRole('button', { name: 'Cancel' })).toHaveAttribute('id', 'card-cancel');
  await expect(page.locator('#card-msg')).toHaveAttribute('role', 'alert');
  const listId = await page.locator('#card-company').getAttribute('list');
  expect(listId, 'the company box has a suggestion list').toBeTruthy();
  expect(await page.evaluate(id => [...document.querySelectorAll(`#${id} option`)].map(o => (o as HTMLOptionElement).value).sort(), listId!)).toEqual(['Acme', 'Zeta']);
  const before = await rawStore(page);
  await page.locator('#card-q').fill('Typed but cancelled?');
  await page.locator('#card-cancel').click();
  await expect(page.locator('#card-form')).toBeHidden();
  expect(await rawStore(page)).toBe(before);
});

test('save: Learn shows the saved card; stored as { q, a, company, created } with a new id u + 1 to 16 characters of [0-9a-z]', async ({ open }) => {
  const page = await open({ time: NOW });
  await addCardViaForm(page, { q: 'What is flaky?', a: 'A test that passes and fails on the same code.', company: 'Acme' });
  await expect(page.locator('#learn')).toBeVisible();
  await expect(page.locator('#learn')).toContainText('What is flaky?');
  await expect(page.locator('#learn')).toContainText('A test that passes and fails on the same code.');
  const s = await store(page);
  const ids = Object.keys(s.cards);
  expect(ids).toHaveLength(1);
  expect(ids[0]).toMatch(/^u[0-9a-z]{1,16}$/);
  expect(s.cards[ids[0]]).toEqual({ q: 'What is flaky?', a: 'A test that passes and fails on the same code.', company: 'Acme', created: TODAY });
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card']);
});

test('save: a card with only a question is fine (answer and company empty)', async ({ open }) => {
  const page = await open({ time: NOW });
  await addCardViaForm(page, { q: 'Only a question' });
  const s = await store(page);
  expect(Object.values(s.cards)).toEqual([{ q: 'Only a question', a: '', company: '', created: TODAY }]);
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['No company · 1 card']);
});

test('new ids never repeat an existing id, even with the same time and the same random numbers', async ({ page, open }) => {
  // the same "random" value for the first 12 calls, so a page that does not check for repeats makes the same id twice
  await page.addInitScript(() => { const real = Math.random.bind(Math); let n = 0; Math.random = () => (n++ < 12 ? 0.5 : real()); });
  await page.clock.install({ time: NOW });
  await page.clock.setFixedTime(NOW);
  await open();
  for (let i = 0; i < 3; i++) await addCardViaForm(page, { q: `Same instant ${i}?` });
  const ids = Object.keys((await store(page)).cards);
  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  for (const id of ids) expect(id).toMatch(/^u[0-9a-z]{1,16}$/);
  expect(Object.values((await store(page)).cards).map(c => (c as { q: string }).q).sort()).toEqual(['Same instant 0?', 'Same instant 1?', 'Same instant 2?']);
});

test('edit: the form shows the card, Save keeps its id and marks, and Learn shows the new text', async ({ open }) => {
  const page = await withCards(open, trio(), { known: { [A]: 1 }, notes: { [A]: 'keep me' } });
  await openCards(page);
  await pickCard(page, 'Acme question one?');
  await page.locator('#card-edit').click();
  await expect(page.locator('#card-q')).toHaveValue('Acme question one?');
  await expect(page.locator('#card-a')).toHaveValue('Acme answer one');
  await expect(page.locator('#card-company')).toHaveValue('Acme');
  await page.locator('#card-q').fill('Acme question one, reworded?');
  await page.locator('#card-save').click();
  await expect(page.locator('#learn')).toContainText('Acme question one, reworded?');
  const s = await store(page);
  expect(Object.keys(s.cards).sort()).toEqual([A, B, C, D]);
  expect(s.cards[A].q).toBe('Acme question one, reworded?');
  expect(s.cards[A].created).toBe('2026-01-01');
  expect(s.known).toEqual({ [A]: 1 });
  expect(s.notes[A]).toBe('keep me');
});

// ---------------------------------------------------------------- form checks (FM4 to FM6)
async function tryAdd(page: Page, f: { q: string; a?: string; company?: string }) {
  await goTo(page, 'home');
  await page.locator('#card-add').click();
  await page.locator('#card-q').fill(f.q);
  if (f.a !== undefined) await page.locator('#card-a').fill(f.a);
  if (f.company !== undefined) await page.locator('#card-company').fill(f.company);
  await page.locator('#card-save').click();
}
for (const [name, q] of [['empty', ''], ['spaces only', '   '], ['spaces and a newline', ' \n\t  ']] as const) {
  test(`FM4 question ${name}: "Write the question first." and nothing saved, even with an answer and a company`, async ({ open }) => {
    const page = await open({ time: NOW });
    await tryAdd(page, { q, a: 'An answer without a question', company: 'Acme' });
    await expect(page.locator('#card-msg')).toHaveText('Write the question first.');
    await expect(page.locator('#card-form')).toBeVisible();
    const s = await store(page);
    expect(Object.keys(s.cards ?? {})).toEqual([]);
    expect(Object.keys(s.companies ?? {})).toEqual([]);
    await goTo(page, 'home');
    await expect(page.locator('#my-cards .card-company')).toBeHidden();
  });
}

const over = (n: number) => 'x'.repeat(n);
for (const [field, f, limit] of [
  ['Question', { q: over(10_001) }, 10_000],
  ['Answer', { q: 'Fine?', a: over(10_001) }, 10_000],
  ['Company', { q: 'Fine?', company: over(81) }, 80],
] as const) {
  test(`FM5 ${field} over its limit: "${field} is too long: at most N characters." and nothing saved`, async ({ open }) => {
    const page = await open({ time: NOW });
    await tryAdd(page, f);
    await expect(page.locator('#card-msg')).toHaveText(new RegExp(`^${field} is too long: at most ${String(limit).replace(/(\d)(?=(\d{3})$)/, '$1,?')} characters\\.$`));
    await expect(page.locator('#card-form')).toBeVisible();
    expect(Object.keys((await store(page)).cards ?? {})).toEqual([]);
  });
}
test('FM5 boundary: a question and an answer of exactly 10,000 characters and a 80-character company are saved', async ({ open }) => {
  const page = await open({ time: NOW });
  await tryAdd(page, { q: over(10_000), a: over(10_000), company: over(80) });
  await expect(page.locator('#card-form')).toBeHidden();
  const s = await store(page);
  const c = Object.values(s.cards)[0] as { q: string; a: string; company: string };
  expect([c.q.length, c.a.length, c.company.length]).toEqual([10_000, 10_000, 80]);
  expect((await page.locator('#card-msg').count()) === 0 || (await page.locator('#card-msg').innerText()) === '').toBe(true);
});

const MSG500 = 'You have 500 cards, the most this page keeps. Delete one to add another.';
test('FM6 the 501st card is refused with the 500 message; the 500th is accepted', async ({ open }) => {
  const page = await withCards(open, cardsOf(499));
  await tryAdd(page, { q: 'Number 500?' });
  await expect(page.locator('#card-form')).toBeHidden();
  expect(Object.keys((await store(page)).cards)).toHaveLength(500);
  await tryAdd(page, { q: 'Number 501?' });
  await expect(page.locator('#card-msg')).toHaveText(MSG500);
  await expect(page.locator('#card-form')).toBeVisible();
  const s = await store(page);
  expect(Object.keys(s.cards)).toHaveLength(500);
  expect(Object.values(s.cards).some(c => (c as { q: string }).q === 'Number 501?')).toBe(false);
});

test('FM6 company notes: at 50 notes, a card for a company that already has a note is still accepted', async ({ open }) => {
  const companies = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`Firm ${i}`, `note ${i}`]));
  const page = await withCards(open, { [A]: card('Existing?', '', 'Firm 0') }, { companies });
  await tryAdd(page, { q: 'Another for Firm 1?', company: 'Firm 1' });
  await expect(page.locator('#card-form')).toBeHidden();
  const s = await store(page);
  expect(Object.keys(s.cards)).toHaveLength(2);
  expect(Object.keys(s.companies)).toHaveLength(50);
});

// ---------------------------------------------------------------- storage full (FM7)
test('FM7 storage full while saving a card: #save-error shows and the card shows in this tab', async ({ open }) => {
  const page = await open({ fullStorage: true, time: NOW });
  const before = await rawStore(page);
  await expect(page.locator('#save-error')).toBeHidden();
  await page.evaluate(() => { (window as unknown as { __full: boolean }).__full = true; });
  await tryAdd(page, { q: 'Saved only in this tab?', a: 'Yes', company: 'Acme' });
  await expect(page.locator('#save-error')).toBeVisible();
  await expect(page.locator('#save-error')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#learn')).toBeVisible();
  await expect(page.locator('#learn')).toContainText('Saved only in this tab?');
  expect(await rawStore(page)).toBe(before);
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card']);
  // storage works again: the next change saves the card too
  await page.evaluate(() => { (window as unknown as { __full: boolean }).__full = false; });
  await addCardViaForm(page, { q: 'Second one?' });
  await expect(page.locator('#save-error')).toBeHidden();
  expect(Object.values((await store(page)).cards).map(c => (c as { q: string }).q).sort()).toEqual(['Saved only in this tab?', 'Second one?']);
});

// ---------------------------------------------------------------- import (FM8, FM9)
const okCard = card('Imported?', 'Yes', 'Acme', '2026-01-05');
const str = (n: number) => 'x'.repeat(n);
const bad: [string, Record<string, unknown>, string][] = [
  ['id q9999x', { cards: { q9999x: okCard } }, 'cards.q9999x'],
  ['id without the u prefix', { cards: { abc: okCard } }, 'cards.abc'],
  ['id u alone', { cards: { u: okCard } }, 'cards.u'],
  ['id of 17 characters after u', { cards: { ['u' + '1'.repeat(17)]: okCard } }, 'cards.u' + '1'.repeat(17)],
  ['id with an upper-case letter', { cards: { uAB: okCard } }, 'cards.uAB'],
  ['id with a dash', { cards: { 'u1-2': okCard } }, 'cards.u1-2'],
  ['card without q', { cards: { u1: { a: 'x', company: '', created: '2026-01-05' } } }, 'cards.u1'],
  ['q empty', { cards: { u1: { ...okCard, q: '' } } }, 'cards.u1'],
  ['q only spaces', { cards: { u1: { ...okCard, q: '   ' } } }, 'cards.u1'],
  ['q a number', { cards: { u1: { ...okCard, q: 5 } } }, 'cards.u1'],
  ['q over 10,000', { cards: { u1: { ...okCard, q: str(10_001) } } }, 'cards.u1'],
  ['a over 10,000', { cards: { u1: { ...okCard, a: str(10_001) } } }, 'cards.u1'],
  ['a missing', { cards: { u1: { q: 'x', company: '', created: '2026-01-05' } } }, 'cards.u1'],
  ['company over 80', { cards: { u1: { ...okCard, company: str(81) } } }, 'cards.u1'],
  ['created is not a day', { cards: { u1: { ...okCard, created: '2026-13-45' } } }, 'cards.u1'],
  ['created is a word', { cards: { u1: { ...okCard, created: 'yesterday' } } }, 'cards.u1'],
  ['card is a string', { cards: { u1: 'x' } }, 'cards.u1'],
  ['card is null', { cards: { u1: null } }, 'cards.u1'],
  ['one good and one bad card', { cards: { u1: okCard, u2: { ...okCard, q: '' } } }, 'cards.u2'],
  ['cards is an array', { cards: [okCard] }, 'cards'],
  ['company note over 10,000', { companies: { Acme: str(10_001) } }, 'companies.Acme'],
  ['company note a number', { companies: { Acme: 5 } }, 'companies.Acme'],
  ['companies is an array', { companies: ['x'] }, 'companies'],
];
for (const [name, part, listed] of bad) {
  test(`FM8 import with a bad part (${name}): the whole file is refused, naming ${listed}, nothing changes`, async ({ open }) => {
    const page = await withCards(open, { [A]: card('Mine already?') });
    const before = await rawStore(page);
    await page.locator('#import-input').setInputFiles(file(exportOf({ known: marks(['q0001']), ...part })));
    const msg = page.locator('#import-msg');
    await expect(msg).toHaveAttribute('data-kind', 'error');
    const text = (await msg.textContent())!;
    expect(text).toContain(listed);
    if (listed === 'cards' || listed === 'companies') expect(text).toMatch(new RegExp(`\\b${listed}\\b(?!\\.)`));
    await expect(page.locator('#import-ask')).toBeHidden();
    expect(await rawStore(page)).toBe(before);
    await reload(page);
    expect(await rawStore(page)).toBe(before);
  });
}
for (const [name, part, listed] of [
  ['501 cards', { cards: cardsOf(501) }, 'cards'],
  ['51 company notes', { companies: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`F${i}`, 'n'])) }, 'companies'],
] as const) {
  test(`FM8 import with ${name}: refused, naming ${listed}`, async ({ bank }) => {
    const before = await rawStore(bank);
    await bank.locator('#import-input').setInputFiles(file(exportOf(part)));
    await expect(bank.locator('#import-msg')).toHaveAttribute('data-kind', 'error');
    expect((await bank.locator('#import-msg').textContent())!).toMatch(new RegExp(`\\b${listed}\\b(?!\\.)`));
    expect(await rawStore(bank)).toBe(before);
  });
}
test('FM8 boundary: 500 cards and 50 company notes are accepted, with the longest allowed ids and texts', async ({ bank }) => {
  const cards = { ...cardsOf(498), ['u' + 'z9'.repeat(8)]: card(str(10_000), str(10_000), str(80), '2026-02-28'), u0: card('Short id?', '', '', '2026-01-01') };
  const companies = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`F${i}`, i === 0 ? str(10_000) : '']));
  await bank.locator('#import-input').setInputFiles(file(exportOf({ cards, companies })));
  await bank.locator('#import-yes').click();
  await expect(bank.locator('#import-msg')).toHaveAttribute('data-kind', 'ok');
  const s = await store(bank);
  expect(Object.keys(s.cards)).toHaveLength(500);
  expect(Object.keys(s.companies)).toHaveLength(50);
  await expect(bank.locator('#my-cards .card-company')).toHaveText([`${'x'.repeat(80)} · 1 card`, 'No company · 499 cards']);
});

test('FM9 import with good cards and marks, notes and code on them: imported, and not counted as "not in this version"', async ({ open }) => {
  const page = await open({ time: NOW });
  const cards = { u1: card('Imported one?', 'A1', 'Acme', '2026-01-05'), u2: card('Imported two?', '', '', '2026-01-06') };
  await page.locator('#import-input').setInputFiles(file(exportOf({
    cards, companies: { Acme: 'import note' },
    known: { q0003: 1, u1: 1 }, shaky: { u2: 1 }, notes: { u1: 'mine' }, code: { u2: 'let x' },
    srs: { u1: { box: 1, last: '2026-01-05', due: '2026-01-08' } },
  })));
  await expect(page.locator('#import-ask')).toBeVisible();
  await page.locator('#import-yes').click();
  const msg = page.locator('#import-msg');
  await expect(msg).toHaveAttribute('data-kind', 'ok');
  await expect(msg).not.toHaveText(/not in this version/);
  const s = await store(page);
  expect(s.cards).toEqual(cards);
  expect(s.companies).toEqual({ Acme: 'import note' });
  expect(s.known).toEqual({ q0003: 1, u1: 1 });
  expect(s.notes.u1).toBe('mine');
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card', 'No company · 1 card']);
});

test('FM9 control: a card-like id that is not in the file\'s cards still counts as "not in this version"', async ({ open }) => {
  const page = await open({ time: NOW });
  await page.locator('#import-input').setInputFiles(file(exportOf({ cards: { u1: card('Imported?') }, known: { u1: 1, u2: 1, q9999: 1 } })));
  await page.locator('#import-yes').click();
  const msg = page.locator('#import-msg');
  await expect(msg).toHaveAttribute('data-kind', 'ok');
  await expect(msg).toHaveText(/(\d+) questions? in the file (is|are) not in this version/);
  expect(/(\d+) questions?/.exec((await msg.textContent())!)![1]).toBe('2');
});

test('export carries the cards and the company notes; export then import round-trips them', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'n1' } });
  await expect(page.locator('#my-cards .card-company')).toHaveCount(3);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  const exported = JSON.parse(fs.readFileSync((await dl.path())!, 'utf8'));
  expect(exported.format).toBe(1);
  expect(exported.progress.v).toBe(2);
  expect(exported.progress.cards).toEqual(trio());
  expect(exported.progress.companies).toEqual({ Acme: 'n1' });
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  await reload(page);
  await expect(page.locator('#my-cards .card-company')).toBeHidden();
  await page.locator('#import-input').setInputFiles(file(exported));
  await page.locator('#import-yes').click();
  await expect(page.locator('#import-msg')).toHaveAttribute('data-kind', 'ok');
  expect((await store(page)).cards).toEqual(trio());
  await expect(page.locator('#my-cards .card-company')).toHaveCount(3);
});

test('an older page keeps unknown keys: progress with cards survives a save of another mark', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'n' } });
  await expect(page.locator('#my-cards .card-company')).toHaveCount(3);
  await goTo(page, 'learn', '01-playwright');
  await page.locator('.known-btn').click();
  const s = await store(page);
  expect(s.cards).toEqual(trio());
  expect(s.companies).toEqual({ Acme: 'n' });
  expect(s.v).toBe(2);
});

// ---------------------------------------------------------------- two tabs (FM10)
test('FM10 a second tab adds a card: the first tab shows it after the storage event and keeps its own', async ({ bank: a, secondTab: b }) => {
  await addCardViaForm(a, { q: 'From tab A?', company: 'Acme' });
  await goTo(a, 'home');
  await expect(a.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card']);
  // B loaded before A saved, so it holds an old copy
  await addCardViaForm(b, { q: 'From tab B?', company: 'Beta' });
  await goTo(b, 'home');
  await expect(a.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card', 'Beta · 1 card']);
  const s = await store(a);
  expect(Object.values(s.cards).map(c => (c as { q: string }).q).sort()).toEqual(['From tab A?', 'From tab B?']);
  await expect(b.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card', 'Beta · 1 card']);
});

test('FM10 a stale tab marking a bank question does not drop the other tab\'s cards', async ({ bank: a, secondTab: b }) => {
  await addCardViaForm(a, { q: 'From tab A?' });
  await goTo(b, 'learn', '01-playwright');
  await b.locator('.known-btn').click();
  const s = await store(a);
  expect(Object.values(s.cards)).toHaveLength(1);
  expect(Object.keys(s.known)).toHaveLength(1);
});

// ---------------------------------------------------------------- delete (FM11)
const ASK = 'Delete this card? Its marks and note go too.';
const LAST = ' It is the last card for Zeta, so its company note goes too.';
const everything = (id: string) => ({ known: { [id]: 1 }, notes: { [id]: 'n' }, code: { [id]: 'c' }, srs: { [id]: { box: 1, last: '2026-01-14', due: '2026-01-17' } } });
test('FM11 delete the last card of a company: the ask names it, Yes removes card, marks, note, code, review date, company note and the home row', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'acme n', Zeta: 'zeta n' }, ...everything(C) });
  await openCards(page);
  await pickCard(page, 'Zeta question?');
  await page.locator('#card-delete').click();
  await expect(page.locator('#card-delete-ask')).toHaveText(ASK + LAST);
  await expect(page.locator('#card-delete-yes')).toHaveText('Yes, delete');
  await expect(page.locator('#card-delete-no')).toHaveText('Cancel');
  await page.locator('#card-delete-yes').click();
  const s = await store(page);
  expect(Object.keys(s.cards).sort()).toEqual([A, B, D]);
  expect(s.companies).toEqual({ Acme: 'acme n' });
  for (const k of ['known', 'notes', 'code', 'srs']) expect(s[k]?.[C], k).toBeUndefined();
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['Acme · 2 cards', 'No company · 1 card']);
});

test('delete a card that is not the company\'s last: short ask, the company note stays; Cancel changes nothing', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'acme n' }, ...everything(A) });
  await openCards(page);
  await pickCard(page, 'Acme question one?');
  const before = await rawStore(page);
  await page.locator('#card-delete').click();
  await expect(page.locator('#card-delete-ask')).toHaveText(ASK);
  await page.locator('#card-delete-no').click();
  await expect(page.locator('#card-delete-ask')).toBeHidden();
  expect(await rawStore(page)).toBe(before);
  await expect(page.locator('#learn')).toContainText('Acme question one?');
  await page.locator('#card-delete').click();
  await page.locator('#card-delete-yes').click();
  await expect(page.locator('#learn')).toContainText('Acme question two?');
  const s = await store(page);
  expect(Object.keys(s.cards).sort()).toEqual([B, C, D]);
  expect(s.companies).toEqual({ Acme: 'acme n' });
  expect(s.known?.[A]).toBeUndefined();
  await goTo(page, 'home');
  await expect(page.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card', 'Zeta · 1 card', 'No company · 1 card']);
});

test('delete the only card: Learn goes home and the empty My cards text is back', async ({ open }) => {
  const page = await withCards(open, { [D]: card('Alone?') });
  await openCards(page);
  await page.locator('#card-delete').click();
  await expect(page.locator('#card-delete-ask')).toHaveText(ASK);
  await page.locator('#card-delete-yes').click();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#my-cards')).toContainText('Add your own questions');
  expect(Object.keys((await store(page)).cards)).toEqual([]);
});

// ---------------------------------------------------------------- cards elsewhere
test('Quiz: a "My cards" chip appears only when cards exist; it picks every card whatever the tier', async ({ open }) => {
  const none = await open({ time: NOW });
  await openSetup(none);
  await expect(setupRoot(none).getByRole('button', { name: /^My cards/ })).toBeHidden();
  await goTo(none, 'home');
  await addCardViaForm(none, { q: 'Quizzable one?' });
  await addCardViaForm(none, { q: 'Quizzable two?' });
  await addCardViaForm(none, { q: 'Quizzable three?' });
  await openSetup(none);
  await setupRoot(none).getByRole('button', { name: /^My cards/ }).click();
  await setupRoot(none).getByRole('button', { name: 'Core only (most asked)', exact: true }).click();
  await sizeBtn(none, 'All').click();
  await expect(startBtn(none)).toHaveText(/^Start 3 questions$/);
  await startBtn(none).click();
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    await expect(none.getByRole('button', { name: /Show answer/ })).toBeVisible();
    seen.add((await none.locator('#quiz').innerText()).match(/Quizzable (one|two|three)\?/)![1]);
    await none.getByRole('button', { name: /Show answer/ }).click();
    await ratingButton(none, 'known').click();
  }
  expect([...seen].sort()).toEqual(['one', 'three', 'two']);
});

test('Mock topic chips: a "My cards" chip appears when cards exist', async ({ open }) => {
  const page = await withCards(open, trio());
  await openSetup(page);
  await modeBtn(page, 'mock').click();
  await expect(setupRoot(page).getByRole('button', { name: /^My cards/ })).toHaveCount(1);
  await setupRoot(page).getByRole('button', { name: /^My cards/ }).click();
  await setupRoot(page).getByRole('button', { name: 'Core only (most asked)', exact: true }).click();
  await sizeBtn(page, 'All').click();
  await expect(startBtn(page)).toHaveText(/^Start mock interview \(4 questions\)$/);
});

test('Review: cards take part through their marks and review dates', async ({ open }) => {
  const yesterday = ymd(addDays(NOW, -1));
  const page = await withCards(open, trio(), {
    srs: { [A]: { box: 0, last: ymd(addDays(NOW, -3)), due: yesterday } },
    missed: { [B]: 1 }, shaky: { [C]: 1 }, notes: { [D]: 'my note' },
  });
  await goTo(page, 'review');
  for (const id of [A, B, C, D]) await expect(page.locator(`.rq-row[data-id="${id}"]`), id).toHaveCount(1);
  await expect(page.locator(`.rq-row[data-id="${A}"] .tag`)).toContainText('Due');
  await expect(page.locator(`.rq-row[data-id="${B}"] .tag`)).toContainText(/Didn.t know/);
  await expect(page.locator('#tab-review .badge')).toHaveText('1');
  await page.locator(`.rq-row[data-id="${C}"]`).click();
  await expect(page.locator('#learn')).toContainText('Zeta question?');
});

test('Daily mix: due and marked cards take part; new unrated cards do not enter it', async ({ page, open }) => {
  const cards = { u0due: card('Due card?'), u0shk: card('Shaky card?'), u0mis: card('Missed card?'), u0new: card('Brand new card?') };
  await withCards(open, cards, {
    srs: { u0due: { box: 0, last: ymd(addDays(NOW, -3)), due: ymd(addDays(NOW, -1)) } },
    shaky: { u0shk: 1 }, missed: { u0mis: 1 }, mixSize: 20,
  });
  const ids: string[] = (await store(page)).mix?.ids ?? [];
  expect(ids).toEqual(expect.arrayContaining(['u0due', 'u0shk', 'u0mis']));
  expect(ids).not.toContain('u0new');
  expect(ids.indexOf('u0due'), 'due first').toBeLessThan(ids.indexOf('u0shk'));
});

test('FM13 header counter counts bank questions only, with cards marked known', async ({ open }) => {
  const total = topicRows.length;
  const page = await withCards(open, trio(), { known: { [A]: 1, [B]: 1, [C]: 1, [D]: 1 } });
  await expect(page.locator('#ov-text')).toHaveText(new RegExp(`^0 / ${total}\\b`));
  await openCards(page);
  await pickCard(page, 'Loose question?');
  await page.locator('.known-btn').click();   // still known (pressing again would clear it): check both states
  await expect(page.locator('#ov-text')).toHaveText(new RegExp(`^0 / ${total}\\b`));
  await goTo(page, 'learn', '01-playwright');
  await page.locator('.known-btn').click();
  await expect(page.locator('#ov-text')).toHaveText(new RegExp(`^1 / ${total}\\b`));
  await reload(page);
  await expect(page.locator('#ov-text')).toHaveText(new RegExp(`^1 / ${total}\\b`));
});

test('Reset names "N cards" in what goes and deletes cards and company notes', async ({ open }) => {
  const page = await withCards(open, trio(), { companies: { Acme: 'n' } });
  await page.locator('#reset-btn').click();
  await expect(page.locator('#reset-ask')).toContainText('4 cards');
  await page.locator('#reset-no').click();
  expect(Object.keys((await store(page)).cards)).toHaveLength(4);
  await page.locator('#reset-btn').click();
  await page.locator('#reset-yes').click();
  const s = await store(page);
  expect(Object.keys(s.cards ?? {})).toEqual([]);
  expect(Object.keys(s.companies ?? {})).toEqual([]);
  await expect(page.locator('#my-cards .card-company')).toBeHidden();
});

test('Reset with one card says "1 card"; a reset with no cards does not mention cards', async ({ open, page }) => {
  await withCards(open, { [A]: card('One?') });
  await page.locator('#reset-btn').click();
  await expect(page.locator('#reset-ask')).toContainText(/\b1 card\b/);
  await page.locator('#reset-yes').click();
  await goTo(page, 'learn', '01-playwright');
  await page.locator('.known-btn').click();
  await goTo(page, 'home');
  await page.locator('#reset-btn').click();
  await expect(page.locator('#reset-ask')).toContainText('1 known mark');
  await expect(page.locator('#reset-ask')).not.toContainText(/card/i);
});

test('a second tab sees a deleted card go: Learn on cards in tab A updates after tab B deletes the last one', async ({ bank: a, secondTab: b }) => {
  await addCardViaForm(a, { q: 'Shared card?', company: 'Acme' });
  await reload(b);
  await expect(b.locator('#my-cards .card-company')).toHaveText(['Acme · 1 card']);
  await openCards(b);
  await b.locator('#card-delete').click();
  await b.locator('#card-delete-yes').click();
  await expect(a.locator('#my-cards .card-company')).toBeHidden();
});
