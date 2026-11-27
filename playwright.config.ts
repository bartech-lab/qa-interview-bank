import { defineConfig, devices } from '@playwright/test';

const desktop = { viewport: { width: 1280, height: 800 } };
const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true };
// Phone-size projects run the original page tests and the layout tests tagged @narrow; the rest do not depend on screen size.
const narrowOnly = { grep: /page\.spec|@narrow/ };
// Playwright's Firefox loosens file:// rules; restore stock Firefox behaviour (docs/feasibility.md).
const stockFirefox = { launchOptions: { firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': true, 'privacy.file_unique_origin': true } } };

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 6,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'chromium-mobile', ...narrowOnly, use: { ...devices['Desktop Chrome'], ...mobile } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], ...desktop, ...stockFirefox } },
    { name: 'firefox-mobile', ...narrowOnly, use: { ...devices['Desktop Firefox'], viewport: mobile.viewport, ...stockFirefox } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], ...desktop } },
    { name: 'webkit-mobile', ...narrowOnly, use: { ...devices['Desktop Safari'], ...mobile } },
  ],
});
