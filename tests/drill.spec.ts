// Phase 6, section 1: the locator drill leaves the header (docs/phase6-spec.md). Written from the spec only; "FMn" is failure mode n.
import { test, expect, goTo, load, PAGE_URL } from './fixtures';
import { topicRows } from './phase6-helpers';
import { openById as openQuestion } from './code-helpers';
import type { Page } from '@playwright/test';
import fs from 'node:fs';

type Info = { pages: { id: string; title: string; case: number; caseTitle: string }[] };
const info: Info = JSON.parse(fs.readFileSync('src/locators/tasks.json', 'utf8'));
const frameOf = (p: Page) => p.frameLocator('#loc-frame');
const drillQ = topicRows.filter(t => t.slug === 'pw-locators');
const otherPw = topicRows.filter(t => t.file === '01-playwright' && t.slug !== 'pw-locators');

async function openDrill(page: Page) {
  await goTo(page, 'learn', '01-playwright');
  await page.locator('#drill-open').click();
  await expect(page.locator('#locators')).toBeVisible();
}
async function choosePage(p: Page, id: string, title: string) {
  await p.locator('#loc-page').selectOption(id);
  await expect(p.locator('#loc-frame')).toHaveAttribute('title', `Frozen page: ${title}`);
  await expect(frameOf(p).locator('body *').first()).toBeAttached();
}

test('FM1 header: three view buttons Learn, Quiz, Review; no #tab-locators and no Locators button', async ({ bank }) => {
  const header = bank.getByRole('banner');
  await expect(header.locator('#tab-learn')).toHaveText('Learn');
  await expect(header.locator('#tab-quiz')).toHaveText('Quiz');
  await expect(header.locator('#tab-review')).toContainText('Review');
  await expect(bank.locator('#tab-locators')).toHaveCount(0);
  await expect(header.getByRole('button', { name: /Locators/i })).toHaveCount(0);
  // the three buttons are the whole view group: no fourth view button hides under another name
  expect(await header.locator('#tab-learn').evaluate(e => e.parentElement!.querySelectorAll('button').length)).toBe(3);
});

for (const how of ['address at load', 'hash change', 'go()'] as const) {
  test(`FM1 old link #locators (${how}) opens the drill and #tab-learn is "on"`, async ({ watched: page }) => {
    if (how === 'address at load') await load(page, `${PAGE_URL}#locators`);
    else {
      await load(page);
      if (how === 'hash change') await page.evaluate(() => { location.hash = '#locators'; });
      else await goTo(page, 'locators');
    }
    await expect(page.locator('#locators')).toBeVisible();
    await expect(page.locator('#tab-learn')).toHaveClass(/\bon\b/);
    await expect(page.locator('#tab-quiz')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('#tab-review')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('#learn')).toBeHidden();
    // leaving the drill moves the mark away
    await page.locator('#tab-quiz').click();
    await expect(page.locator('#locators')).toBeHidden();
    await expect(page.locator('#tab-learn')).not.toHaveClass(/\bon\b/);
  });
}

test('entry 1: Learn on the Playwright topic shows #drill-open "Locator drill"; it opens the drill; other topics show none', async ({ bank }) => {
  await goTo(bank, 'learn', '02-typescript-javascript');
  await expect(bank.locator('#drill-open')).toBeHidden();
  await goTo(bank, 'learn', '03-api');
  await expect(bank.locator('#drill-open')).toBeHidden();
  await goTo(bank, 'learn', '01-playwright');
  await expect(bank.getByRole('button', { name: 'Locator drill' })).toHaveAttribute('id', 'drill-open');
  await bank.locator('#drill-open').click();
  await expect(bank.locator('#locators')).toBeVisible();
  await expect(bank.locator('#tab-learn')).toHaveClass(/\bon\b/);
  await expect(frameOf(bank).locator('body *').first()).toBeAttached();
});

test('entry 2: each pw-locators question shows a "Practise in the locator drill" link-button under its answer', async ({ bank }) => {
  expect(drillQ.length).toBeGreaterThan(5);
  for (const t of [drillQ[0], drillQ.at(-1)!]) {
    await openQuestion(bank, t.id);
    const b = bank.locator('.drill-link');
    await expect(b).toHaveCount(1);
    await expect(b).toHaveAccessibleName('Practise in the locator drill');
    const head = await bank.locator('#learn h2, #learn h1').first().boundingBox();
    const at = await b.boundingBox();
    expect(at!.y, 'the button sits under the question heading').toBeGreaterThan(head!.y);
  }
  await b_click(bank);
  await expect(bank.locator('#locators')).toBeVisible();
  await expect(bank.locator('#tab-learn')).toHaveClass(/\bon\b/);
});
async function b_click(page: Page) { await page.locator('.drill-link').click(); }

