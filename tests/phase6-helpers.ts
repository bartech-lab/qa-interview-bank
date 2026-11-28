// Helpers for the phase 6 tests (docs/phase6-spec.md). They use only the page parts named in the spec and the question files.
import { expect, goTo, progress, ymd, type Q } from './fixtures';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const KEY = 'qa-bank';
export const NOW = new Date(2026, 0, 15, 12, 0);   // local 2026-01-15 12:00
export const TODAY = ymd(NOW);

// ---- the question files, read straight from topics/ ----
export type T = { id: string; slug: string; tier: 'Core' | 'Standard' | 'Niche'; file: string; title: string };
export const topicRows: T[] = (() => {
  const rows: T[] = [];
  for (const f of fs.readdirSync('topics').filter(x => x.endsWith('.md')).sort()) {
    let title = '';
    for (const line of fs.readFileSync(path.join('topics', f), 'utf8').split('\n')) {
      if (line.startsWith('### ')) title = line.slice(4).trim();
      const m = /^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d+)/.exec(line);
      if (m) rows.push({ id: m[3], slug: m[1], tier: m[2] as T['tier'], file: f.replace(/\.md$/, ''), title });
    }
  }
  return rows;
})();

// ---- own cards ----
export type CardData = { q: string; a: string; company: string; created: string };
export const card = (q: string, a = '', company = '', created = '2026-01-10'): CardData => ({ q, a, company, created });
export const cardsOf = (n: number, company = '') => Object.fromEntries(Array.from({ length: n }, (_, i) => [`u${(i + 1).toString(36).padStart(3, '0')}`, card(`Question number ${i + 1}?`, `Answer ${i + 1}`, company)]));
export const seedWith = (p: Record<string, unknown>) => ({ [KEY]: progress(p) });
export const exportOf = (p: Record<string, unknown>) => ({ app: 'qa-interview-bank', format: 1, exported: '2026-01-10T10:00:00.000Z', progress: { v: 2, known: {}, shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null, ...p } });
export const file = (o: unknown) => ({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)) });
export const store = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
export const rawStore = (page: Page) => page.evaluate(k => localStorage.getItem(k), KEY);

export async function addCardViaForm(page: Page, f: { q: string; a?: string; company?: string }) {
  await goTo(page, 'home');
  await page.locator('#card-add').click();
  await page.locator('#card-q').fill(f.q);
  if (f.a !== undefined) await page.locator('#card-a').fill(f.a);
  if (f.company !== undefined) await page.locator('#card-company').fill(f.company);
  await page.locator('#card-save').click();
}

// ---- quiz setup ----
export const startBtn = (page: Page) => page.locator('.startrow .btn.primary');
export const setupRoot = (page: Page) => page.locator('#quiz');
export async function openSetup(page: Page) { await page.locator('#tab-quiz').click(); await expect(page.locator('#mode-quiz')).toBeVisible(); }
export const modeBtn = (page: Page, m: 'quiz' | 'mock' | 'code') => page.locator(`#mode-${m}`);
export const chip = (page: Page, name: string) => setupRoot(page).locator('.chip').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
export const TIERS = { core: 'Core only (most asked)', std: 'Core + Standard', all: 'Everything' } as const;
export const tierBtn = (page: Page, t: keyof typeof TIERS) => setupRoot(page).getByRole('button', { name: TIERS[t], exact: true });
export const sizeBtn = (page: Page, n: string) => setupRoot(page).getByRole('button', { name: n, exact: true });
export const skipKnown = (page: Page) => setupRoot(page).getByRole('checkbox', { name: 'Skip questions I already know' });
export async function poolOf(page: Page): Promise<number> {   // the number the start button shows with size "All"
  await sizeBtn(page, 'All').click();
  const t = (await startBtn(page).textContent())!;
  return Number(/(\d+)/.exec(t)![1]);
}

// ---- roles (spec section 3, table) ----
const AUTO = ['ts-core', 'js-core', 'js-async', 'api-rest', 'api-tools', 'api-auth', 'ci-cd', 'git', 'sql-core'];
export const ROLES: Record<string, { files: string[]; slugs: string[] }> = {
  'Manual QA': { files: ['05-testing-fundamentals'], slugs: ['agile', 'stakeholders', 'release', 'soft-skills', 'docs', 'api-rest', 'api-tools', 'sql-core', 'a11y', 'cross-compat', 'mobile-general'] },
  Automation: { files: ['01-playwright', '06-framework-and-flaky', '13-live-coding'], slugs: AUTO },
  SDET: { files: ['01-playwright', '06-framework-and-flaky', '13-live-coding'], slugs: [...AUTO, 'oop-patterns', 'unit-frameworks', 'api-contract', 'api-integration', 'microservices', 'messaging', 'docker-k8s', 'ci-github', 'ci-gitlab', 'performance', 'security', 'data-testing'] },
  Lead: { files: ['11-agile-leadership'], slugs: ['test-strategy', 'test-risk', 'shift-left', 'test-levels', 'fw-architecture', 'fw-flaky', 'migration-frameworks', 'ci-cd', 'ai-testing', 'ai-tools'] },
};
export const inRole = (r: string, t: T) => ROLES[r].files.includes(t.file) || ROLES[r].slugs.includes(t.slug);

// ---- job ad matching, the rule of the spec ----
export type Kw = Record<string, { name: string; patterns: string[] }>;
export const keywords: Kw = JSON.parse(fs.readFileSync('src/topic-keywords.json', 'utf8'));
const WORD = (p: string) => (p.startsWith('cs:') ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${p.slice(3)})(?![\\p{L}\\p{N}_])`, 'gu') : new RegExp(`(?<![\\p{L}\\p{N}_])(?:${p})(?![\\p{L}\\p{N}_])`, 'giu'));
// slug -> number of matches, only for topics with at least one
export function matchAd(ad: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [slug, v] of Object.entries(keywords)) {
    let n = 0;
    for (const p of v.patterns) n += [...ad.matchAll(WORD(p))].length;
    if (n) out[slug] = n;
  }
  return out;
}
export const adTopics = (page: Page) => page.locator('#ad-result .ad-topic');

// ---- reading the page text ----
export const seconds = (t: string) => { const m = /^(\d+):(\d\d)$/.exec(t.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
export type { Q };
