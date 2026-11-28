// Phase 6, section 3: quiz setup with mode and topic source (docs/phase6-spec.md, ideas 59, 60, 61, 62). "FMn" is failure mode n.
import { test, expect, bankData, marks } from './fixtures';
import { gapMonitor } from './code-helpers';
import { NOW, topicRows, ROLES, inRole, openSetup, modeBtn, startBtn, setupRoot, chip, tierBtn, sizeBtn, skipKnown, poolOf, matchAd, keywords, adTopics, seedWith } from './phase6-helpers';
import type { Page } from '@playwright/test';

const adBox = (p: Page) => p.locator('#ad-text');
// Press Find topics and wait until the match is drawn: the button is disabled while it runs (docs/phase6-spec.md, section 3).
// Without the wait, the first match could redraw the ad box while the next fill types into it (CI run 46145293624, FM17).
async function findTopics(p: Page) {
  await p.locator('#ad-match').click();
  await expect(p.locator('#ad-match')).toBeEnabled();
}
async function useAd(p: Page, text: string) {
  await openSetup(p);
  await p.locator('#src-ad').click();
  await adBox(p).fill(text);
  await findTopics(p);
}
const nameOf = (slug: string) => keywords[slug].name;
const NO_MATCH = 'No topic matched this ad. Pick topics from the Topic list instead.';
const inTier = (t: { tier: string }, tier: 'core' | 'std' | 'all') => (tier === 'core' ? t.tier === 'Core' : tier === 'std' ? t.tier !== 'Niche' : true);

// ---------------------------------------------------------------- mode
test('mode buttons: Quiz, Mock interview, Live-coding rehearsal with ids; Quiz is pressed by default', async ({ bank }) => {
  await openSetup(bank);
  const root = setupRoot(bank);
  await expect(root.getByRole('button', { name: 'Quiz', exact: true })).toHaveAttribute('id', 'mode-quiz');
  await expect(root.getByRole('button', { name: 'Mock interview', exact: true })).toHaveAttribute('id', 'mode-mock');
  await expect(root.getByRole('button', { name: 'Live-coding rehearsal', exact: true })).toHaveAttribute('id', 'mode-code');
  await expect(modeBtn(bank, 'quiz')).toHaveAttribute('aria-pressed', 'true');
  await expect(modeBtn(bank, 'mock')).toHaveAttribute('aria-pressed', 'false');
  await expect(modeBtn(bank, 'code')).toHaveAttribute('aria-pressed', 'false');
  // the mode buttons come first in the setup card
  const first = await root.locator('.setup').evaluate(el => el.querySelector('button')!.id);
  expect(first).toBe('mode-quiz');
});

test('mode: choosing Mock or Live-coding moves the pressed state; Mock keeps the topic, tier, size and option choices of Quiz', async ({ bank }) => {
  await openSetup(bank);
  await chip(bank, 'Playwright').click();
  await tierBtn(bank, 'all').click();
  await sizeBtn(bank, '10').click();
  await expect(startBtn(bank)).toHaveText('Start 10 questions');
  await modeBtn(bank, 'mock').click();
  await expect(modeBtn(bank, 'mock')).toHaveAttribute('aria-pressed', 'true');
  await expect(modeBtn(bank, 'quiz')).toHaveAttribute('aria-pressed', 'false');
  await expect(startBtn(bank)).toHaveText('Start mock interview (10 questions)');
  await expect(chip(bank, 'Playwright')).toHaveClass(/\bon\b/);
  await expect(skipKnown(bank)).toBeChecked();
  await sizeBtn(bank, '20').click();
  await expect(startBtn(bank)).toHaveText('Start mock interview (20 questions)');
  await modeBtn(bank, 'code').click();
  await expect(modeBtn(bank, 'code')).toHaveAttribute('aria-pressed', 'true');
  await expect(modeBtn(bank, 'mock')).toHaveAttribute('aria-pressed', 'false');
  await modeBtn(bank, 'quiz').click();
  await expect(startBtn(bank)).toHaveText('Start 20 questions');
  await expect(chip(bank, 'Playwright')).toHaveClass(/\bon\b/);
});

