# Phase 3 spec: run code in the page (ideas 34 to 39)

The contract for the phase 3 tests and code. Tests are written from this file, not from the code. Ideas: 34 code editor, 35 JavaScript and TypeScript runner, 36 SQL runner with seeded tables, 37 SQL judging, 38 predict the output, 39 Run buttons on answer blocks.

Rules from phase 1 that apply (`docs/feasibility.md`): user code runs only in a worker built from page text and is stopped with `terminate()`; nothing beside the HTML; Firefox tests use stock file:// rules; third-party licences go in the one comment at the end of the page.

## Words used here

- **Task**: a question with a `**Starter:**` code block. 21 exist in `topics/13-live-coding.md`. 5 are Playwright tasks (their starter imports `@playwright/test`), 11 are TypeScript/JavaScript (q1019 to q1029), 5 are SQL (q1030 to q1034). The sixth Playwright task, q1015, has a starter without code (it points to the broken file in its Full process), so it shows the starter text and no editor, as before.
- **Runnable task**: the 11 TS/JS and 5 SQL tasks. Playwright tasks get the editor but no Run button.
- **Predict question**: a question whose title contains `What does this print?` (11 questions: q0236 and q0288 to q0297).
- **Seed**: the SQL that creates and fills the tables of a SQL task.
- **Worked answer** of a SQL task: the code block in its `**Full process:**` fenced as ```` ```sql answer ```` (or ```` ```sql answer ordered ````). Exactly one per SQL task.

## Packed parts and start-up

1. The built page stores five parts gzip-compressed and base64-encoded in `<script type="application/x-gzip-base64" id="pack-NAME">` tags: `data` (the questions), `codemirror`, `sucrase`, `sqljs` (loader) and `sqlwasm` (SQLite as WebAssembly). The browser unpacks them with `DecompressionStream('gzip')`.
2. The questions are unpacked when the page opens. When home is drawn for the first time, `<html>` gets `data-ready="1"`. Tests wait for it after every `goto` and `reload`.
3. The other parts are unpacked on first use only, at most once per page load: the editor when the first task is shown, Sucrase on the first TS/JS run, sql.js on the first SQL run.
4. If unpacking the questions fails (for example `DecompressionStream` is missing), `#home` shows `This browser cannot unpack the questions. Use a current Chrome, Edge, Firefox or Safari.` with `role="alert"`. No page error.
5. If unpacking the editor fails, the plain text box stays and works. If unpacking a runner fails, the run's output shows `This browser cannot unpack the code runner. Use a current Chrome, Edge, Firefox or Safari.`
6. `dist/index.html` stays at or below 4,500,000 bytes (build check).
7. Test access: the question list is the global `Q` (each item keeps `id`, `file`, `topic`, `section`, `q`, `body`). `document.getElementById('data')` no longer exists.

## Editor (idea 34)

1. Every task shows `.editor` with a code editor whose editable part has the accessible name `Code editor` (role `textbox`). TS/JS tasks highlight TypeScript; SQL tasks highlight SQL.
2. The page first renders a plain `<textarea aria-label="Code editor">` and replaces it with CodeMirror once the editor part is unpacked. While both exist only one is visible. The text is the saved code (`store.code[id]`) or the starter.
3. Typing saves to `store.code[id]` like before (key `code` in `localStorage['qa-bank']`). Reload shows the saved text in the editor.
4. Tab inserts two spaces. Esc, then Tab, moves focus out of the editor.
5. `Reset to starter`, `Compare with the answer` and the timer keep working as in phase 2.
6. Ctrl+Enter (Cmd+Enter on a Mac) in the editor of a runnable task does the same as its Run button.
7. Keys typed in the editor never trigger page shortcuts (Space and 1, 2, 3 in the quiz; the arrow keys in Learn).
8. On a SQL task, Run and Check stop each other: pressing one while the other is going stops it, and only the new one's result shows.

## Run bar and output (ideas 35 and 36)

