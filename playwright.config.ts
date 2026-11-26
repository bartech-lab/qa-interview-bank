import { defineConfig, devices } from '@playwright/test';

const desktop = { viewport: { width: 1280, height: 800 } };
const mobile = { viewport: { width: 390, height: 844 }, hasTouch: true };

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 6,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], ...mobile } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], ...desktop } },
    { name: 'firefox-mobile', use: { ...devices['Desktop Firefox'], viewport: mobile.viewport } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], ...desktop } },
    { name: 'webkit-mobile', use: { ...devices['Desktop Safari'], ...mobile } },
  ],
});
