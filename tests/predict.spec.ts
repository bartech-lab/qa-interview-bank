// Phase 3: predict the output, and Node parity (docs/phase3-spec.md). Written from the spec only; "FMn" is failure mode n.
import { test, expect, reload, bankData, progress, type Q } from './fixtures';
import { PREDICT, KEY, norm, predictCode, nodeLines, out, lines, errors, waitDone, today, openById } from './code-helpers';
import type { Page } from '@playwright/test';

test.use({ actionTimeout: 8_000 });

const MATCH = 'You got it: the output matches.';
const DIFFER = 'Not quite: compare your lines with the output.';
const predict = (page: Page) => page.locator('.predict');
const box = (page: Page) => predict(page).getByRole('textbox', { name: 'Your prediction' });
const go = (page: Page) => predict(page).getByRole('button', { name: 'Run and compare' });
const verdict = (page: Page) => predict(page).locator('.predict-verdict[data-verdict]');

// Types a prediction, presses Run and compare, and waits for a fresh verdict.
async function compare(page: Page, text: string) {
  await expect(box(page)).toBeVisible();
  await page.locator('.predict-verdict').evaluateAll(els => els.forEach(e => e.removeAttribute('data-verdict')));
  await box(page).fill(text);
  await go(page).click();
  await expect(verdict(page)).toHaveCount(1, { timeout: 15_000 });
  return { kind: (await verdict(page).getAttribute('data-verdict'))!, text: norm(await verdict(page).innerText()) };
}
const get = async (page: Page, id: string): Promise<Q> => (await bankData(page)).find(q => q.id === id)!;

test('predict 1: Learn shows the predict box with the first ts block, a Your prediction box and Run and compare', async ({ open }) => {
  const page = await open();
  await openById(page, 'q0236');
  const q = await get(page, 'q0236');
  await expect(predict(page)).toHaveCount(1);
  await expect(box(page)).toBeVisible();
  await expect(go(page)).toBeVisible();
  const first = predictCode(q);
  const lastBlock = q.body.split('```ts').slice(1).map(p => p.split('\n```')[0]).at(-1)!;
  const mine = first.split('\n').map(norm).filter(l => l.length > 20 && !lastBlock.includes(l));
  const theirs = lastBlock.split('\n').map(norm).filter(l => l.length > 20 && !first.includes(l));
  expect(mine.length, 'a line only in the first block').toBeGreaterThan(0);
  expect(theirs.length, 'a line only in the second block').toBeGreaterThan(0);
  const shown = norm(await predict(page).innerText());
  for (const l of mine) expect(shown).toContain(l);
  for (const l of theirs) expect(shown, 'only the first ts block is the prediction code').not.toContain(l);
});

test('predict 4: in Learn the answer is folded under Show the answer; Run and compare opens it', async ({ open }) => {
  const page = await open();
  await openById(page, 'q0289');
  const details = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Show the answer' }) });
  await expect(details).toHaveCount(1);
  expect(await details.evaluate(d => (d as HTMLDetailsElement).open)).toBe(false);
  await expect(page.getByText(/callbacks all see the same/)).toBeHidden();
  await compare(page, 'var 0\nvar 1\nvar 2');
  await expect.poll(() => details.evaluate(d => (d as HTMLDetailsElement).open)).toBe(true);
  await expect(page.getByText(/callbacks all see the same/)).toBeVisible();
});

test('FM9 q0289: var 3 three times, then let 0, let 1, let 2 (late timer lines are shown); the right prediction matches', async ({ open }) => {
  const page = await open();
  await openById(page, 'q0289');
  const want = ['var 3', 'var 3', 'var 3', 'let 0', 'let 1', 'let 2'];
  const v = await compare(page, want.join('\n'));
  expect(v.kind).toBe('match');
  expect(v.text).toContain(MATCH);
  const o = out(page);
  const r = await waitDone(o);
  expect(r.lines).toEqual(want);
  expect(r.errors).toEqual([]);
});

test('predict 3: lines are trimmed and empty lines dropped before comparing; order, missing and extra lines differ', async ({ open }) => {
  const page = await open();
  await openById(page, 'q0289');
  const padded = '  var 3  \n\nvar 3\t\n   \nvar 3\nlet 0   \n\n   let 1\nlet 2\n\n';
  expect((await compare(page, padded)).kind).toBe('match');
  const cases: Record<string, string> = {
    'the naive 0 1 2': 'var 0\nvar 1\nvar 2\nlet 0\nlet 1\nlet 2',
    'let before var': 'let 0\nlet 1\nlet 2\nvar 3\nvar 3\nvar 3',
    'a missing line': 'var 3\nvar 3\nlet 0\nlet 1\nlet 2',
    'an extra line': 'var 3\nvar 3\nvar 3\nlet 0\nlet 1\nlet 2\nlet 3',
    'an empty box': '',
    'spaces inside a line': 'var  3\nvar 3\nvar 3\nlet 0\nlet 1\nlet 2',
  };
  for (const [name, text] of Object.entries(cases)) {
    const v = await compare(page, text);
    expect(v.kind, name).toBe('differ');
    expect(v.text, name).toContain(DIFFER);
  }
  expect((await lines(out(page))).length, 'the output is shown after a wrong prediction too').toBe(6);
});

test('FM10 q0295: top-level await prints the three documented lines', async ({ open }) => {
  const page = await open();
  await openById(page, 'q0295');
  const v = await compare(page, "[ 'a', 'x', 'c' ]\nall failed with x\nfast");
  expect(v.kind).toBe('match');
  const r = await waitDone(out(page));
  expect(r.lines).toEqual(["[ 'a', 'x', 'c' ]", 'all failed with x', 'fast']);
  expect(r.errors).toEqual([]);
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('predict 1 and 4: in the quiz the predict box shows before Show answer, and Show answer works as before', async ({ open }) => {
  const page = await open();
  const ids = ['q0289', 'q0288', 'q0290', 'q0291', 'q0292', 'q0293', 'q0294', 'q0295', 'q0296', 'q0297'];
  await page.evaluate(([k, p]) => localStorage.setItem(k, p), [KEY, progress({ mix: { day: today(), ids }, mixSize: 10 })]);
  await reload(page);
  await page.locator('#mix-start').click();
  await expect(box(page)).toBeVisible();
  await expect(page.getByText(/callbacks all see the same/)).toBeHidden();
  expect((await compare(page, 'var 3\nvar 3\nvar 3\nlet 0\nlet 1\nlet 2')).kind).toBe('match');
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.getByText(/callbacks all see the same/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Knew it/ })).toBeVisible();
});

// predict 5 and the 11 questions: the page output equals Node's, in all three browsers
for (const id of PREDICT) {
  test(`predict 2 and 5: ${id} the page prints what Node prints, and that prediction matches`, async ({ open }) => {
    const page = await open();
    await openById(page, id);
    await expect(predict(page)).toHaveCount(1);
    const q = await get(page, id);
    const code = predictCode(q);
    const expected = nodeLines(code);
    const v = await compare(page, expected.join('\n'));
    const r = await waitDone(out(page));
    expect(r.errors).toEqual([]);
    expect(r.lines.join('\n')).toBe(expected.join('\n'));
    expect(v.kind).toBe('match');
    expect(v.text).toContain(MATCH);
    const wrong = await compare(page, expected.join('\n') + '\nsomething else');
    expect(wrong.kind).toBe('differ');
    expect(await errors(out(page))).toEqual([]);
  });
}
