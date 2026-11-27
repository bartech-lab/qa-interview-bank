// Phase 1 feasibility probes. Pages and packages go to probes/ (git-ignored); results to probes/results-<browser>.json.
//
//   node tools/probes.mjs setup                     install pinned packages into probes/, build bundles and probe pages
//   node tools/probes.mjs snapshot <app-url>        freeze pages of a running sample app into probes/pages/app/ (probe 11)
//   node tools/probes.mjs run <browser>...          run every probe by file:// and http in chromium, firefox or webkit
//
// Findings and the table live in docs/feasibility.md.
import { chromium, firefox, webkit } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'probes');
const PAGES = path.join(DIR, 'pages');
const BUNDLES = path.join(DIR, 'bundles');
const PACKAGES = {
  'sql.js': '1.17.0', 'quickjs-emscripten-core': '0.32.0', '@jitl/quickjs-singlefile-browser-release-sync': '0.32.0',
  'playwright-injected': '1.59.1', sucrase: '3.35.1', codemirror: '6.0.2', '@codemirror/lang-javascript': '6.2.5',
  '@codemirror/lang-sql': '6.10.0', '@codemirror/lang-yaml': '6.1.3', esbuild: '0.28.2',
};
const APP_PAGES = ['chat', 'board', 'basket', 'booking', 'billing-details', 'calendar', 'account-signin', 'checklist', 'comments', 'cinema'];
const CDN = 'https://cdn.jsdelivr.net/npm';

const read = f => fs.readFileSync(f, 'utf8');
const gz = s => zlib.gzipSync(s, { level: 9 }).length;
const size = s => ({ raw: Buffer.byteLength(s), gzip: gz(s) });
const inline = code => `<script>${code.replaceAll('</script', '<\\/script')}</script>`;
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>\n`;

// ---------- setup ----------
async function setup() {
  fs.mkdirSync(BUNDLES, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'package.json'), JSON.stringify({ private: true, dependencies: PACKAGES }, null, 1));
  execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund'], { cwd: DIR, stdio: 'inherit' });
  const esbuild = createRequire(path.join(DIR, 'package.json'))('esbuild');
  const entries = {
    cm: `export { EditorView, basicSetup } from 'codemirror'; export { javascript } from '@codemirror/lang-javascript';
         export { sql } from '@codemirror/lang-sql'; export { yaml } from '@codemirror/lang-yaml';`,
    pwi: `export { InjectedScript, getByRoleSelector, getAriaRole, getElementAccessibleName } from 'playwright-injected';`,
    // size only: what a locator trainer also needs, the parsers between locator text and selectors
    pwiTrainer: `export { InjectedScript, getByRoleSelector, getAriaRole, getElementAccessibleName, asLocator, locatorOrSelectorAsSelector, parseSelector } from 'playwright-injected';`,
    sucrase: `export { transform } from 'sucrase';`,
    qjs: `export { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core';
          export { default as variant } from '@jitl/quickjs-singlefile-browser-release-sync';`,
  };
  const sizes = {};
  for (const [name, contents] of Object.entries(entries)) {
    const out = path.join(BUNDLES, `${name}.js`);
    await esbuild.build({ stdin: { contents, resolveDir: DIR }, bundle: true, minify: true, format: 'iife', globalName: name.toUpperCase(),
      platform: 'browser', target: 'es2022', outfile: out, legalComments: 'none', logLevel: 'warning' });
    sizes[name] = size(read(out));
  }
  const sqlFile = path.join(DIR, 'node_modules/sql.js/dist/sql-wasm-inline.js');
  sizes.sql = size(read(sqlFile));
  fs.writeFileSync(path.join(DIR, 'sizes.json'), JSON.stringify(sizes, null, 1));
  writePages(read(sqlFile));
  console.log(sizes);
}

function writePages(sqlCode) {
  const b = n => read(path.join(BUNDLES, `${n}.js`));
  const w = (name, html) => fs.writeFileSync(path.join(PAGES, name), html);
  fs.mkdirSync(PAGES, { recursive: true });

  // 1: a worker made from text in the page (blob: URL and data: URL).
  w('p01-worker.html', page('p01', `<script>
function tryWorker(url) { return new Promise(res => {
  try { const w = new Worker(url); const t = setTimeout(() => { res('no answer in 3 s'); w.terminate(); }, 3000);
    w.onmessage = e => { clearTimeout(t); res(e.data === 42 ? 'ok' : 'wrong answer'); w.terminate(); };
    w.onerror = e => { clearTimeout(t); e.preventDefault(); res('error event: ' + (e.message || 'no message')); };
  } catch (e) { res('throws: ' + e.name + ' ' + e.message); } }); }
(async () => { const src = 'postMessage(6*7)';
  window.__result = { blob: await tryWorker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))),
                      data: await tryWorker('data:text/javascript,' + encodeURIComponent(src)) }; })();
