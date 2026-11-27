// Phase 3: SQL runner and SQL judging (docs/phase3-spec.md). Written from the spec only; "FMn" is failure mode n.
import { test, expect, bankData } from './fixtures';
import { SQL_TASKS, LIMIT, workedSql, starterOf, editor, out, runBtn, status, errors, task, run, runCode, check, judge, tableRows, gapMonitor, openById } from './code-helpers';

test.use({ actionTimeout: 8_000 });

const FINISHED = /^Finished in \d+ ms\.$/;
const endless = 'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT COUNT(*) FROM c;';
const yourResult = (page: import('@playwright/test').Page) => page.getByText('Your result', { exact: true });
const workedResult = (page: import('@playwright/test').Page) => page.getByText('Worked answer', { exact: true });
const lastNonSeed = (page: import('@playwright/test').Page) => out(page).locator('table');
const rowsLabel = (n: number) => `Showing the first 500 of ${n} rows.`;

// ---------------------------------------------------------------- SQL runner (idea 36)
test('SQL 1, 2, 4: the run starts from the seed: customers (5 rows) and orders (8 rows), one table per SELECT with its row count', async ({ open }) => {
  const page = await open();
  const r = await runCode(page, 'q1030', 'SELECT * FROM customers ORDER BY id;\nSELECT * FROM orders ORDER BY id;');
  expect(r.errors).toEqual([]);
  expect(r.status).toMatch(FINISHED);
  const tables = out(page).locator('table');
  await expect(tables).toHaveCount(2);
  await expect(tables.nth(0).locator('th')).toHaveText(['id', 'name', 'email', 'country']);
  await expect(tables.nth(1).locator('th')).toHaveText(['id', 'customer_id', 'status', 'total', 'created_at']);
  const customers = await tableRows(tables.nth(0));
  expect(customers).toHaveLength(5);
  expect(customers[3]).toEqual(['4', 'Dan', 'ann@example.com', 'PL']);
  const orders = await tableRows(tables.nth(1));
  expect(orders).toHaveLength(8);
  expect(orders[5]).toEqual(['6', '3', 'shipped', '300', '2026-10-15']);
  const text = await out(page).innerText();
  expect(text).toContain('5 rows');
  expect(text).toContain('8 rows');
});

test('SQL 1: SQLite 3.54.1', async ({ open }) => {
  const page = await open();
  await runCode(page, 'q1030', 'SELECT sqlite_version() AS v;');
  await expect(out(page).locator('table td')).toHaveText(['3.54.1']);
});

test('SQL 4: "1 row" and "No rows", statements that return nothing show no table', async ({ open }) => {
  const page = await open();
  await runCode(page, 'q1030', "SELECT 1 AS x;\nSELECT * FROM orders WHERE 1 = 0;\nINSERT INTO customers VALUES (9, 'Zed', 'z@example.com', 'PL');\nSELECT COUNT(*) AS n FROM customers;");
  const text = await out(page).innerText();
  expect(text).toMatch(/(^|\n)1 row(\n|$)/);
  expect(text).toContain('No rows');
  expect(text).toMatch(/(^|\n)1 row(\n|$)/);
  const last = out(page).locator('table').last();
  await expect(last.locator('td')).toHaveText(['6']);
  expect(await errors(out(page))).toEqual([]);
});

test('SQL 1: every run starts from a fresh seed, what one run did is gone in the next', async ({ open }) => {
  const page = await open();
  await task(page, 'q1031', 'SELECT COUNT(*) AS n FROM orders;');
  await task(page, 'q1030', 'DELETE FROM orders;\nSELECT COUNT(*) AS n FROM orders;');
  await run(page);
  await expect(out(page).locator('table td')).toHaveText(['0']);
  await openById(page, 'q1031');
  await run(page);
  await expect(out(page).locator('table td')).toHaveText(['8']);
});

test('SQL 3: CREATE TABLE for a table the seed made does not fail and does not empty it', async ({ open }) => {
  const page = await open();
  const create = 'CREATE TABLE customers (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT NOT NULL,\n  country TEXT NOT NULL\n);\n';
  const r = await runCode(page, 'q1030', create + 'SELECT COUNT(*) AS n FROM customers;');
  expect(r.errors).toEqual([]);
  await expect(out(page).locator('table td')).toHaveText(['5']);
});

