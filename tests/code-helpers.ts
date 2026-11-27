// Helpers for the phase 3 tests (docs/phase3-spec.md). They use only the page parts named in the spec.
import { expect, bankData, goTo, reload, ymd, type Q } from './fixtures';
import type { Page, Locator } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const KEY = 'qa-bank';
export const TS_TASKS = ['q1019', 'q1020', 'q1021', 'q1022', 'q1023', 'q1024', 'q1025', 'q1026', 'q1027', 'q1028', 'q1029'];
export const SQL_TASKS = ['q1030', 'q1031', 'q1032', 'q1033', 'q1034'];
export const PREDICT = ['q0236', 'q0288', 'q0289', 'q0290', 'q0291', 'q0292', 'q0293', 'q0294', 'q0295', 'q0296', 'q0297'];

export const DONE = /^(Finished in \d+ ms\.|Stopped\.|Stopped after 5 s: .*|Output stopped at 1,000 lines\.)$/;
export const LIMIT = 'Stopped after 5 s: the code was still running. Look for an endless loop, runaway recursion or a timer that never stops.';
export const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---- reading the question text (markdown) ----
export type Block = { info: string; code: string; full: boolean };
export function blocks(body: string): Block[] {
  const res: Block[] = [];
  let full = false, open: { info: string; lines: string[] } | null = null;
  for (const line of body.split('\n')) {
    if (open) {
      if (/^```\s*$/.test(line)) { res.push({ info: open.info, code: open.lines.join('\n'), full }); open = null; } else open.lines.push(line);
    } else if (/^```/.test(line)) open = { info: line.slice(3).trim(), lines: [] };
    else if (line.startsWith('**Full process:**')) full = true;
  }
  return res;
}
export const isTs = (b: Block) => /^ts(\s|$)/.test(b.info);
export const isRunTs = (b: Block) => isTs(b) && /\brun\b/.test(b.info);
export const isRunSql = (b: Block) => /^sql(\s|$)/.test(b.info) && /\brun\b/.test(b.info);
export const starterOf = (q: Q) => blocks(q.body).find(b => !b.full)!.code;
// A task: a question whose Starter holds a code block (docs/phase3-spec.md). q1015's starter has none.
export const isTask = (q: Q) => /```/.test((/^\*\*Starter:\*\*[\s\S]*?(?=^\*\*[A-Z][\w -]*:\*\*|$(?![\s\S]))/m.exec(q.body) || [''])[0]);
export const workedTs = (q: Q) => blocks(q.body).filter(b => b.full && isTs(b)).at(-1)!.code;
export const predictCode = (q: Q) => blocks(q.body).find(b => b.full && isTs(b))!.code;
// The block fenced "sql answer" (or "sql answer ordered"); until the fences exist, the documented fallback per task.
export function workedSql(q: Q): { code: string; ordered: boolean } {
  const bs = blocks(q.body).filter(b => b.full && /^sql(\s|$)/.test(b.info));
  const fenced = bs.find(b => /^sql\s+answer\b/.test(b.info));
  if (fenced) return { code: fenced.code, ordered: /\bordered\b/.test(fenced.info) };
  const pick = q.id === 'q1032' ? bs.find(b => /DELETE/.test(b.code)) : bs[0];
  return { code: pick!.code, ordered: q.id === 'q1033' || q.id === 'q1034' };
}
export const okLine = (code: string) => /console\.log\('([^']*: ok)'\)/.exec(code)?.[1];

// ---- Node parity: the same code saved as .mts and run by this machine's Node ----
export function nodeLines(code: string): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qib-'));
  try {
    const file = path.join(dir, 'x.mts');
    fs.writeFileSync(file, code);
    const out = execFileSync(process.execPath, [file], { timeout: 10000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
    const lines = out.split('\n');
    if (lines.at(-1) === '') lines.pop();
    return lines;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- page parts ----
export const editor = (page: Page) => page.locator('.editor').getByRole('textbox', { name: 'Code editor' });
export const out = (page: Page) => page.locator('.out').first();
export const runBtn = (page: Page) => page.locator('.run-btn');
export const lines = (o: Locator) => o.locator('.out-line').allTextContents();
export const errors = (o: Locator) => o.locator('.out-error').allTextContents();
export const status = (o: Locator) => o.locator('.out-status');
const clearOld = (page: Page) => page.evaluate(() => document.querySelectorAll('.out-status').forEach(e => { e.textContent = ''; }));

// Opens Learn on one question: its topic, then pick(index). (fixtures.openById looks the index up in a second copy of the list and gets -1.)
export async function openById(page: Page, id: string) {
  const all = await bankData(page);
  const i = all.findIndex(x => x.id === id);
  await goTo(page, 'learn', all[i].file);
  await page.evaluate(n => (window as unknown as { eval: (s: string) => (i: number) => void }).eval('pick')(n), i);
}

// Waits until the visible editor is the upgraded one (not the plain textarea).
export async function upgraded(page: Page) {
  await expect(editor(page)).toBeVisible();
  await expect.poll(() => editor(page).evaluate(el => el.tagName), { timeout: 10_000, message: 'editor upgraded from the textarea' }).not.toBe('TEXTAREA');
}

// Writes the code into the saved progress, reloads and opens the question in Learn.
// Chromium can drop a localStorage write made from the test right before a reload (seen once in CI: the page showed the
// starter), so the write is repeated until the reloaded page reads it back. This is the test's seeding, not the page.
export async function task(page: Page, id: string, code?: string) {
  if (code !== undefined) {
    for (let attempt = 1; ; attempt++) {
      await page.evaluate(([k, i, c]) => {
        const s = JSON.parse(localStorage.getItem(k) || 'null') || { v: 2, known: {}, shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null };
        s.code = s.code || {};
        s.code[i] = c;
        localStorage.setItem(k, JSON.stringify(s));
      }, [KEY, id, code]);
      await reload(page);
      const seen = await page.evaluate(([k, i]) => (JSON.parse(localStorage.getItem(k) || '{}').code || {})[i], [KEY, id]);
      if (seen === code) break;
      if (attempt === 3) throw new Error(`the page did not read the seeded code for ${id} after 3 reloads`);
    }
  }
  await openById(page, id);
}

export type RunResult = { lines: string[]; errors: string[]; status: string };
export async function waitDone(o: Locator, timeout = 15_000): Promise<RunResult> {
  await expect(status(o)).toHaveText(DONE, { timeout });
  return { lines: await lines(o), errors: await errors(o), status: (await status(o).textContent())! };
}
// Presses the Run button of the task and waits for its status line.
export async function run(page: Page, timeout = 15_000): Promise<RunResult> {
  await expect(runBtn(page)).toHaveText('Run');
  await clearOld(page);
  await runBtn(page).click();
  return waitDone(out(page), timeout);
}
// Opens the task with this code and runs it.
export async function runCode(page: Page, id: string, code: string, timeout = 15_000) {
  await task(page, id, code);
  return run(page, timeout);
}

// SQL judging
export async function check(page: Page, timeout = 20_000) {
  await expect(page.locator('.check-btn')).toBeVisible();
  await page.locator('.verdict').evaluateAll(els => els.forEach(e => e.removeAttribute('data-verdict')));
  await page.locator('.check-btn').click();
  const v = page.locator('.verdict[data-verdict]');
  await expect(v).toHaveCount(1, { timeout });
  return { verdict: (await v.getAttribute('data-verdict'))!, message: norm(await v.innerText()), box: v };
}
export async function judge(page: Page, id: string, sql: string) {
  await task(page, id, sql);
  return check(page);
}
// Rows of the n-th result table in the task output, as cell texts.
export const tableRows = (t: Locator) => t.evaluate((el: Element) => Array.from((el as HTMLTableElement).rows).filter(r => r.querySelector('td')).map(r => Array.from(r.cells).map(c => (c.textContent ?? '').trim())));

// A page timer that records the longest gap between ticks.
export async function gapMonitor(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __gap: number };
    w.__gap = 0;
    let last = performance.now();
    setInterval(() => { const n = performance.now(); w.__gap = Math.max(w.__gap, n - last); last = n; }, 20);
  });
  return () => page.evaluate(() => (window as unknown as { __gap: number }).__gap);
}

// Init script that makes packed parts fail to unpack: the page reads garbage instead of the base64.
export function corruptParts(page: Page, ids: string[]) {
  return page.addInitScript((names: string[]) => {
    const bad = () => {
      for (const n of names) {
        const el = document.getElementById('pack-' + n);
        if (el && !el.hasAttribute('data-bad')) { el.setAttribute('data-bad', '1'); el.textContent = 'AAAA'; }
      }
    };
    new MutationObserver(bad).observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', bad);
  }, ids);
}

export const today = () => ymd(new Date());
export { bankData };