1. Runnable tasks have, under the editor, a `Run` button (class `run-btn`). SQL tasks also have `Check my answer` (class `check-btn`). Playwright tasks have neither.
2. While a run is going, the Run button reads `Stop` and stops it; the output shows `Running…`.
3. Output goes to `.out` beside the button (`aria-live="polite"`). Each printed line is a `.out-line`. An error is an `.out-error`. The last element is `.out-status` with one of:
   - `Finished in N ms.`
   - `Stopped after 5 s: the code was still running. Look for an endless loop, runaway recursion or a timer that never stops.`
   - `Output stopped at 1,000 lines.`
   - `Stopped.` (the user pressed Stop)
4. Pressing Run again first stops the previous run of that editor. Its output never appears after the new run started.
5. Leaving the question (Next, Previous, another tab, a mark that redraws the question, Show answer in the quiz) stops every running run. No output from it lands anywhere afterwards.
6. If a worker cannot be created (`new Worker` throws or fires `error` before the run starts), the output shows `This browser blocks running code in the page, so Run is off here. The answer and Compare still work.` Nothing runs on the page thread. No page error.

### TypeScript and JavaScript

1. The code runs in a new worker per run, made from page text. Types are removed with Sucrase (`typescript` and `imports` transforms). The code runs in strict mode, inside an async function, so top-level `await` works.
2. Imports the page provides: `node:assert`, `node:assert/strict`, `assert`, `assert/strict` (default export callable as `assert(x)`, plus `equal`, `notEqual`, `strictEqual`, `notStrictEqual`, `deepEqual`, `deepStrictEqual`, `notDeepEqual`, `ok`, `throws`, `rejects`, `fail`, with `node:assert/strict` semantics: `equal` is `Object.is`-strict, `deepEqual` is strict deep equality), and `node:test` (`mock.timers.enable({ apis: ['setTimeout'] })`, `mock.timers.tick(ms)`, `mock.timers.reset()`, `mock.fn()`). Any other import gives the error `Error: Cannot use 'NAME' here. The page provides node:assert, node:assert/strict and node:test (mock.timers).`
3. A failed assert shows `AssertionError` and its message in `.out-error`.
4. `console.log`, `info`, `warn`, `error` and `debug` print lines. Several arguments join with a space; strings print as they are; other values print the way Node's `util.inspect` prints them (arrays `[ 1, 2 ]`, strings inside arrays and objects in single quotes, `Map(1) { 'a' => 1 }`, `Set(1) { 1 }`, class instances `Name { x: 1 }`, long arrays and objects wrapped at 80 characters like Node). `%s`, `%d`, `%i`, `%f`, `%j`, `%O` and `%%` in a first string argument work as in Node. `%o` works as `%O`, except that an array also shows `[length]`; other hidden details Node adds for `%o` are not shown.
5. A run is finished when the code's async function has settled, no timer it set is still pending, and the microtask queue is empty. So output from `setTimeout(…, 0)` callbacks after the last line still shows.
6. An error thrown by the code, and a promise rejection nobody handles, show as `.out-error` with `Name: message`, plus ` (line N)` when the line in the user's code is known. The run then ends with `Finished in N ms.`
7. A syntax error shows `SyntaxError: message (line N)` with the line number in the user's code.
8. Time limit: 5 s from the start of the run. Then the worker is terminated and the time-limit status shows. The page itself never stalls: a page timer keeps ticking during an endless loop (no gap over 250 ms).
9. More than 1,000 printed lines: the run is stopped and `Output stopped at 1,000 lines.` shows; the first 1,000 lines stay.
10. Runaway recursion that ends by itself shows an `.out-error` whose text matches `/call stack|recursion/i`. Recursion that catches its own stack error and goes on ends either the same way or by the time limit. Either way the next run works.
11. Every run starts clean: globals set by one run do not exist in the next.

### SQL

