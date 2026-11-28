// Phase 6, section 2, "Learn on cards", bullet "Search" (docs/phase6-spec.md). "FMn" is failure mode n.
// The search box #lsearch matches the title, the answer text the article shows and, for a card, its company.
// The hidden "Topic: <slug> | <tier> | id: <id>" line is not searched.
import { test, expect, goTo, bankData, type Q } from './fixtures';
import { card, seedWith, NOW } from './phase6-helpers';
import type { Page } from '@playwright/test';

const FILE = '01-playwright';
const shown = (q: Q) => q.body.split('\n').filter(l => !l.startsWith('Topic:')).join('\n');
// The part of the answer that is always shown first: the text after "**Say:**" up to the next bold label.
const say = (q: Q) => /\*\*Say:\*\*([\s\S]*?)(?:\n\s*\n\*\*|$)/.exec(q.body)?.[1] ?? '';
// the list shows titles with the Markdown marks removed
const plain = (t: string) => t.replace(/[`*]/g, '');
const has = (text: string, word: string) => text.toLowerCase().includes(word.toLowerCase());

async function search(page: Page, text: string) {
  await page.locator('#lsearch').fill(text);
  await page.waitForTimeout(100);   // a debounced box settles; the assertions below poll anyway
}
const listed = (page: Page) => page.locator('#side-list .qlink');
const titlesListed = async (page: Page) => (await listed(page).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

test('FM38 "core" in a bank topic lists only questions whose title or shown answer holds the word, not every Core question', async ({ bank }) => {
  const qs = (await bankData(bank)).filter(q => q.file === FILE);
  const coreTier = qs.filter(q => q.tier === 'Core');
  const may = qs.filter(q => has(q.q, 'core') || has(shown(q), 'core'));
  const must = qs.filter(q => has(q.q, 'core') || has(say(q), 'core'));
  // the scenario separates the right search from the wrong one
  expect(must.length, 'fixture: some questions do say "core"').toBeGreaterThan(0);
  expect(coreTier.length - may.length, 'fixture: many Core-tier questions do not say "core"').toBeGreaterThan(20);
  await goTo(bank, 'learn', FILE);
  await search(bank, 'core');
  await expect.poll(async () => await listed(bank).count()).toBeLessThanOrEqual(may.length);
  const n = await listed(bank).count();
  expect(n).toBeGreaterThanOrEqual(must.length);
  expect(n).toBeLessThan(coreTier.length);
  const texts = await titlesListed(bank);
  for (const q of must) expect(texts.some(t => t.includes(plain(q.q))), `"${q.q}" (${q.id}) holds the word and must be listed`).toBe(true);
  const allowed = new Set(may.map(q => plain(q.q)));
  for (const t of texts) expect([...allowed].some(title => t.includes(title)), `"${t}" is listed but its shown text has no "core"`).toBe(true);
});

test('FM38 "topic" in a bank topic lists only questions whose title or shown answer holds the word', async ({ bank }) => {
  const qs = (await bankData(bank)).filter(q => q.file === FILE);
  const may = qs.filter(q => has(q.q, 'topic') || has(shown(q), 'topic'));
  await goTo(bank, 'learn', FILE);
  await search(bank, 'topic');
  await expect.poll(async () => await listed(bank).count()).toBeLessThanOrEqual(may.length);
  expect(qs.length - may.length, 'fixture: most questions do not say "topic"').toBeGreaterThan(100);
  const allowed = may.map(q => plain(q.q));
  for (const t of await titlesListed(bank)) expect(allowed.some(title => t.includes(title)), `"${t}" is listed but its shown text has no "topic"`).toBe(true);
});

test('FM38 the whole id of a bank question finds it, in its topic', async ({ bank }) => {
  const qs = (await bankData(bank)).filter(q => q.file === FILE);
  const target = qs[3];
  await goTo(bank, 'learn', FILE);
  await search(bank, target.id);
  await expect(listed(bank)).toHaveCount(1);
  expect((await titlesListed(bank))[0]).toContain(plain(target.q));
  // control: the id of a question in another topic does not find it here
  const other = (await bankData(bank)).find(q => q.file !== FILE)!;
  await search(bank, other.id);
  await expect(listed(bank)).toHaveCount(0);
});

test.describe('in My cards', () => {
  const A = 'u0aaa', B = 'u0bbb', C = 'u0ccc';
  const cards = {
    [A]: card('Alpha question?', 'Use the retry budget wisely', 'Acme'),
    [B]: card('Beta question?', 'Plain beta answer', 'Globex'),
    [C]: card('Gamma question?', 'Plain gamma answer', ''),
  };
  async function open3(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>) {
    const page = await open({ time: NOW, seed: seedWith({ cards }) });
    await goTo(page, 'learn', 'my-cards');
    await expect(listed(page)).toHaveCount(3);
    return page;
  }

  test('FM38 "my-cards" and "topic" list none: they sit only in the hidden Topic line', async ({ open }) => {
    const page = await open3(open);
    await search(page, 'my-cards');
    await expect(listed(page)).toHaveCount(0);
    await search(page, 'topic');
    await expect(listed(page)).toHaveCount(0);
    await search(page, '');
    await expect(listed(page)).toHaveCount(3);
  });

  test('FM38 a word from one card\'s answer lists that card only, ignoring case', async ({ open }) => {
    const page = await open3(open);
    await search(page, 'RETRY');
    await expect(listed(page)).toHaveCount(1);
    expect((await titlesListed(page))[0]).toContain('Alpha question?');
  });

  test('FM38 a word from a question title lists that card', async ({ open }) => {
    const page = await open3(open);
    await search(page, 'gamma');
    await expect(listed(page)).toHaveCount(1);
    expect((await titlesListed(page))[0]).toContain('Gamma question?');
  });

  test('FM38 a company name lists its cards', async ({ open }) => {
    const page = await open3(open);
    await search(page, 'globex');
    await expect(listed(page)).toHaveCount(1);
    expect((await titlesListed(page))[0]).toContain('Beta question?');
    await search(page, 'ACME');
    await expect(listed(page)).toHaveCount(1);
    expect((await titlesListed(page))[0]).toContain('Alpha question?');
  });

  test('FM38 a card id typed whole finds that card', async ({ open }) => {
    const page = await open3(open);
    await search(page, C);
    await expect(listed(page)).toHaveCount(1);
    expect((await titlesListed(page))[0]).toContain('Gamma question?');
  });
});