test('SQL 4: more than 500 rows show the first 500 and say so; 500 rows show no such note', async ({ open }) => {
  const page = await open();
  const series = (n: number) => `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${n}) SELECT i FROM n;`;
  await runCode(page, 'q1030', series(600));
  const cells = out(page).locator('table td');
  await expect(cells).toHaveCount(500);
  expect(await cells.first().textContent()).toBe('1');
  expect(await cells.last().textContent()).toBe('500');
  await expect(out(page)).toContainText(rowsLabel(600));
  await expect(out(page).locator('table th')).toHaveText(['i']);
  await runCode(page, 'q1030', series(500));
  await expect(out(page).locator('table td')).toHaveCount(500);
  expect(await out(page).innerText()).not.toContain('Showing the first');
  await expect(out(page)).toContainText('500 rows');
  await runCode(page, 'q1030', series(501));
  await expect(out(page).locator('table td')).toHaveCount(500);
  await expect(out(page)).toContainText(rowsLabel(501));
});

test('SQL 5: a SQL error shows SQLite\'s message in .out-error', async ({ open }) => {
  const page = await open();
  const syntax = await runCode(page, 'q1030', 'SELEC 1;');
  expect(syntax.errors.join('\n')).toMatch(/syntax error/i);
  const table = await runCode(page, 'q1030', 'SELECT * FROM nope;');
  expect(table.errors.join('\n')).toContain('no such table: nope');
  const check = await runCode(page, 'q1030', "INSERT INTO orders (id, customer_id, status, total, created_at) VALUES (99, 1, 'bogus', 1, '2026-01-01');");
  expect(check.errors.join('\n')).toMatch(/CHECK constraint failed/i);
  await expect(out(page).locator('table')).toHaveCount(0);
});

test('FM7 endless recursive CTE: time-limit status in 4.5 to 8 s, the page never stalls, the next SQL run works', async ({ open }) => {
  test.setTimeout(45_000);
  const page = await open();
  await task(page, 'q1031', 'SELECT COUNT(*) AS n FROM customers;');
  await task(page, 'q1030', endless);
  await openById(page, 'q1031');
  await run(page);   // unpacks SQLite, so the timing below is only the query
  await expect(out(page).locator('table td')).toHaveText(['5']);
  await openById(page, 'q1030');
  const gap = await gapMonitor(page);
  const t0 = Date.now();
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await expect(status(out(page))).toHaveText(LIMIT, { timeout: 15_000 });
  const took = Date.now() - t0;
  expect(took).toBeGreaterThanOrEqual(4500);
  expect(took).toBeLessThanOrEqual(8000);
  expect(await gap(), 'longest gap of a page timer (ms)').toBeLessThanOrEqual(250);
  await expect(runBtn(page)).toHaveText('Run');
  await openById(page, 'q1031');
  const next = await run(page);
  expect(next.status).toMatch(FINISHED);
  await expect(out(page).locator('table td')).toHaveText(['5']);
});

test('SQL: Stop ends a query that never ends with "Stopped."', async ({ open }) => {
  const page = await open();
  await task(page, 'q1030', endless);
  await runBtn(page).click();
  await expect(runBtn(page)).toHaveText('Stop');
  await expect(out(page)).toContainText('Running…');
  await runBtn(page).click();
  await expect(status(out(page))).toHaveText('Stopped.');
  await expect(runBtn(page)).toHaveText('Run');
});

// ---------------------------------------------------------------- SQL judging (idea 37)
test('FM4 q1033 right rows in the wrong order: order; q1030 right rows in another order: match', async ({ open }) => {
  const page = await open();
  const wrongOrder = "SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS paid_orders, SUM(total) AS revenue\nFROM orders WHERE status IN ('paid', 'shipped') AND created_at >= '2026-09-01'\nGROUP BY strftime('%Y-%m', created_at) HAVING SUM(total) >= 300 ORDER BY month DESC;";
  const a = await judge(page, 'q1033', wrongOrder);
  expect(a.verdict).toBe('order');
  expect(a.message).toContain('The rows are right but in the wrong order. This task asks for a set order.');
  await expect(yourResult(page)).toBeVisible();
  await expect(workedResult(page)).toBeVisible();
  const b = await judge(page, 'q1030', 'SELECT c.id, c.name FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE o.id IS NULL ORDER BY c.id DESC;');
  expect(b.verdict).toBe('match');
  expect(b.message).toContain('Correct: your result matches the worked answer.');
  await expect(yourResult(page)).toBeHidden();
});

