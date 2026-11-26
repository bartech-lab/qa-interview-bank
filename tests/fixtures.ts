import { test as base, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const PAGE_URL = pathToFileURL(path.resolve('dist/index.html')).href;

type Fixtures = { bank: Page; fitsScreen: () => Promise<void> };

// Opens the built page from file:// (the way people use it) and fails the test on any page error,
// console error or browser dialog.
export const test = base.extend<Fixtures>({
  bank: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', e => problems.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
    page.on('dialog', d => { problems.push('browser dialog: ' + d.type()); void d.dismiss(); });
    await page.goto(PAGE_URL);
    await use(page);
    expect(problems, 'errors on the page').toEqual([]);
  },
  fitsScreen: async ({ page }, use) => {
    await use(async () => {
      const wider = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(wider, 'page is wider than the screen').toBe(false);
    });
  },
});
export { expect };
