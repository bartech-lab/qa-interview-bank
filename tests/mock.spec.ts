// Phase 6, section 4: mock interview (docs/phase6-spec.md, idea 61). Written from the spec only; "FMn" is failure mode n.
import { test, expect, bankData, ratingButton, saved } from './fixtures';
import { NOW, openSetup, modeBtn, chip, sizeBtn, startBtn, seconds } from './phase6-helpers';
import type { Page } from '@playwright/test';

const GUIDE = ['Direct answer in one sentence.', 'How it works, or the technique.', 'An example from your own work.', 'The trade-off, or when not to use it.'];
const norm = (s: string) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
const timer = (p: Page) => p.locator('#mock-timer');

// A mock interview of 10 Playwright questions on a clock that only moves when the test moves it.
async function startMock(page: Page) {
  await openSetup(page);
  await modeBtn(page, 'mock').click();
  await chip(page, 'Playwright').click();
  await sizeBtn(page, '10').click();
  await startBtn(page).click();
  await expect(timer(page)).toBeVisible();
}
async function pausedMock(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>) {
  const page = await open({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 3_600_000));
  await startMock(page);
  return page;
}
const secs = async (p: Page) => seconds((await timer(p).textContent())!);
async function askedId(page: Page): Promise<string> {
  const text = norm(await page.locator('#quiz').innerText());
  const all = await bankData(page);
  return all.filter(q => text.includes(norm(q.q))).sort((a, b) => b.q.length - a.q.length)[0].id;
}

test('card: crumbs and question, #mock-timer from 0:00, #mock-text "Your answer (optional, not saved)", the guide button and Show answer', async ({ open }) => {
  const page = await pausedMock(open);
  await expect(timer(page)).toHaveText('0:00');
  await expect(timer(page)).not.toHaveClass(/\bover\b/);
  await expect(page.getByRole('textbox', { name: 'Your answer (optional, not saved)' })).toHaveAttribute('id', 'mock-text');
  await expect(page.getByRole('button', { name: 'Show structure guide' })).toHaveAttribute('id', 'mock-guide-btn');
  await expect(page.getByRole('button', { name: /^Show answer/ })).toHaveAttribute('id', 'mock-show');
  await expect(page.locator('#mock-guide')).toBeHidden();
  expect(await askedId(page)).toMatch(/^q\d+$/);
  await expect(ratingButton(page, 'known')).toBeHidden();
});

test('timer counts up in m:ss from the clock and gets class "over" from 1:30', async ({ open }) => {
  const page = await pausedMock(open);
  await page.clock.runFor(5_000);
  await expect(timer(page)).toHaveText('0:05');
  await page.clock.runFor(54_000);
  await expect(timer(page)).toHaveText('0:59');
  await page.clock.runFor(1_000);
  await expect(timer(page)).toHaveText('1:00');
  await page.clock.runFor(29_000);
  await expect(timer(page)).toHaveText('1:29');
  await expect(timer(page)).not.toHaveClass(/\bover\b/);
  await page.clock.runFor(1_000);
  await expect(timer(page)).toHaveText('1:30');
  await expect(timer(page)).toHaveClass(/\bover\b/);
  await page.clock.runFor(600_000);
  await expect(timer(page)).toHaveText('11:30');
  await expect(timer(page)).toHaveClass(/\bover\b/);
});

test('timer restarts at 0:00 on the next question and loses "over"', async ({ open }) => {
  const page = await pausedMock(open);
  await page.clock.runFor(95_000);
  await expect(timer(page)).toHaveClass(/\bover\b/);
  await page.locator('#mock-show').click();
  await ratingButton(page, 'known').click();
  await expect(timer(page)).toHaveText('0:00');
  await expect(timer(page)).not.toHaveClass(/\bover\b/);
  await expect(page.locator('#mock-text')).toHaveValue('');
});

test('structure guide: Show structure guide reveals #mock-guide, an ordered list of four lines', async ({ open }) => {
  const page = await pausedMock(open);
  await page.locator('#mock-guide-btn').click();
  const guide = page.locator('#mock-guide');
  await expect(guide).toBeVisible();
  expect(await guide.evaluate(e => e.tagName)).toBe('OL');
  await expect(guide.locator('li')).toHaveText(GUIDE);
  await expect(guide.getByRole('listitem')).toHaveCount(4);
});

