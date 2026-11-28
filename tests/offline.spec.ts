// Phase 6, sections 6 and 7: offline copy on Pages and the data-version footer line (docs/phase6-spec.md, ideas 69, 12).
// "FMn" is failure mode n. The http tests use the `site` fixture (tests/fixtures.ts): a server for the page's folder.
import { test, expect, testWithSite, testWithProfile, bankData, ready, load } from './fixtures';
import type { Page } from '@playwright/test';
import fs from 'node:fs';

const NOTE = 'This copy works offline in this browser after this visit.';
const VERSION = /(?:\d{4}\.\d{2}\.\d{2}|local)\+[0-9a-f]{12}/;

// Page errors and console errors of an http page, minus the browser's own "Failed to load resource" lines
// (a stopped server makes the browser log those for favicon and similar requests; they are not the page's).
function collect(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) problems.push('console error: ' + m.text()); });
  page.on('dialog', d => { problems.push('browser dialog: ' + d.type()); void d.dismiss(); });
  return problems;
}
async function visit(page: Page, url: string) {
  await page.goto(url);
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1');
}
const swReady = (page: Page) => page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

// ---------------------------------------------------------------- section 6, build files
testWithSite('build files: sw.js, manifest.webmanifest and icon.svg sit beside index.html and are served', async ({ site, page }) => {
  const problems = collect(page);
  const get = (name: string) => page.request.get(`${site.url}/${name}`);
  const man = await get('manifest.webmanifest');
  expect(man.status(), 'manifest.webmanifest').toBe(200);
  const m = await man.json();
  expect(m.name).toBe('QA Interview Bank');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('./');
  const sw = await get('sw.js');
  expect(sw.status(), 'sw.js').toBe(200);
  const swText = await sw.text();
  expect(swText, 'the cache name carries the data version').toMatch(VERSION);
  expect(sw.headers()['content-type']).toMatch(/javascript/);
  const icon = await get('icon.svg');
  expect(icon.status(), 'icon.svg').toBe(200);
  expect(await icon.text()).toContain('<svg');
  expect(problems).toEqual([]);
});

test('the Pages workflow publishes the page, the worker, the manifest and every icon', async () => {
  const wf = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  for (const name of ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) expect(wf, name).toContain(name);
});

// ---------------------------------------------------------------- section 6, over http
testWithSite('over http: a manifest link, the worker registers, and #offline-note shows in the home footer once it is active', async ({ site, page }) => {
  const problems = collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect(page.locator('#offline-note')).toHaveText(NOTE, { timeout: 15_000 });
  expect(await swReady(page)).toBe(true);
  const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '').pathname));
  expect(regs).toEqual(['/sw.js']);
  expect(await page.locator('#offline-note').evaluate(el => !!el.closest('#home'))).toBe(true);
  expect(problems).toEqual([]);
});

testWithSite('over http: #offline-note is not in the other views', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  await page.locator('#tab-quiz').click();
  await expect(page.locator('#offline-note')).toBeHidden();
});

testWithSite('FM26 server stopped after one visit: a reload shows the page with its questions', async ({ site, page }) => {
  const problems = collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  const total = (await bankData(page)).length;
  expect(total).toBeGreaterThan(100);
  await site.stop();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.locator('.topic').first()).toBeVisible();
  expect((await bankData(page)).length).toBe(total);
  await expect(page.locator('#data-version')).toContainText(`${total} questions`);
  // the page works, not only paints: Learn opens a question
  await page.locator('.topic').first().click();
  await expect(page.locator('#learn')).toBeVisible();
  expect(problems).toEqual([]);
});

testWithSite('FM26 also by the address with index.html, after a restart of the server, and again offline', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  await site.stop();
  await page.goto(site.url + '/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await page.goto(site.url + '/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await site.start();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await site.stop();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
});

testWithSite('FM26 progress saved before going offline is still there offline', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  await page.locator('.topic').first().click();
  await page.locator('.known-btn').click();
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
  await site.stop();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.locator('#ov-text')).toHaveText(/^1 \//);
});

