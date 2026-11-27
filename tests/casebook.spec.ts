// Phase 4: links from Playwright questions to e2e-casebook cases (docs/phase4-spec.md, idea 51).
// Written from the spec only. The linked and unlinked question are chosen from src/casebook.json at run time.
// Not tested here: "the build fails on a bad link" (the maintainer's build check).
import { test, expect, bankData, goTo, progress, quizThese, load, currentId, PAGE_URL } from './fixtures';
import { openById } from './code-helpers';
import type { Page } from '@playwright/test';
import fs from 'node:fs';

type Case = { title: string; doc: string; page: string; solution?: string };
const book: { cases: Record<string, Case>; links: Record<string, number[]> } = JSON.parse(fs.readFileSync('src/casebook.json', 'utf8'));

const REPO = 'https://github.com/bartech-lab/e2e-casebook';
const CODESPACES = 'https://codespaces.new/bartech-lab/e2e-casebook?quickstart=1';
const SLEEPS = 'The live demo sleeps when idle and can take about a minute to wake.';

const isPlaywright = (q: { file: string; topic: string }) => /playwright/i.test(q.file + ' ' + q.topic);
async function pick(page: Page) {
  const all = (await bankData(page)).filter(isPlaywright);
  const linked = all.filter(q => book.links[q.id]);
  const unlinked = all.filter(q => !book.links[q.id]);
  expect(linked.length, 'Playwright questions with links').toBeGreaterThan(0);
  expect(unlinked.length, 'Playwright questions without links').toBeGreaterThan(0);
  const withSolution = (q: { id: string }) => book.links[q.id].some(n => book.cases[n].solution);
  const without = (q: { id: string }) => book.links[q.id].some(n => !book.cases[n].solution);
  return {
    linked: linked.find(q => book.links[q.id].length > 1 && withSolution(q)) ?? linked.find(withSolution)!,
    noSolution: linked.find(without),
    unlinked: unlinked[0],
  };
}
const block = (page: Page) => page.getByRole('region', { name: 'Practise on e2e-casebook' });

async function expectBlock(page: Page, id: string) {
  const b = block(page);
  await expect(b).toHaveCount(1);
  await expect(page.locator('.casebook')).toHaveCount(1);
  let links = 0;
  for (const n of book.links[id]) {
    const c = book.cases[n];
    const doc = b.getByRole('link', { name: `Case ${n}: ${c.title}`, exact: true });
    await expect(doc).toHaveAttribute('href', `${REPO}/blob/main/${c.doc}`);
    const live = b.getByRole('link', { name: `Try case ${n} live`, exact: true });
    await expect(live).toHaveAttribute('href', `https://e2e-proving-ground.onrender.com/?try=${encodeURIComponent(c.page)}`);
    links += 2;
    const sol = b.getByRole('link', { name: `Worked solution for case ${n}`, exact: true });
    if (c.solution) {
      await expect(sol).toHaveAttribute('href', `${REPO}/tree/main/solutions/cases/${c.solution}#readme`);
      links++;
    } else await expect(sol).toHaveCount(0);
  }
  const cs = b.getByRole('link', { name: 'Run real Playwright in GitHub Codespaces', exact: true });
  await expect(cs).toHaveCount(1);
  await expect(cs).toHaveAttribute('href', CODESPACES);
  links++;
  await expect(b).toContainText(SLEEPS);
  await expect(b.getByText(SLEEPS)).toHaveCount(1);
  await expect(b.getByRole('link')).toHaveCount(links);
  for (const a of await b.getByRole('link').all()) {
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', 'noopener');
  }
}

test('51: a linked question shows the block with the exact links, targets and rel in Learn', async ({ bank }) => {
  const { linked } = await pick(bank);
  await openById(bank, linked.id);
  await expectBlock(bank, linked.id);
});

test('51: a case without a worked solution gets no Worked solution link', async ({ bank }) => {
  const { noSolution } = await pick(bank);
  test.skip(!noSolution, 'every linked Playwright question has solutions only');
  await openById(bank, noSolution!.id);
  await expectBlock(bank, noSolution!.id);
});

test('51: the block holds one pair of links per linked case and the Codespaces link once', async ({ bank }) => {
  const multi = (await bankData(bank)).find(q => book.links[q.id]?.length > 1)!;
  expect(multi, 'a question linked to two cases').toBeTruthy();
  await openById(bank, multi.id);
  await expectBlock(bank, multi.id);
  await expect(block(bank).getByRole('link', { name: 'Run real Playwright in GitHub Codespaces' })).toHaveCount(1);
});

test('51: a Playwright question without links shows no block', async ({ bank }) => {
  const { unlinked } = await pick(bank);
  await openById(bank, unlinked.id);
  await expect(bank.getByRole('heading').first()).toBeVisible();
  await expect(bank.locator('.casebook')).toHaveCount(0);
  await expect(block(bank)).toHaveCount(0);
  await expect(bank.getByRole('link', { name: 'Run real Playwright in GitHub Codespaces' })).toHaveCount(0);
});

test('51: the block shows in the quiz only after Show answer', async ({ open }) => {
  const probe = await open();
  const { linked } = await pick(probe);
  const page = await open({ seed: { 'qa-bank': progress({ notes: { [linked.id]: 'n' } }) } });
  await goTo(page, 'review');
  await expect(quizThese(page)).toHaveText(/Quiz these 1/);
  await quizThese(page).click();
  await expect(page.locator('.casebook')).toHaveCount(0);
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expectBlock(page, linked.id);
});

test('51: an unlinked question in the quiz shows no block after Show answer', async ({ open }) => {
  const probe = await open();
  const { unlinked } = await pick(probe);
  const page = await open({ seed: { 'qa-bank': progress({ notes: { [unlinked.id]: 'n' } }) } });
  await goTo(page, 'review');
  await quizThese(page).click();
  await page.getByRole('button', { name: /Show answer/ }).click();
  await expect(page.getByRole('button', { name: /Knew it/ })).toBeVisible();
  await expect(page.locator('.casebook')).toHaveCount(0);
});

// ---------------------------------------------------------------- addresses (docs/phase4-spec.md, "Addresses")
test('address #qNNNN opens that question in Learn; #locators opens the trainer; an unknown one leaves home', async ({ watched: page }) => {
  const all = JSON.parse(fs.readFileSync('src/casebook.json', 'utf8')) as { links: Record<string, number[]> };
  const id = Object.keys(all.links).at(-1)!;
  await load(page, `${PAGE_URL}#${id}`);
  await expect(page.locator('#learn')).toBeVisible();
  expect(await currentId(page)).toBe(id);
  await page.evaluate(() => { location.hash = '#locators'; });
  await expect(page.locator('#locators')).toBeVisible();
  await expect(page.locator('#tab-locators')).toHaveClass(/\bon\b/);
  await page.evaluate(() => { location.hash = '#q0002'; });
  await expect.poll(() => currentId(page)).toBe('q0002');
  await page.goto('about:blank');  // a new load: changing only the # part would not reload the page
  await load(page, `${PAGE_URL}#q9999`);
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#learn')).toBeHidden();
});