test('Quiz mode and Topic list stay as before: the topic chips, and Start N questions asks N cards', async ({ bank }) => {
  await openSetup(bank);
  await expect(bank.locator('#src-list')).toHaveAccessibleName('Topic list');
  await expect(bank.locator('#src-list')).toHaveAttribute('aria-pressed', 'true');
  await expect(setupRoot(bank).locator('.chip').filter({ hasText: /^Playwright$/ })).toHaveCount(1);
  await sizeBtn(bank, '10').click();
  await chip(bank, 'Playwright').click();  // Mobile testing has no Core question, so Start would stay disabled
  await startBtn(bank).click();
  await expect(bank.getByRole('button', { name: /Show answer/ })).toBeVisible();
  await expect(bank.locator('#mock-timer')).toBeHidden();
});

// ---------------------------------------------------------------- topic source
test('topic source: Topic list (default), Role and Job ad buttons with ids; each shows only its own controls', async ({ bank }) => {
  await openSetup(bank);
  await expect(bank.getByRole('button', { name: 'Topic list', exact: true })).toHaveAttribute('id', 'src-list');
  await expect(bank.getByRole('button', { name: 'Role', exact: true })).toHaveAttribute('id', 'src-role');
  await expect(bank.getByRole('button', { name: 'Job ad', exact: true })).toHaveAttribute('id', 'src-ad');
  await expect(bank.locator('#src-list')).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.locator('.role-btn')).toBeHidden();
  await expect(bank.locator('#ad-text')).toBeHidden();
  await bank.locator('#src-role').click();
  await expect(bank.locator('#src-role')).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.locator('#src-list')).toHaveAttribute('aria-pressed', 'false');
  await expect(bank.locator('.role-btn')).toHaveCount(4);
  await expect(chip(bank, 'Playwright')).toBeHidden();
  await bank.locator('#src-ad').click();
  await expect(bank.locator('#ad-text')).toBeVisible();
  await expect(bank.locator('.role-btn')).toBeHidden();
  await bank.locator('#src-list').click();
  await expect(chip(bank, 'Playwright')).toHaveCount(1);
  await expect(bank.locator('#ad-text')).toBeHidden();
});

test('topic source works in Mock mode too', async ({ bank }) => {
  await openSetup(bank);
  await modeBtn(bank, 'mock').click();
  await bank.locator('#src-role').click();
  await bank.locator('.role-btn', { hasText: 'Lead' }).click();
  await expect(bank.locator('#role-count')).toContainText('Lead:');
  await expect(startBtn(bank)).toHaveText(/^Start mock interview \(\d+ questions\)$/);
});

// ---------------------------------------------------------------- roles
test('roles: four buttons named Manual QA, Automation, SDET and Lead; a pressed role has aria-pressed', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-role').click();
  await expect(bank.locator('.role-btn')).toHaveText(['Manual QA', 'Automation', 'SDET', 'Lead']);
  for (const name of Object.keys(ROLES)) {
    await bank.getByRole('button', { name, exact: true }).click();
    await expect(bank.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(bank.locator('.role-btn[aria-pressed="true"]')).toHaveCount(1);
    await expect(bank.locator('#role-count')).toContainText(`${name}: `);
  }
});

test('roles: with tier Everything and no skipping, #role-count is the number of questions in the role files and slugs', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-role').click();
  await tierBtn(bank, 'all').click();
  await skipKnown(bank).uncheck();
  for (const name of Object.keys(ROLES)) {
    await bank.getByRole('button', { name, exact: true }).click();
    const want = topicRows.filter(t => inRole(name, t)).length;
    await expect(bank.locator('#role-count')).toHaveText(`${name}: ${want} questions`);
    expect(await poolOf(bank), `${name} start pool`).toBe(want);
  }
  // the roles are not one big pool: SDET adds slugs to Automation, Manual QA is smaller than everything
  const n = (r: string) => topicRows.filter(t => inRole(r, t)).length;
  expect(n('SDET')).toBeGreaterThan(n('Automation'));
});