</script>`));

  // 2: a sandboxed frame without allow-same-origin runs code, reports back, and cannot reach the page.
  w('p02-frame.html', page('p02', `<script>
addEventListener('message', e => { window.__result = { run: e.data.v === 42 ? 'ok' : 'wrong', parentAccess: e.data.parent, storage: e.data.storage, frameOrigin: e.data.origin }; });
setTimeout(() => { window.__result ??= { run: 'no answer in 3 s' }; }, 3000);
const f = document.createElement('iframe'); f.sandbox = 'allow-scripts';
f.srcdoc = '<script>let p, s; try { p = parent.document.title, p = "READ THE PAGE"; } catch (e) { p = "blocked"; }' +
  'try { localStorage.length; s = "available"; } catch (e) { s = "blocked"; }' +
  'parent.postMessage({ v: 6 * 7, parent: p, storage: s, origin: String(location.origin) }, "*")<\\/script>';
document.body.append(f);
</script>`));

  // 3 and 4: sql.js single-file build inlined; time to ready, wasm memory after 10,000 rows, a CTE with a window function.
  const memHook = `<script>
window.__mems = []; const OM = WebAssembly.Memory;
WebAssembly.Memory = function (d) { const m = new OM(d); __mems.push(m); return m; }; WebAssembly.Memory.prototype = OM.prototype;
for (const k of ['instantiate', 'instantiateStreaming']) { const o = WebAssembly[k]; if (o) WebAssembly[k] = async (...a) => {
  const r = await o.apply(WebAssembly, a); for (const v of Object.values((r.instance || r).exports)) if (v instanceof OM) __mems.push(v); return r; }; }
const wasmMB = () => Math.max(0, ...__mems.map(m => m.buffer.byteLength)) / 1048576;
const heapMB = () => performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'not reported';
</script>`;
  w('p03-sql.html', page('p03', memHook + inline(sqlCode) + `<script>
(async () => { const t1 = performance.now(); const SQL = await initSqlJs(); const ready = performance.now();
  const memReady = wasmMB(); const db = new SQL.Database();
  db.run('create table t(id integer primary key, g int, v real)'); db.run('begin');
  const st = db.prepare('insert into t(g, v) values (?, ?)'); for (let i = 0; i < 10000; i++) st.run([i % 10, i * 1.5]); st.free(); db.run('commit');
  const r = db.exec('with s as (select g, sum(v) total from t group by g) select g, total, rank() over (order by total desc) rk from s order by rk limit 3');
  window.__result = { readyMs: Math.round(ready), initMs: Math.round(ready - t1), rows: r[0].values.length, firstRank: r[0].values[0][2],
    sqlite: db.exec('select sqlite_version()')[0].values[0][0], wasmMBReady: memReady, wasmMB10k: wasmMB(), jsHeapMB: heapMB() };
})().catch(e => { window.__result = { error: String(e) }; });
</script>`));

  // 4 and 8: QuickJS single-file build; time to ready, and the interrupt handler against endless code.
  w('p04-quickjs.html', page('p04', memHook + inline(b('qjs')) + `<script>