test('entry 2: a Playwright question with another topic slug has no drill link', async ({ bank }) => {
  expect(otherPw.length).toBeGreaterThan(5);
  await openQuestion(bank, drillQ[0].id);
  await expect(bank.locator('.drill-link'), 'control: a pw-locators question has the link').toHaveCount(1);
  for (const t of [otherPw[0], otherPw.at(-1)!]) {
    await openQuestion(bank, t.id);
    await expect(bank.locator('#learn')).toBeVisible();
    await expect(bank.locator('.drill-link')).toBeHidden();
  }
  // a question of another file whose slug only looks alike
  const sql = topicRows.find(t => t.file === '04-sql-databases')!;
  await openQuestion(bank, sql.id);
  await expect(bank.locator('.drill-link')).toBeHidden();
});

test('#loc-back is the first control of the drill, named "← Playwright", and opens Learn on the Playwright topic', async ({ bank }) => {
  await openDrill(bank);
  const back = bank.locator('#loc-back');
  await expect(back).toHaveAccessibleName('← Playwright');
  expect(await bank.locator('#locators').evaluate(el => el.querySelector('button, select, input, a, textarea')!.id)).toBe('loc-back');
  await back.click();
  await expect(bank.locator('#locators')).toBeHidden();
  await expect(bank.locator('#learn')).toBeVisible();
  await expect(bank.locator('#tab-learn')).toHaveClass(/\bon\b/);
  await expect(bank.locator('#side')).toContainText('Playwright');
  await expect(bank.locator('#drill-open'), 'the Playwright topic is open again').toBeVisible();
  // the topic shows its own questions: the first one of the file
  const first = topicRows.find(t => t.file === '01-playwright')!;
  await expect(bank.locator('#learn h2').first()).toContainText(first.title.replace(/[`*]/g, '').slice(0, 20));
});

for (const p of info.pages) {
  test(`FM2 frozen page ${p.id}: no .sandbox-nav, no case catalogue, no jump box`, async ({ bank }) => {
    await goTo(bank, 'locators');
    await choosePage(bank, p.id, p.title);
    const f = frameOf(bank);
    await expect(f.locator('.sandbox-nav')).toHaveCount(0);
    await expect(f.getByText('Case catalogue')).toHaveCount(0);
    await expect(f.getByText('Jump to a case')).toHaveCount(0);
    await expect(f.getByRole('heading', { name: /Case catalogue/ })).toHaveCount(0);
    // the page content is still there: a heading and no empty frame
    await expect(f.locator('h1, h2').first()).toBeVisible();
  });
}

async function headingInView(page: Page, id: string, title: string, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await goTo(page, 'locators');
  await choosePage(page, id, title);
  const input = page.locator('#loc-input');
  const h = frameOf(page).locator('h1, h2').first();
  await expect(input).toBeInViewport({ ratio: 1 });
  await expect(h).toBeInViewport({ ratio: 1 });
  const y = await page.evaluate(() => window.scrollY);
  expect(y, 'the bank page did not scroll').toBe(0);
  const box = await h.boundingBox();
  expect(box!.y + box!.height, 'heading bottom inside the window').toBeLessThanOrEqual(size.height);
  expect(box!.x + box!.width, 'heading right edge inside the window').toBeLessThanOrEqual(size.width);
}
for (const p of info.pages) {
  test(`FM2 layout 1280x720 on ${p.id}: #loc-input and the frozen page's first heading are in view without scrolling`, async ({ bank }) => {
    await headingInView(bank, p.id, p.title, { width: 1280, height: 720 });
  });
  test(`FM2 layout 390x844 on ${p.id}: #loc-input and the frozen page's first heading are in view without scrolling @narrow`, async ({ bank }) => {
    await headingInView(bank, p.id, p.title, { width: 390, height: 844 });
  });
}

// "Everything else in phase4-spec stays": this one passes on the page before this phase too (it opens by the #locators address).
test('stays: the drill still has the picker with every frozen page, the case link and works with a locator', async ({ bank }) => {
  await goTo(bank, 'locators');
  expect(await bank.locator('#loc-page option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value))).toEqual(info.pages.map(p => p.id));
  await expect(bank.locator('#loc-case')).toHaveAccessibleName(`Case ${info.pages[0].case} on e2e-casebook: ${info.pages[0].caseTitle}`);
  await expect(frameOf(bank).locator('body *').first()).toBeAttached();
  await bank.locator('#loc-input').fill('getByRole(\'button\')');
  await expect(bank.locator('#loc-state')).toHaveAttribute('data-input', "getByRole('button')");
  await expect(bank.locator('#loc-state')).toHaveAttribute('data-state', /^(one|many|none)$/);
});
