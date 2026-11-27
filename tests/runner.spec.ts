// Phase 3: code editor, TypeScript/JavaScript runner, run bar, answer-block Run buttons (docs/phase3-spec.md).
// Written from the spec only. "FMn" in a title is failure mode n of the spec.
import { test, expect, load, reload, bankData, goTo, saved, currentId, PAGE_URL } from './fixtures';
import {
  TS_TASKS, SQL_TASKS, LIMIT, norm, blocks, isRunTs, isRunSql, isTs, starterOf, workedTs, okLine, nodeLines,
  editor, out, runBtn, lines, errors, status, upgraded, task, run, runCode, waitDone, gapMonitor, corruptParts,
  openById, isTask,
} from './code-helpers';

test.use({ actionTimeout: 8_000 });

const BLOCKED_MSG = 'This browser blocks running code in the page, so Run is off here. The answer and Compare still work.';
const RUNNER_MSG = 'This browser cannot unpack the code runner. Use a current Chrome, Edge, Firefox or Safari.';
const QUESTIONS_MSG = 'This browser cannot unpack the questions. Use a current Chrome, Edge, Firefox or Safari.';
const textOf = (page: import('@playwright/test').Page) => editor(page).evaluate(el => ('value' in el ? (el as HTMLTextAreaElement).value : (el as HTMLElement).innerText));
const savedCode = async (page: import('@playwright/test').Page, id: string) => (await saved(page)).code?.[id] as string | undefined;

// ---------------------------------------------------------------- packed parts and start-up
test('startup 1 and 7: five packed parts as gzip-base64 scripts, the global Q, no #data', async ({ open }) => {
  const page = await open();
  for (const n of ['data', 'codemirror', 'sucrase', 'sqljs', 'sqlwasm']) {
    await expect(page.locator(`script#pack-${n}[type="application/x-gzip-base64"]`), `pack-${n}`).toHaveCount(1);
  }
  expect(await page.evaluate(() => document.getElementById('data'))).toBeNull();
  const info = await page.evaluate(() => {
    const q = (0, eval)('Q') as Record<string, unknown>[];
    return { isArray: Array.isArray(q), n: q.length, keys: Object.keys(q[0]), first: q[0].id };
  });
  expect(info.isArray).toBe(true);
  expect(info.n).toBeGreaterThan(400);
  expect(info.keys).toEqual(expect.arrayContaining(['id', 'file', 'topic', 'section', 'q', 'body']));
  await expect(page.locator('html')).toHaveAttribute('data-ready', '1');
});

test('startup 3: editor and runner parts unpack on first use, once per page load', async ({ watched: page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __ds: number; DecompressionStream: typeof DecompressionStream };
    const D = w.DecompressionStream;
    w.__ds = 0;
    w.DecompressionStream = class extends D { constructor(f: CompressionFormat) { super(f); w.__ds++; } } as typeof DecompressionStream;
  });
  await load(page);
  const ds = () => page.evaluate(() => (window as unknown as { __ds: number }).__ds);
  const atHome = await ds();
  expect(atHome, 'the questions are unpacked at start').toBeGreaterThanOrEqual(1);
  const bank = await bankData(page);
  const plain = bank.find(q => !q.body.includes('**Starter:**') && q.file === bank[0].file)!;
  await goTo(page, 'learn', plain.file);
  await openById(page, plain.id);
  expect(await ds(), 'a plain question unpacks nothing').toBe(atHome);
  await openById(page, 'q1019');
  await upgraded(page);
  const afterEditor = await ds();
  expect(afterEditor, 'the editor part unpacks when the first task shows').toBeGreaterThan(atHome);
  await openById(page, 'q1020');
  await upgraded(page);
  expect(await ds(), 'the editor part unpacks once').toBe(afterEditor);
  await runBtn(page).click();
  await waitDone(out(page));
  const afterRun = await ds();
  await run(page);
  await openById(page, 'q1021');
  await run(page);
  expect(await ds(), 'the TS runner part unpacks once').toBe(afterRun);
  await openById(page, 'q1030');
  await run(page);
  const afterSql = await ds();
  await run(page);
  await openById(page, 'q1031');
  await run(page);
  expect(await ds(), 'the SQL runner parts unpack once').toBe(afterSql);
});

