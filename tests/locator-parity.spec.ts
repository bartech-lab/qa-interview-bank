// Phase 4: parity of the locator trainer with real Playwright (docs/phase4-spec.md, "Parity with real Playwright").
// Rows 1 to 48 and the tests were written from the spec only; rows 49 to 57 were added later. Rows 14, 18, 19 and 46 were
// replaced in phase 6: they targeted the case menu, which the frozen pages no longer carry (docs/phase4-spec.md). All rows are copied from the spec table; every task answer comes from src/locators/tasks.json.
import { test, expect, goTo } from './fixtures';
import type { Page, FrameLocator, Locator } from '@playwright/test';
import fs from 'node:fs';

type ParityRow = [n: number, page: string, text: string, kind: string, typed: string, zero: boolean];
type Info = { pages: { id: string; title: string; case: number }[]; tasks: { id: string; page: string; task: string; answer: string }[] };
const info: Info = JSON.parse(fs.readFileSync('src/locators/tasks.json', 'utf8'));

const PARITY: ParityRow[] = [
  [1, "notes", "getByText('Trip ideas')", "text", "", false],
  [2, "shop", "getByText('backpack')", "text", "case", false],
  [3, "orders", "getByText('Page 1 of 3', { exact: true })", "text", "", false],
  [4, "orders", "getByText('page 1', { exact: true })", "text", "case", true],
  [5, "orders", "getByText(/PLN$/)", "text", "regex", false],
  [6, "orders", "getByText('  page   1 of ')", "text", "spaces", false],
  [7, "signup", "getByLabel('email')", "label", "case", false],
  [8, "settings", "getByLabel('Display')", "label", "partial", false],
  [9, "billing-details", "getByLabel('Full name', { exact: true })", "label", "", false],
  [10, "expense-claims", "getByLabel(/pass/i)", "label", "regex", false],
  [11, "expense-claims", "getByPlaceholder('ewa@')", "placeholder", "partial", false],
  [12, "expense-claims", "getByPlaceholder('EWA@EXAMPLE.COM', { exact: true })", "placeholder", "case", true],
  [13, "shop", "getByTestId('order-total')", "testid", "", false],
  [14, "notes", "getByRole('listitem').filter({ has: page.getByText('Book notes') })", "filter", "", false],
  [15, "shop", "getByTestId('order')", "testid", "partial", true],
  [16, "gallery", "getByAltText('photo 1 of')", "alt", "case", false],
  [17, "gallery", "getByAltText(/Photo \\d of/)", "alt", "regex", false],
  [18, "gallery", "getByAltText('Photo 1 of 24 from the trip')", "alt", "", false],
  [19, "gallery", "getByAltText('from the trip')", "alt", "partial", false],
  [20, "orders", "locator('tbody tr')", "css", "", false],
  [21, "shop", "locator('[data-testid=\"order-total\"]')", "css", "", false],
  [22, "settings", "locator('select option')", "css", "", false],
  [23, "notes", "locator('li input[type=checkbox]')", "css", "", false],
  [24, "playlist", "locator('li:has-text(\"Slow Train\") button')", "css", "", false],
  [25, "product-tabs", "locator('//h1')", "xpath", "", false],
  [26, "orders", "locator('tbody tr').filter({ hasText: 'Piotr' })", "filter", "", false],
  [27, "orders", "getByRole('row').filter({ hasNotText: 'PLN' })", "filter", "", false],
  [28, "shop", "getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Reviews for Pen' }) })", "filter", "", false],
  [29, "notes", "locator('li').filter({ hasText: /ideas$/ })", "filter", "regex", false],
  [30, "playlist", "getByRole('listitem').filter({ hasText: 'slow' }).getByRole('button')", "filter", "case", false],
  [31, "orders", "locator('tbody tr').nth(2)", "nth", "", false],
  [32, "playlist", "getByRole('button', { name: /^Move/ }).last()", "last", "regex", false],
  [33, "gallery", "getByRole('img').first()", "first", "", false],
  [34, "notes", "getByRole('checkbox').nth(-1)", "nth", "", false],
  [35, "signup", "getByRole('button', { name: 'show PASSWORD' })", "role", "case", false],
  [36, "signup", "getByRole('button', { name: 'Show', exact: true })", "role", "", true],
  [37, "product-tabs", "getByRole('tabpanel', { includeHidden: true })", "role", "", false],
  [38, "billing-details", "getByRole('radio', { checked: false })", "role", "", false],
  [39, "orders", "getByRole('button', { disabled: true })", "role", "", false],
  [40, "product-tabs", "getByRole('heading', { level: 1 })", "role", "", false],
  [41, "settings", "getByRole('combobox', { name: /them/i })", "role", "regex", false],
  [42, "shop", "getByRole('checkbox', { checked: true })", "role", "", false],
  [43, "product-tabs", "getByRole('tab', { selected: true })", "role", "", false],
  [44, "shop", "getByRole('link', { name: 'reviews for' })", "role", "partial", false],
  [45, "orders", "getByRole('cell', { name: 'Ann' })", "role", "", false],
  [46, "playlist", "getByLabel('Move Slow Train')", "label", "", false],
  [47, "shop", "page.getByRole('button', { name: 'Add Pen' });", "role", "prefix", false],
  [48, "signup", "await page.getByLabel('Name', { exact: true })", "label", "prefix", false],
  [49, "notes", "getByRole('button', { name: 'Star' }).or(page.getByRole('button', { name: 'Archive' }))", "or", "", false],
  [50, "notes", "getByRole('checkbox').and(page.getByLabel('Trip ideas'))", "and", "", false],
  [51, "shop", "getByRole('link', { name: 'Reviews for Pen' }).or(page.getByRole('button', { name: 'Add Pen' })).first()", "or", "", false],
  [52, "orders", "getByRole('row').filter({ hasText: 'Ann' }).and(page.getByRole('row').filter({ hasText: '1006' }))", "and", "", false],
  [53, "shop", "getByRole('listitem').filter({ has: page.getByRole('button').or(page.getByRole('link')) })", "or", "", false],
  [54, "orders", "getByRole('row').filter({ has: page.getByRole('cell', { name: 'Ann' }), hasText: '400' })", "filter", "", false],
  [55, "orders", "getByRole('row').filter({ hasNotText: 'ann', hasText: /Ewa|Ola/ }).first()", "filter", "case", false],
  [56, "playlist", "getByRole('listitem').filter({ visible: true, hasText: 'slow' })", "filter", "case", false],
  [57, "orders", "getByRole('row').filter({ hasText: /a{1,2}, b|Ann/, has: page.getByRole('cell', { name: '400' }) })", "filter", "regex", false],
];

