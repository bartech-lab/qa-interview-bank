// Real Safari check (docs/feasibility.md, "Real Safari"). Runs on macOS with safaridriver enabled (sudo safaridriver --enable).
// Drives Safari over plain W3C WebDriver, no packages. For each way of opening the built page it checks:
//   ready   the page unpacks its questions (html[data-ready="1"])
//   worker  TS task q1019's worked solution runs in a worker and prints its ok line
//   limit   the 5 s limit stops while (true) {}
//   sql     SQL task q1030's worked answer is judged "match"
//   locators  the Locators tab marks 3 Add buttons on the Shop page, and 2 elements for an .or() locator
// Targets: file:// of dist/index.html, a local http server on dist/, and the GitHub Pages copy.
// Whether Safari's automation may open file:// at all is recorded, not assumed; a refused file:// is a finding, not a failure.
//
// Usage: node tools/safari-check.mjs [pages-url]   (run tools/build.py first; writes safari-results.json)
// Exit 1 when any check fails, other than file:// being refused (then the later checks for that target are skipped).
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PAGES_URL = process.argv[2] || 'https://bartech-lab.github.io/qa-interview-bank/';
const PORT = 4444;
const LIMIT = 'Stopped after 5 s: the code was still running. Look for an endless loop, runaway recursion or a timer that never stops.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

