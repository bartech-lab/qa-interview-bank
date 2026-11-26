import { test, expect, PAGE_URL } from './fixtures';

const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('qa-bank') || '{"known":{},"code":{}}'));

test('home lists the 12 topics and no reset button before any progress', async ({ bank, fitsScreen }) => {
  await expect(bank.locator('.card.topic')).toHaveCount(12);
  await expect(bank.locator('#reset-btn')).toHaveCount(0);
  await fitsScreen();
});

test('marking a question as known counts it and saves it under the question id', async ({ bank, fitsScreen }) => {
  await bank.locator('.card.topic').first().click();
  await bank.locator('.known-btn').click();
  await expect(bank.locator('#ov-text')).toHaveText(/^1 \//);
  const s = await saved(bank);
  expect(Object.keys(s.known)).toEqual(['q0001']);
  await fitsScreen();
});

test('progress saved by the old version (file and question text) is kept and moved to the id', async ({ page }) => {
  await page.goto(PAGE_URL);
  const first = await page.evaluate(() => {
    const d = JSON.parse(document.getElementById('data')!.textContent!);
    return { key: d[0].file + '|' + d[0].q, id: d[0].id };
  });
  await page.evaluate(k => localStorage.setItem('qa-bank', JSON.stringify({ known: { [k]: 1 }, code: { [k]: '// old edit' } })), first.key);
  await page.reload();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await page.locator('.card.topic').first().click();
  await page.locator('.known-btn').click();
  await page.locator('.known-btn').click();
  const s = await saved(page);
  expect(s.known).toEqual({ [first.id]: 1 });
  expect(s.code).toEqual({ [first.id]: '// old edit' });
});

test('the live-coding editor saves an edit', async ({ bank, fitsScreen }) => {
  await bank.evaluate(() => (window as unknown as { go: (v: string, a: string) => void }).go('learn', '13-live-coding'));
  for (let i = 0; i < 60 && !(await bank.locator('textarea.ed').count()); i++) await bank.getByRole('button', { name: 'Next →' }).click();
  await bank.locator('textarea.ed').first().fill('// my edit');
  await expect.poll(async () => Object.keys((await saved(bank)).code).length).toBe(1);
  await fitsScreen();
});

test('a one-question quiz can be revealed and rated', async ({ bank, fitsScreen }) => {
  await bank.locator('#tab-quiz').click();
  await fitsScreen();
  await bank.locator('.startrow .btn.primary').click();
  await bank.getByRole('button', { name: /Show answer/ }).click();
  await fitsScreen();
  await bank.getByRole('button', { name: /Knew it/ }).click();
  await expect(bank.locator('#ov-text')).toHaveText(/^1 \//);
});

test('reset asks in the page, Cancel keeps progress, Yes clears it for good', async ({ bank }) => {
  await bank.locator('.card.topic').first().click();
  await bank.locator('.known-btn').click();
  await bank.locator('#tab-learn').click();
  await bank.locator('#reset-btn').click();
  await expect(bank.locator('#reset-ask')).toHaveText(/1 known mark\?/);
  await bank.locator('#reset-no').click();
  await expect(bank.locator('#ov-text')).toHaveText(/^1 \//);
  await bank.locator('#reset-btn').click();
  await bank.locator('#reset-yes').click();
  await expect(bank.locator('#ov-text')).toHaveText(/^0 \//);
  await bank.reload();
  await expect(bank.locator('#ov-text')).toHaveText(/^0 \//);
  expect(await saved(bank)).toEqual({ known: {}, code: {} });
});

test('each answer links a prefilled issue that names the question id', async ({ bank }) => {
  await bank.locator('.card.topic').first().click();
  const link = bank.getByRole('link', { name: 'Report a problem with this answer' });
  const href = new URL((await link.getAttribute('href'))!);
  expect(href.origin + href.pathname).toBe('https://github.com/bartech-lab/qa-interview-bank/issues/new');
  expect(href.searchParams.get('title')).toMatch(/^\[q0001\] /);
  expect(href.searchParams.get('body')).toContain('Id: q0001');
});

test('the page text claims nothing about real interviews and carries no Polish answer blocks', async ({ bank }) => {
  const html = await bank.content();
  expect(html).not.toMatch(/asked in (a )?real interviews?/i);
  expect(html).not.toContain('Powiedz:');
});