(async () => { const t1 = performance.now(); const qjs = await QJS.newQuickJSWASMModuleFromVariant(QJS.variant); const ready = performance.now();
  // stack: 0 keeps QuickJS's default; a number sets its own stack limit in bytes, checked before the browser's stack runs out.
  const run = (code, stack) => { const rt = qjs.newRuntime(); rt.setInterruptHandler(QJS.shouldInterruptAfterDeadline(Date.now() + 1000));
    if (stack) rt.setMaxStackSize(stack);
    const ctx = rt.newContext(); const s = performance.now(); let msg;
    try { const r = ctx.evalCode(code);
      if (r.error) { const e = ctx.dump(r.error); msg = (e && (e.name + ': ' + e.message)) || String(e); r.error.dispose(); } else { msg = 'returned ' + ctx.dump(r.value); r.value.dispose(); }
    } catch (e) { msg = 'host throws ' + e.name + ': ' + e.message; }
    const ms = Math.round(performance.now() - s);
    try { ctx.dispose(); rt.dispose(); } catch (e) { msg += '; dispose throws ' + e.name; }
    return ms + ' ms, ' + msg; };
  const out = { readyMs: Math.round(ready), initMs: Math.round(ready - t1), wasmMB: wasmMB(), sum: run('let s = 0; for (let i = 0; i < 1e5; i++) s += i; s'),
    endlessLoop: run('while (true) {}') };
  for (const [label, stack] of [['default stack', 0], ['stack limit 256 KB', 262144]]) {
    out['recursion, ' + label] = run('function f() { return f() + 1 } f()', stack);
    out['recursionThatCatches, ' + label] = run('function f() { try { f() } catch (e) { f() } } f()', stack); }
  window.__result = out;
})().catch(e => { window.__result = { error: String(e) }; });
</script>`));

  // 5: files beside the HTML: classic script, module script, fetch, worker from a file.
  w('beside.js', 'window.besideScript = "ok";\n');
  w('beside.mjs', 'window.besideModule = "ok";\n');
  w('beside.json', '{"ok": true}\n');
  w('beside-worker.js', 'postMessage(42);\n');
  w('p05-beside.html', page('p05', `<script src="beside.js"></script><script type="module" src="beside.mjs"></script><script>
const out = {}; const fetched = fetch('beside.json').then(r => r.json()).then(j => j.ok ? 'ok' : 'wrong', e => 'fails: ' + e.name);
const worker = new Promise(res => { try { const w = new Worker('beside-worker.js'); w.onmessage = () => res('ok'); w.onerror = e => { e.preventDefault(); res('error event'); }; setTimeout(() => res('no answer in 3 s'), 3000); } catch (e) { res('throws: ' + e.name); } });
setTimeout(async () => { window.__result = { classicScript: window.besideScript || 'not loaded', moduleScript: window.besideModule || 'not loaded', fetch: await fetched, workerFromFile: await worker }; }, 1500);
</script>`));

  // 6: an optional part from a public CDN: classic script, its wasm by fetch, and an ES module by import() (style-mod: no dependencies, so jsDelivr's +esm rewrite is not under test).
  w('p06-cdn.html', page('p06', `<script src="${CDN}/sql.js@1.17.0/dist/sql-wasm.js"></script><script>
(async () => { const out = { classicScript: typeof initSqlJs === 'function' ? 'ok' : 'not loaded' }; let t = performance.now();
  try { const SQL = await initSqlJs({ locateFile: f => '${CDN}/sql.js@1.17.0/dist/' + f }); new SQL.Database().exec('select 1'); out.wasm = 'ok, ' + Math.round(performance.now() - t) + ' ms'; } catch (e) { out.wasm = 'fails: ' + e; }
  t = performance.now();
  try { const m = await import('${CDN}/style-mod@4.1.2/+esm'); out.esmImport = typeof m.StyleModule === 'function' ? 'ok, ' + Math.round(performance.now() - t) + ' ms' : 'wrong'; } catch (e) { out.esmImport = 'fails: ' + e; }
  window.__result = out; })();
</script>`));

  // 7: CodeMirror 6 with JavaScript/TypeScript, SQL and YAML mounts from the inlined bundle.
  w('p07-codemirror.html', page('p07', inline(b('cm')) + `<script>