test('roles: a question counts when its slug is in the role even from a file outside the role\'s files', async ({ bank }) => {
  // api-rest is a Manual QA slug; its file (03-api) is not a Manual QA file
  const apiRest = topicRows.filter(t => t.slug === 'api-rest' && t.file !== '05-testing-fundamentals');
  expect(apiRest.length).toBeGreaterThan(0);
  await openSetup(bank);
  await bank.locator('#src-role').click();
  await tierBtn(bank, 'all').click();
  await skipKnown(bank).uncheck();
  await bank.getByRole('button', { name: 'Manual QA', exact: true }).click();
  const files = topicRows.filter(t => t.file === '05-testing-fundamentals').length;
  const want = topicRows.filter(t => inRole('Manual QA', t)).length;
  expect(want).toBeGreaterThan(files);
  await expect(bank.locator('#role-count')).toHaveText(`Manual QA: ${want} questions`);
});

for (const tier of ['core', 'std', 'all'] as const) {
  for (const role of Object.keys(ROLES)) {
    test(`FM19 role ${role}, tier ${tier}, Skip known on: #role-count equals the pool the quiz starts with (known marks seeded)`, async ({ open }) => {
      const pool = topicRows.filter(t => inRole(role, t) && inTier(t, tier));
      const known = pool.filter((_, i) => i % 3 === 0).map(t => t.id);
      const page = await open({ time: NOW, seed: seedWith({ known: marks(known) }) });
      await openSetup(page);
      await page.locator('#src-role').click();
      await page.getByRole('button', { name: role, exact: true }).click();
      await tierBtn(page, tier).click();
      await expect(skipKnown(page)).toBeChecked();
      const want = pool.length - known.length;
      await expect(page.locator('#role-count')).toHaveText(`${role}: ${want} questions`);
      expect(await poolOf(page)).toBe(want);
      await skipKnown(page).uncheck();
      await expect(page.locator('#role-count')).toHaveText(`${role}: ${pool.length} questions`);
      expect(await poolOf(page)).toBe(pool.length);
    });
  }
}

test('FM19 the size cut comes after the count: #role-count stays the pool, the button shows the smaller size', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-role').click();
  await bank.getByRole('button', { name: 'Automation', exact: true }).click();
  await tierBtn(bank, 'all').click();
  await sizeBtn(bank, '10').click();
  const want = topicRows.filter(t => inRole('Automation', t)).length;
  await expect(bank.locator('#role-count')).toHaveText(`Automation: ${want} questions`);
  await expect(startBtn(bank)).toHaveText('Start 10 questions');
});

test('roles: starting a role quiz asks only questions of that role', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-role').click();
  await bank.getByRole('button', { name: 'Lead', exact: true }).click();
  await tierBtn(bank, 'all').click();
  await sizeBtn(bank, '10').click();
  await startBtn(bank).click();
  const all = await bankData(bank);
  const allowed = new Set(topicRows.filter(t => inRole('Lead', t)).map(t => t.id));
  const norm = (s: string) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    await expect(bank.getByRole('button', { name: /Show answer/ })).toBeVisible();
    const text = norm(await bank.locator('#quiz').innerText());
    const shown = all.filter(q => text.includes(norm(q.q))).sort((a, b) => b.q.length - a.q.length)[0];
    expect(allowed.has(shown.id), `${shown.id} is a Lead question`).toBe(true);
    await bank.getByRole('button', { name: /Show answer/ }).click();
    await bank.getByRole('button', { name: /Knew it/ }).click();
  }
});

// ---------------------------------------------------------------- job ad
test('job ad: #ad-text "Paste a job ad", the privacy line, #ad-match "Find topics"', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-ad').click();
  await expect(bank.getByRole('textbox', { name: 'Paste a job ad' })).toHaveAttribute('id', 'ad-text');
  await expect(setupRoot(bank)).toContainText('The ad stays in this browser.');
  await expect(bank.getByRole('button', { name: 'Find topics', exact: true })).toHaveAttribute('id', 'ad-match');
});