1. The SQL runs in a new worker per run with sql.js (SQLite 3.54.1). Each run starts from a fresh in-memory database built from the task's seed.
2. The seed of the 5 SQL tasks is the ```` ```sql ```` block with `INSERT` in the intro of their section ("Live coding: SQL at a whiteboard"): tables `customers` (5 rows) and `orders` (8 rows). The build attaches it to every SQL task of that section and fails when a SQL task has no seed.
3. The starter repeats the `CREATE TABLE` statements. A `CREATE TABLE` in the user's code for a table the seed already made does not fail and does not empty the table.
4. Each statement that returns rows shows one result table (`.out table`, column names as the header). Under each: `N rows` (`1 row`, `No rows`). More than 500 rows: the first 500 show and `Showing the first 500 of N rows.`
5. A SQL error shows `.out-error` with SQLite's message.
6. The same 5 s limit stops a query that never ends (for example an endless recursive CTE).

## SQL judging (idea 37)

`Check my answer` runs the user's SQL and the worked answer, each on a fresh copy of the seed, and shows `.verdict` with `data-verdict` and a message. The user's result shows in a table headed `Your result`, next to the worked answer's in a table headed `Worked answer` (shown for every verdict except `match` and `error`).

1. What is compared:
   - When the worked answer changes data (it holds `INSERT`, `UPDATE`, `DELETE` or `REPLACE`): every seed table after both scripts, as sets of rows.
   - Otherwise: the last result set of each script.
2. Values compare by position, not by column name. Numbers compare as numbers (`300` equals `300.0`); text and numbers differ (`'300'` is not `300`); `NULL` equals only `NULL`.
3. Rows compare as a multiset (duplicates count), except for a worked answer fenced `sql answer ordered`: then order matters too. q1033 and q1034 are ordered; q1030, q1031 and q1032 are not.
4. Verdicts, checked in this order:

| `data-verdict` | When | Message |
|---|---|---|
| `error` | the user's SQL fails | `Your SQL stopped with an error, so there is nothing to compare.` |
| `noresult` | result mode, and the user's SQL returns no result set | `Your SQL returned no result. End it with a SELECT.` |
| `columns` | column counts differ | `Your result has X columns; the worked answer has Y.` |
| `empty` | the user's result has no rows, the worked answer has some | `Your query returned no rows; the worked answer has N.` |
| `order` | same rows, wrong order, ordered task | `The rows are right but in the wrong order. This task asks for a set order.` |
| `rows` | rows differ | `Not yet: N rows missing and M extra compared with the worked answer.` (table mode: `Not yet: after your statements, table T has N rows missing and M extra.`) |
| `match` | otherwise | `Correct: your result matches the worked answer.` (table mode: `Correct: the tables match the worked answer.`) |

   "1 row" and "rows" follow the number in every message.
5. The judge also stops at the 5 s limit; then `data-verdict="error"`.

Documented results the tests check: q1030 returns Dan and Eve (ids 4, 5); q1033 returns October 590 (3 orders) and November 320 (2 orders); q1032 leaves customers 1, 2, 3 and 5; q1034's last rows for customer 3 have running totals 300, 600, 620.

## Predict the output (idea 38)

1. A predict question shows, with the question (in Learn above the answer, in the quiz before Show answer), a `.predict` box with: the code (the first ```` ```ts ```` block of its Full process), a text box with the accessible name `Your prediction`, and a button `Run and compare`.
2. `Run and compare` runs the code like a TS/JS run (same worker, limits and output) and shows `.predict-verdict` with `data-verdict="match"` and `You got it: the output matches.`, or `data-verdict="differ"` and `Not quite: compare your lines with the output.`
3. Match rule: split both texts into lines, trim each line, drop empty lines; equal lists match.
4. In Learn, the answer of a predict question is folded under `Show the answer` (a `<details>`). `Run and compare` opens it. In the quiz, Show answer works as before.
5. The output of each predict question in the page equals what Node 26 prints for the same code saved as an `.mts` file.

## Run buttons on answer blocks (idea 39)

1. The build marks a code block runnable by adding `run` to its fence: ```` ```ts run ```` or ```` ```sql run ````.
   - TS: it holds `console.log` or `assert`; it imports nothing, or only `node:assert`, `node:assert/strict` or `node:test`; it holds none of `page.`, `test(`, `expect(`, `fetch(`, `process.`, `require(`, `declare `.
   - SQL: it holds its own `CREATE TABLE`, or its question has a seed.
   - Blocks listed in the build's exclusion list, each with a reason, are not marked.