test('FM15 questions cannot be unpacked: home shows the message with role alert, no page error', async ({ watched: page }) => {
  await page.addInitScript(() => {
    try { delete (window as unknown as Record<string, unknown>).DecompressionStream; } catch { /* keep going */ }
    (window as unknown as Record<string, unknown>).DecompressionStream = undefined;
  });
  await page.goto(PAGE_URL);
  await expect(page.locator('#home').getByRole('alert')).toHaveText(QUESTIONS_MSG);
});

test('FM15 runner part cannot be unpacked: Run shows the runner message, the page keeps working', async ({ watched: page }) => {
  await corruptParts(page, ['sucrase']);
  await load(page);
  await openById(page, 'q1019');
  await runBtn(page).click();
  await expect(out(page)).toContainText(RUNNER_MSG, { timeout: 10_000 });
  await expect(runBtn(page)).toHaveText('Run');
  await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect.poll(() => currentId(page)).toBe('q1020');
});

test('FM15 editor part cannot be unpacked: the plain text box stays and saves; Run still works', async ({ watched: page }) => {
  await corruptParts(page, ['codemirror']);
  await load(page);
  await openById(page, 'q1019');
  await expect(editor(page)).toBeVisible();
  await page.waitForTimeout(1500);   // an upgrade would have happened by now
  expect(await editor(page).evaluate(el => el.tagName)).toBe('TEXTAREA');
  await editor(page).fill("console.log('plain box');");
  await expect.poll(() => savedCode(page, 'q1019')).toBe("console.log('plain box');");
  const r = await run(page);
  expect(r.lines).toEqual(['plain box']);
  expect(r.errors).toEqual([]);
});

// ---------------------------------------------------------------- editor (idea 34)
test('editor 1 and 2: every one of the 21 tasks shows one visible Code editor holding its starter', async ({ open }) => {
  const page = await open();
  const tasks = (await bankData(page)).filter(isTask);
  expect(tasks).toHaveLength(21);
  for (const q of tasks) {
    await openById(page, q.id);
    await expect(editor(page), q.id).toHaveCount(1);
    await expect(editor(page), q.id).toBeVisible();
    expect(norm(await textOf(page)), `starter text of ${q.id}`).toBe(norm(starterOf(q)));
  }
  await upgraded(page);   // the textarea has been replaced by the code editor
});

test('FM16 saved code shows in the upgraded editor after reload, and editing in it saves', async ({ open }) => {
  const page = await open();
  const mine = "const mine = 1;\nconsole.log('saved', mine);";
  await task(page, 'q1019', mine);
  await upgraded(page);
  expect(norm(await textOf(page))).toBe(norm(mine));
  expect(await savedCode(page, 'q1019'), 'the upgrade must not overwrite saved code').toBe(mine);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' // typed');
  await expect.poll(() => savedCode(page, 'q1019')).toContain('// typed');
  const after = (await savedCode(page, 'q1019'))!;
  expect(after.startsWith("const mine = 1;\nconsole.log('saved', mine);")).toBe(true);
  await reload(page);
  await openById(page, 'q1019');
  await upgraded(page);
  expect(norm(await textOf(page))).toBe(norm(after));
});

test('editor 4: Tab inserts two spaces; Esc then Tab leaves the editor', async ({ open }) => {
  const page = await open();
  await task(page, 'q1019', 'x');
  await upgraded(page);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('Tab');
  await expect.poll(() => savedCode(page, 'q1019')).toBe('  x');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label') !== 'Code editor')).toBe(true);
  expect(await savedCode(page, 'q1019'), 'Tab after Esc must not type into the code').toBe('  x');
});

test('editor 6: Ctrl+Enter (Cmd+Enter on a Mac) in the editor runs the code, TS and SQL', async ({ open }) => {
  const page = await open();
  await task(page, 'q1019', "console.log('hi from the keyboard');");
  await upgraded(page);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+Enter');
  const r = await waitDone(out(page));
  expect(r.lines).toEqual(['hi from the keyboard']);
  expect(await savedCode(page, 'q1019'), 'Enter must not be typed into the code').toBe("console.log('hi from the keyboard');");
  await task(page, 'q1030', 'SELECT 41 + 1 AS answer;');
  await upgraded(page);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(out(page).locator('table td')).toHaveText(['42'], { timeout: 15_000 });
});