test('job ad: matched topics are ticked checkboxes named by topic, with match counts and up to three matched words, most matches first', async ({ bank }) => {
  const ad = 'We need getByRole locators, selectors and more locators. We write locators daily, and run locators. Agile and Scrum. PostgreSQL.';
  const want = matchAd(ad);
  const counts = Object.values(want);
  expect(new Set(counts).size, 'premise: distinct counts, so the order does not depend on the tie rule').toBe(counts.length);
  await useAd(bank, ad);
  const boxes = adTopics(bank);
  await expect(boxes).toHaveCount(counts.length);
  const info = await boxes.evaluateAll(els => els.map(e => {
    let el: HTMLElement = e as HTMLElement;
    while (el.parentElement && el.parentElement.querySelectorAll('.ad-topic').length === 1) el = el.parentElement;
    return { checked: (e as HTMLInputElement).checked, text: (el.textContent || '').replace(/\s+/g, ' ').trim() };
  }));
  const order = Object.entries(want).sort((a, b) => b[1] - a[1]).map(([slug, n]) => ({ name: nameOf(slug), n }));
  expect(info.map(i => i.checked)).toEqual(order.map(() => true));
  order.forEach((o, i) => {
    expect(info[i].text, `row ${i}`).toContain(o.name);
    const m = /(\d+) match(?:es)?: (.+)$/.exec(info[i].text);
    expect(m, `match line in "${info[i].text}"`).not.toBeNull();
    expect(Number(m![1])).toBe(o.n);
    const words = m![2].split(', ');
    expect(words.length).toBeLessThanOrEqual(3);
    for (const w of words) expect(ad.toLowerCase(), `word "${w}"`).toContain(w.trim().toLowerCase());
  });
  for (const slug of Object.keys(want)) await expect(bank.locator('#ad-result').getByRole('checkbox', { name: nameOf(slug), exact: true })).toBeChecked();
});

test('job ad: #ad-count says "N topics matched, M questions"; unticking a topic removes its questions from the pool', async ({ bank }) => {
  const ad = 'Playwright locators, and Agile with Scrum.';
  const want = Object.keys(matchAd(ad));
  await openSetup(bank);
  await tierBtn(bank, 'all').click();
  await skipKnown(bank).uncheck();
  await bank.locator('#src-ad').click();
  await adBox(bank).fill(ad);
  await findTopics(bank);
  const qs = (slugs: string[]) => topicRows.filter(t => slugs.includes(t.slug)).length;
  await expect(bank.locator('#ad-count')).toHaveText(`${want.length} topics matched, ${qs(want)} questions`);
  expect(await poolOf(bank)).toBe(qs(want));
  const victim = want[0];
  await bank.locator('#ad-result').getByRole('checkbox', { name: nameOf(victim), exact: true }).uncheck();
  const rest = want.slice(1);
  // N counts every topic the ad matched; M counts the questions of the ticked ones (docs/phase6-spec.md, section 3).
  await expect(bank.locator('#ad-count')).toHaveText(new RegExp(`^${want.length} topics? matched, ${qs(rest)} questions?$`));
  expect(await poolOf(bank)).toBe(qs(rest));
  await bank.locator('#ad-result').getByRole('checkbox', { name: nameOf(victim), exact: true }).check();
  expect(await poolOf(bank)).toBe(qs(want));
});

test('job ad: the quiz started from an ad asks only questions of the ticked topics (Mock too)', async ({ bank }) => {
  await openSetup(bank);
  await modeBtn(bank, 'mock').click();
  await tierBtn(bank, 'all').click();
  await bank.locator('#src-ad').click();
  await adBox(bank).fill('We test with Scrum and Agile.');
  await findTopics(bank);
  const slugs = Object.keys(matchAd('We test with Scrum and Agile.'));
  const total = topicRows.filter(t => slugs.includes(t.slug)).length;
  await sizeBtn(bank, 'All').click();
  await expect(startBtn(bank)).toHaveText(`Start mock interview (${total} questions)`);
});