test('judging 2: values compare by position, 300 equals 300.0, text and numbers differ, NULL equals only NULL', async ({ open }) => {
  const page = await open();
  // the worked answer of q1030 is (4, 'Dan'), (5, 'Eve')
  expect((await judge(page, 'q1030', "SELECT 4.0 AS a, 'Dan' AS b UNION ALL SELECT 5, 'Eve';")).verdict, 'real number equals integer').toBe('match');
  expect((await judge(page, 'q1030', "SELECT 5 AS other_name, 'Eve' AS another UNION ALL SELECT 4, 'Dan';")).verdict, 'column names do not matter').toBe('match');
  const text = await judge(page, 'q1030', "SELECT '4' AS a, 'Dan' AS b UNION ALL SELECT 5, 'Eve';");
  expect(text.verdict, "'4' is not 4").toBe('rows');
  expect(text.message).toContain('Not yet: 1 row missing and 1 extra compared with the worked answer.');
  const nul = await judge(page, 'q1030', "SELECT NULL AS a, 'Dan' AS b UNION ALL SELECT 5, 'Eve';");
  expect(nul.verdict, 'NULL is not 4').toBe('rows');
  expect(nul.message).toContain('Not yet: 1 row missing and 1 extra compared with the worked answer.');
});

test('judging 2: a revenue of 590.0 equals 590, a revenue of text \'590\' does not', async ({ open }) => {
  const page = await open();
  const q = (extra: string) => `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS paid_orders, ${extra} AS revenue\nFROM orders WHERE status IN ('paid', 'shipped') AND created_at >= '2026-09-01'\nGROUP BY strftime('%Y-%m', created_at) HAVING SUM(total) >= 300 ORDER BY month;`;
  expect((await judge(page, 'q1033', q('CAST(SUM(total) AS REAL)'))).verdict).toBe('match');
  const text = await judge(page, 'q1033', q('CAST(SUM(total) AS TEXT)'));
  expect(text.verdict).toBe('rows');
  expect(text.message).toContain('Not yet: 2 rows missing and 2 extra compared with the worked answer.');
});

test('judging 3: rows compare as a multiset, duplicates count', async ({ open }) => {
  const page = await open();
  const extra = await judge(page, 'q1030', "SELECT 4, 'Dan' UNION ALL SELECT 4, 'Dan' UNION ALL SELECT 5, 'Eve';");
  expect(extra.verdict, 'a duplicated row is an extra row').toBe('rows');
  expect(extra.message).toContain('Not yet: 0 rows missing and 1 extra compared with the worked answer.');
  const missing = await judge(page, 'q1030', "SELECT 4, 'Dan';");
  expect(missing.verdict).toBe('rows');
  expect(missing.message).toContain('Not yet: 1 row missing and 0 extra compared with the worked answer.');
  await expect(yourResult(page)).toBeVisible();
  await expect(workedResult(page)).toBeVisible();
});

test('FM5 empty result on q1030: empty, and the message names the 2 rows of the worked answer', async ({ open }) => {
  const page = await open();
  const r = await judge(page, 'q1030', 'SELECT c.id, c.name FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE 1 = 0;');
  expect(r.verdict).toBe('empty');
  expect(r.message).toContain('Your query returned no rows; the worked answer has 2.');
  await expect(yourResult(page)).toBeVisible();
  await expect(workedResult(page)).toBeVisible();
});