const langs = { ts: CM.javascript({ typescript: true }), sql: CM.sql(), yaml: CM.yaml() }; const docs = { ts: 'const a: number = 1;', sql: 'select 1;', yaml: 'a: 1' };
for (const [k, l] of Object.entries(langs)) new CM.EditorView({ doc: docs[k], extensions: [CM.basicSetup, l], parent: document.body });
window.__result = { editors: document.querySelectorAll('.cm-editor').length, highlighted: document.querySelectorAll('.cm-content span').length > 0 ? 'yes' : 'no' };
</script>`));

  // 8: a time limit in a worker: endless loop, plain recursion, and recursion that catches its own stack error.
  w('p08-worker-limit.html', page('p08', `<script>
let last = performance.now(), gap = 0; setInterval(() => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; }, 20);
function limited(src) { return new Promise(res => { let w; const s = performance.now();
  try { w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { return res('no worker: ' + e.name); }
  const t = setTimeout(() => { w.terminate(); res('stopped by terminate() after ' + Math.round(performance.now() - s) + ' ms'); }, 1000);
  w.onmessage = e => { clearTimeout(t); w.terminate(); res('finished itself: ' + e.data); };
  w.onerror = e => { e.preventDefault(); clearTimeout(t); w.terminate(); res('error event: ' + e.message); }; }); }
(async () => { gap = 0; last = performance.now();
  const out = { endlessLoop: await limited('while (true) {}'),
    recursion: await limited('function f() { return f() + 1 } try { f() } catch (e) { postMessage(e.constructor.name) }'),
    recursionThatCatches: await limited('function f() { try { f() } catch (e) { f() } } f()'),
    afterwards: await limited('postMessage("ok")') };
  out.pageMaxGapMs = Math.round(gap); window.__result = out; })();
</script>`));

  // 9: a 3-second busy loop inside a sandboxed frame; does the page's own timer stall?
  w('p09-frame-freeze.html', page('p09', `<script>
let last = performance.now(), gap = 0; setInterval(() => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; }, 20);
const f = document.createElement('iframe'); f.sandbox = 'allow-scripts';
f.srcdoc = '<script>addEventListener("message", () => { const end = Date.now() + 3000; while (Date.now() < end) {} parent.postMessage("done", "*"); })<\\/script>';
f.onload = () => { gap = 0; last = performance.now(); f.contentWindow.postMessage('go', '*'); };
addEventListener('message', () => setTimeout(() => { window.__result = { pageMaxGapMs: Math.round(gap), frozen: gap > 2500 ? 'yes' : 'no' }; }, 200));
document.body.append(f);
</script>`));

  // 10: playwright-injected answers role locators in the page and inside a sandboxed frame.
  const fixture = '<button>Go</button><a href="#x">Docs</a><h2>Title</h2><input aria-label="Name"><button hidden>Hidden</button>';
  const query = `function pwiCounts() { const b = /Firefox/.test(navigator.userAgent) ? 'firefox' : /Chrome/.test(navigator.userAgent) ? 'chromium' : 'webkit';
  const inj = new PWI.InjectedScript(window, { isUnderTest: false, sdkLanguage: 'javascript', testIdAttributeName: 'data-testid', stableRafCount: 0, browserName: b, customEngines: [] });
  const n = (role, o) => inj.querySelectorAll(inj.parseSelector(PWI.getByRoleSelector(role, o)), document).length;
  return [n('button', { name: 'Go', exact: true }), n('link', { name: 'Docs' }), n('heading', { level: 2 }), n('textbox', { name: 'Name' }), n('button')].join(','); }`;
  w('p10-injected.html', page('p10', fixture + `<script type="text/plain" id="pwi">${b('pwi').replaceAll('</script', '<\\/script')}</script><script>
eval(document.getElementById('pwi').textContent); ${query}
const out = { expected: '1,1,1,1,1' }; try { out.page = pwiCounts(); } catch (e) { out.page = 'throws: ' + e; }
addEventListener('message', e => { out.sandboxedFrame = e.data; window.__result = out; });
setTimeout(() => { if (!window.__result) { out.sandboxedFrame = 'no answer in 5 s'; window.__result = out; } }, 5000);
const f = document.createElement('iframe'); f.sandbox = 'allow-scripts';
f.srcdoc = ${JSON.stringify(fixture)} + '<script>' + document.getElementById('pwi').textContent + '\\n' + ${JSON.stringify(query)} +
  '\\ntry { parent.postMessage(pwiCounts(), "*") } catch (e) { parent.postMessage("throws: " + e, "*") }<\\/script>';