test('editor 5: Reset to starter puts the starter into the code editor; Compare with the answer shows the worked answer', async ({ open }) => {
  const page = await open();
  const bank = await bankData(page);
  const q = bank.find(x => x.id === 'q1019')!;
  await task(page, 'q1019', 'junk that is not the starter');
  await upgraded(page);
  await page.getByRole('button', { name: 'Reset to starter' }).click();
  await expect.poll(async () => norm(await textOf(page))).toBe(norm(starterOf(q)));
  // Compare: a distinctive worked line shows up once more than before the click (the answer itself is already on the page).
  for (const id of ['q1019', 'q1030']) {
    await task(page, id, 'junk');
    await upgraded(page);
    const worked = id === 'q1019' ? workedTs(bank.find(x => x.id === id)!) : blocks(bank.find(x => x.id === id)!.body).filter(b => b.full).at(-1)!.code;
    const line = norm(worked.split('\n').filter(l => l.trim().length > 25).at(-3) ?? worked.split('\n')[0]);
    const count = async () => (norm(await page.locator('body').innerText()).split(line).length - 1);
    const before = await count();
    await page.getByRole('button', { name: 'Compare with the answer' }).click();
    await expect.poll(count, { message: `worked line of ${id} appears after Compare` }).toBeGreaterThan(before);
  }
});

// ---------------------------------------------------------------- run bar and output
test('run bar 1: runnable tasks have Run (SQL also Check); FM21 the 5 Playwright tasks with an editor have neither', async ({ open }) => {
  const page = await open();
  const bank = await bankData(page);
  const tasks = bank.filter(isTask);
  const pw = tasks.filter(q => starterOf(q).includes('@playwright/test'));
  expect(pw.map(q => q.id).sort()).toHaveLength(5);
  for (const q of pw) {
    await openById(page, q.id);
    await expect(editor(page), `${q.id} has the editor`).toBeVisible();
    await expect(runBtn(page), `${q.id} Run`).toHaveCount(0);
    await expect(page.locator('.check-btn'), `${q.id} Check`).toHaveCount(0);
  }
  for (const id of [...TS_TASKS, ...SQL_TASKS]) {
    await openById(page, id);
    await expect(runBtn(page), `${id} Run`).toHaveCount(1);
    await expect(runBtn(page)).toHaveText('Run');
    await expect(page.locator('.check-btn'), `${id} Check`).toHaveCount(SQL_TASKS.includes(id) ? 1 : 0);
    if (SQL_TASKS.includes(id)) await expect(page.locator('.check-btn')).toHaveText('Check my answer');
  }
  expect(tasks.length - pw.length).toBe(16);
});