for (const [name, ad] of [['empty', ''], ['spaces only', '   \n  '], ['no keyword', 'Lorem ipsum dolor sit amet, consectetur.']] as const) {
  test(`FM14 ${name} ad: the no-match message shows and Start is disabled`, async ({ bank }) => {
    await useAd(bank, ad);
    await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH);
    await expect(adTopics(bank)).toBeHidden();
    await expect(startBtn(bank)).toBeDisabled();
  });
}
test('FM14 a matching ad enables Start again, and an empty one disables it again', async ({ bank }) => {
  await useAd(bank, 'Playwright');
  await expect(startBtn(bank)).toBeEnabled();
  await adBox(bank).fill('');
  await findTopics(bank);
  await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH);
  await expect(startBtn(bank)).toBeDisabled();
});

test('Find topics is disabled while a match runs, so a second ad typed meanwhile is not overwritten by the first result', async ({ bank }) => {
  // A slow first unpack (as on a busy CI machine) is made certain by delaying the page's keyword loader.
  await openSetup(bank);
  await bank.evaluate(() => { const load = (window as any).keywordsLoad; (window as any).keywordsLoad = async () => { await new Promise(r => setTimeout(r, 1500)); return load(); }; });
  await bank.locator('#src-ad').click();
  await adBox(bank).fill('we run the ci in the morning');
  await bank.locator('#ad-match').click();
  await expect(bank.locator('#ad-match')).toBeDisabled();
  await expect(bank.locator('#ad-match')).toHaveAttribute('aria-busy', 'true');
  await expect(bank.locator('#ad-match')).toBeEnabled();
  await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH);
});

test('FM15 60,000 characters pasted: cut at 50,000 (a word after the cut is not matched), and no freeze over 2 s', async ({ bank }) => {
  const filler = (n: number) => 'lorem ipsum '.repeat(Math.ceil(n / 12)).slice(0, n);
  const before = filler(49_000) + ' Playwright ' + filler(60_000 - 49_000 - 12);   // the word sits before the cut
  const after = filler(55_000) + ' Playwright ' + filler(60_000 - 55_000 - 12);    // the word sits after the cut
  expect(before.length).toBe(60_000);
  expect(after.length).toBe(60_000);
  const slugs = Object.keys(matchAd(' Playwright '));
  expect(slugs.length, 'the word Playwright matches a topic in src/topic-keywords.json').toBeGreaterThan(0);
  expect(matchAd(after.slice(0, 50_000)), 'the filler matches nothing').toEqual({});
  await openSetup(bank);
  await bank.locator('#src-ad').click();
  const gap = await gapMonitor(bank);
  await adBox(bank).fill(after);
  const t0 = Date.now();
  await findTopics(bank);
  await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH, { timeout: 2000 });
  expect(Date.now() - t0).toBeLessThan(2000);
  expect(await gap(), 'longest gap between page timer ticks (ms)').toBeLessThan(2000);
  expect((await adBox(bank).inputValue()).length).toBeLessThanOrEqual(50_000);
  await adBox(bank).fill(before);
  await findTopics(bank);
  await expect(adTopics(bank)).toHaveCount(slugs.length, { timeout: 2000 });
});

test('FM15 a long run of one letter and a long repeated word is answered within 2 s', async ({ bank }) => {
  await openSetup(bank);
  await bank.locator('#src-ad').click();
  await adBox(bank).fill('a'.repeat(30_000) + ' ' + 'prompt'.repeat(3_000));
  const t0 = Date.now();
  await findTopics(bank);
  await expect(bank.locator('#ad-result')).not.toBeEmpty({ timeout: 2000 });
  expect(Date.now() - t0).toBeLessThan(2500);
});

test('FM16 Polish ad: "testów automatycznych" matches whole, not inside a longer word (letters like ą, ó count as letters)', async ({ bank }) => {
  const auto = nameOf('fw-automation');
  expect(keywords['fw-automation'].patterns).toContain('testów automatycznych');
  await useAd(bank, 'Wymagane doświadczenie w tworzeniu testów automatycznych.');
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: auto, exact: true })).toBeChecked();
  for (const bad of ['kątestów automatycznych', 'testów automatycznychą', 'testów automatycznychż', '_testów automatycznych_', 'testów automatycznych2', 'ątestów automatycznych']) {
    const want = matchAd(bad);
    expect(want['fw-automation'], 'reference: ' + bad).toBeUndefined();
    await adBox(bank).fill(bad);
    await findTopics(bank);
    if (Object.keys(want).length === 0) await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH);
    else await expect(adTopics(bank)).toHaveCount(Object.keys(want).length);
    await expect(bank.locator('#ad-result').getByRole('checkbox', { name: auto, exact: true }), bad).toBeHidden();
  }
  // control: punctuation and a line break around the phrase still count as boundaries
  await adBox(bank).fill('(testów automatycznych), nic więcej\ntestów automatycznych;');
  await findTopics(bank);
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: auto, exact: true })).toBeChecked();
});