test('FM17 wrong column count on q1030: columns, and it is checked before an empty result', async ({ open }) => {
  const page = await open();
  const r = await judge(page, 'q1030', 'SELECT c.id FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE o.id IS NULL;');
  expect(r.verdict).toBe('columns');
  expect(r.message).toMatch(/Your result has 1 columns?; the worked answer has 2\./);
  const e = await judge(page, 'q1030', 'SELECT c.id FROM customers AS c WHERE 1 = 0;');
  expect(e.verdict, 'column count comes before empty').toBe('columns');
});

test('judging 4: error, noresult, and only the last result set counts', async ({ open }) => {
  const page = await open();
  const worked = workedSql((await bankData(page)).find(q => q.id === 'q1030')!).code;
  const err = await judge(page, 'q1030', 'SELEC 1;');
  expect(err.verdict).toBe('error');
  expect(err.message).toContain('Your SQL stopped with an error, so there is nothing to compare.');
  await expect(yourResult(page)).toBeHidden();
  await expect(workedResult(page)).toBeHidden();
  const none = await judge(page, 'q1030', 'DELETE FROM orders WHERE 1 = 0;');
  expect(none.verdict).toBe('noresult');
  expect(none.message).toContain('Your SQL returned no result. End it with a SELECT.');
  expect((await judge(page, 'q1030', '-- only a comment')).verdict).toBe('noresult');
  expect((await judge(page, 'q1030', 'SELECT 1 AS junk;\n' + worked)).verdict, 'an earlier SELECT does not matter').toBe('match');
  expect((await judge(page, 'q1030', worked + '\nSELECT 99 AS x;')).verdict, 'a later SELECT is the one that counts').toBe('columns');
});

test('judging 1: user script and worked answer each start from a fresh seed', async ({ open }) => {
  const page = await open();
  // If the worked answer ran after the user's DELETE it would also see no orders, return all 5 customers and match.
  const r = await judge(page, 'q1030', 'DELETE FROM orders;\nSELECT c.id, c.name FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE o.id IS NULL;');
  expect(r.verdict).toBe('rows');
  expect(r.message).toContain('Not yet: 0 rows missing and 3 extra compared with the worked answer.');
});

test('FM18 NULL versus 0: q1034 with COALESCE(change, 0) is rows, not match', async ({ open }) => {
  const page = await open();
  const sql = "SELECT customer_id, id AS order_id, created_at, total,\n       SUM(total) OVER (PARTITION BY customer_id ORDER BY created_at, id) AS running_total,\n       COALESCE(total - LAG(total) OVER (PARTITION BY customer_id ORDER BY created_at, id), 0) AS change_from_previous\nFROM orders WHERE status <> 'cancelled' ORDER BY customer_id, created_at, id;";
  const r = await judge(page, 'q1034', sql);
  expect(r.verdict).toBe('rows');
  expect(r.message).toContain('Not yet: 3 rows missing and 3 extra compared with the worked answer.');
});

test('FM19 q1032 judges the tables: the worked DELETE matches, another delete does not, the closing SELECT does not matter', async ({ open }) => {
  const page = await open();
  const q = (await bankData(page)).find(x => x.id === 'q1032')!;
  const worked = workedSql(q).code;
  const ok = await judge(page, 'q1032', worked);
  expect(ok.verdict).toBe('match');
  expect(ok.message).toContain('Correct: the tables match the worked answer.');
  const wrong = await judge(page, 'q1032', 'DELETE FROM customers WHERE id = 1;\nSELECT id, name FROM customers ORDER BY id;');
  expect(wrong.verdict).toBe('rows');
  expect(wrong.message).toContain('Not yet: after your statements, table customers has 1 row missing and 1 extra.');
  const other = await judge(page, 'q1032', 'DELETE FROM customers WHERE id = 4;\nDELETE FROM orders WHERE id = 1;\nSELECT 1;');
  expect(other.verdict).toBe('rows');
  expect(other.message).toContain('Not yet: after your statements, table orders has 1 row missing and 0 extra.');
  const differentSelect = await judge(page, 'q1032', 'DELETE FROM customers WHERE id = 4;\nSELECT 42 AS answer;');
  expect(differentSelect.verdict, 'a different closing SELECT with the right tables').toBe('match');
  const noSelect = await judge(page, 'q1032', 'DELETE FROM customers WHERE id = 4;');
  expect(noSelect.verdict, 'table mode needs no result set').toBe('match');
  const emptied = await judge(page, 'q1032', 'DELETE FROM customers;');
  expect(emptied.verdict, 'table mode has no "empty" verdict').toBe('rows');
  expect(emptied.message).toContain('Not yet: after your statements, table customers has 4 rows missing and 0 extra.');
  const err = await judge(page, 'q1032', 'DELETE FROM nope;');
  expect(err.verdict).toBe('error');
});