testWithSite('FM27 new deploy while online: a reload shows the newest page, not the cached one', async ({ site, page }) => {
  const problems = collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('meta[name="qib-deploy"]')).toHaveCount(0);
  const html = fs.readFileSync(process.env.QIB_PAGE || 'dist/index.html', 'utf8');
  site.swap({ index: html.replace('</head>', '<meta name="qib-deploy" content="two"></head>') });
  await page.reload();
  await ready(page);
  await expect(page.locator('meta[name="qib-deploy"]')).toHaveAttribute('content', 'two');
  // and again a second deploy: never one behind
  site.swap({ index: html.replace('</head>', '<meta name="qib-deploy" content="three"></head>') });
  await page.reload();
  await ready(page);
  await expect(page.locator('meta[name="qib-deploy"]')).toHaveAttribute('content', 'three');
  // Firefox loads the apple-touch-icon in the background, never through the page; when a reload cancels that load it logs
  // this generic line (CI run 46178936203; locally 1 in 40 runs under a CPU limit). Any other console error still fails.
  const cancelledIcon = /^console error: .*Failed to load ‘[^’]*\/apple-touch-icon\.png’\. A ServiceWorker intercepted the request and encountered an unexpected error\./;
  expect(problems.filter(p => !cancelledIcon.test(p))).toEqual([]);
});

testWithSite('FM27 a new data version: the new worker activates and the older caches are deleted', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('#offline-note')).toBeVisible({ timeout: 15_000 });
  const old = (await page.locator('#data-version').textContent())!.match(VERSION)![0];
  const before = await cacheNames(page);
  expect(before.length).toBeGreaterThan(0);
  expect(before.some(k => k.includes(old)), `a cache name holds ${old}: ${before}`).toBe(true);
  const NEW = '2099.01.01+abcdef012345';
  const html = fs.readFileSync(process.env.QIB_PAGE || 'dist/index.html', 'utf8');
  site.swap({
    index: html.replaceAll(old, NEW),
    sw: t => t.replaceAll(old, NEW) + `\n// deploy ${NEW}\n`,
  });
  await page.reload();
  await ready(page);
  // the new worker may wait for the old one to let go: close the page's only client (leave it), then come back
  await page.goto('about:blank');
  await page.goto(site.url + '/');
  await ready(page);
  await expect.poll(async () => (await cacheNames(page)).filter(k => k.includes(old)).length, { timeout: 20_000 }).toBe(0);
  await expect.poll(async () => (await cacheNames(page)).some(k => k.includes(NEW)), { timeout: 20_000 }).toBe(true);
  // still offline-ready on the new version
  await site.stop();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
});

// ---------------------------------------------------------------- FM28
test('FM28 file://: no manifest link, no worker, no #offline-note, no console error', async ({ watched: page }) => {
  await load(page);
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  await expect(page.locator('#offline-note')).toBeHidden();
  const regs = await page.evaluate(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations().catch(() => [])).length : 0));
  expect(regs).toBe(0);
  const reg = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /sw\.js|manifest/.test(n)));
  expect(reg).toEqual([]);
  await page.locator('#tab-quiz').click();
  await page.locator('#tab-review').click();
  await page.locator('#tab-learn').click();
});

// ---------------------------------------------------------------- section 7: the footer line
test('footer: #data-version reads "Questions: <data version>, N questions." with N the bank size', async ({ bank }) => {
  const total = (await bankData(bank)).length;
  const t = ((await bank.locator('#data-version').textContent()) ?? '').trim();
  expect(t).toMatch(new RegExp(`^Questions: ${VERSION.source}, ${total} questions\\.$`));
  await expect(bank.locator('#data-version')).toBeVisible();
  await expect(bank.locator('#home #data-version')).toHaveCount(1);
});

test('footer: the version equals dist/questions.json dataVersion when testing the built page', async ({ bank }) => {
  test.skip(!!process.env.QIB_PAGE, 'a copy of the page: its version is not the one of dist/questions.json');
  const json = JSON.parse(fs.readFileSync('dist/questions.json', 'utf8'));
  await expect(bank.locator('#data-version')).toHaveText(`Questions: ${json.dataVersion}, ${json.questions.length} questions.`);
});

test('footer: the data version is the same on every load (it comes from the questions, not the clock)', async ({ bank }) => {
  const a = (await bank.locator('#data-version').textContent())!;
  await bank.reload();
  await ready(bank);
  expect((await bank.locator('#data-version').textContent())!).toBe(a);
});

// ---------------------------------------------------------------- FM39, FM40: icons and installability
const pngSize = (b: Buffer) => {
  expect(b.subarray(0, 8).toString('hex'), 'PNG signature').toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('latin1'), 'first chunk').toBe('IHDR');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