// ---------- WebDriver ----------
let session;
async function wd(method, route, body) {
  const r = await fetch(`http://127.0.0.1:${PORT}${route.replace(':s', session)}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json();
  if (json.value && json.value.error) throw new Error(`${json.value.error}: ${json.value.message}`);
  return json.value;
}
const js = (script, ...args) => wd('POST', '/session/:s/execute/sync', { script, args });
async function until(what, fn, ms) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn().catch(e => `error: ${e.message}`);
    if (last && !(typeof last === 'string' && last.startsWith('error:'))) return last;
    await sleep(250);
  }
  throw new Error(`${what}: not reached in ${ms / 1000} s (last: ${JSON.stringify(last)})`);
}
async function click(css) {
  const el = await wd('POST', '/session/:s/element', { using: 'css selector', value: css });
  await wd('POST', `/session/:s/element/${Object.values(el)[0]}/click`, {});
}

// Opens question `id` in Learn and puts `code` into its editor through the page's own functions (typing into CodeMirror would add brackets).
const OPEN = `const [id, kind] = arguments; const all = eval('Q'); const i = all.findIndex(q => q.id === id);
  eval('go')('learn', all[i].file); eval('pick')(i);
  const full = all[i].f['Full process'] || '';
  if (kind === 'sql') return eval('workedAnswer')(all[i]).code;
  return [...full.matchAll(/^\\s*\`\`\`ts\\b[^\\n]*\\n([\\s\\S]*?)^\\s*\`\`\`/gm)].at(-1)[1];`;
const SET = `const box = document.querySelector('.editor'); if (!box) return 'no editor';
  eval('setEditorCode')(box, arguments[0]); document.querySelectorAll('.out-status').forEach(e => { e.textContent = ''; });
  document.querySelectorAll('.verdict').forEach(e => e.removeAttribute('data-verdict')); return 'ok';`;
const STATUS = `const s = document.querySelector('.out .out-status'); const t = s ? s.textContent : '';
  return /^(Finished in \\d+ ms\\.|Stopped\\.|Stopped after 5 s: .*)$/.test(t) ? { status: t, lines: [...document.querySelectorAll('.out .out-line')].map(e => e.textContent) } : null;`;

async function checks(url) {
  const out = {};
  const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = `FAIL: ${e.message.split('\n')[0]}`; } };
  await step('open', async () => {
    await wd('POST', '/session/:s/url', { url });
    const at = await wd('GET', '/session/:s/url');
    if (at.startsWith(url.split(':')[0] + ':')) return `ok, at ${at}`;
    // Safari shows its own error page instead of the file; keep what it says.
    const text = await js("return (document.title + ': ' + document.body.innerText).replace(/\\s+/g, ' ').trim()").catch(e => e.message);
    throw new Error(`refused: Safari shows ${at}, "${text.slice(0, 300)}"`);
  });
  if (String(out.open).startsWith('FAIL')) return out;
  await step('ready', async () => { await until('data-ready', () => js("return document.documentElement.dataset.ready === '1'"), 20000); return 'ok'; });
  await step('worker', async () => {
    const code = await js(OPEN, 'q1019', 'ts');
    const ok = /console\.log\('([^']*: ok)'\)/.exec(code)?.[1];
    await until('editor', () => js(SET, code).then(r => r === 'ok'), 10000);
    await click('.run-btn');
    const r = await until('run finished', () => js(STATUS), 15000);
    if (!r.status.startsWith('Finished in') || !r.lines.includes(ok)) throw new Error(`status "${r.status}", lines ${JSON.stringify(r.lines)}, wanted "${ok}"`);
    return `ok, printed "${ok}"; ${r.status}`;
  });
  await step('limit', async () => {
    await until('editor', () => js(SET, 'while (true) {}').then(r => r === 'ok'), 10000);
    const t = Date.now();
    await click('.run-btn');
    const r = await until('limit', () => js(STATUS), 15000);
    if (r.status !== LIMIT) throw new Error(`status "${r.status}"`);
    return `ok, stopped after ${((Date.now() - t) / 1000).toFixed(1)} s with the limit message`;
  });
  await step('sql', async () => {
    const code = await js(OPEN, 'q1030', 'sql');
    await until('editor', () => js(SET, code).then(r => r === 'ok'), 10000);
    await click('.check-btn');
    const v = await until('verdict', () => js("const v = document.querySelector('.verdict[data-verdict]'); return v ? v.dataset.verdict : null"), 20000);
    if (v !== 'match') throw new Error(`verdict "${v}"`);
    return 'ok, verdict match';
  });
  await step('locators', async () => {
    // The Locators tab (phase 4): the trainer's frame reads locators with Playwright's engine and reports a count.
    await js("eval('go')('locators')");
    await until('trainer ready', () => js("const s = document.getElementById('loc-state'); return !!s && s.dataset.input === ''"), 20000);
    const got = [];
    for (const [text, want] of [["getByRole('button', { name: /^Add/ })", '3'], ["getByRole('link', { name: 'Reviews for Pen' }).or(getByRole('button', { name: 'Add Pen' }))", '2']]) {
      await js("eval('locPick')('shop'); const i = document.getElementById('loc-input'); i.value = arguments[0]; eval('locSend')();", text);
      const count = await until('locator result', () => js("const s = document.getElementById('loc-state'); return s.dataset.input === arguments[0] ? (s.dataset.count || s.dataset.state) : null", text), 15000);
      if (count !== want) throw new Error(`${text}: ${count}, wanted ${want}`);
      got.push(`${want} for ${text.slice(0, 24)}…`);
    }
    return `ok, ${got.join('; ')}`;
  });
  return out;
}

// ---------- run ----------
const types = { '.html': 'text/html; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(DIST, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const driver = spawn('safaridriver', ['-p', String(PORT)], { stdio: 'inherit' });
const local = fs.readFileSync(path.join(DIST, 'index.html'));
const result = { date: new Date().toISOString(), macos: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(),
  runnerImage: `${process.env.ImageOS || 'unknown'} ${process.env.ImageVersion || ''}`.trim(), commit: process.env.GITHUB_SHA || 'local',
  localPage: { bytes: local.length, sha256: sha(local) }, targets: {} };
let failed = false;
try {
  await until('safaridriver', () => fetch(`http://127.0.0.1:${PORT}/status`).then(r => r.ok), 20000);
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
  session = s.sessionId;
  result.safari = { browserName: s.capabilities.browserName, browserVersion: s.capabilities.browserVersion, platformName: s.capabilities.platformName };
  try {
    const pages = Buffer.from(await (await fetch(PAGES_URL)).arrayBuffer());
    result.pagesPage = { url: PAGES_URL, bytes: pages.length, sha256: sha(pages), sameAsLocalBuild: sha(pages) === sha(local) };
    // file:// from three places: the checkout, /tmp and the home folder, to tell a refused protocol from an unreadable folder.
    const copies = [['file', path.join(DIST, 'index.html')], ['file-tmp', '/tmp/qib/index.html'], ['file-home', path.join(os.homedir(), 'qib', 'index.html')]];
    for (const [, f] of copies.slice(1)) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(path.join(DIST, 'index.html'), f); }
    for (const [name, url] of [...copies.map(([n, f]) => [n, pathToFileURL(f).href]), ['http', `http://127.0.0.1:${server.address().port}/`], ['pages', PAGES_URL]]) {
      result.targets[name] = { url, ...(await checks(url)) };
      console.log(name, JSON.stringify(result.targets[name]));
      for (const [k, v] of Object.entries(result.targets[name])) {
        if (String(v).startsWith('FAIL') && !(name.startsWith('file') && k === 'open')) failed = true;
      }
    }
  } finally { await wd('DELETE', '/session/:s'); }
} catch (e) {
  result.error = e.message;
  failed = true;
} finally {
  driver.kill();
  server.close();
}
fs.writeFileSync(path.join(ROOT, 'safari-results.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
process.exit(failed ? 1 : 0);