test('run bar 2, 3: Run turns into Stop while running; Stop ends the run with "Stopped." and no later output', async ({ open }) => {
  const page = await open();
  await task(page, 'q1019', "console.log('first line');\nawait new Promise(r => setTimeout(r, 1500));\nconsole.log('late line');");
  await expect(out(page)).toHaveAttribute('aria-live', 'polite');
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await expect(out(page)).toContainText('Running…');
  await expect(out(page).locator('.out-line')).toHaveText(['first line'], { timeout: 15_000 });
  await runBtn(page).click();
  await expect(status(out(page))).toHaveText('Stopped.');
  await expect(runBtn(page)).toHaveText('Run');
  await page.waitForTimeout(2000);
  expect(await lines(out(page))).toEqual(['first line']);
  await expect(status(out(page))).toHaveText('Stopped.');
  // the last element of the output is the status
  await expect(out(page).locator(':scope > :last-child')).toHaveClass(/out-status/);
  const again = await run(page);
  expect(again.lines).toEqual(['first line', 'late line']);
  expect(again.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('FM13 run again while a slow run is going: the first run never adds output after the second started', async ({ open }) => {
  const page = await open();
  await task(page, 'q1019', "console.log('start');\nawait new Promise(r => setTimeout(r, 1200));\nconsole.log('end');");
  await runBtn(page).click();
  await expect(out(page).locator('.out-line').first()).toHaveText('start', { timeout: 15_000 });
  await page.waitForTimeout(600);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+Enter');   // runs again (or stops, if Run reads Stop): either way the first run is over
  await page.waitForTimeout(900);                     // the first run's 'end' would have printed by now
  expect(await lines(out(page)), 'output of the first run after the second began').not.toContain('end');
  const r = await waitDone(out(page));
  expect(r.lines.filter(l => l === 'start')).toHaveLength(1);
  expect(r.lines.filter(l => l === 'end').length).toBeLessThanOrEqual(1);
  if (/^Finished/.test(r.status)) expect(r.lines).toEqual(['start', 'end']);
  await page.waitForTimeout(1500);
  expect((await lines(out(page))).filter(l => l === 'end').length).toBeLessThanOrEqual(1);
});

for (const how of ['Next', 'Previous', 'another tab', 'a mark that redraws the question'] as const) {
  test(`FM14 leaving mid-run (${how}): the late line never shows on any question`, async ({ open }) => {
    const page = await open();
    const code = "console.log('started');\nsetTimeout(() => console.log('late'), 1500);";
    await task(page, how === 'Previous' ? 'q1020' : 'q1019', code);
    await runBtn(page).click();
    await expect(out(page).locator('.out-line')).toHaveText(['started'], { timeout: 15_000 });   // the run is live
    if (how === 'Next') await page.getByRole('button', { name: 'Next →' }).click();
    else if (how === 'Previous') await page.getByRole('button', { name: /Previous/ }).click();
    else if (how === 'another tab') await page.locator('#tab-quiz').click();
    else await page.locator('.known-btn').click();
    await page.waitForTimeout(2500);
    const anywhere = await page.evaluate(() => /(^|\n)late(\n|$)/.test(document.body.innerText) || [...document.querySelectorAll('.out-line')].some(e => e.textContent === 'late'));
    expect(anywhere, "'late' on the page").toBe(false);
    await page.locator('#tab-learn').click();
    await openById(page, how === 'Previous' ? 'q1020' : 'q1019');
    expect(await lines(out(page)), 'fresh question has no output of the old run').not.toContain('late');
  });
}

test('FM1 endless loop: time-limit status in 4.5 to 8 s, the page never stalls, the next Run prints normally', async ({ open }) => {
  test.setTimeout(45_000);
  const page = await open();
  await task(page, 'q1020', "console.log('warm');");
  expect((await run(page)).lines).toEqual(['warm']);   // unpacks the runner, so the timing below is only the run
  await task(page, 'q1019', 'while (true) {}');
  const gap = await gapMonitor(page);
  await expect(runBtn(page)).toHaveText('Run');
  const t0 = Date.now();
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await expect(status(out(page))).toHaveText(LIMIT, { timeout: 15_000 });
  const took = Date.now() - t0;
  expect(took).toBeGreaterThanOrEqual(4500);
  expect(took).toBeLessThanOrEqual(8000);
  expect(await gap(), 'longest gap of a page timer (ms)').toBeLessThanOrEqual(250);
  await expect(runBtn(page)).toHaveText('Run');
  await openById(page, 'q1020');
  const next = await run(page);
  expect(next.lines).toEqual(['warm']);
  expect(next.status).toMatch(/^Finished in \d+ ms\.$/);
  // Run on the same editor works again too
  await openById(page, 'q1019');
  await expect(runBtn(page)).toHaveText('Run');
});

test('FM2 plain runaway recursion: an error that mentions the call stack or recursion; the next run works', async ({ open }) => {
  test.setTimeout(30_000);
  const page = await open();
  await task(page, 'q1020', "console.log('next ok');");
  const r = await runCode(page, 'q1019', 'function f(): number { return f(); }\nf();');
  expect(r.errors.join('\n')).toMatch(/call stack|recursion/i);
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
  await openById(page, 'q1020');
  expect((await run(page)).lines).toEqual(['next ok']);
});

test('FM2 recursion that catches its own stack error: call-stack error or the time limit; the next run works', async ({ open }) => {
  test.setTimeout(40_000);
  const page = await open();
  await task(page, 'q1020', "console.log('next ok');");
  const r = await runCode(page, 'q1019', 'function f() { try { f(); } catch { f(); } }\nf();', 20_000);
  if (r.status === LIMIT) expect(r.errors).toEqual([]);
  else { expect(r.errors.join('\n')).toMatch(/call stack|recursion/i); expect(r.status).toMatch(/^Finished in \d+ ms\.$/); }
  await openById(page, 'q1020');
  const next = await run(page);
  expect(next.lines).toEqual(['next ok']);
  expect(next.errors).toEqual([]);
});

test('FM3 syntax error on line 3 shows SyntaxError with (line 3)', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "const a = 1;\nconsole.log(a);\nconst x = ;\nconsole.log('never');");
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0]).toMatch(/^SyntaxError: .+ \(line 3\)$/);
  expect(r.lines).toEqual([]);
});

test('FM3 a syntax error only the engine reports (duplicate declaration) still shows SyntaxError', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "console.log('before');\nlet a = 1;\nlet a = 2;");
  expect(r.errors.join('\n')).toMatch(/SyntaxError/);
  expect(r.lines, 'a syntax error stops everything before it runs').toEqual([]);
});