test('FM16 case-insensitive by default: "PLAYWRIGHT" and "Getbyrole" match like the lower-case words', async ({ bank }) => {
  const ad = 'PLAYWRIGHT and GETBYROLE and SELECTORS';
  const want = Object.keys(matchAd(ad));
  expect(want.length).toBeGreaterThan(0);
  await useAd(bank, ad);
  await expect(adTopics(bank)).toHaveCount(want.length);
});

test('FM17 a cs: pattern does not match a lowercase word, and does match the exact case', async ({ bank }) => {
  expect(keywords['ci-cd'].patterns).toContain('cs:CI');
  const lower = 'we run the ci in the morning';
  const upper = 'we run the CI in the morning';
  expect(matchAd(lower)['ci-cd']).toBeUndefined();
  expect(matchAd(upper)['ci-cd']).toBeGreaterThan(0);
  await useAd(bank, lower);
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: nameOf('ci-cd'), exact: true })).toBeHidden();
  await adBox(bank).fill(upper);
  await findTopics(bank);
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: nameOf('ci-cd'), exact: true })).toBeChecked();
  // "Go" (a language) must not match the verb "go"
  expect(keywords['java-dotnet'].patterns).toContain('cs:Go');
  const verb = 'we go to the office';
  await adBox(bank).fill(verb);
  await findTopics(bank);
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: nameOf('java-dotnet'), exact: true })).toBeHidden();
  await adBox(bank).fill('services written in Go and Kotlin');
  await findTopics(bank);
  await expect(bank.locator('#ad-result').getByRole('checkbox', { name: nameOf('java-dotnet'), exact: true })).toBeChecked();
});

test('FM17 whole word in English too: "selectorsx" and "xplaywright" do not match', async ({ bank }) => {
  const ad = 'selectorsx xplaywright playwrights2 locatorss';
  expect(matchAd(ad), 'premise: the reference finds nothing').toEqual({});
  await useAd(bank, ad);
  await expect(bank.locator('#ad-result')).toHaveText(NO_MATCH);
});

test('FM18 every pattern in src/topic-keywords.json compiles as a whole-word rule in this engine, and the page reads the file without error', async ({ bank }) => {
  expect(Object.keys(keywords)).toHaveLength(85);
  const bad = await bank.evaluate(kw => {
    const out: string[] = [];
    for (const [slug, v] of Object.entries(kw as Record<string, { patterns: string[] }>)) {
      for (const p of v.patterns) {
        const cs = p.startsWith('cs:');
        const src = cs ? p.slice(3) : p;
        try { new RegExp(`(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`, cs ? 'gu' : 'giu'); } catch (e) { out.push(`${slug}: ${p}: ${(e as Error).message}`); }
      }
    }
    return out;
  }, keywords);
  expect(bad).toEqual([]);
  // the page itself compiles them all when it matches (a bad pattern would be a page error, which `bank` reports)
  await useAd(bank, 'anything at all, including Playwright');
  await expect(bank.locator('#ad-result')).toBeVisible();
});

test('no reach: matching an ad makes no network request, by file://', async ({ bank }) => {
  const seen: string[] = [];
  bank.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) seen.push(r.url()); });
  await useAd(bank, 'Our confidential ad mentions Playwright and secret-project-x.');
  await expect(adTopics(bank).first()).toBeVisible();
  await adBox(bank).fill('another ad with Scrum');
  await findTopics(bank);
  await expect(adTopics(bank).first()).toBeVisible();
  expect(seen).toEqual([]);
});