document.body.append(f);
</script>`));
}

// ---------- snapshot of sample-app pages (probe 11): a React app with sandboxes at /s/<id>/<page> ----------
async function snapshot(base) {
  const out = path.join(PAGES, 'app');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: base });
    const p = await context.newPage();
    const freeze = async name => {
      await p.waitForTimeout(1000);  // sandbox pages hold a live socket, so the network never goes idle
      const html = await p.evaluate(() => {
        const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
        const doc = document.documentElement.cloneNode(true);
        doc.querySelectorAll('script, link[rel="stylesheet"], style').forEach(e => e.remove());
        const style = document.createElement('style'); style.textContent = css; doc.querySelector('head').append(style);
        return '<!doctype html>\n' + doc.outerHTML;
      });
      fs.writeFileSync(path.join(out, `${name}.html`), html);
    };
    await p.goto('/');
    await freeze('landing');
    for (const name of APP_PAGES) {
      const { id } = await (await context.request.post('/api/sandboxes')).json();
      await p.goto(`/s/${id}/${name}`);
      await p.getByLabel('Your name').fill('probe');
      await p.getByRole('button', { name: 'Join' }).click();
      await p.getByRole('main').getByRole('heading', { level: 1 }).waitFor();
      await freeze(name);
    }
    await context.close();
  } finally { await browser.close(); }
  console.log(`froze ${APP_PAGES.length + 1} pages into ${out}`);
}

// ---------- run ----------
const ENGINES = { chromium, firefox, webkit };
const ROLES = ['button', 'link', 'heading', 'textbox', 'checkbox', 'radio', 'combobox', 'listbox', 'option', 'list', 'listitem', 'img', 'navigation',
  'main', 'banner', 'region', 'dialog', 'tab', 'tabpanel', 'switch', 'table', 'row', 'cell', 'columnheader', 'spinbutton', 'slider', 'status', 'alert', 'group', 'form', 'article', 'searchbox', 'menuitem', 'progressbar'];

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const file = path.join(PAGES, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(PAGES) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
  });
  return new Promise(res => server.listen(0, '127.0.0.1', () => res(server)));
}

async function result(p, ms = 30000) {
  try { await p.waitForFunction(() => window.__result !== undefined, null, { timeout: ms }); return await p.evaluate(() => window.__result); }
  catch (e) { return { error: `no result in ${ms / 1000} s: ${e.message.split('\n')[0]}` }; }
}

async function withPage(browser, fn) {
  const context = await browser.newContext();
  try { const p = await context.newPage(); return await fn(p, context); } finally { await context.close(); }
}

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function parity(browser, url) {
  const pages = fs.readdirSync(path.join(PAGES, 'app')).filter(f => f.endsWith('.html')).sort();
  const pwi = read(path.join(BUNDLES, 'pwi.js'));
  let total = 0, same = 0; const diffs = [];
  for (const f of pages) await withPage(browser, async p => {
    await p.goto(`${url}app/${f}`);
    await p.addScriptTag({ content: pwi });
    const locators = await p.evaluate(({ roles, browserName }) => {
      document.querySelectorAll('*').forEach((e, i) => { e.dataset.pid = i; });
      window.__inj = new PWI.InjectedScript(window, { isUnderTest: false, sdkLanguage: 'javascript', testIdAttributeName: 'data-testid', stableRafCount: 0, browserName, customEngines: [] });
      const seen = new Map();
      for (const e of document.body.querySelectorAll('*')) {
        const role = PWI.getAriaRole(e); if (!role || !roles.includes(role)) continue;
        const name = PWI.getElementAccessibleName(e, false); if (name && name.length < 80) seen.set(role + '\u0000' + name, { role, name });
      }
      return [...roles.map(role => ({ role })), ...[...seen.values()].slice(0, 60)];
    }, { roles: ROLES, browserName: browser.browserType().name() });
    for (const l of locators) {
      const opts = l.name === undefined ? {} : { name: l.name, exact: true };
      const real = await p.getByRole(l.role, opts).evaluateAll(els => els.map(e => e.dataset.pid).join(','));
      const ours = await p.evaluate(({ role, opts }) => __inj.querySelectorAll(__inj.parseSelector(PWI.getByRoleSelector(role, opts)), document).map(e => e.dataset.pid).join(','), { role: l.role, opts });
      if (l.name === undefined && !real && !ours) continue;  // role absent on this page: not a test case
      total++; if (real === ours) same++; else diffs.push(`${f}: getByRole('${l.role}'${l.name === undefined ? '' : `, { name: ${JSON.stringify(l.name)} }`}) real [${real}] injected [${ours}]`);
    }
  });
  return { pages: pages.length, locators: total, same, differ: total - same, diffs: diffs.slice(0, 20) };
}

async function run(names) {
  const server = await serve();
  const httpBase = `http://127.0.0.1:${server.address().port}/`;
  const fileBase = pathToFileURL(PAGES).href + '/';
  const probes = fs.readdirSync(PAGES).filter(f => /^p\d\d-.*\.html$/.test(f)).sort();
  try {
    for (const name of names) {
      // Playwright's Firefox ships security.fileuri.strict_origin_policy=false; put back the stock file:// rules.
      const browser = await ENGINES[name].launch(name === 'firefox' ? { firefoxUserPrefs: { 'security.fileuri.strict_origin_policy': true, 'privacy.file_unique_origin': true } } : {});
      const rows = [];
      try {
        const version = browser.version();
        for (const [protocol, base] of [['file', fileBase], ['http', httpBase]]) {
          for (const f of probes) {
            const html = read(path.join(PAGES, f));
            const runs = /p0[34]-/.test(f) ? 5 : 1;
            const results = [];
            for (let i = 0; i < runs; i++) results.push(await withPage(browser, async p => { await p.goto(base + f, { waitUntil: 'commit' }); return result(p); }));
            const r = results[0];
            if (runs > 1 && r.readyMs !== undefined) { r.readyMs = `median of ${runs}: ${median(results.map(x => x.readyMs))}`; r.initMs = `median of ${runs}: ${median(results.map(x => x.initMs))}`; }
            rows.push({ probe: f, browser: name, version, protocol, result: r, size: size(html) });
            console.log(name, protocol, f, JSON.stringify(r));
          }
          if (name === 'chromium') for (const f of probes.filter(f => /p0[34]-/.test(f))) {
            const times = [];
            for (let i = 0; i < 5; i++) times.push(await withPage(browser, async (p, c) => {
              const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
              await p.goto(base + f, { waitUntil: 'commit' }); return (await result(p, 60000)).readyMs;
            }));
            const r = { readyMs: `median of 5: ${median(times)}`, note: 'CPU slowed 4x: an estimate for a mid-range phone, not a phone' };
            rows.push({ probe: f + ' (CPU 4x slower)', browser: name, version, protocol, result: r, size: size(read(path.join(PAGES, f))) });
            console.log(name, protocol, f, 'throttled', JSON.stringify(r));
          }
          if (fs.existsSync(path.join(PAGES, 'app'))) {
            const r = await parity(browser, base);
            rows.push({ probe: 'p11-parity', browser: name, version, protocol, result: r, size: null });
            console.log(name, protocol, 'p11-parity', JSON.stringify(r));
          }
        }
      } finally { await browser.close(); }
      fs.writeFileSync(path.join(DIR, `results-${name}.json`), JSON.stringify(rows, null, 1));
    }
  } finally { server.close(); }
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'setup') await setup();
else if (cmd === 'snapshot') await snapshot(args[0]);
else if (cmd === 'run') await run(args.length ? args : ['chromium', 'firefox']);
else { console.error('usage: node tools/probes.mjs setup | snapshot <app-url> | run <browser>...'); process.exit(2); }