test('FM8 output flood: 1,000 lines stay, the run stops with the limit status, the next run works', async ({ open }) => {
  test.setTimeout(40_000);
  const page = await open();
  const flood = await runCode(page, 'q1019', 'for (;;) console.log(1);');
  expect(flood.status).toBe('Output stopped at 1,000 lines.');
  await expect(out(page).locator('.out-line')).toHaveCount(1000);
  expect(flood.lines.every(l => l === '1')).toBe(true);
  await expect(runBtn(page)).toHaveText('Run');
  const counted = await runCode(page, 'q1019', 'for (let i = 1; ; i++) console.log(i);');
  expect(counted.status).toBe('Output stopped at 1,000 lines.');
  expect(counted.lines).toHaveLength(1000);
  expect(counted.lines[0]).toBe('1');
  expect(counted.lines[999]).toBe('1000');
  await expect(out(page).locator(':scope > :last-child')).toHaveClass(/out-status/);
  const next = await runCode(page, 'q1020', "console.log('fine');");
  expect(next.lines).toEqual(['fine']);
});

test('FM11 unhandled rejection shows Error: boom, then the run finishes', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "console.log('a');\nPromise.reject(new Error('boom'));");
  expect(r.errors.join('\n')).toContain('Error: boom');
  expect(r.lines).toEqual(['a']);
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('run TS 6: a thrown error shows Name: message with the right line, lines before it stay, the run finishes', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "console.log('before');\nfunction f() {\n  throw new TypeError('bad thing');\n}\nf();\nconsole.log('after');");
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0]).toMatch(/^TypeError: bad thing( \(line 3\))?$/);
  expect(r.lines).toEqual(['before']);
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
  const t = await runCode(page, 'q1020', "setTimeout(() => { throw new RangeError('from a timer'); }, 10);");
  expect(t.errors.join('\n')).toContain('RangeError: from a timer');
  expect(t.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('FM12 an unknown import shows the page-provides message', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "import fs from 'node:fs';\nconsole.log(fs);");
  expect(r.errors.join('\n')).toContain("Error: Cannot use 'node:fs' here. The page provides node:assert, node:assert/strict and node:test (mock.timers).");
  expect(r.lines).toEqual([]);
  const r2 = await runCode(page, 'q1020', "import _ from 'lodash';\nconsole.log(_);");
  expect(r2.errors.join('\n')).toContain("Error: Cannot use 'lodash' here. The page provides node:assert, node:assert/strict and node:test (mock.timers).");
});

test('FM6 Worker constructor throws: blocked message, nothing runs on the page, no page error, the page keeps working', async ({ watched: page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).Worker = function () { throw new Error('workers are blocked here'); };
  });
  await load(page);
  await task(page, 'q1019', "globalThis.__ranOnPage = 1;\nconsole.log('x');");
  await runBtn(page).click();
  await expect(out(page)).toContainText(BLOCKED_MSG, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__ranOnPage), 'code must not run on the page thread').toBeUndefined();
  await expect(out(page).locator('.out-line')).toHaveCount(0);
  await expect(runBtn(page)).toHaveText('Run');
  await task(page, 'q1030', 'SELECT 1;');
  await runBtn(page).click();
  await expect(out(page)).toContainText(BLOCKED_MSG, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Compare with the answer' }).click();
  // the page still works: Next, marks
  await openById(page, 'q1019');
  await page.locator('.known-btn').click();
  expect(Object.keys((await saved(page)).known)).toContain('q1019');
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect.poll(() => currentId(page)).toBe('q1020');
});

test('FM6 Worker fires error before the run starts: blocked message, no page error', async ({ watched: page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).Worker = function (this: unknown) {
      const t = new EventTarget() as EventTarget & Record<string, unknown>;
      t.postMessage = () => undefined;
      t.terminate = () => undefined;
      setTimeout(() => {
        const ev = new ErrorEvent('error', { message: 'blocked' });
        t.dispatchEvent(ev);
        if (typeof t.onerror === 'function') (t.onerror as (e: Event) => void)(ev);
      }, 0);
      return t;
    };
  });
  await load(page);
  await task(page, 'q1019', "globalThis.__ranOnPage = 1;\nconsole.log('x');");
  await runBtn(page).click();
  await expect(out(page)).toContainText(BLOCKED_MSG, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__ranOnPage)).toBeUndefined();
  await expect(runBtn(page)).toHaveText('Run');
});