type Entry = { label: string; page: string; text: string; zero: boolean };
const entries: Entry[] = [
  ...PARITY.map(([n, page, text, , , zero]) => ({ label: `row ${n}`, page, text, zero })),
  ...info.tasks.map(t => ({ label: `task ${t.id}`, page: t.page, text: t.answer, zero: false })),
];

// What the trainer reads: surrounding spaces, one leading "await ", a leading "page." and a trailing ";" are removed, then "page." goes in front.
const real = (frame: FrameLocator, text: string): Locator => {
  const s = text.trim().replace(/^await /, '').replace(/;\s*$/, '');
  const full = s.startsWith('page.') ? s : 'page.' + s;
  return new Function('page', 'return ' + full)(frame);
};
const indexes = (l: Locator) => l.evaluateAll(els => els.map(e => [...document.querySelectorAll('*')].indexOf(e)));

async function typeAndWait(page: Page, text: string) {
  const input = page.locator('#loc-input');
  await input.fill('');
  await expect(page.locator('#loc-state')).toHaveAttribute('data-input', '');
  await input.fill(text);
  await expect(page.locator('#loc-state')).toHaveAttribute('data-input', text);
}

for (const p of info.pages) {
  const mine = entries.filter(e => e.page === p.id);
  test(`FM15 parity on ${p.id}: the marked set equals the set real Playwright matches (${mine.length} locators)`, async ({ bank }) => {
    test.setTimeout(90_000);
    await goTo(bank, 'locators');
    await expect(bank.locator('#locators')).toBeVisible();
    await bank.locator('#loc-page').selectOption(p.id);
    await expect(bank.locator('#loc-frame')).toHaveAttribute('title', `Frozen page: ${p.title}`);
    const frame = bank.frameLocator('#loc-frame');
    await expect(frame.locator('body *').first()).toBeAttached();
    for (const e of mine) {
      await typeAndWait(bank, e.text);
      const trainer = await indexes(frame.locator('[data-qa-match]'));
      const expected = await indexes(real(frame, e.text));
      expect.soft(trainer, `${e.label}: ${e.text}`).toEqual(expected);
      if (e.zero) {
        expect.soft(expected.length, `${e.label}: real Playwright matches nothing`).toBe(0);
        await expect.soft(bank.locator('#loc-state'), `${e.label}: the trainer says none`).toHaveAttribute('data-state', 'none');
      } else {
        expect.soft(expected.length, `${e.label}: real Playwright matches at least one element`).toBeGreaterThan(0);
      }
    }
  });
}

test('FM15 mix rule: the 57 rows hold every kind, at least 10 typed ones, and at most a third use only getByRole', () => {
  expect(PARITY).toHaveLength(57);
  expect(PARITY.map(r => r[0])).toEqual(Array.from({ length: 57 }, (_, i) => i + 1));
  for (const r of PARITY) expect(info.pages.map(p => p.id), `row ${r[0]} names a known page`).toContain(r[1]);
  const kinds = new Set(PARITY.map(r => r[3]));
  // No 'title' kind since phase 6: the only title attributes were in the case menu the frozen pages no longer carry.
  for (const k of ['text', 'label', 'placeholder', 'testid', 'alt', 'css', 'xpath', 'filter', 'nth', 'first', 'last', 'role', 'or', 'and']) expect(kinds, `kind ${k} present`).toContain(k);
  expect(PARITY.filter(r => r[4] !== '').length).toBeGreaterThanOrEqual(10);
  // Role-only: every call of the chain is getByRole (string contents do not count as calls).
  const calls = (text: string) => new Set([...text.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''").matchAll(/([A-Za-z]\w*)\(/g)].map(m => m[1]));
  const roleOnly = PARITY.filter(r => { const c = calls(r[2]); return c.size === 1 && c.has('getByRole'); });
  expect(roleOnly.length, 'role-only rows').toBeLessThanOrEqual(PARITY.length / 3);
  expect(roleOnly.length, 'role-only rows are found at all').toBeGreaterThan(0);
  expect(PARITY.filter(r => r[5]).length, 'rows that must match nothing').toBe(4);
  // A task answer is also checked: every one must be a locator of a known page.
  for (const t of info.tasks) expect(info.pages.map(p => p.id), `task ${t.id}`).toContain(t.page);
});