test('judging 5: Check stops at the 5 s limit with the error verdict', async ({ open }) => {
  test.setTimeout(45_000);
  const page = await open();
  await task(page, 'q1030', endless);
  const t0 = Date.now();
  const r = await check(page, 25_000);
  expect(r.verdict).toBe('error');
  expect(Date.now() - t0).toBeLessThan(20_000);
  await runCode(page, 'q1030', 'SELECT COUNT(*) AS n FROM customers;');
  await expect(out(page).locator('table td')).toHaveText(['5']);
});

// ---------------------------------------------------------------- FM20: the 5 SQL tasks, all browsers
const documented: Record<string, (page: import('@playwright/test').Page) => Promise<void>> = {
  q1030: async page => { expect(await tableRows(lastNonSeed(page).last())).toEqual([['4', 'Dan'], ['5', 'Eve']]); },
  q1032: async page => { expect((await tableRows(lastNonSeed(page).last())).map(r => r[0])).toEqual(['1', '2', '3', '5']); },
  q1033: async page => {
    const rows = await tableRows(lastNonSeed(page).last());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.arrayContaining(['2026-10', '3', '590']));
    expect(rows[1]).toEqual(expect.arrayContaining(['2026-11', '2', '320']));
  },
  q1034: async page => {
    const t = lastNonSeed(page).last();
    const idx = (await t.locator('th').allTextContents()).findIndex(h => /running/i.test(h));
    expect(idx, 'a running total column').toBeGreaterThanOrEqual(0);
    const rows = (await tableRows(t)).filter(r => r[0] === '3');
    expect(rows.map(r => r[idx])).toEqual(['300', '600', '620']);
  },
};
for (const id of SQL_TASKS) {
  test(`FM20 ${id}: the starter runs without an error and is judged, the worked answer matches and gives its documented result`, async ({ open }) => {
    const page = await open();
    const q = (await bankData(page)).find(x => x.id === id)!;
    await openById(page, id);
    await expect(editor(page)).toBeVisible();
    const starter = await run(page);
    expect(starter.errors, 'the starter must run without an error').toEqual([]);
    expect(starter.status).toMatch(FINISHED);
    const s = await check(page);
    if (id === 'q1032') {
      // the worked answer changes data, so the tables are judged (spec: SQL judging 1); the starter leaves customer 4 in place
      expect(s.verdict).toBe('rows');
      expect(s.message).toContain('table customers has 0 rows missing and 1 extra');
    } else expect(s.verdict).toBe('noresult');
    const worked = workedSql(q).code;
    const j = await judge(page, id, worked);
    expect(j.verdict, 'the worked answer matches itself').toBe('match');
    await task(page, id, worked);
    const r = await run(page);
    expect(r.errors).toEqual([]);
    await documented[id]?.(page);
    expect(starterOf(q).length).toBeGreaterThan(0);
  });
}


// Run and Check share one task: starting one stops the other, and neither writes into the other's panel.
test('judging 6: Check pressed while a slow Run is going stops the Run and shows only the verdict', async ({ bank }) => {
  const slow = "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 3000000) SELECT count(*) FROM n;\n" + workedSql((await bankData(bank)).find(q => q.id === 'q1030')!).code;
  await task(bank, 'q1030', slow);
  await runBtn(bank).click();
  await expect(runBtn(bank)).toHaveText('Stop');
  await bank.locator('.check-btn').click();
  await expect(bank.locator('.verdict')).toHaveAttribute('data-verdict', 'match', { timeout: 15_000 });
  await expect(runBtn(bank)).toHaveText('Run');
  await bank.waitForTimeout(500);
  await expect(bank.getByText('Running…')).toHaveCount(0);
});