// ---------------------------------------------------------------- TypeScript and JavaScript rules
test('TS 1 and 4: types are removed, top-level await works, code is strict; console methods print lines', async ({ open }) => {
  const page = await open();
  const code = [
    "interface Box<T> { value: T }",
    "const box: Box<number> = { value: 41 };",
    "const n = (await Promise.resolve(box.value)) + 1;",
    "console.log(n, typeof n);",
    "console.log((function (this: unknown) { return this === undefined; })());",
    "const wide = (null as unknown as string | null)?.length;",
    "console.log(wide);",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(code).join('\n'));
  const m = await runCode(page, 'q1020', "console.info('i'); console.warn('w'); console.error('e'); console.debug('d'); console.log('a', 'b', 1, ['c']);");
  expect(m.lines).toEqual(['i', 'w', 'e', 'd', "a b 1 [ 'c' ]"]);
  const s = await runCode(page, 'q1021', "undeclaredVariable = 5;");
  expect(s.errors.join('\n')).toMatch(/ReferenceError/);
});

test('TS 4: values print like Node util.inspect (arrays, strings, Map, Set, classes, wrapping at 80 characters)', async ({ open }) => {
  const page = await open();
  const code = [
    "class Point { x = 1; y = 'two'; }",
    "console.log([1, 2], ['a', \"it's\"], { a: 'x', b: [1, { c: null }], d: undefined });",
    "console.log(new Map([['a', 1]]), new Set([1]), new Point(), [new Point()]);",
    "console.log({ a: { b: { c: { d: 1 } } } });",
    "console.log(Array.from({ length: 30 }, (_, i) => i * 3));",
    "console.log(Array.from({ length: 101 }, (_, i) => i));",
    "console.log(['alpha-alpha-alpha', 'bravo-bravo-bravo', 'charlie-charlie-charlie', 'delta-delta-delta']);",
    "console.log({ firstName: 'Sam', lastName: 'Tester', email: 'sam@example.com', country: 'PL', active: true });",
    "console.log('text', 7, true, null, undefined, 12n, -0, [undefined, null], new Date(0), /re/g, Symbol('s'));",
    "console.log([[1, [2, [3, [4]]]]], { 'key with space': 1, valid_id: 2 }, [ , 1], 'str'.repeat(3));",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(code).join('\n'));
});

test('TS 4: %s %d %i %f %j %o %O and %% in the first argument work as in Node', async ({ open }) => {
  const page = await open();
  const code = [
    "console.log('%s is %d years and %i days, %f', 'Ann', 42.5, 42.9, '1.5x');",
    "console.log('%j and %O and %o', { a: [1, 2] }, { b: { c: 1 } }, [1, 2]);",
    "console.log('100%% sure', 'extra', 7);",
    "console.log('%s', { a: 1 }, '%d', 5);",
    "console.log('%d %d %d', '42abc', 12n, -0);",
    "console.log('%s %s', 12n, -0);",
    "console.log('no specifier', '%s');",
    "console.log('%s');",
    "console.log('%c styled', 'color: red');",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(code).join('\n'));
});

test('TS 2: node:assert, node:assert/strict, assert and assert/strict all use strict semantics', async ({ open }) => {
  const page = await open();
  const code = [
    "import a1 from 'node:assert';",
    "import a2 from 'node:assert/strict';",
    "import a3 from 'assert';",
    "import a4 from 'assert/strict';",
    "for (const [name, a] of Object.entries({ a1, a2, a3, a4 })) {",
    "  try { a.equal(1, '1'); console.log(name, 'loose equal passed'); } catch (e) { console.log(name, (e as Error).name); }",
    "  try { a.deepEqual({ v: 1 }, { v: '1' }); console.log(name, 'loose deepEqual passed'); } catch (e) { console.log(name, (e as Error).name); }",
    "}",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines).toEqual(['a1 AssertionError', 'a1 AssertionError', 'a2 AssertionError', 'a2 AssertionError', 'a3 AssertionError', 'a3 AssertionError', 'a4 AssertionError', 'a4 AssertionError']);
});