// true when the four corner pixels of the image are fully opaque (a transparent corner shows black or white on iOS)
const opaqueCorners = (page: Page, url: string) => page.evaluate(async u => {
  const bmp = await createImageBitmap(await (await fetch(u)).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0);
  const at = (x: number, y: number) => g.getImageData(x, y, 1, 1).data[3];
  return [at(0, 0), at(bmp.width - 1, 0), at(0, bmp.height - 1), at(bmp.width - 1, bmp.height - 1), at(bmp.width >> 1, bmp.height >> 1)];
}, url);

testWithSite('FM39 manifest icons over http: icon.svg, icon-192.png and icon-512.png are listed, served as typed, and a PNG is the size it says', async ({ site, page }) => {
  const problems = collect(page);
  await visit(page, site.url + '/');
  const res = await page.request.get(`${site.url}/manifest.webmanifest`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/json/);
  const m = await res.json();
  const icons: { src: string; sizes: string; type?: string; purpose?: string }[] = m.icons ?? [];
  const bySrc = (name: string) => icons.filter(i => new URL(i.src, `${site.url}/manifest.webmanifest`).pathname === `/${name}`);
  for (const [name, sizes] of [['icon.svg', 'any'], ['icon-192.png', '192x192'], ['icon-512.png', '512x512']] as const) {
    const hit = bySrc(name);
    expect(hit, `${name} is listed once in the manifest`).toHaveLength(1);
    expect(hit[0].sizes, `${name} sizes`).toBe(sizes);
    expect(hit[0].purpose, `${name} purpose`).toBe('any');
  }
  for (const icon of icons) {
    const url = new URL(icon.src, `${site.url}/manifest.webmanifest`).href;
    const r = await page.request.get(url);
    expect(r.status(), `${icon.src} is served`).toBe(200);
    const type = r.headers()['content-type'].split(';')[0];
    const body = await r.body();
    if (/\.png$/.test(icon.src)) {
      expect(type, `${icon.src} content-type`).toBe('image/png');
      const { w, h } = pngSize(body);
      expect(`${w}x${h}`, `${icon.src} real size`).toBe(icon.sizes);
      expect(icon.type ?? 'image/png', `${icon.src} type field`).toBe('image/png');
      expect(await opaqueCorners(page, url), `${icon.src} is opaque in the corners and the middle`).toEqual([255, 255, 255, 255, 255]);
    } else {
      expect(/\.svg$/.test(icon.src), `${icon.src} is a PNG or an SVG`).toBe(true);
      expect(type, `${icon.src} content-type`).toBe('image/svg+xml');
      expect(body.toString('utf8')).toContain('<svg');
      expect(icon.type ?? 'image/svg+xml', `${icon.src} type field`).toBe('image/svg+xml');
    }
  }
  expect(problems).toEqual([]);
});

testWithSite('FM39 over http the page links apple-touch-icon.png, a 180x180 opaque PNG', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  await expect(page.locator('link[rel="apple-touch-icon"][href="apple-touch-icon.png"]')).toHaveCount(1);
  const url = `${site.url}/apple-touch-icon.png`;
  const r = await page.request.get(url);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type'].split(';')[0]).toBe('image/png');
  expect(pngSize(await r.body())).toEqual({ w: 180, h: 180 });
  expect(await opaqueCorners(page, url)).toEqual([255, 255, 255, 255, 255]);
});

testWithSite('FM39 the worker caches icon-192.png, icon-512.png and apple-touch-icon.png', async ({ site, page }) => {
  collect(page);
  await visit(page, site.url + '/');
  expect(await swReady(page)).toBe(true);
  const names = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon.svg'];
  await expect.poll(() => page.evaluate(async ns => {
    const out: string[] = [];
    for (const n of ns) if (await caches.match(new URL(n, location.href).href)) out.push(n);
    return out;
  }, names), { timeout: 15_000 }).toEqual(names);
});

testWithProfile('FM40 over http in a normal profile Chromium reports no installability errors', async ({ site, profilePage: page }) => {
  collect(page);
  await visit(page, site.url + '/');
  expect(await swReady(page)).toBe(true);
  const cdp = await page.context().newCDPSession(page);
  try {
    await expect.poll(async () => (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(e => e.errorId), { timeout: 15_000, message: 'installability errors' }).toEqual([]);
  } finally {
    await cdp.detach();
  }
});