2. A runnable block shows a `Run` button (class `run-block`) under it; output goes to a `.out` under the button, same rules as above. SQL blocks run on the question's seed when it has one, else on an empty database.
3. Every runnable TS block, run in the page, finishes with no `.out-error` and prints exactly what Node 26 prints for it as an `.mts` file. Every runnable SQL block finishes with no `.out-error`.
4. `Compare with the answer` still finds the last code block of the Full process when fences carry extra words.

## Failure modes

Each line is covered by at least one test.

1. Endless loop `while (true) {}`: time-limit status after about 5 s (between 4.5 and 8 s); the page timer never stalls more than 250 ms; the next Run prints normally.
2. Runaway recursion, plain (`function f() { return 1 + f(); } f();`; not `return f()`, which WebKit runs as a proper tail call in strict mode, so it never overflows and the time limit stops it) and catching (`function f() { try { f(); } catch { f(); } } f();`): see TS rule 10; the next run works.
3. Syntax error `const x = ;` on line 3: `SyntaxError` with `(line 3)`. An engine-only syntax error still shows `SyntaxError`.
4. Wrong row order on q1033 (the right rows ordered by month descending): `order`. The right rows in another order on q1030: `match`.
5. Empty result on q1030 (`... WHERE 1 = 0`): `empty`, message names 2 rows.
6. Worker blocked (`window.Worker` replaced by a constructor that throws): blocked message, no page error, the page keeps working (Next works, marks save).
7. Endless recursive CTE: time-limit status; the next SQL run works.
8. Output flood `for (;;) console.log(1)`: `Output stopped at 1,000 lines.` and exactly 1,000 `.out-line`.
9. Late timer output: predict q0289 prints `var 3` three times, then `let 0`, `let 1`, `let 2`.
10. Top-level await: q0295 prints `[ 'a', 'x', 'c' ]`, `all failed with x`, `fast`.
11. Unhandled rejection (`Promise.reject(new Error('boom'))`): `.out-error` containing `Error: boom`.
12. Unknown import (`import fs from 'node:fs'`): the unknown-import message.
13. Double Run on a slow script: only the second run's output shows.
14. Leaving mid-run: start `setTimeout(() => console.log('late'), 1500)`, press Next at once; `late` never appears on any question.
15. Unpack failure: `DecompressionStream` removed by an init script: the questions message on home, no page error. Editor or runner part failing alone: see "Packed parts" 5.
16. Saved code survives the editor upgrade: saved code shows in the CodeMirror editor after reload; editing in CodeMirror saves.
17. Wrong column count on q1030 (`SELECT c.id FROM ...`): `columns`.
18. `NULL` versus `0`: a query returning `0` where the worked answer has `NULL` (q1034, first `change_from_previous`) is `rows`, not `match`.
19. Table judging on q1032: the worked DELETE gives `match`; deleting customer 1 instead gives `rows` naming table `customers`; a user's script that ends with a different `SELECT` but leaves the right tables still gives `match`.
20. Each of the 16 runnable tasks: its starter runs and ends with an error or a failed check (TS/JS: `.out-error`; SQL starter: no error, and Check gives `noresult`, except q1032, which is judged by its tables and gives `rows`: customer 4 is still there); its worked solution (the last ```` ```ts ```` block of the Full process for TS/JS, the worked answer for SQL) prints its `ok` line with no `.out-error` (TS/JS) or gives `match` (SQL). In Chromium, Firefox and WebKit.
21. The 5 Playwright tasks with a starter editor have no Run button.

## Page parts the tests use

| Part | Selector or name |
|---|---|
| Ready flag | `html[data-ready="1"]` |
| Editor | role `textbox`, name `Code editor`, inside `.editor` |
| Run, Check | `.run-btn` (`Run` / `Stop`), `.check-btn` (`Check my answer`) |
| Output | `.out`, `.out-line`, `.out-error`, `.out-status`, `.out table` |
| Verdict | `.verdict[data-verdict]` |
| Predict | `.predict`, textbox `Your prediction`, button `Run and compare`, `.predict-verdict[data-verdict]` |
| Answer-block Run | `.run-block` and the `.out` after it |
| Test hooks (globals) | `Q`; `pick(i)` and `go(view, arg)` as before |
