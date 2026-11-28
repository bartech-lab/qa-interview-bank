// Phase 6, section 5: live-coding rehearsal (docs/phase6-spec.md, idea 62). Written from the spec only; "FMn" is failure mode n.
import { test, expect, bankData, saved } from './fixtures';
import { editor, upgraded, runBtn, out, status, lines, LIMIT, isTask, workedSql, check, waitDone } from './code-helpers';
import { NOW, openSetup, modeBtn, seconds } from './phase6-helpers';
import type { Page } from '@playwright/test';

const PROMPTS = ['Restate the task in your own words.', 'Say your plan before you type.', 'Name an edge case.', 'Say how you would test it.', 'Say what you would improve with more time.'];
const T1 = 'q1019', T2 = 'q1020', SQL = 'q1030';
const clean = (s: string) => s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
const titles: Record<string, string> = {};
const clock = (p: Page) => p.locator('#rh-clock');
const left = async (p: Page) => seconds((await clock(p).textContent())!);

async function rhSetup(page: Page) {
  await openSetup(page);
  await modeBtn(page, 'code').click();
  await expect(modeBtn(page, 'code')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.rh-task').first()).toBeVisible();
}
const taskBox = async (page: Page, id: string) => {
  if (!titles[id]) titles[id] = clean((await bankData(page)).find(q => q.id === id)!.q);
  return page.getByRole('checkbox', { name: titles[id], exact: true });
};
async function startRehearsal(page: Page, ids: string[], min?: 30 | 45 | 60) {
  await rhSetup(page);
  for (const id of ids) await (await taskBox(page, id)).check();
  if (min) await page.locator('.rh-min', { hasText: `${min} min` }).click();
  await page.locator('#rh-start').click();
  await expect(page.locator('#rh')).toBeVisible();
}
async function pausedRehearsal(open: (o?: import('./fixtures').OpenOpts) => Promise<Page>, ids: string[], min?: 30 | 45 | 60) {
  const page = await open({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 3_600_000));
  await startRehearsal(page, ids, min);
  return page;
}
// The text of the summary row of one task: the smallest block around its title that holds no other task's title.
async function row(page: Page, id: string, all: string[]) {
  const mine = titles[id], others = all.filter(x => x !== id).map(x => titles[x]);
  return page.locator('#rh-summary').evaluate((root, [m, o]) => {
    const norm = (s: string) => s.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
    const els = [...root.querySelectorAll<HTMLElement>('*')].filter(e => norm(e.textContent || '').includes(m as string));
    const smallest = els.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    let el = smallest;
    while (el.parentElement && el.parentElement !== root && !(o as string[]).some(t => norm(el.parentElement!.textContent || '').includes(t))) el = el.parentElement;
    return norm(el.innerText || el.textContent || '');  // innerText keeps table cells apart ("0:12 Ran", not "0:12Ran")
  }, [mine, others] as [string, string[]]);
}
const typeCode = async (page: Page, code: string) => { await upgraded(page); await editor(page).fill(code); };

// ---------------------------------------------------------------- setup
test('setup: one .rh-task checkbox per 13-live-coding question with a Starter, named by its title', async ({ bank }) => {
  const all = (await bankData(bank)).filter(q => q.file === '13-live-coding' && isTask(q));
  expect(all.length).toBeGreaterThan(10);
  await rhSetup(bank);
  await expect(bank.locator('.rh-task')).toHaveCount(all.length);
  for (const id of [T1, T2, SQL]) await expect(await taskBox(bank, id)).toHaveClass(/rh-task/);
  const names = await bank.locator('.rh-task').evaluateAll(els => els.map(e => ((e as HTMLInputElement).labels?.[0]?.textContent ?? e.getAttribute('aria-label') ?? '').replace(/[`*]/g, '').replace(/\s+/g, ' ').trim()));
  expect(names.sort()).toEqual(all.map(q => clean(q.q)).sort());
  // a live-coding question without code in its Starter is not offered
  const noStarter = (await bankData(bank)).filter(q => q.file === '13-live-coding' && !isTask(q));
  for (const q of noStarter.slice(0, 5)) expect(names, q.id).not.toContain(clean(q.q));
});

test('setup: .rh-min buttons 30, 45, 60 min; 45 is pressed by default; #rh-start is disabled until a task is ticked', async ({ bank }) => {
  await rhSetup(bank);
  await expect(bank.locator('.rh-min')).toHaveText(['30 min', '45 min', '60 min']);
  await expect(bank.getByRole('button', { name: '45 min', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.getByRole('button', { name: '30 min', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await bank.getByRole('button', { name: '60 min', exact: true }).click();
  await expect(bank.getByRole('button', { name: '60 min', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bank.getByRole('button', { name: '45 min', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(bank.locator('.rh-min[aria-pressed="true"]')).toHaveCount(1);
  await expect(bank.getByRole('button', { name: 'Start rehearsal', exact: true })).toHaveAttribute('id', 'rh-start');
  await expect(bank.locator('#rh-start')).toBeDisabled();
  const box = await taskBox(bank, T1);
  await box.check();
  await expect(bank.locator('#rh-start')).toBeEnabled();
  await box.uncheck();
  await expect(bank.locator('#rh-start')).toBeDisabled();
});

test('FM25 sixth task: at 5 ticked every other box is disabled; unticking one frees them again', async ({ bank }) => {
  await rhSetup(bank);
  const boxes = bank.locator('.rh-task');
  const n = await boxes.count();
  expect(n).toBeGreaterThan(6);
  for (let i = 0; i < 5; i++) await boxes.nth(i).check();
  await expect(boxes.locator('xpath=self::*[@disabled or @aria-disabled="true"]')).toHaveCount(n - 5);
  for (let i = 0; i < 5; i++) await expect(boxes.nth(i)).toBeEnabled();
  await expect(boxes.nth(5)).toBeDisabled();
  await expect(boxes.nth(n - 1)).toBeDisabled();
  await boxes.nth(5).click({ force: true }).catch(() => undefined);
  await expect(boxes.nth(5)).not.toBeChecked();
  expect(await boxes.evaluateAll(els => els.filter(e => (e as HTMLInputElement).checked).length)).toBe(5);
  await boxes.nth(2).uncheck();
  await expect(boxes.locator('xpath=self::*[@disabled]')).toHaveCount(0);
  await boxes.nth(5).check();
  expect(await boxes.evaluateAll(els => els.filter(e => (e as HTMLInputElement).checked).length)).toBe(5);
  await expect(boxes.nth(6)).toBeDisabled();
});

// ---------------------------------------------------------------- the rehearsal
test('view #rh: clock counts down from the chosen minutes, "Task N of M", task text, editor with Run', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1, T2]);
  await expect(page.locator('#rh-clock')).toHaveText('45:00');
  await expect(page.locator('#rh-step')).toHaveText('Task 1 of 2');
  await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[0]);
  await expect(page.locator('#rh-next')).toHaveText('Next task');
  await expect(page.getByRole('button', { name: 'End rehearsal', exact: true })).toHaveAttribute('id', 'rh-end');
  await expect(page.locator('#rh .editor')).toBeVisible();
  await expect(runBtn(page)).toHaveText('Run');
  await expect(page.locator('#rh')).toContainText('reverse');
  await expect(page.locator('.check-btn'), 'a TypeScript task has no Check').toBeHidden();
  await page.clock.runFor(10_000);
  await expect(page.locator('#rh-clock')).toHaveText('44:50');
  await page.clock.runFor(60_000);
  await expect(page.locator('#rh-clock')).toHaveText('43:50');
});

for (const min of [30, 60] as const) {
  test(`${min} min: the clock starts at ${min}:00`, async ({ open }) => {
    const page = await pausedRehearsal(open, [T1], min);
    await expect(page.locator('#rh-clock')).toHaveText(`${min}:00`);
    await expect(page.locator('#rh-step')).toHaveText('Task 1 of 1');
    await expect(page.locator('#rh-next')).toHaveText('Finish');
  });
}

test('think-aloud prompts: five stages, Next prompt moves on, disabled after stage 5, back to stage 1 on the next task', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1, T2]);
  const next = page.locator('#rh-next-prompt');
  await expect(next).toHaveAccessibleName('Next prompt');
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[i]);
    if (i < 4) { await expect(next).toBeEnabled(); await next.click(); }
  }
  await expect(next).toBeDisabled();
  await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[4]);
  await page.locator('#rh-next').click();
  await expect(page.locator('#rh-step')).toHaveText('Task 2 of 2');
  await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[0]);
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[1]);
});

test('Next task shows the next task; on the last task it reads Finish and ends with the summary and no "Time is up."', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1, T2]);
  await page.locator('#rh-next').click();
  await expect(page.locator('#rh-step')).toHaveText('Task 2 of 2');
  await expect(page.locator('#rh-next')).toHaveAccessibleName('Finish');
  await page.locator('#rh-next').click();
  await expect(page.locator('#rh-summary')).toBeVisible();
  await expect(page.locator('#rh-timeup')).toBeHidden();
});

test('summary: one row per task with the time spent (m:ss) and the result; Not run for a task never run', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1, T2]);
  await page.clock.runFor(12_000);
  await typeCode(page, "console.log('ran it');");
  await runBtn(page).click();
  await waitDone(out(page));
  await page.locator('#rh-next').click();
  await page.clock.runFor(31_000);
  await page.getByRole('button', { name: 'End rehearsal', exact: true }).click();
  await expect(page.locator('#rh-summary')).toBeVisible();
  const r1 = await row(page, T1, [T1, T2]);
  const r2 = await row(page, T2, [T1, T2]);
  expect(r1).toContain('0:12');
  expect(r1).toMatch(/\bRan\b/);
  expect(r2).toContain('0:31');
  expect(r2).toMatch(/Not run/);
  expect(r1).not.toMatch(/Not run|Correct|Not correct yet/);
});

test('summary: a task not reached before End rehearsal is a row too, with 0:00 and Not run', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1, T2, SQL]);
  await page.clock.runFor(5_000);
  await page.locator('#rh-end').click();
  const r3 = await row(page, SQL, [T1, T2, SQL]);
  expect(r3).toContain('0:00');
  expect(r3).toMatch(/Not run/);
  expect(await row(page, T1, [T1, T2, SQL])).toContain('0:05');
});

test('SQL task: Check gives Correct for the worked answer and "Not correct yet" for a wrong query', async ({ open }) => {
  const page = await pausedRehearsal(open, [SQL, T1]);
  await expect(page.locator('.check-btn')).toBeVisible();
  const q = (await bankData(page)).find(x => x.id === SQL)!;
  await typeCode(page, 'select 1 as nothing;');
  const wrong = await check(page);
  expect(wrong.verdict).not.toBe('pass');
  await page.locator('#rh-next').click();
  await page.locator('#rh-end').click();
  expect(await row(page, SQL, [SQL, T1])).toMatch(/Not correct yet/);
  expect(q.id).toBe(SQL);
});

test('SQL task: the worked answer shows Correct in the summary', async ({ open }) => {
  const page = await pausedRehearsal(open, [SQL]);
  const q = (await bankData(page)).find(x => x.id === SQL)!;
  await typeCode(page, workedSql(q).code);
  const r = await check(page);
  expect(r.verdict).toBe('match');  // docs/phase3-spec.md: a correct result is data-verdict="match"
  await page.locator('#rh-next').click();   // the only task: Finish
  expect(await row(page, SQL, [SQL])).toMatch(/\bCorrect\b/);
  expect(await row(page, SQL, [SQL])).not.toMatch(/Not correct yet|Not run/);
});

test('code typed in a rehearsal is saved like code typed in Learn', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1]);
  await typeCode(page, '// typed in the rehearsal');
  // The editor ends the saved text with a newline in Learn too, so the comparison ignores trailing white space.
  await expect.poll(async () => (await saved(page)).code?.[T1]?.trimEnd()).toBe('// typed in the rehearsal');
});

// ---------------------------------------------------------------- FM23, FM24
test('FM23 while (true) {} in a task: stopped at 5 s, the clock keeps going, Next task works and the next task runs', async ({ open }) => {
  test.setTimeout(60_000);
  const page = await open();
  await startRehearsal(page, [T1, T2]);
  await typeCode(page, 'while (true) {}');
  const t0 = await left(page);
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  const started = Date.now();
  await expect(status(out(page))).toHaveText(LIMIT, { timeout: 15_000 });
  const took = Date.now() - started;
  expect(took).toBeGreaterThanOrEqual(4000);
  expect(took).toBeLessThanOrEqual(9000);
  const t1 = await left(page);
  expect(t0 - t1, 'clock seconds that passed').toBeGreaterThanOrEqual(4);
  expect(t0 - t1).toBeLessThanOrEqual(12);
  await expect(runBtn(page)).toHaveText('Run');
  await page.locator('#rh-next').click();
  await expect(page.locator('#rh-step')).toHaveText('Task 2 of 2');
  await typeCode(page, "console.log('second task');");
  await runBtn(page).click();
  const r = await waitDone(out(page));
  expect(r.lines).toEqual(['second task']);
  expect(await left(page)).toBeLessThanOrEqual(t1);  // the second run can finish within the same clock second
});

test('FM23 Next task pressed while the loop still runs works at once and the old run does not write into the next task', async ({ open }) => {
  test.setTimeout(60_000);
  const page = await open();
  await startRehearsal(page, [T1, T2]);
  await typeCode(page, 'while (true) {}');
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await page.locator('#rh-next').click();
  await expect(page.locator('#rh-step')).toHaveText('Task 2 of 2');
  await expect(runBtn(page)).toHaveText('Run');
  await expect(page.locator('#rh-prompt')).toHaveText(PROMPTS[0]);
  await typeCode(page, "console.log('clean');");
  await runBtn(page).click();
  const r = await waitDone(out(page));
  expect(r.lines).toEqual(['clean']);
  expect(await lines(out(page))).not.toContain(LIMIT);
  await expect(status(out(page))).not.toHaveText(LIMIT);
});

test('FM24 the clock reaches 0 while code runs: the run stops, "Time is up." and the summary show', async ({ open }) => {
  test.setTimeout(60_000);
  const page = await open({ time: NOW });
  await startRehearsal(page, [T1, T2], 30);
  await typeCode(page, 'while (true) {}');
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await page.clock.fastForward(30 * 60 * 1000 + 2000);
  await expect(page.locator('#rh-timeup')).toHaveText('Time is up.');
  await expect(page.locator('#rh-summary')).toBeVisible();
  await expect(page.locator('.run-btn', { hasText: 'Stop' })).toBeHidden();
  const r1 = await row(page, T1, [T1, T2]);
  expect(r1, 'time spent on the task that was open at the end').toMatch(/30:0\d/);
  expect(await row(page, T2, [T1, T2])).toMatch(/Not run/);
  // nothing lands afterwards: more time passes, the summary is the same
  const before = await page.locator('#rh-summary').innerText();
  await page.clock.runFor(10_000);
  expect(await page.locator('#rh-summary').innerText()).toBe(before);
});

test('FM24 time is up with nothing running: the same summary and the line "Time is up."', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1], 30);
  await page.clock.runFor(29 * 60 * 1000 + 59_000);
  await expect(page.locator('#rh-clock')).toHaveText('0:01');
  await expect(page.locator('#rh-timeup')).toBeHidden();
  await page.clock.runFor(1_000);
  await expect(page.locator('#rh-timeup')).toHaveText('Time is up.');
  await expect(page.locator('#rh-summary')).toBeVisible();
  expect(await row(page, T1, [T1])).toContain('30:00');
});

test('FM24 the clock is the time left by the clock, not by ticks: a 10-minute jump shows 35:00', async ({ open }) => {
  const page = await pausedRehearsal(open, [T1]);
  await page.clock.fastForward(10 * 60 * 1000);
  await page.clock.runFor(100);
  await expect.poll(() => left(page)).toBeLessThanOrEqual(35 * 60);
  await expect.poll(() => left(page)).toBeGreaterThanOrEqual(34 * 60 + 59);
});