test('TS 2: assert methods behave like node:assert/strict, mock.timers and mock.fn work', async ({ open }) => {
  const page = await open();
  const code = [
    "import assert, { equal, deepStrictEqual } from 'node:assert/strict';",
    "import { mock } from 'node:test';",
    "const t = async (name: string, f: () => unknown) => { try { await f(); console.log(name, 'ok'); } catch (e) { console.log(name, 'threw', (e as Error).name); } };",
    "await t('call', () => assert(0));",
    "await t('call truthy', () => assert(1));",
    "await t('equal NaN', () => assert.equal(NaN, NaN));",
    "await t('equal 300 and 300.0', () => equal(300, 300.0));",
    "await t('equal string and number', () => assert.equal('300', 300));",
    "await t('notEqual', () => assert.notEqual(1, '1'));",
    "await t('strictEqual', () => assert.strictEqual(1, 1));",
    "await t('notStrictEqual', () => assert.notStrictEqual(1, 2));",
    "await t('deepEqual same', () => assert.deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));",
    "await t('deepEqual types', () => assert.deepEqual([1], ['1']));",
    "await t('deepStrictEqual set', () => deepStrictEqual(new Set([1]), new Set([1])));",
    "await t('deepStrictEqual map differs', () => deepStrictEqual(new Map([[1, 2]]), new Map([[1, 3]])));",
    "await t('notDeepEqual', () => assert.notDeepEqual({ a: 1 }, { a: 2 }));",
    "await t('ok', () => assert.ok(0));",
    "await t('fail', () => assert.fail('nope'));",
    "await t('throws', () => assert.throws(() => { throw new Error('x'); }));",
    "await t('throws nothing', () => assert.throws(() => undefined));",
    "await t('rejects', () => assert.rejects(Promise.reject(new Error('x'))));",
    "await t('rejects nothing', () => assert.rejects(Promise.resolve(1)));",
    "mock.timers.enable({ apis: ['setTimeout'] });",
    "setTimeout(() => console.log('fired'), 1000);",
    "console.log('before tick');",
    "mock.timers.tick(999);",
    "console.log('after 999');",
    "mock.timers.tick(1);",
    "mock.timers.reset();",
    "const fn = mock.fn((x: number) => x * 2);",
    "console.log(fn(2), fn(3), fn.mock.calls.length);",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(code).join('\n'));
});

test('TS 3: a failed assert shows AssertionError and its message', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1019', "import assert from 'node:assert/strict';\nconsole.log('checking');\nassert.equal(1 + 1, 3, 'one plus one is not three');");
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0]).toContain('AssertionError');
  expect(r.errors[0]).toContain('one plus one is not three');
  expect(r.lines).toEqual(['checking']);
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('TS 5: the run ends when timers are done and the microtask queue is empty, so late callbacks still print', async ({ open }) => {
  const page = await open();
  const code = [
    "console.log('sync');",
    "setTimeout(() => console.log('timer 0'), 0);",
    "setTimeout(() => { console.log('timer 30'); setTimeout(() => console.log('nested 30'), 30); }, 30);",
    "let n = 0;",
    "const h = setInterval(() => { console.log('tick', ++n); if (n === 3) clearInterval(h); }, 15);",
    "Promise.resolve().then(() => { console.log('micro 1'); return Promise.resolve(); }).then(() => console.log('micro 2'));",
    "await null;",
    "console.log('last line of the function');",
  ].join('\n');
  const r = await runCode(page, 'q1019', code);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(code).join('\n'));
  expect(r.lines.at(-1)).toBe('nested 30');
  expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
});

test('TS 11: every run starts clean, globals and mock timers of one run do not reach the next', async ({ open }) => {
  const page = await open();
  await task(page, 'q1020', "console.log(typeof (globalThis as any).leaked, typeof (globalThis as any).ranBefore);\nsetTimeout(() => console.log('real timer'), 20);");
  await task(page, 'q1019', "import { mock } from 'node:test';\n(globalThis as any).leaked = 1;\n(globalThis as any).ranBefore = 'yes';\nmock.timers.enable({ apis: ['setTimeout'] });\nsetTimeout(() => console.log('never'), 10);\nconsole.log(typeof leaked);");
  const first = await run(page);
  expect(first.lines).toEqual(['number']);
  await openById(page, 'q1020');
  const second = await run(page);
  expect(second.lines).toEqual(['undefined undefined', 'real timer']);
});