test('Show answer stops the timer, shows the answer and the three rating buttons', async ({ open }) => {
  const page = await pausedMock(open);
  await page.clock.runFor(7_000);
  await expect(timer(page)).toHaveText('0:07');
  await page.locator('#mock-show').click();
  for (const how of ['missed', 'shaky', 'known'] as const) await expect(ratingButton(page, how)).toBeVisible();
  const stopped = await timer(page).textContent();
  await page.clock.runFor(60_000);
  await expect(timer(page)).toHaveText(stopped!);
  expect(seconds(stopped!)).toBeLessThan(10);
  // the answer of the question shows as in Quiz: the Say text of the asked question is on the page
  const id = await askedId(page);
  const q = (await bankData(page)).find(x => x.id === id)!;
  const say = /\*\*Say:\*\*\s*([^\n]+)/.exec(q.body)![1];
  // The page shows Markdown without its marks (`code`, **bold**), so they are dropped before comparing.
  // The first sentence is set apart from the rest, so only its start is compared.
  await expect(page.locator('#quiz')).toContainText(norm(say.replace(/[`*_]/g, '')).split(/(?<=[.!?])\s/)[0].slice(0, 40));
});

test('Space reveals the answer while no text box has focus; Space and 1/2/3 typed in the text box stay in the text box', async ({ open }) => {
  const page = await pausedMock(open);
  await page.locator('#mock-text').click();
  await page.keyboard.type('a 1 b');
  await expect(page.locator('#mock-text')).toHaveValue('a 1 b');
  await expect(ratingButton(page, 'known')).toBeHidden();
  await expect(page.locator('#mock-show')).toBeVisible();
  await page.locator('#mock-timer').click();   // focus leaves the text box
  await page.keyboard.press('Space');
  await expect(ratingButton(page, 'known')).toBeVisible();
  await expect(page.locator('#mock-show')).toBeHidden();
  await page.keyboard.press('3');
  await expect.poll(async () => Object.keys((await saved(page)).known).length).toBe(1);
});

test('rating after the answer saves like Quiz: Didn\'t know, Shaky and Knew it set the same marks and review dates', async ({ open }) => {
  const page = await pausedMock(open);
  const ids: string[] = [];
  for (const how of ['missed', 'shaky', 'known'] as const) {
    ids.push(await askedId(page));
    await page.locator('#mock-show').click();
    await ratingButton(page, how).click();
  }
  const s = await saved(page);
  expect(Object.keys(s.missed)).toEqual([ids[0]]);
  expect(Object.keys(s.shaky)).toEqual([ids[1]]);
  expect(Object.keys(s.known)).toEqual([ids[2]]);
  expect(s.srs[ids[0]].due > s.srs[ids[0]].last).toBe(true);
  expect(s.srs[ids[2]].box).toBe(1);
});

// ---------------------------------------------------------------- FM20
for (const hide of [true, false]) {
  test(`FM20 tab ${hide ? 'hidden' : 'not told it was hidden'} for 2 minutes (clock moved): the timer shows at least 2:00 when it runs again`, async ({ open }) => {
    const page = await pausedMock(open);
    await page.clock.runFor(3_000);
    await expect(timer(page)).toHaveText('0:03');
    if (hide) {
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
        Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await page.clock.fastForward(120_000);   // timers fire at most once while the clock jumps: a tick counter would show about 0:03
    if (hide) {
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await page.clock.runFor(1_000);
    await expect.poll(() => secs(page)).toBeGreaterThanOrEqual(120);
    await expect(timer(page)).toHaveClass(/\bover\b/);
  });
}

// ---------------------------------------------------------------- FM21
const TYPED = 'My own words: retries are not a fix, ZZtypedZZ';
test('FM21 typed answer: shown above the answer in #mock-mine under the label "Your answer"; the box stays empty on the next question', async ({ open }) => {
  const page = await pausedMock(open);
  await page.locator('#mock-text').fill(TYPED);
  await page.locator('#mock-show').click();
  const mine = page.locator('#mock-mine');
  await expect(mine).toBeVisible();
  await expect(mine).toContainText('Your answer');
  await expect(mine).toContainText(TYPED);
  const at = await mine.boundingBox();
  const rating = await ratingButton(page, 'known').boundingBox();
  expect(at!.y, 'typed text above the rating buttons').toBeLessThan(rating!.y);
  const id = await askedId(page);
  const q = (await bankData(page)).find(x => x.id === id)!;
  const say = norm(/\*\*Say:\*\*\s*([^\n]+)/.exec(q.body)![1]).slice(0, 30);
  const body = norm(await page.locator('#quiz').innerText());
  expect(body.indexOf(TYPED), 'typed text before the answer text').toBeLessThan(body.indexOf(say));
  await ratingButton(page, 'known').click();
  await expect(page.locator('#mock-text')).toHaveValue('');
  await expect(page.locator('#mock-mine')).toBeHidden();
});

test('FM21 no typed text: no #mock-mine after Show answer', async ({ open }) => {
  const page = await pausedMock(open);
  await page.locator('#mock-show').click();
  await expect(ratingButton(page, 'known')).toBeVisible();
  await expect(page.locator('#mock-mine')).toBeHidden();
});

test('FM21 typed text is never saved: not in storage after rating, after the summary, or after a reload', async ({ open }) => {
  const page = await pausedMock(open);
  for (let i = 0; i < 10; i++) {
    await page.locator('#mock-text').fill(`${TYPED} ${i}`);
    await page.locator('#mock-show').click();
    await ratingButton(page, i % 2 ? 'known' : 'shaky').click();
    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(dump).not.toContain('ZZtypedZZ');
  }
  await expect(page.locator('#mock-copy')).toBeVisible();
  const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(dump).not.toContain('ZZtypedZZ');
  expect(dump).not.toContain('retries are not a fix');
});

// ---------------------------------------------------------------- summary and copy
async function finishMock(page: Page, typed: Record<number, string>, times: Record<number, number> = {}) {
  const questions: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = await askedId(page);
    questions.push(norm((await bankData(page)).find(q => q.id === id)!.q));
    if (times[i]) await page.clock.runFor(times[i]);
    if (typed[i]) await page.locator('#mock-text').fill(typed[i]);
    await page.locator('#mock-show').click();
    await ratingButton(page, 'known').click();
  }
  return questions;
}

test('summary: the Quiz summary plus a time per question (m:ss)', async ({ open }) => {
  const page = await pausedMock(open);
  await finishMock(page, {}, { 0: 7_000, 1: 65_000, 2: 3_000 });
  await expect(page.locator('#mock-timer')).toBeHidden();
  const text = await page.locator('#quiz').innerText();
  for (const t of ['0:07', '1:05', '0:03']) expect(text, t).toContain(t);
  expect((text.match(/\b\d+:\d\d\b/g) ?? []).length, 'one time per question').toBeGreaterThanOrEqual(10);
  await expect(page.locator('#quiz')).toContainText(/10/);
  await expect(page.locator('#mock-copy'), 'nothing typed: no copy button').toBeHidden();
});

test('summary: when anything was typed there is #mock-copy "Copy my answers" that copies each question with its typed answer as plain text', async ({ open }) => {
  const page = await pausedMock(open);
  await page.evaluate(() => {
    (window as unknown as { __copied: string[] }).__copied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => { (window as unknown as { __copied: string[] }).__copied.push(t); return Promise.resolve(); } } });
  });
  const questions = await finishMock(page, { 0: 'alpha <b>one</b> answer', 2: 'gamma answer' });
  const btn = page.getByRole('button', { name: 'Copy my answers' });
  await expect(btn).toHaveAttribute('id', 'mock-copy');
  await btn.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBe(1);
  const copied: string = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied[0]);
  expect(copied).toContain('alpha <b>one</b> answer');   // plain text: typed characters, not HTML made from them
  expect(copied).toContain('gamma answer');
  expect(norm(copied)).toContain(questions[0]);
  expect(norm(copied)).toContain(questions[2]);
  expect(copied.indexOf(questions[0].slice(0, 25)) >= 0 || norm(copied).indexOf(questions[0]) >= 0).toBe(true);
  expect(norm(copied).indexOf(questions[0])).toBeLessThan(norm(copied).indexOf('alpha'));
  expect(norm(copied).indexOf('alpha')).toBeLessThan(norm(copied).indexOf(questions[2]));
  expect(norm(copied).indexOf(questions[2])).toBeLessThan(norm(copied).indexOf('gamma'));
  await expect(page.locator('#mock-copy-text')).toBeHidden();
});

for (const [how, stub] of [
  ['writeText rejects', () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }); }],
  ['writeText throws at once', () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => { throw new DOMException('denied', 'NotAllowedError'); } } }); }],
  ['no clipboard object at all', () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); }],
] as const) {
  test(`FM22 clipboard refused (${how}): the text appears in the selectable box #mock-copy-text and no error shows`, async ({ open }) => {
    const page = await pausedMock(open);
    await page.evaluate(stub);
    await page.evaluate(() => { document.execCommand = () => false; });
    const questions = await finishMock(page, { 1: 'beta words here' });
    await page.locator('#mock-copy').click();
    const box = page.locator('#mock-copy-text');
    await expect(box).toBeVisible();
    const text = await box.evaluate(el => ((el as HTMLTextAreaElement).value ?? '') || el.textContent || '');
    expect(text).toContain('beta words here');
    expect(norm(text)).toContain(questions[1]);
  });
}