// ---------------------------------------------------------------- FM20: the 11 TS/JS tasks, all browsers
for (const id of TS_TASKS) {
  test(`FM20 ${id}: the starter ends with an error, the worked solution prints its ok line without an error`, async ({ open }) => {
    const page = await open();
    const q = (await bankData(page)).find(x => x.id === id)!;
    await openById(page, id);
    const starter = await run(page);
    expect(starter.errors.length, 'the starter must end with an error or a failed check').toBeGreaterThan(0);
    const worked = workedTs(q);
    const ok = okLine(worked);
    expect(ok, 'the worked solution has an ok line').toBeTruthy();
    const r = await runCode(page, id, worked);
    expect(r.errors).toEqual([]);
    expect(r.lines).toContain(ok);
    expect(r.status).toMatch(/^Finished in \d+ ms\.$/);
  });
}

// ---------------------------------------------------------------- answer blocks (idea 39)
test('answer block 2, 3: a runnable TS block has a Run button under it; its output is Node output', async ({ open }) => {
  const page = await open();
  const q = (await bankData(page)).find(x => x.id === 'q1019')!;
  const rb = blocks(q.body).filter(isRunTs);
  expect(rb.length, 'q1019 has ```ts run blocks').toBeGreaterThan(0);
  await openById(page, 'q1019');
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  await expect(page.locator('.run-block')).toHaveCount(rb.length);
  await page.locator('.run-block').first().click();
  const o = page.locator('.run-block').first().locator('xpath=following::*[contains(concat(" ", normalize-space(@class), " "), " out ")][1]');
  const r = await waitDone(o);
  expect(r.errors).toEqual([]);
  expect(r.lines.join('\n')).toBe(nodeLines(rb[0].code).join('\n'));
  expect(r.lines).toContain('reverse: ok');
});

test('answer block 2: a runnable SQL block runs on the question seed', async ({ open }) => {
  const page = await open();
  const q = (await bankData(page)).find(x => x.id === 'q1030')!;
  expect(blocks(q.body).filter(isRunSql).length, 'q1030 has ```sql run blocks').toBeGreaterThan(0);
  await openById(page, 'q1030');
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const btn = page.locator('.run-block').first();
  await expect(btn).toBeVisible();
  await btn.click();
  const o = btn.locator('xpath=following::*[contains(concat(" ", normalize-space(@class), " "), " out ")][1]');
  await waitDone(o).catch(() => undefined);
  await expect(o.locator('.out-error')).toHaveCount(0);
  await expect(o.locator('table td')).toHaveText(['4', 'Dan', '5', 'Eve']);
});

// ---------------------------------------------------------------- FM sweep over every run block (Chromium only)
const SHARDS = 4;
for (let shard = 0; shard < SHARDS; shard++) {
  test(`answer block 3 sweep ${shard + 1}/${SHARDS}: every runnable block finishes without an error; TS output equals Node`, async ({ open, browserName }) => {
    test.skip(browserName !== 'chromium', 'the full sweep runs several hundred blocks and Node comparisons; one browser is enough, the tasks run in all three');
    test.setTimeout(300_000);
    const page = await open();
    const all = (await bankData(page)).filter(q => blocks(q.body).some(b => isRunTs(b) || isRunSql(b)));
    const mine = all.filter((_, i) => i % SHARDS === shard);
    expect(mine.length, `questions with run blocks in this shard (of ${all.length})`).toBeGreaterThan(0);
    for (const q of mine) {
      const runs = blocks(q.body).filter(b => isRunTs(b) || isRunSql(b));
      await openById(page, q.id);
      await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
      const btns = page.locator('.run-block');
      const have = await btns.count();
      expect.soft(have, `${q.id}: Run buttons on the page versus run fences in the text`).toBe(runs.length);
      for (let i = 0; i < Math.min(have, runs.length); i++) {
        const label = `${q.id} block ${i + 1}`;
        const btn = btns.nth(i);
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        const o = btn.locator('xpath=following::*[contains(concat(" ", normalize-space(@class), " "), " out ")][1]');
        try { await expect(status(o)).toHaveText(/^(Finished in \d+ ms\.|Stopped.*|Output stopped.*)$/, { timeout: 15_000 }); } catch { expect.soft(false, `${label}: the run did not finish`).toBe(true); continue; }
        expect.soft(await errors(o), `${label}: errors`).toEqual([]);
        expect.soft((await status(o).textContent())!, `${label}: status`).toMatch(/^Finished in \d+ ms\.$/);
        if (isTs(runs[i])) expect.soft((await lines(o)).join('\n'), `${label}: output versus Node`).toBe(nodeLines(runs[i].code).join('\n'));
      }
    }
  });
}

