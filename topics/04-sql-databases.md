# SQL, databases and data testing

How to study this file: run the seed block below once in a scratch PostgreSQL 16 database (for example `docker run --rm -e POSTGRES_PASSWORD=x postgres:16`, then `psql`). Every query in the file uses this one schema, and every expected output was produced by running it on PostgreSQL 16. Say each **Say** block out loud first, then type the **Full process** SQL from memory and compare the rows. Where PostgreSQL and MySQL differ, the entry says so. The sections run from most asked to least asked: the real screening questions first, then SQL fundamentals, transactions, indexes and design, SQL for testing, 25 hands-on tasks, then NoSQL and data pipelines (concept only).

## Schema and seed data (run once, rerunnable)

```sql
DROP TABLE IF EXISTS order_items, orders, customers CASCADE;

CREATE TABLE customers (
  id          integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  country     char(2) NOT NULL,
  created_at  date NOT NULL,
  referred_by integer REFERENCES customers (id)
);

CREATE TABLE orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  status      text NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  ordered_at  timestamp NOT NULL,
  coupon      text
);

CREATE TABLE order_items (
  id         integer PRIMARY KEY,
  order_id   integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  sku        text NOT NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);

INSERT INTO customers (name, email, country, created_at, referred_by) VALUES
  ('Anna Nowak',      'anna@example.com',   'PL', '2026-01-10', NULL),
  ('Ben Carter',      'ben@example.com',    'GB', '2026-01-15', 1),
  ('Clara Diaz',      'clara@example.com',  'ES', '2026-02-01', 1),
  ('Dawid Zielinski', 'dawid@example.com',  'PL', '2026-02-20', 2),
  ('Eva Kral',        'eva@example.com',    'CZ', '2026-03-05', NULL),
  ('Anna Nowak',      'anna.n@example.org', 'PL', '2026-03-10', NULL);

INSERT INTO orders (id, customer_id, status, ordered_at, coupon) VALUES
  (101, 1, 'paid',      '2026-02-01 10:00', 'WELCOME10'),
  (102, 1, 'shipped',   '2026-02-15 12:30', NULL),
  (103, 2, 'paid',      '2026-02-10 09:15', NULL),
  (104, 2, 'cancelled', '2026-03-01 18:45', 'WELCOME10'),
  (105, 3, 'paid',      '2026-03-02 08:00', NULL),
  (106, 3, 'paid',      '2026-03-20 14:10', NULL),
  (107, 3, 'new',       '2026-04-01 11:20', NULL),
  (108, 4, 'shipped',   '2026-03-15 16:05', 'SPRING5'),
  (109, 1, 'paid',      '2026-04-05 13:00', NULL),
  (110, 4, 'paid',      '2026-04-10 10:30', NULL);

INSERT INTO order_items (id, order_id, sku, quantity, unit_price) VALUES
  (1,  101, 'KEYBOARD', 1,  50.00),
  (2,  101, 'MOUSE',    2,  20.00),
  (3,  102, 'MONITOR',  1, 200.00),
  (4,  103, 'KEYBOARD', 1,  50.00),
  (5,  104, 'MOUSE',    1,  20.00),
  (6,  105, 'MONITOR',  2, 200.00),
  (7,  106, 'CABLE',    5,   5.00),
  (8,  107, 'KEYBOARD', 1,  50.00),
  (9,  108, 'MOUSE',    3,  20.00),
  (10, 108, 'CABLE',    2,   5.00),
  (11, 109, 'MONITOR',  1, 200.00),
  (12, 109, 'MOUSE',    1,  20.00);
```

What the data looks like: six customers (two named Anna Nowak with different emails, Eva Kral and the second Anna have no orders), ten orders (order 110 has no items), twelve order items. Order totals are 101: 90.00, 102: 200.00, 103: 50.00, 104: 20.00, 105: 400.00, 106: 25.00, 107: 50.00, 108: 70.00, 109: 220.00. MySQL differences in the schema: use `AUTO_INCREMENT` instead of `GENERATED ALWAYS AS IDENTITY`, and `DATETIME` instead of `timestamp`.

## Questions asked in real screenings

### What is the difference between a view and a materialized view?

Topic: sql-core | Core | id: q0413

**Say:** A view is a saved query. It stores no data, it runs the query every time you read it, so it is always current. A materialized view stores the result of the query on disk, so reading it is fast, but the data is old until someone refreshes it. In PostgreSQL you refresh it with `REFRESH MATERIALIZED VIEW`. I pick a view for simple reuse and security, and a materialized view for an expensive report where slightly old data is fine. MySQL has no materialized views, you build a summary table and refresh it yourself.

**Full process:**

1. Create a view on top of the order tables. It stores nothing.

```sql
CREATE VIEW order_totals AS
SELECT o.id AS order_id, o.customer_id, o.status,
       SUM(i.quantity * i.unit_price) AS total
FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id;
```

2. Create a materialized view on top of the view. This runs the query now and stores the rows.

```sql
CREATE MATERIALIZED VIEW revenue_by_country AS
SELECT c.country, SUM(t.total) AS revenue
FROM order_totals t JOIN customers c ON c.id = t.customer_id
WHERE t.status IN ('paid', 'shipped')
GROUP BY c.country;

CREATE UNIQUE INDEX ON revenue_by_country (country);
SELECT * FROM revenue_by_country ORDER BY country;
```

Output: `ES 425.00`, `GB 50.00`, `PL 580.00`.

3. Insert a new paid order for Clara (Spain, order 120, 200.00) and read both. The view sees it at once, the materialized view does not.

```sql
BEGIN;
INSERT INTO orders VALUES (120, 3, 'paid', now(), NULL);
INSERT INTO order_items VALUES (20, 120, 'MONITOR', 1, 200);

SELECT country, revenue FROM revenue_by_country WHERE country = 'ES';
-- ES | 425.00   (old)

SELECT c.country, SUM(total) FROM order_totals t
JOIN customers c ON c.id = t.customer_id
WHERE c.country = 'ES' AND t.status IN ('paid', 'shipped') GROUP BY 1;
-- ES | 625.00   (current)
```

4. Refresh. `CONCURRENTLY` keeps the view readable during the refresh and needs a unique index on the materialized view (the index from step 2). Without it, the refresh locks out readers.

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_by_country;
SELECT country, revenue FROM revenue_by_country WHERE country = 'ES';
-- ES | 625.00
ROLLBACK;
```

(Note: `REFRESH ... CONCURRENTLY` also runs inside the transaction above, which PostgreSQL allows. The `ROLLBACK` undoes the new order but also the refresh, so the materialized view is back to 425.00.)

Behaviour over time: PostgreSQL never refreshes a materialized view on its own. Schedule the refresh (cron, `pg_cron`, an application job) or the data stays frozen at the last refresh.

**Follow-ups:**
- *Can you insert into a view?* A simple view over one table is automatically updatable in PostgreSQL, so `INSERT`, `UPDATE` and `DELETE` work. A view with `GROUP BY`, `DISTINCT` or aggregates is not, unless you add an `INSTEAD OF` trigger.
- *Does a view make a query faster?* No. PostgreSQL expands the view into the outer query, so it costs the same as writing the query inline. Only a materialized view saves work, because it stores the result.
- *How does this matter in a test?* If the UI reads from a materialized view, a test that writes data and asserts at once can read old rows. Refresh first, or poll the read until the new row appears, never use a fixed sleep.

**Trap:** Saying "a materialized view is a faster view" without saying it can be stale. The cost of speed is freshness. The second trap: believing a normal view caches data.

**Source:** https://www.postgresql.org/docs/16/rules-materializedviews.html and https://www.postgresql.org/docs/16/sql-refreshmaterializedview.html

### What is the difference between DELETE and TRUNCATE, and what happens with related tables?

Topic: sql-core | Core | id: q0414

**Say:** `DELETE` removes the rows you choose with `WHERE`, it works row by row, it fires row triggers, and the rows can be rolled back. `TRUNCATE` empties the whole table at once, there is no `WHERE`, it is much faster, and it can reset the auto-increment counter. With related tables, `DELETE` follows the foreign key rule on each row: `RESTRICT` gives an error, `CASCADE` deletes the child rows too, `SET NULL` clears the child's reference. `TRUNCATE` does not check row by row. If another table has a foreign key to this one, PostgreSQL refuses unless you truncate both tables in the same command or add `CASCADE`. In PostgreSQL `TRUNCATE` can be rolled back, in MySQL it cannot, because it is DDL with an implicit commit.

**Full process:** Run each block in a transaction and roll back, so the seed data stays.

1. `DELETE` and a foreign key with `RESTRICT`. Customer 4 has orders, and `orders.customer_id` is `ON DELETE RESTRICT`.

```sql
BEGIN;
DELETE FROM customers WHERE id = 4;
ROLLBACK;
```

Output: `ERROR: update or delete on table "customers" violates foreign key constraint "orders_customer_id_fkey" on table "orders"`.

2. `DELETE` with `CASCADE`. `order_items.order_id` is `ON DELETE CASCADE`, so deleting order 101 deletes its two items.

```sql
BEGIN;
DELETE FROM orders WHERE id = 101;
SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items;
ROLLBACK;
```

Output inside the transaction: `orders 9, items 10`. After `ROLLBACK`: `orders 10, items 12`.

3. `TRUNCATE` of a parent table that another table references.

```sql
BEGIN;
TRUNCATE orders;
ROLLBACK;
```

Output: `ERROR: cannot truncate a table referenced in a foreign key constraint`, with the hint `Truncate table "order_items" at the same time, or use TRUNCATE ... CASCADE.`

4. Two ways that work.

```sql
BEGIN;
TRUNCATE orders, order_items;              -- both tables in one command
SELECT COUNT(*) FROM order_items;          -- 0
ROLLBACK;

BEGIN;
TRUNCATE orders CASCADE;                   -- also empties order_items, not customers
-- NOTICE: truncate cascades to table "order_items"
SELECT COUNT(*) FROM customers;            -- 6
ROLLBACK;
```

5. The identity counter. `TRUNCATE ... RESTART IDENTITY` resets the counter. A plain `TRUNCATE` in PostgreSQL does not.

```sql
BEGIN;
TRUNCATE customers RESTART IDENTITY CASCADE;
INSERT INTO customers (name, email, country, created_at)
VALUES ('Z', 'z@z', 'PL', '2026-01-01') RETURNING id;   -- 1
ROLLBACK;
```

6. Triggers. A row-level `DELETE` trigger fires for each deleted row, but not for `TRUNCATE` (only a `TRUNCATE` trigger does). This matters if an audit table depends on those triggers.

MySQL differences: `TRUNCATE` always commits implicitly and cannot be rolled back, it always resets `AUTO_INCREMENT`, and it refuses a table that a foreign key references, even if the child table is empty (unless `FOREIGN_KEY_CHECKS` is 0). There is no `TRUNCATE ... CASCADE` in MySQL.

**Follow-ups:**
- *What does DROP do compared with these two?* `DROP TABLE` removes the table itself, its structure, indexes and privileges. `DELETE` and `TRUNCATE` keep the table and remove only rows.
- *Why is TRUNCATE faster?* It does not scan or log each row. It discards the table's storage and takes an `ACCESS EXCLUSIVE` lock, so no other session can read the table while it runs.
- *When is DELETE the better choice?* When you need `WHERE`, when row-level triggers must fire, or when you cannot take an exclusive lock on a busy table.

**Trap:** Saying "TRUNCATE cannot be rolled back". That is true for MySQL and Oracle, where it commits implicitly, but false for PostgreSQL and SQL Server, where `TRUNCATE` can be rolled back inside a transaction. A second trap: saying `TRUNCATE` ignores foreign keys. It checks them, and refuses.

**Source:** https://www.postgresql.org/docs/16/sql-truncate.html and https://dev.mysql.com/doc/refman/8.4/en/truncate-table.html

### What is the difference between UNION and UNION ALL?

Topic: sql-core | Core | id: q0415

**Say:** Both stack the results of two queries into one result. `UNION` removes duplicate rows from the combined result, `UNION ALL` keeps every row. Because `UNION` has to compare rows to remove duplicates (it sorts or hashes), it is slower. I default to `UNION ALL` when I know the two sets cannot overlap, or when I want to count duplicates. Both queries need the same number of columns with compatible types, and the column names come from the first query.

**Full process:** Customers who ordered in February (query A) and customers who ordered in March (query B).

```sql
-- A: customer_id 1, 2 ordered in Feb (orders 101, 102, 103). B: 3, 4, 2 ordered in March (105, 106, 108, 104).
SELECT customer_id FROM orders
WHERE ordered_at >= '2026-02-01' AND ordered_at < '2026-03-01'
UNION
SELECT customer_id FROM orders
WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01'
ORDER BY customer_id;
```

Output: `1, 2, 3, 4` (4 rows). Now the same with `UNION ALL`:

```sql
SELECT customer_id FROM orders
WHERE ordered_at >= '2026-02-01' AND ordered_at < '2026-03-01'
UNION ALL
SELECT customer_id FROM orders
WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01'
ORDER BY customer_id;
```

Output: `1, 1, 2, 2, 3, 3, 4` (7 rows). A customer with two orders appears twice.

Notes: `ORDER BY` goes once, at the end, and applies to the whole result. `UNION` treats two `NULL` values as equal, so it keeps only one. `INTERSECT` and `EXCEPT` exist too (MySQL has them since 8.0.31).

**Follow-ups:**
- *How is UNION different from a JOIN?* `UNION` adds rows from two queries with the same column layout. A `JOIN` adds columns by matching rows between tables.
- *Do you ever want UNION instead of UNION ALL?* Yes, when the sets may overlap and you need each row once, such as a list of distinct customers from two sources.

**Trap:** Using `UNION` "to be safe". It hides duplicates that may be a real bug, and it adds a sort or hash step on large results. In testing, `UNION ALL` is also how you count rows from several tables in one query.

**Source:** https://www.postgresql.org/docs/16/queries-union.html

### Why do we use many smaller tables instead of one big table?

Topic: sql-core | Core | id: q0416

**Say:** This is normalization: each fact is stored in one place. A customer's email sits in one row of `customers`, so a change happens once and copies cannot disagree. With one big table I would repeat the customer name and email on every order row, and then an update, a delete or an insert can leave the data inconsistent. Smaller tables with foreign keys also let the database protect the data: an order cannot point to a customer that does not exist. The cost is more `JOIN`s on reads. Read-heavy systems sometimes copy data back on purpose, which is denormalization.

**Full process:** Show the problem with a flat table, then the fix.

1. The flat version, one wide table with customer data on every order row. This is a sketch you do not need to run.

```sql
-- flat_orders(order_id, customer_name, customer_email, customer_country, sku, quantity, unit_price)
-- Anna Nowak, anna@example.com, PL appears once per item she ever bought.
```

2. Three anomalies this causes.
   - Update anomaly: Anna changes her email, and you update 5 of 6 rows. Now two emails exist for one person.
   - Insert anomaly: you cannot store a customer who has not ordered yet (Eva Kral in the seed data) without fake order columns.
   - Delete anomaly: deleting her last order deletes the only record of her.

3. The normalized version is the schema at the top of this file: `customers` (one row per person), `orders` (one row per order, `customer_id` points to the customer), `order_items` (one row per line, `order_id` points to the order).

4. Reading it back takes joins. Revenue per customer is one query:

```sql
SELECT c.name, SUM(i.quantity * i.unit_price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
GROUP BY c.id, c.name ORDER BY c.id;
```

**Follow-ups:**
- *Is more tables always better?* No. Past the point where each fact lives in one place, more tables add joins and no safety. Reporting databases are often denormalized (star schema) to make reads simple and fast.
- *What is the practical test for this design?* Ask: can I change this fact in one place only? If a value is copied into several rows, normalize it. If it must be a frozen copy (the price at the time of purchase), keep the copy on purpose: `unit_price` on `order_items` is that case, because the product price may change later.
- *How does this help a tester?* Foreign keys and constraints block bad data at the source, so fewer data bugs reach the application. Joins also give me a place to check integrity: orphan rows should be impossible.

**Trap:** Answering only "to save space" or "it is faster". Space is a side effect. The main reason is consistency (one source of truth), and joins can make some reads slower, not faster.

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### How do you measure how fast a query is?

Topic: sql-core | Core | id: q0417

**Say:** First I look at the plan with `EXPLAIN`, which shows how the database will run the query without running it. `EXPLAIN ANALYZE` runs it for real in PostgreSQL and adds actual time and actual rows for each step, so I wrap a write statement in a transaction and roll it back. I compare estimated rows to actual rows, and I look for a sequential scan on a big table. To find slow queries in general, I use `pg_stat_statements` in PostgreSQL or the slow query log in MySQL. I measure on realistic data volume and repeat the run, because a small table and a warm cache both give a false good result.

**Full process:**

1. Build a table big enough to matter (200,000 rows, about 5,000 customers). This is a scratch table, run it in a temp schema or a throwaway database.

```sql
CREATE TEMP TABLE big_orders AS
SELECT g AS id, (g % 5000) + 1 AS customer_id,
       (ARRAY['new','paid','shipped','cancelled'])[1 + (g % 4)] AS status,
       timestamp '2026-01-01' + (g || ' minutes')::interval AS ordered_at
FROM generate_series(1, 200000) g;
ANALYZE big_orders;
```

2. Read the plan and the real execution.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM big_orders WHERE customer_id = 42;
```

Output shape (numbers such as time and cost differ per machine):

```
Seq Scan on big_orders (actual rows=40 loops=1)
  Filter: (customer_id = 42)
  Rows Removed by Filter: 199960
  Buffers: local read=1344 written=1005
```

Reading it: the database read all 200,000 rows to return 40. `Rows Removed by Filter` is the clue.

3. Add the index and run the same statement again.

```sql
CREATE INDEX ON big_orders (customer_id);
ANALYZE big_orders;
EXPLAIN (ANALYZE) SELECT * FROM big_orders WHERE customer_id = 42;
```

```
Bitmap Heap Scan on big_orders (actual rows=40 loops=1)
  Recheck Cond: (customer_id = 42)
  Heap Blocks: exact=40
  ->  Bitmap Index Scan on big_orders_customer_id_idx (actual rows=40 loops=1)
        Index Cond: (customer_id = 42)
```

4. For a write, do not run `EXPLAIN ANALYZE` on real data without a rollback:

```sql
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'paid' WHERE id = 107;
ROLLBACK;
```

5. Find the slowest queries across the whole database. In PostgreSQL, `pg_stat_statements` is an extension that must be listed in `shared_preload_libraries` (needs a server restart), then `CREATE EXTENSION pg_stat_statements;`. It keeps total time, call count and mean time per normalized query. A cheaper first step is `log_min_duration_statement = 500`, which logs every statement slower than 500 ms. In MySQL, use the slow query log (`slow_query_log`, `long_query_time`) and `EXPLAIN ANALYZE` (MySQL 8.0.18 and later).

**Follow-ups:**
- *Why not just time the query in the client?* The client time includes network, driver and row transfer. `EXPLAIN ANALYZE` shows where the database spent time, step by step. Use both: the client number for what the user feels, the plan to find the cause.
- *What are the first-run and warm-cache effects?* The first run reads from disk, later runs read from memory. Run several times and compare the repeat runs, and never compare a cold run with a warm one.
- *How would a test check performance?* A functional test can check the plan does not contain a sequential scan on a large table. More often I leave it to a performance test with realistic data volume, because a test database with 20 rows never shows the problem.

**Trap:** Calling `EXPLAIN ANALYZE` safe. It executes the statement, so an `UPDATE` or `DELETE` really changes data. The other trap: testing on a tiny table, where a sequential scan is the fastest plan and nothing looks wrong.

**Source:** https://www.postgresql.org/docs/16/using-explain.html and https://www.postgresql.org/docs/16/pgstatstatements.html

### How do you optimize a slow query?

Topic: sql-core | Standard | id: q0418

**Say:** I read the plan first and fix what it shows, I do not guess. Usually the fix is an index on the columns used in `WHERE`, `JOIN` and `ORDER BY`, remembering that every index slows writes. Then I select only the columns I need instead of `SELECT *`, and I stop wrapping an indexed column in a function, because `WHERE lower(email) = 'a'` cannot use a plain index on `email`. I replace a loop that runs one query per row (the N+1 problem) with one join. For deep pages I use a "seek" filter like `id > last_id` instead of a big `OFFSET`. If the report is expensive and can be a bit old, I use a materialized view or a cache.

**Full process:**

1. Measure first (previous question) and write down the baseline.

2. Index the filter column. Expected change: `Seq Scan` becomes `Bitmap Index Scan` or `Index Scan` (output shown in the previous entry).

3. Function on an indexed column. A plain index on `email` is not used for `upper(email) = ...`. Build the index on the expression instead.

```sql
CREATE TABLE s AS SELECT g AS id, 'user' || g || '@x.com' AS email
FROM generate_series(1, 100000) g;
CREATE INDEX s_email_idx ON s (email);
ANALYZE s;

EXPLAIN (COSTS OFF) SELECT * FROM s WHERE upper(email) = 'USER5@X.COM';
-- Seq Scan on s
--   Filter: (upper(email) = 'USER5@X.COM'::text)

CREATE INDEX s_upper_idx ON s (upper(email));
ANALYZE s;
EXPLAIN (COSTS OFF) SELECT * FROM s WHERE upper(email) = 'USER5@X.COM';
-- Index Scan using s_upper_idx on s
--   Index Cond: (upper(email) = 'USER5@X.COM'::text)
```

4. A leading wildcard. `LIKE 'user77%'` can use an index only if the index fits the pattern: in a database with a non-C collation (the default for most installs), PostgreSQL needs `text_pattern_ops` for prefix `LIKE`. `LIKE '%77@x.com'` cannot use a normal B-tree index at all.

```sql
CREATE INDEX s_pat ON s (email text_pattern_ops);
ANALYZE s;
EXPLAIN (COSTS OFF) SELECT * FROM s WHERE email LIKE 'user77%';
-- Bitmap Heap Scan on s
--   Filter: (email ~~ 'user77%'::text)
--   ->  Bitmap Index Scan on s_pat
--         Index Cond: ((email ~>=~ 'user77'::text) AND (email ~<~ 'user78'::text))
```

For "contains" search, use the `pg_trgm` extension with a GIN or GiST index.

5. N+1. Instead of looping over customers and running `SELECT ... FROM orders WHERE customer_id = ?` once per customer, join once:

```sql
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
```

6. Deep paging. `OFFSET 100000` reads and throws away 100,000 rows. A keyset query goes straight to the page:

```sql
SELECT id, ordered_at FROM orders
WHERE id > 105          -- last id from the previous page
ORDER BY id LIMIT 3;
```

Output: `106, 107, 108`.

7. Run `EXPLAIN ANALYZE` again, compare to the baseline, and keep the index only if the plan and the timing both improve. Check that the write path did not get noticeably worse.

**Follow-ups:**
- *Why not index every column?* Each index must be updated on every insert, update and delete, and takes disk space. Index what queries filter, join and sort on, and drop unused indexes (check `pg_stat_user_indexes.idx_scan`).
- *The plan still shows a Seq Scan after you added an index. Why?* Common reasons: the query returns a large share of the table (a scan is cheaper), the statistics are old (run `ANALYZE`), a function wraps the column, the types differ so a cast blocks the index, or the table is tiny.
- *What else besides indexes?* Rewrite the query (`EXISTS` instead of `IN` on a big list, filter before the join), partition a huge table, update statistics, and tune only after the above.

**Trap:** "Add an index" as the whole answer. It is the right first guess, but only the plan proves it, and an unused index only costs write speed. Another trap is believing `SELECT *` is harmless: it blocks index-only scans and moves more data.

**Source:** https://www.postgresql.org/docs/16/indexes-expressional.html and https://www.postgresql.org/docs/16/indexes-opclass.html

## SQL fundamentals

### In what order does a SELECT run?

Topic: sql-core | Standard | id: q0419

**Say:** The order you write it is not the order the database thinks about it. Logically it starts with `FROM` and the joins, then `WHERE`, then `GROUP BY`, then `HAVING`, then window functions, then the `SELECT` list, then `DISTINCT`, then `ORDER BY`, then `LIMIT` and `OFFSET`. That is why a column alias from `SELECT` cannot be used in `WHERE`, but can be used in `ORDER BY`. It is also why `WHERE` cannot filter on an aggregate and `HAVING` can.

**Full process:**

```sql
SELECT c.country, COUNT(*) AS orders       -- 5. pick columns, name the alias
FROM orders o                              -- 1. take the table
JOIN customers c ON c.id = o.customer_id   -- 1. join
WHERE o.status <> 'cancelled'              -- 2. filter rows
GROUP BY c.country                         -- 3. make groups
HAVING COUNT(*) >= 3                       -- 4. filter groups
ORDER BY orders DESC                       -- 6. sort, alias allowed here
LIMIT 5;                                   -- 7. cut
```

Output: `PL 5` (customers 1 and 4: orders 101, 102, 109, 108, 110) and `ES 3` (105, 106, 107). `GB` has one non-cancelled order (103) and is removed by `HAVING`.

Try `WHERE orders >= 3` in place of `HAVING`: PostgreSQL answers `column "orders" does not exist`, because the alias is created after `WHERE`.

MySQL difference: MySQL also allows aliases in `GROUP BY` and `HAVING`, and in `WHERE` it does not. PostgreSQL allows an alias in `GROUP BY` and `ORDER BY` but not in `HAVING`.

**Follow-ups:**
- *Why does this matter in practice?* It explains why `WHERE` is faster than `HAVING` for a plain row filter: rows are removed before grouping, so the database groups less data.
- *Where does a window function run?* After `GROUP BY` and `HAVING`, before `SELECT DISTINCT` and `ORDER BY`. So you cannot use a window function in `WHERE`, you wrap it in a subquery or CTE.

**Trap:** Believing the database runs the query top to bottom as written. A tester who knows the logical order finds the cause of "alias not found" and "aggregate not allowed in WHERE" errors quickly.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### What is the difference between WHERE and HAVING?

Topic: sql-core | Standard | id: q0420

**Say:** `WHERE` filters individual rows before grouping. `HAVING` filters groups after `GROUP BY`, so it can use aggregates like `COUNT` and `SUM`. If a condition does not need an aggregate, put it in `WHERE`, because it removes rows earlier and the query does less work. I use both in one query when I need to filter rows first and then groups.

**Full process:** Customers whose paid or shipped orders add up to more than 200.

```sql
SELECT c.name, SUM(i.quantity * i.unit_price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status IN ('paid', 'shipped')   -- row filter
JOIN order_items i ON i.order_id = o.id
GROUP BY c.id, c.name
HAVING SUM(i.quantity * i.unit_price) > 200                                   -- group filter
ORDER BY spent DESC;
```

Output: `Anna Nowak 510.00`, `Clara Diaz 425.00`. Ben (50.00) and Dawid (70.00) are cut by `HAVING`. The cancelled order is cut before grouping.

**Follow-ups:**
- *Can HAVING be used without GROUP BY?* Yes, then the whole result is one group. It is rare.

**Trap:** Putting a non-aggregate condition in `HAVING` (`HAVING status = 'paid'`). It works in some cases but it is slower and shows the author did not understand the order.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### Explain every kind of JOIN with a small example.

Topic: sql-core | Standard | id: q0421

**Say:** A join combines rows from two tables on a condition. `INNER JOIN` keeps only rows that match on both sides. `LEFT JOIN` keeps every row of the left table, with `NULL` on the right where nothing matches. `RIGHT JOIN` is the mirror image. `FULL JOIN` keeps unmatched rows from both sides. `CROSS JOIN` pairs every row with every row. A self join joins a table to itself, for example a customer to the customer who referred them. I use `LEFT JOIN` plus `WHERE right.id IS NULL` to find rows with no match, such as customers with no orders.

**Full process:** Two tiny tables, `a` has ids 1, 2, 3 and `b` has ids 2, 3, 4.

```sql
CREATE TEMP TABLE a (id int, v text);
CREATE TEMP TABLE b (id int, w text);
INSERT INTO a VALUES (1, 'a1'), (2, 'a2'), (3, 'a3');
INSERT INTO b VALUES (2, 'b2'), (3, 'b3'), (4, 'b4');
```

`INNER JOIN` (2 rows, only ids in both):

```sql
SELECT a.id AS a_id, a.v, b.id AS b_id, b.w FROM a INNER JOIN b ON a.id = b.id;
```

```
 a_id | v  | b_id | w
------+----+------+----
    2 | a2 |    2 | b2
    3 | a3 |    3 | b3
```

`LEFT JOIN` (3 rows, every row of `a`):

```
 a_id | v  | b_id | w
------+----+------+----
    1 | a1 |      |
    2 | a2 |    2 | b2
    3 | a3 |    3 | b3
```

`RIGHT JOIN` (3 rows, every row of `b`):

```
 a_id | v  | b_id | w
------+----+------+----
    2 | a2 |    2 | b2
    3 | a3 |    3 | b3
      |    |    4 | b4
```

`FULL JOIN` (4 rows, all of both):

```
 a_id | v  | b_id | w
------+----+------+----
    1 | a1 |      |
    2 | a2 |    2 | b2
    3 | a3 |    3 | b3
      |    |    4 | b4
```

`CROSS JOIN` (3 x 3 = 9 rows):

```sql
SELECT a.id AS a_id, b.id AS b_id FROM a CROSS JOIN b ORDER BY 1, 2;
-- (1,2) (1,3) (1,4) (2,2) (2,3) (2,4) (3,2) (3,3) (3,4)
```

Self join, on the seed schema. Who referred each customer:

```sql
SELECT c.name AS customer, r.name AS referred_by
FROM customers c LEFT JOIN customers r ON r.id = c.referred_by
ORDER BY c.id;
```

```
    customer     | referred_by
-----------------+-------------
 Anna Nowak      |
 Ben Carter      | Anna Nowak
 Clara Diaz      | Anna Nowak
 Dawid Zielinski | Ben Carter
 Eva Kral        |
 Anna Nowak      |
```

Semi and anti join (no extra rows, only filtering). `EXISTS` keeps `a` rows that have a match, `NOT EXISTS` keeps those without:

```sql
SELECT a.* FROM a WHERE EXISTS (SELECT 1 FROM b WHERE b.id = a.id);       -- (2,a2) (3,a3)
SELECT a.* FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.id = a.id);   -- (1,a1)
```

MySQL differences: MySQL has no `FULL JOIN`. Emulate it with a `LEFT JOIN` plus `UNION` plus a `RIGHT JOIN`. PostgreSQL supports all of the above.

**Follow-ups:**
- *What happens if the join key is duplicated on one side?* Rows multiply: one `a` row matches every `b` row with that key. A sum after such a join counts twice. Check row counts before and after a join.
- *What is the difference between a condition in ON and in WHERE for a LEFT JOIN?* See the next entry.
- *What is a natural join?* It joins on all columns with the same name. I avoid it, because adding a column to a table later can silently change the join.

**Trap:** Describing joins only as Venn diagrams and not knowing that duplicates in a key multiply rows. Another trap: `RIGHT JOIN` is not needed, rewrite it as a `LEFT JOIN` with the tables swapped.

**Source:** https://www.postgresql.org/docs/16/queries-table-expressions.html

### What is the difference between a condition in ON and in WHERE on a LEFT JOIN?

Topic: sql-core | Standard | id: q0422

**Say:** For an inner join it makes no difference. For a `LEFT JOIN` it does. A condition in `ON` decides which right-side rows match, so left rows are still kept with `NULL`. A condition on the right table in `WHERE` runs after the join and removes the `NULL` rows, which turns the `LEFT JOIN` into an inner join by accident.

**Full process:** Using the tiny `a` and `b` tables from the previous entry.

```sql
SELECT a.id, b.w FROM a LEFT JOIN b ON a.id = b.id AND b.w <> 'b2' ORDER BY 1;
```

```
 id | w
----+----
  1 |
  2 |
  3 | b3
```

All three `a` rows survive. Row 2 matched nothing after the extra condition, so `w` is `NULL`.

```sql
SELECT a.id, b.w FROM a LEFT JOIN b ON a.id = b.id WHERE b.w <> 'b2' ORDER BY 1;
```

```
 id | w
----+----
  3 | b3
```

Only one row. `WHERE b.w <> 'b2'` is never true for the `NULL` rows, so rows 1 and 2 are gone.

**Follow-ups:**
- *How do you write "customers with no paid order" correctly?* Put the status in `ON`, then check for `NULL`: `LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' WHERE o.id IS NULL`. Or use `NOT EXISTS`.

**Trap:** A query that "has a LEFT JOIN" but filters the right table in `WHERE`. It returns the same rows as an inner join, and the author thinks it keeps unmatched rows.

**Source:** https://www.postgresql.org/docs/16/queries-table-expressions.html

### How do NULLs behave in comparisons and aggregates?

Topic: sql-core | Standard | id: q0423

**Say:** `NULL` means unknown, so any comparison with it gives unknown, not true. `= NULL` never matches, I use `IS NULL` or `IS NOT NULL`. In a `WHERE` clause, unknown is treated like false, so `status <> 'x'` also drops rows where `status` is `NULL`. Aggregates ignore `NULL`, except `COUNT(*)`, which counts rows. `SUM` over only `NULL` values gives `NULL`, not 0, so I wrap it in `COALESCE` when I need 0.

**Full process:**

```sql
SELECT COUNT(*)                                            AS all_rows,
       COUNT(coupon)                                       AS with_coupon,
       COUNT(*) FILTER (WHERE coupon IS NULL)              AS without_coupon,
       COUNT(*) FILTER (WHERE coupon <> 'WELCOME10')       AS not_welcome,
       COUNT(*) FILTER (WHERE coupon IS DISTINCT FROM 'WELCOME10') AS not_welcome_null_safe
FROM orders;
```

```
 all_rows | with_coupon | without_coupon | not_welcome | not_welcome_null_safe
----------+-------------+----------------+-------------+-----------------------
       10 |           3 |              7 |           1 |                     8
```

Reading it: three orders have a coupon. `coupon <> 'WELCOME10'` matches only the one `SPRING5` row (1), because the 7 `NULL` rows are unknown. `IS DISTINCT FROM` treats `NULL` as a normal value and returns 8.

Replace `NULL` for display:

```sql
SELECT id, COALESCE(coupon, 'none') AS coupon FROM orders WHERE id IN (101, 102) ORDER BY id;
-- 101 | WELCOME10
-- 102 | none
```

Other places `NULL` behaves oddly: `GROUP BY` and `DISTINCT` put all `NULL`s in one group. `ORDER BY ... ASC` puts `NULL` last in PostgreSQL and first in MySQL (`NULLS FIRST` and `NULLS LAST` are PostgreSQL only). A `UNIQUE` column allows many `NULL`s in PostgreSQL (PostgreSQL 15 added `NULLS NOT DISTINCT`) and in MySQL.

MySQL difference: `FILTER (WHERE ...)` does not exist, use `SUM(coupon IS NULL)` or `COUNT(CASE WHEN ... END)`. The null-safe equals in MySQL is `<=>`.

**Follow-ups:**
- *What does AVG do with NULL?* It ignores them, so the average of 10, 20, `NULL` is 15, not 10. If `NULL` means 0 in your business logic, use `AVG(COALESCE(x, 0))`.
- *Difference between COUNT(*), COUNT(col) and COUNT(DISTINCT col)?* Rows, non-`NULL` values, distinct non-`NULL` values.

**Trap:** `WHERE coupon <> 'WELCOME10'` to find "all orders without that coupon". It silently drops the `NULL` rows, so a data check passes when it should fail.

**Source:** https://www.postgresql.org/docs/16/functions-comparison.html

### Why can NOT IN return no rows, and what do you use instead?

Topic: sql-core | Standard | id: q0424

**Say:** If the list inside `NOT IN (...)` contains a single `NULL`, the whole condition becomes unknown for every row, and the query returns nothing. It is a classic silent bug. I use `NOT EXISTS` instead, which is safe with `NULL`, and which the planner can turn into an efficient anti join.

**Full process:** Using the tiny `a` (1, 2, 3) and `b` (2, 3, 4) tables.

```sql
INSERT INTO b VALUES (NULL, 'bnull');
SELECT * FROM a WHERE id NOT IN (SELECT id FROM b);                      -- 0 rows
SELECT * FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.id = a.id);    -- (1, a1)
```

`1 NOT IN (2, 3, 4, NULL)` means `1 <> 2 AND 1 <> 3 AND 1 <> 4 AND 1 <> NULL`. The last part is unknown, so the whole expression is never true.

**Follow-ups:**
- *Is IN with a NULL in the list also a problem?* Not in the same way. `1 IN (2, NULL)` is unknown, but `2 IN (2, NULL)` is true, so matches still work. Only `NOT IN` breaks.

**Trap:** Testing the query only on data without `NULL`s and concluding it works. A test that finds "customers without orders" with `NOT IN` passes until the first row with a `NULL` foreign key.

**Source:** https://www.postgresql.org/docs/16/functions-subquery.html

### What are the rules for GROUP BY, and why does "must appear in the GROUP BY clause" happen?

Topic: sql-core | Standard | id: q0425

**Say:** Every column in the `SELECT` list must either be in `GROUP BY` or be inside an aggregate function. The database makes one row per group, so a plain column that is not grouped has many possible values and it cannot pick one. PostgreSQL gives an error. If I group by the primary key, PostgreSQL also allows the other columns of that table, because they are determined by it. Old MySQL versions accepted the bad query and returned an arbitrary value, but `ONLY_FULL_GROUP_BY` is on by default since MySQL 5.7.

**Full process:**

```sql
SELECT c.name, COUNT(o.id)          -- error: c.name is not grouped
FROM customers c JOIN orders o ON o.customer_id = c.id
GROUP BY c.country;
```

Output: `ERROR: column "c.name" must appear in the GROUP BY clause or be used in an aggregate function`.

Correct version. Note we group by `c.id` as well as `c.name`, because two customers are named Anna Nowak:

```sql
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name ORDER BY c.id;
```

```
 id |      name       | orders
----+-----------------+--------
  1 | Anna Nowak      |      3
  2 | Ben Carter      |      2
  3 | Clara Diaz      |      3
  4 | Dawid Zielinski |      2
  5 | Eva Kral        |      0
  6 | Anna Nowak      |      0
```

Note `COUNT(o.id)` and not `COUNT(*)`: with the `LEFT JOIN`, `COUNT(*)` gives 1 for customers with no orders, because the row exists. `COUNT(o.id)` skips the `NULL` and gives 0.

**Follow-ups:**
- *GROUP BY name versus GROUP BY id?* Grouping by a non-unique column (name) merges different people. Here it would merge the two Annas into one row with 3 orders.

**Trap:** Using `COUNT(*)` after a `LEFT JOIN` and reporting 1 order for a customer with none.

**Source:** https://www.postgresql.org/docs/16/queries-table-expressions.html

### What is DISTINCT and when do you avoid it?

Topic: sql-core | Standard | id: q0426

**Say:** `DISTINCT` removes duplicate rows from the result, comparing all selected columns together. It is useful for a quick list of unique values. I avoid using it to "fix" a join that returns too many rows, because that hides the cause, which is usually a join on a non-unique key. `COUNT(DISTINCT col)` counts unique values. PostgreSQL also has `DISTINCT ON (col)`, which keeps the first row per group, and MySQL does not have it.

**Full process:**

```sql
SELECT DISTINCT country FROM customers ORDER BY country;      -- CZ, ES, GB, PL
SELECT COUNT(DISTINCT country) FROM customers;                -- 4
```

Latest order per customer with PostgreSQL's `DISTINCT ON`:

```sql
SELECT DISTINCT ON (customer_id) customer_id, id, ordered_at
FROM orders ORDER BY customer_id, ordered_at DESC;
```

```
 customer_id | id  |     ordered_at
-------------+-----+---------------------
           1 | 109 | 2026-04-05 13:00:00
           2 | 104 | 2026-03-01 18:45:00
           3 | 107 | 2026-04-01 11:20:00
           4 | 110 | 2026-04-10 10:30:00
```

**Follow-ups:**
- *A join gives duplicate rows. Do you add DISTINCT?* No. First find out why: an unexpected one-to-many relation, a missing join condition, or real duplicates in the data. Fix the join, or aggregate before joining.

**Trap:** Adding `DISTINCT` until the numbers "look right". The sum after the join can still be wrong, because the duplicates were removed after the double counting.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### How does LIKE work and what are its performance limits?

Topic: sql-core | Standard | id: q0427

**Say:** `LIKE` matches a pattern: `%` is any number of characters, `_` is exactly one. `LIKE 'anna%'` finds values starting with "anna". In PostgreSQL `LIKE` is case sensitive and `ILIKE` is not. In MySQL the default collation makes `LIKE` case insensitive. A pattern with a leading wildcard, `'%anna'`, cannot use a normal B-tree index, so it scans the whole table. For "contains" search on big tables I would use a trigram index (`pg_trgm`) or a full-text index.

**Full process:**

```sql
SELECT id, email FROM customers WHERE email LIKE 'anna%' ORDER BY id;
-- 1 | anna@example.com
-- 6 | anna.n@example.org

SELECT id, email FROM customers WHERE email LIKE 'anna_@%';   -- 0 rows (underscore means exactly one char)
SELECT id, name FROM customers WHERE name ILIKE 'ANNA%';      -- ids 1 and 6 (PostgreSQL only)
```

To match a real `%` or `_`, escape it: `WHERE coupon LIKE 'WELCOME\_10' ESCAPE '\'`.

**Follow-ups:**
- *Why does a prefix LIKE sometimes not use the index?* In a non-C collation, a plain B-tree index cannot serve `LIKE 'abc%'`. Create it with `text_pattern_ops`, or use a `C` collation (shown in the optimization entry).

**Trap:** Using `LIKE '%text%'` for a search feature on a big table and expecting an index to help.

**Source:** https://www.postgresql.org/docs/16/functions-matching.html

### How do you write a CASE expression, and where is it useful?

Topic: sql-core | Standard | id: q0428

**Say:** `CASE` is an if/else inside a query. It returns the first branch whose condition is true, and `NULL` if none matches and there is no `ELSE`. I use it to bucket values, to pivot (turn rows into columns) with conditional aggregates, and to make a result readable. It works in `SELECT`, `ORDER BY`, `GROUP BY` and `WHERE`.

**Full process:** Classify orders by total.

```sql
SELECT o.id,
       SUM(i.quantity * i.unit_price) AS total,
       CASE WHEN SUM(i.quantity * i.unit_price) >= 200 THEN 'large'
            WHEN SUM(i.quantity * i.unit_price) >= 50  THEN 'medium'
            ELSE 'small' END AS size
FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id ORDER BY o.id;
```

```
 id  | total  |  size
-----+--------+--------
 101 |  90.00 | medium
 102 | 200.00 | large
 103 |  50.00 | medium
 104 |  20.00 | small
 105 | 400.00 | large
 106 |  25.00 | small
 107 |  50.00 | medium
 108 |  70.00 | medium
 109 | 220.00 | large
```

Order 110 is missing: it has no items, so the inner join drops it.

Conditional count (one row, a column per status):

```sql
SELECT COUNT(*) FILTER (WHERE status = 'paid')    AS paid,
       COUNT(*) FILTER (WHERE status = 'shipped') AS shipped
FROM orders;       -- 6, 2
```

The portable form works in MySQL too: `SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`.

**Follow-ups:**
- *Does CASE order matter?* Yes. The first true `WHEN` wins, so put the most specific condition first. Above, the `>= 200` test comes before `>= 50`.

**Trap:** Forgetting `ELSE`, which leaves `NULL`s that then disappear in a later `<>` filter.

**Source:** https://www.postgresql.org/docs/16/functions-conditional.html

### What is the difference between a subquery, a correlated subquery and a CTE?

Topic: sql-core | Standard | id: q0429

**Say:** A subquery is a query inside another query. A correlated subquery uses a column from the outer query, so it is evaluated per outer row, in principle. A CTE, `WITH name AS (...)`, gives a query a name so I can read it top to bottom and use it more than once. In PostgreSQL 12 and later, a simple CTE used once is inlined and optimized like a subquery. I use CTEs for readability, and I use `EXISTS` with a correlated subquery to test whether related rows exist.

**Full process:**

1. Subquery in `WHERE`. Customers with an order above the average item price:

```sql
SELECT DISTINCT c.name FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
WHERE i.unit_price > (SELECT AVG(unit_price) FROM order_items)
ORDER BY c.name;
```

The average unit price is 70.00. Items above it are the three monitor lines (200.00 each, orders 102, 105, 109), so the output is `Anna Nowak`, `Clara Diaz`.

2. Correlated subquery with `EXISTS`. Customers who have at least one cancelled order:

```sql
SELECT c.id, c.name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'cancelled');
```

Output: `2 | Ben Carter`.

3. CTE. Monthly revenue of paid and shipped orders:

```sql
WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month,
         SUM(i.quantity * i.unit_price) AS revenue
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status IN ('paid', 'shipped')
  GROUP BY 1
)
SELECT month, revenue FROM monthly ORDER BY month;
```

```
   month    | revenue
------------+---------
 2026-02-01 |  340.00
 2026-03-01 |  495.00
 2026-04-01 |  220.00
```

PostgreSQL 12 and later: add `MATERIALIZED` or `NOT MATERIALIZED` after `AS` to force or forbid computing the CTE once. Before version 12, a CTE was always an optimization fence. A recursive CTE (`WITH RECURSIVE`) walks hierarchies, such as the `referred_by` chain.

MySQL difference: CTEs work from MySQL 8.0. `date_trunc` does not exist, use `DATE_FORMAT(ordered_at, '%Y-%m-01')`.

**Follow-ups:**
- *EXISTS versus IN?* Both work for "has a related row". `EXISTS` stops at the first match and is safe with `NULL`. `IN` is fine for a short list of constants. For `NOT`, always prefer `NOT EXISTS`.
- *CTE versus temporary table?* A CTE lives for one statement. A temp table lives for the session, can be indexed, and is useful when the same intermediate result feeds several statements.

**Trap:** Believing a CTE is always a performance fence (true before PostgreSQL 12) or always faster (it is not, it is about readability).

**Source:** https://www.postgresql.org/docs/16/queries-with.html

### How do you work with dates and times in SQL?

Topic: sql-core | Standard | id: q0430

**Say:** For a date range I use a half-open interval: `>= start AND < next_start`. It is correct for every time precision and has no off-by-one at midnight. I avoid `BETWEEN` on timestamps for the same reason, since its upper bound is inclusive. I store timestamps in UTC with time zone (`timestamptz` in PostgreSQL) and convert on display. I also avoid putting a function on the column, like `WHERE ordered_at::date = '2026-03-01'`, because it blocks an index on `ordered_at`.

**Full process:**

```sql
SELECT id, ordered_at FROM orders
WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01'
ORDER BY ordered_at;
```

```
 id  |     ordered_at
-----+---------------------
 104 | 2026-03-01 18:45:00
 105 | 2026-03-02 08:00:00
 108 | 2026-03-15 16:05:00
 106 | 2026-03-20 14:10:00
```

Useful functions: `date_trunc('month', ts)` cuts to the month start, `ts::date` casts to a date, `date1 - date2` gives integer days, `ts + interval '7 days'` adds time, `now()` is the transaction start time, `current_date` is today, `extract(dow FROM ts)` gives the weekday.

Pitfall demo: `BETWEEN '2026-03-01' AND '2026-03-31'` stops at `2026-03-31 00:00:00`, so an order at `2026-03-31 15:00` is lost.

MySQL differences: `NOW()`, `CURDATE()`, `DATEDIFF(a, b)`, `DATE_ADD(ts, INTERVAL 7 DAY)`, `DATE_FORMAT`. MySQL `TIMESTAMP` is stored in UTC and converted with the session time zone, `DATETIME` is not converted.

**Follow-ups:**
- *Why do time zones cause test failures?* A test that says "today" can differ between the CI machine, the database and the browser. I pin the time zone and compute the expected range from the same source the product uses. (Tests around daylight saving and project time zone are a classic source of off-by-one-day bugs.)

**Trap:** `BETWEEN` for timestamps, and comparing a `timestamp` column to a local date string without thinking about the time zone.

**Source:** https://www.postgresql.org/docs/16/functions-datetime.html

### What are INTERSECT and EXCEPT, and when do you use them in testing?

Topic: sql-core | Standard | id: q0431

**Say:** `INTERSECT` returns the rows that appear in both queries, `EXCEPT` returns the rows in the first query that are not in the second. Both remove duplicates unless you add `ALL`. In testing, `EXCEPT` run in both directions is my quick way to compare two tables, for example before and after a migration. Any row in the result is a difference.

**Full process:**

```sql
-- customers who ordered in Feb and also in March
SELECT customer_id FROM orders WHERE ordered_at >= '2026-02-01' AND ordered_at < '2026-03-01'
INTERSECT
SELECT customer_id FROM orders WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01';
-- 2

-- customers who ordered in Feb but not in March
SELECT customer_id FROM orders WHERE ordered_at >= '2026-02-01' AND ordered_at < '2026-03-01'
EXCEPT
SELECT customer_id FROM orders WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01';
-- 1
```

The full before and after comparison is in the hands-on tasks.

MySQL: `INTERSECT` and `EXCEPT` exist from 8.0.31. Oracle calls `EXCEPT` `MINUS`.

**Follow-ups:**
- *Does EXCEPT treat NULL as equal?* Yes, two `NULL`s count as the same value in set operations, which is what you want for comparing tables.

**Trap:** Running `EXCEPT` in one direction only. It shows rows missing in the second table but not extra rows there.

**Source:** https://www.postgresql.org/docs/16/queries-union.html

## Window functions, duplicates and ranking

### What is a window function, and how is it different from GROUP BY?

Topic: sql-core | Standard | id: q0432

**Say:** A window function calculates over a set of related rows, but it does not collapse them. `GROUP BY` gives one row per group. A window function keeps every row and adds a column next to it, such as a running total, a rank, or the previous row's value. The `OVER (...)` clause defines the window: `PARTITION BY` splits rows into groups, `ORDER BY` orders them inside each group. I use them for "latest per group", "top N per group", rankings and differences to the previous row.

**Full process:** Running total of Anna's orders (customer 1), in time order.

```sql
WITH t AS (
  SELECT o.id, o.ordered_at, SUM(i.quantity * i.unit_price) AS total
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.customer_id = 1
  GROUP BY o.id, o.ordered_at
)
SELECT id, total, SUM(total) OVER (ORDER BY ordered_at) AS running_total
FROM t ORDER BY ordered_at;
```

```
 id  | total  | running_total
-----+--------+---------------
 101 |  90.00 |         90.00
 102 | 200.00 |        290.00
 109 | 220.00 |        510.00
```

Window functions run after `GROUP BY` and `HAVING`, so you can aggregate and then window in the same query, or use a CTE as above.

Frame detail: with `ORDER BY` and no frame clause, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, and rows with equal sort values (peers) get the same running total. For a strict row-by-row total, write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

MySQL: window functions exist from MySQL 8.0, not in 5.7.

**Follow-ups:**
- *Can you filter on a window function in WHERE?* No, windows are computed after `WHERE`. Put the query in a subquery or CTE and filter outside, as in the latest-order-per-customer entry.
- *What does PARTITION BY do without ORDER BY?* The aggregate covers the whole partition, so every row shows the group total next to its own data.

**Trap:** Confusing it with `GROUP BY` and expecting fewer rows.

**Source:** https://www.postgresql.org/docs/16/tutorial-window.html

### What is the difference between ROW_NUMBER, RANK and DENSE_RANK?

Topic: sql-core | Standard | id: q0433

**Say:** All three number rows inside a window. `ROW_NUMBER` gives a unique number, 1, 2, 3, even for ties, and the order among ties is arbitrary unless I add a tie-break column. `RANK` gives tied rows the same number and then skips, so 1, 1, 3. `DENSE_RANK` gives tied rows the same number and does not skip, so 1, 1, 2. I choose by the question: "exactly one row per group" is `ROW_NUMBER`, "top 2 prices, ties included" is `DENSE_RANK`.

**Full process:** Six order items, ranked by price from high to low.

```sql
SELECT sku, unit_price,
       RANK()       OVER (ORDER BY unit_price DESC)        AS rnk,
       DENSE_RANK() OVER (ORDER BY unit_price DESC)        AS dense_rnk,
       ROW_NUMBER() OVER (ORDER BY unit_price DESC, id)    AS rn
FROM order_items WHERE id IN (1, 3, 4, 5, 7, 11)
ORDER BY rn;
```

```
   sku    | unit_price | rnk | dense_rnk | rn
----------+------------+-----+-----------+----
 MONITOR  |     200.00 |   1 |         1 |  1
 MONITOR  |     200.00 |   1 |         1 |  2
 KEYBOARD |      50.00 |   3 |         2 |  3
 KEYBOARD |      50.00 |   3 |         2 |  4
 MOUSE    |      20.00 |   5 |         3 |  5
 CABLE    |       5.00 |   6 |         4 |  6
```

Reading it: the two monitors tie for first. `RANK` jumps to 3 for the keyboards, `DENSE_RANK` goes to 2.

**Follow-ups:**
- *Why add `id` to the ROW_NUMBER ordering?* Without a tie-break column, tied rows can come in a different order on each run, so the result is not deterministic and a test on it becomes flaky.
- *What are NTILE, FIRST_VALUE and LAST_VALUE?* `NTILE(4)` splits rows into 4 buckets. `FIRST_VALUE` and `LAST_VALUE` read the first or last value of the frame (for `LAST_VALUE`, mind the default frame ends at the current row).

**Trap:** Using `RANK` for "top 3" and getting more than 3 rows because of ties, or using `ROW_NUMBER` and dropping a tied row without noticing.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### How do you get the latest row per group (the latest order per customer)?

Topic: sql-core | Standard | id: q0434

**Say:** I number the rows inside each customer with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC)` and keep row 1. It works the same in PostgreSQL and MySQL 8. PostgreSQL also has the shorter `DISTINCT ON`. The old way, a join to `MAX(ordered_at)`, returns two rows if two orders share the same timestamp, so I prefer the window function with a tie-break.

**Full process:**

```sql
SELECT id, customer_id, ordered_at
FROM (
  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC, id DESC) AS rn
  FROM orders o
) x
WHERE rn = 1
ORDER BY customer_id;
```

```
 id  | customer_id |     ordered_at
-----+-------------+---------------------
 109 |           1 | 2026-04-05 13:00:00
 104 |           2 | 2026-03-01 18:45:00
 107 |           3 | 2026-04-01 11:20:00
 110 |           4 | 2026-04-10 10:30:00
```

Customers 5 and 6 have no orders, so they do not appear.

**Follow-ups:**
- *How would you get the top 2 per group?* Change the filter to `rn <= 2`.
- *In a test, where does this appear?* "After placing an order in the UI, the newest order for this customer should have these items." I look up the newest order per customer with this query.

**Trap:** `GROUP BY customer_id` with `MAX(ordered_at)` and then trying to add the order id: it is not allowed, or gives the wrong order's id.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### How do you find the Nth highest value (for example the second highest order total)?

Topic: sql-core | Standard | id: q0435

**Say:** I use `DENSE_RANK` over the totals and filter on rank N, which handles ties correctly. A simpler form is `SELECT DISTINCT total ... ORDER BY total DESC OFFSET N-1 LIMIT 1`. I avoid `LIMIT 1 OFFSET 1` without `DISTINCT`, because with two rows at the top value it returns the top value again. Order 105 is the highest at 400.00, so the second highest is 220.00.

**Full process:**

```sql
WITH totals AS (
  SELECT o.id, SUM(i.quantity * i.unit_price) AS total
  FROM orders o JOIN order_items i ON i.order_id = o.id
  GROUP BY o.id
), ranked AS (
  SELECT id, total, DENSE_RANK() OVER (ORDER BY total DESC) AS rnk FROM totals
)
SELECT id, total FROM ranked WHERE rnk = 2 ORDER BY id;
```

Output: `109 | 220.00`.

The `OFFSET` version returns only the value:

```sql
SELECT DISTINCT total
FROM (SELECT SUM(quantity * unit_price) AS total FROM order_items GROUP BY order_id) t
ORDER BY total DESC OFFSET 1 LIMIT 1;      -- 220.00
```

MySQL: `LIMIT 1 OFFSET 1`, or `LIMIT 1, 1`, with the same `DISTINCT`.

**Follow-ups:**
- *What if there are fewer than N distinct values?* The query returns no rows, not NULL. Wrap it in a subquery with `MAX` if the caller needs a NULL.
- *What is the old-school alternative without window functions?* A correlated subquery counting how many distinct values are greater: it works anywhere but is slow.

**Trap:** `ORDER BY total DESC LIMIT 1 OFFSET 1` on data with ties at the top. It returns the same value as the maximum.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### How do you compare a row with the previous row (LAG and LEAD)?

Topic: sql-core | Standard | id: q0436

**Say:** `LAG(col)` returns the value of `col` from the previous row in the window, `LEAD(col)` from the next row. I give it a `PARTITION BY` so it stays inside one customer, and an `ORDER BY` so "previous" has a meaning. The first row of a partition has no previous row, so `LAG` returns `NULL`, or a default if I pass a third argument. I use it for "days since the last order", for finding gaps, and for checking that statuses move in a valid order.

**Full process:** Days between orders for customers 1 and 3.

```sql
SELECT id, customer_id, ordered_at::date AS day,
       LAG(ordered_at::date) OVER w                    AS prev_day,
       ordered_at::date - LAG(ordered_at::date) OVER w AS days_since
FROM orders
WHERE customer_id IN (1, 3)
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at)
ORDER BY customer_id, ordered_at;
```

```
 id  | customer_id |    day     |  prev_day  | days_since
-----+-------------+------------+------------+------------
 101 |           1 | 2026-02-01 |            |
 102 |           1 | 2026-02-15 | 2026-02-01 |         14
 109 |           1 | 2026-04-05 | 2026-02-15 |         49
 105 |           3 | 2026-03-02 |            |
 106 |           3 | 2026-03-20 | 2026-03-02 |         18
 107 |           3 | 2026-04-01 | 2026-03-20 |         12
```

MySQL: same functions in 8.0. Date subtraction is `DATEDIFF(a, b)`, and the named `WINDOW` clause is supported.

**Follow-ups:**
- *How do you get the next value instead?* `LEAD(col)`. The offset is the second argument: `LAG(col, 2)` looks two rows back.

**Trap:** Forgetting `PARTITION BY`, so the first order of customer 3 is compared with the last order of customer 1.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### How do you find duplicate rows, and how do you delete them safely?

Topic: sql-core | Standard | id: q0437

**Say:** To find duplicates I group by the columns that should be unique and keep the groups with `HAVING COUNT(*) > 1`. To delete them I number the rows inside each duplicate group with `ROW_NUMBER` and delete every row after the first. I run the delete inside a transaction, look at the result, and only then commit. After cleaning I add a unique constraint so it cannot happen again.

**Full process:**

1. Find. The seed data has two customers named Anna Nowak with different emails. This is a "possible duplicate", not proof of one.

```sql
SELECT name, COUNT(*) AS copies, MIN(id) AS keep_id, array_agg(id ORDER BY id) AS ids
FROM customers GROUP BY name HAVING COUNT(*) > 1;
```

```
    name    | copies | keep_id |  ids
------------+--------+---------+-------
 Anna Nowak |      2 |       1 | {1,6}
```

2. Delete all but the lowest id, in a transaction.

```sql
BEGIN;
DELETE FROM customers c
USING (SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn FROM customers) d
WHERE c.id = d.id AND d.rn > 1;
SELECT id, name FROM customers ORDER BY id;     -- 5 rows: id 6 is gone
ROLLBACK;                                       -- COMMIT only after checking
```

3. Prevent it: `ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);` (the seed already has it on `email`).

MySQL differences: the delete form is `DELETE c FROM customers c JOIN (...) d ON d.id = c.id WHERE d.rn > 1`. `array_agg` is `GROUP_CONCAT(id ORDER BY id)`.

**Follow-ups:**
- *What if the rows are identical in every column, with no id?* In PostgreSQL use the hidden `ctid` as the row identifier. In MySQL, create a new table with `SELECT DISTINCT`, then swap the tables.
- *What if other tables point to the duplicate you delete?* The foreign key rule applies: it fails with `RESTRICT`, or deletes the child rows with `CASCADE`. Re-point the child rows to the kept row first.

**Trap:** Deleting duplicates without a transaction, or choosing the survivor by a wrong rule. Also: two rows with the same name are not necessarily the same person. Decide what "duplicate" means (here, the same email) before deleting.

**Source:** https://www.postgresql.org/docs/16/sql-delete.html

## Transactions, ACID, isolation and locks

### What is a transaction and what does ACID mean?

Topic: sql-core | Standard | id: q0438

**Say:** A transaction is a group of statements that succeed together or fail together. ACID describes the guarantees. Atomicity: all or nothing, a failure undoes the whole group. Consistency: after the transaction the data obeys all constraints. Isolation: concurrent transactions do not see each other's half-finished work, to a degree set by the isolation level. Durability: once committed, the change survives a crash. A bank transfer is the standard example: take 100 from one account and add 100 to another, and never only one of them.

**Full process:**

```sql
BEGIN;
UPDATE orders SET status = 'cancelled' WHERE id = 107;
INSERT INTO orders (id, customer_id, status, ordered_at) VALUES (999, 99, 'new', now());
-- ERROR: foreign key violation (customer 99 does not exist)
-- The transaction is now aborted: every later statement fails until ROLLBACK.
ROLLBACK;
SELECT status FROM orders WHERE id = 107;      -- 'new', the UPDATE was undone
```

In PostgreSQL an error inside a transaction aborts the whole transaction. To recover from one failing statement and continue, use a `SAVEPOINT` and `ROLLBACK TO SAVEPOINT`.

PostgreSQL runs every statement in an implicit transaction (autocommit) when you do not write `BEGIN`. DDL like `CREATE TABLE` is transactional in PostgreSQL. In MySQL, DDL commits implicitly, so a migration that fails halfway can leave a half-changed schema.

**Follow-ups:**
- *What does the tester see when atomicity is broken?* Half-saved data: an order without its items, or a payment recorded without the order. I check both sides after a flow that writes several tables.
- *What is a savepoint?* A named point inside a transaction you can roll back to without abandoning the whole transaction.

**Trap:** Saying "consistency" means the same as in the CAP theorem. In ACID it means the data obeys the rules (constraints), which is different from the consistency of replicas in distributed systems.

**Source:** https://www.postgresql.org/docs/16/tutorial-transactions.html

### What are the isolation levels and which anomalies do they allow?

Topic: sql-core | Standard | id: q0439

**Say:** The SQL standard defines four levels, and each one allows fewer anomalies. Read Uncommitted allows dirty reads, which means reading another transaction's uncommitted data. Read Committed allows non-repeatable reads: the same row read twice returns different values, because someone committed in between. Repeatable Read prevents that, and the standard still allows phantom reads, where a repeated query returns new rows. Serializable behaves as if transactions ran one after another. PostgreSQL's default is Read Committed, MySQL InnoDB's default is Repeatable Read.

**Full process:** Walk through the anomaly table and one demonstration.

| Level | Dirty read | Non-repeatable read | Phantom read | Serialization anomaly |
|---|---|---|---|---|
| Read Uncommitted | allowed by the standard, but not possible in PostgreSQL (it behaves as Read Committed) | possible | possible | possible |
| Read Committed (PostgreSQL default) | no | possible | possible | possible |
| Repeatable Read (MySQL default) | no | no | allowed by the standard, not possible in PostgreSQL | possible |
| Serializable | no | no | no | no |

Demonstration of a non-repeatable read in PostgreSQL. Use two `psql` sessions, A and B:

```sql
-- A
BEGIN;                                                    -- Read Committed
SELECT status FROM orders WHERE id = 107;                 -- 'new'
-- B (autocommit)
UPDATE orders SET status = 'paid' WHERE id = 107;
-- A
SELECT status FROM orders WHERE id = 107;                 -- 'paid'  (changed inside one transaction)
COMMIT;
```

Repeat with `BEGIN ISOLATION LEVEL REPEATABLE READ;` in A. The second read in A still shows `'new'`, because A keeps the snapshot it took at its first query. After A commits, it sees `'paid'`.

Behaviour of the strictest level: in PostgreSQL, Serializable transactions can fail with `ERROR: could not serialize access` (SQLSTATE `40001`), and the application must retry the whole transaction. Repeatable Read can fail the same way when two transactions update the same row.

MySQL InnoDB: Repeatable Read is the default, and it uses next-key locks to block phantoms for locking reads. The syntax to change it is `SET TRANSACTION ISOLATION LEVEL ...` in both.

**Follow-ups:**
- *How does PostgreSQL avoid readers blocking writers?* MVCC (multi-version concurrency control): each transaction reads a snapshot, so a reader never blocks a writer and a writer never blocks a reader. Only writers of the same row block each other.
- *What is a lost update, and how do you stop it?* Two transactions read a value, both compute a new one, the second write overwrites the first. Avoid it with an atomic update (`SET qty = qty - 1`), `SELECT ... FOR UPDATE`, or Repeatable Read or Serializable with a retry.
- *Why does a tester care?* Concurrency bugs (two users buying the last item, double submit) only appear under parallel load. I reproduce them with two sessions or parallel requests and check the final state, not the first response.

**Trap:** Reciting the standard's table without knowing that PostgreSQL's Read Uncommitted equals Read Committed and its Repeatable Read has no phantoms. Another trap: believing higher isolation is free, it costs retries and throughput.

**Source:** https://www.postgresql.org/docs/16/transaction-iso.html and https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html

### What kinds of locks exist, and what is a deadlock?

Topic: sql-core | Standard | id: q0440

**Say:** Row-level locks protect rows that a transaction changes, so two writers on the same row take turns. `SELECT ... FOR UPDATE` locks the rows I read because I will change them. Table-level locks protect the whole table, for example `TRUNCATE` or `ALTER TABLE` take an exclusive lock. A deadlock is two transactions each holding a lock the other needs, so neither can continue. PostgreSQL detects it after `deadlock_timeout` (1 second by default), aborts one transaction with an error, and the other proceeds. The fix is to take locks in the same order in all code paths, and to keep transactions short.

**Full process:** Reproduce a deadlock with two `psql` sessions.

```sql
-- A
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 107;     -- A locks order 107
-- B
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 108;     -- B locks order 108
-- A
UPDATE orders SET status = 'paid' WHERE id = 108;     -- A waits for B
-- B
UPDATE orders SET status = 'paid' WHERE id = 107;     -- B waits for A: deadlock
```

After about a second one session gets `ERROR: deadlock detected` (SQLSTATE `40P01`) and its transaction is rolled back. The other one continues. The application should retry the failed transaction.

Prevention: always update rows in the same order, for example sorted by id.

Useful locking tools: `SELECT ... FOR UPDATE NOWAIT` fails at once instead of waiting, and `FOR UPDATE SKIP LOCKED` skips locked rows, which is how a job queue table lets several workers take different rows. To see who blocks whom in PostgreSQL, query `pg_locks` and `pg_stat_activity`.

MySQL InnoDB also detects deadlocks and rolls back one transaction (error 1213). `SHOW ENGINE INNODB STATUS` shows the latest deadlock.

**Follow-ups:**
- *Lock versus latch?* Locks are logical and visible to users. Latches are short internal mutexes inside the engine. I only deal with locks.
- *A test hangs and then times out. Could it be a lock?* Yes. A test that leaves a transaction open (no commit, no rollback) can hold a row lock, and the next test waits on it. I look at `pg_stat_activity` for `idle in transaction`.

**Trap:** Saying "the database prevents deadlocks". It cannot prevent them, it detects and breaks them.

**Source:** https://www.postgresql.org/docs/16/explicit-locking.html and https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html

### What is the difference between pessimistic and optimistic locking?

Topic: sql-core | Standard | id: q0441

**Say:** Pessimistic locking locks the row when I read it, with `SELECT ... FOR UPDATE`, so nobody else can change it until I finish. Optimistic locking does not lock. It adds a version number (or an updated timestamp) to the row, and the update says "only if the version is still the one I read". If someone else changed it, the update affects 0 rows and the application retries or shows a conflict message. Optimistic fits web apps where conflicts are rare, pessimistic fits cases where a conflict is likely and expensive.

**Full process:** Optimistic update with a version column (add one to the example table first).

```sql
ALTER TABLE orders ADD COLUMN version integer NOT NULL DEFAULT 1;

-- user reads order 107 with version 1, then saves:
UPDATE orders SET status = 'paid', version = version + 1
WHERE id = 107 AND version = 1;
-- "UPDATE 1": success

-- a second user, who also read version 1, saves later:
UPDATE orders SET status = 'cancelled', version = version + 1
WHERE id = 107 AND version = 1;
-- "UPDATE 0": conflict, the app must reload and ask again
```

The check for a tester: after two parallel saves, exactly one succeeds and the other reports a conflict, and no change is lost.

**Follow-ups:**
- *How do you test it?* Send two requests that carry the same version at the same time, and assert one gets a conflict response and the final row holds one of the two values, never a mix.

**Trap:** Thinking `SELECT` then `UPDATE` in the same transaction is safe at the default isolation level. Two sessions can both read and then both write.

**Source:** https://www.postgresql.org/docs/16/explicit-locking.html

## Indexes and performance

### How does an index work and what is a B-tree?

Topic: sql-core | Standard | id: q0442

**Say:** An index is a separate sorted structure that lets the database find rows without reading the whole table, like the index at the back of a book. The default type, a B-tree, keeps keys in sorted order in a balanced tree, so a lookup takes a few steps even for millions of rows. It supports equality, ranges (`<`, `>`, `BETWEEN`), sorting and prefix `LIKE` in the right collation. The price is that every insert, update and delete must also update each index, and indexes take disk space.

**Full process:**

1. Which index does PostgreSQL create for you? One for every `PRIMARY KEY` and `UNIQUE` constraint. It does not create one for a plain foreign key column. In the seed schema, I created `orders_customer_id_idx` and `order_items_order_id_idx` by hand, because a join or a cascade delete on an unindexed foreign key scans the child table. (MySQL InnoDB creates an index on a foreign key column automatically.)

2. See the indexes on a table:

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders' ORDER BY indexname;
-- orders_customer_id_idx | CREATE INDEX orders_customer_id_idx ON public.orders USING btree (customer_id)
-- orders_pkey            | CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)
```

3. Other index types in PostgreSQL: Hash (equality only), GIN (arrays, JSON, full text, trigrams), GiST (geometry, ranges), BRIN (very large tables with naturally ordered data).

**Follow-ups:**
- *What is a clustered index?* In MySQL InnoDB the table is stored in primary key order, so the primary key is the clustered index. PostgreSQL tables are heaps, and indexes point to row locations. `CLUSTER` reorders once, but does not maintain it.
- *How do you find unused indexes?* In PostgreSQL, `pg_stat_user_indexes.idx_scan` equal to 0 over a long period.

**Trap:** "Index everything". Each index slows writes and uses space.

**Source:** https://www.postgresql.org/docs/16/indexes-types.html

### How does the column order in a composite index matter?

Topic: sql-core | Standard | id: q0443

**Say:** A composite index on `(a, b)` is sorted by `a` first and then by `b` inside each `a`. So it serves queries filtering on `a`, or on `a` and `b`, which is the leftmost-prefix rule. It does not serve a query that filters only on `b` efficiently. I put equality columns first, then the range column, and I put the most selective column first when the filters are all equalities.

**Full process:** On the 200,000-row scratch table from the measurement entry.

```sql
CREATE INDEX b_cs ON big_orders (customer_id, status) INCLUDE (ordered_at);
VACUUM ANALYZE big_orders;

EXPLAIN (COSTS OFF) SELECT customer_id, status, ordered_at FROM big_orders
WHERE customer_id = 42 AND status = 'paid';
-- Index Only Scan using b_cs on big_orders
--   Index Cond: ((customer_id = 42) AND (status = 'paid'::text))

EXPLAIN (COSTS OFF) SELECT customer_id FROM big_orders WHERE status = 'paid';
-- Seq Scan on big_orders
--   Filter: (status = 'paid'::text)
```

The first query uses both columns, so the index fits. The second filters only on the second column, so the database scans the table. In this test `status` has only 4 values, so even a skip-scan would not help much.

PostgreSQL can occasionally use a non-leading column of a multi-column index, but it scans the whole index, which is rarely better than a scan of the table. MySQL follows the same leftmost-prefix rule.

**Follow-ups:**
- *Index on (a, b) and a query ORDER BY a, b?* The index returns rows already sorted, so the database skips the sort step.
- *Two single-column indexes or one composite?* For queries that always filter on both columns, one composite index is usually better. The database can combine two single indexes (bitmap AND), but with more overhead.

**Trap:** Creating `(status, customer_id)` because "status is used everywhere". A low-selectivity column first wastes the index for queries that filter only on `customer_id`.

**Source:** https://www.postgresql.org/docs/16/indexes-multicolumn.html

### What is a covering index?

Topic: sql-core | Standard | id: q0444

**Say:** A covering index contains every column the query needs, so the database answers from the index alone without reading the table. PostgreSQL shows it as an `Index Only Scan`. I make one with `INCLUDE`, which adds extra columns to the index that are not part of the search key. It is a read optimization with a write cost. It also needs a recently vacuumed table, because the visibility map decides if a row is visible without touching the table.

**Full process:** The `b_cs` index above has `INCLUDE (ordered_at)`. The query `SELECT customer_id, status, ordered_at WHERE customer_id = 42 AND status = 'paid'` runs as an `Index Only Scan`, because all three columns are in the index. Without the `INCLUDE`, the plan would visit the table for `ordered_at`. `SELECT *` breaks it, because other columns are not in the index.

If the plan shows `Heap Fetches: N` with a high number, run `VACUUM` on the table so the visibility map is current.

`INCLUDE` exists in PostgreSQL 11 and later. MySQL has no `INCLUDE`, but a composite index containing all selected columns covers the query too (`Using index` in `EXPLAIN`).

**Follow-ups:**
- *Why not include every column?* The index becomes as large as the table and slows every write.

**Trap:** Expecting an index-only scan right after loading data. Until `VACUUM` (or autovacuum) runs, PostgreSQL still visits the table.

**Source:** https://www.postgresql.org/docs/16/indexes-index-only-scans.html

### When is an index not used?

Topic: sql-core | Standard | id: q0445

**Say:** The common causes are: the query returns a large part of the table, so a scan is cheaper. A function or cast wraps the indexed column. The pattern starts with a wildcard. The filter is on a non-leading column of a composite index. The types do not match, so the column is cast. The statistics are old. Or the table is so small that a scan is faster. I confirm with `EXPLAIN`, never by guessing.

**Full process:** Checks to run in order.

1. `EXPLAIN` the query and read the node: `Seq Scan` with `Filter` and a big `Rows Removed by Filter` means no index was used.
2. Check the column is not wrapped: `WHERE lower(email) = ...` needs an index on `lower(email)`. `WHERE ordered_at::date = ...` needs a range instead: `ordered_at >= ... AND ordered_at < ...`.
3. Check the pattern: `LIKE '%x'` cannot use a B-tree index. A prefix `LIKE 'x%'` needs `text_pattern_ops` in a non-C collation.
4. Run `ANALYZE table;` and explain again. Stale statistics give a wrong row estimate, and the planner picks a wrong plan.
5. Check the share of rows: `WHERE status = 'paid'` returning 25% of the table is faster as a scan, so a plain index on `status` is ignored. A partial index (`CREATE INDEX ... ON orders (id) WHERE status = 'new'`) fits a small hot subset.
6. Check the types: a `text` column compared to a number, or `integer` against `numeric`, can force a cast on the column.

To prove the planner could use an index, temporarily run `SET enable_seqscan = off;` in your session and explain again. Never leave it on, and never set it in production.

**Follow-ups:**
- *Why does the plan change when the table grows?* The planner estimates cost from statistics. A plan that is right for 20 rows is wrong for 2 million.

**Trap:** Forcing the index with hints. PostgreSQL has no query hints by design. Fix statistics, the query, or the index.

**Source:** https://www.postgresql.org/docs/16/indexes-expressional.html

### How do you read the output of EXPLAIN and EXPLAIN ANALYZE?

Topic: sql-core | Standard | id: q0446

**Say:** I read it from the innermost, most indented node upwards. Each node shows the operation, estimated cost and rows, and with `ANALYZE` the actual time and actual rows. The first things I check: the scan type (`Seq Scan`, `Index Scan`, `Bitmap Heap Scan`, `Index Only Scan`), the join type (`Nested Loop`, `Hash Join`, `Merge Join`), estimated rows against actual rows (a big gap means bad statistics), `Rows Removed by Filter`, and `loops`. Cost numbers are the planner's own units, not milliseconds.

**Full process:**

1. Run `EXPLAIN (ANALYZE, BUFFERS) <query>;` and take the sample from a join query on the seed tables:

```sql
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT c.name, COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name;
```

2. Read each node:
   - Scan nodes tell how rows are read. `Seq Scan` reads the whole table, `Index Scan` walks an index and fetches rows, `Bitmap Heap Scan` collects row locations from an index, then reads pages in order. `Index Only Scan` never visits the table.
   - Join nodes tell how tables are combined. `Nested Loop` repeats an inner lookup per outer row (good for few outer rows and an index). `Hash Join` builds a hash table of one side (good for large unsorted sets). `Merge Join` merges two sorted inputs.
   - `actual rows` against `rows` (estimate): a gap of 10x or more points to stale or missing statistics.
   - `loops`: the node ran this many times. Multiply actual time by loops to get the total.
   - `Buffers: shared hit` is memory, `read` is disk. A lot of `read` on the repeat run means the data does not fit in cache.
   - `Sort Method: external merge` means the sort spilled to disk, so `work_mem` is too low.

3. Compare before and after the change with the same data. Keep the plans in the ticket.

MySQL: `EXPLAIN` shows a table with `type` (`ALL` is a full scan, `ref`, `range`, `const`), `key` (the index used), `rows` and `Extra` (`Using filesort`, `Using temporary`, `Using index`). `EXPLAIN ANALYZE` exists from 8.0.18 and prints a tree like PostgreSQL's.

**Follow-ups:**
- *Is the plan with the lowest cost always the fastest?* No. Cost is an estimate. The measured time from `ANALYZE` is the final word.
- *Does EXPLAIN ANALYZE change the data?* Yes, for writes. Wrap it in `BEGIN` and `ROLLBACK`.

**Trap:** Reading the cost as milliseconds, or reading only the top line. The slow step is often a nested node that ran thousands of times.

**Source:** https://www.postgresql.org/docs/16/using-explain.html

### What is the N+1 query problem?

Topic: sql-core | Standard | id: q0447

**Say:** The N+1 problem is one query to fetch a list, and then one more query for each item in the list. With 100 customers that is 101 queries instead of 1 or 2. It often comes from an ORM that loads related rows lazily. Each query is fast, but the sum is slow, and it grows with the data. The fix is one join, or two queries where the second uses `IN (...)` with all ids.

**Full process:**

```sql
-- N+1: 1 query, then one per customer
SELECT id FROM customers;                          -- 6 rows
SELECT COUNT(*) FROM orders WHERE customer_id = 1; -- repeated 6 times

-- Fixed: one query
SELECT c.id, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id ORDER BY c.id;
```

How a tester finds it: turn on statement logging (`log_statement = 'all'` in a test database, or `pg_stat_statements`) and count statements for one page load. If the count grows with the number of rows shown, it is N+1. In the browser, the sign is many near-identical API calls.

**Follow-ups:**
- *Is a join always the answer?* Not always. A join of several one-to-many tables multiplies rows. Sometimes two queries are cheaper than one huge join.

**Trap:** Looking at only the slow query log. Each query is fast, so none shows as slow.

**Source:** https://www.postgresql.org/docs/16/runtime-config-logging.html

### What is a query plan cache and parameterized query, and why do they matter?

Topic: sql-core | Standard | id: q0448

**Say:** A parameterized (prepared) query separates the SQL text from the values: `WHERE email = $1`. It is the main defense against SQL injection, because the value is never parsed as SQL. It can also let the database reuse the parsed query. Building SQL by gluing strings with user input is the dangerous way.

**Full process:**

```sql
PREPARE find_customer (text) AS SELECT id, name FROM customers WHERE email = $1;
EXECUTE find_customer('ben@example.com');          -- 2 | Ben Carter
EXECUTE find_customer($$x' OR '1'='1$$);           -- 0 rows, the text is just a value
```

In application code the driver does this for you: pass values as parameters, never concatenate them into the SQL string.

**Follow-ups:**
- *How do you test for SQL injection?* Send quotes, `' OR '1'='1`, and comment markers in each input and look for errors, changed results or delays. Automated tools help, but the proof is a parameterized query in the code.

**Trap:** Believing that escaping quotes by hand is as good as parameters.

**Source:** https://www.postgresql.org/docs/16/sql-prepare.html

## Schema design, constraints and database objects

### What are the normal forms? Give an example of 1NF, 2NF and 3NF.

Topic: sql-core | Standard | id: q0449

**Say:** Normalization removes redundancy step by step. First normal form (1NF): every column holds one atomic value and there are no repeating groups, so no "phone1, phone2, phone3" columns and no comma-separated lists in a cell. Second normal form (2NF): it is in 1NF, and every non-key column depends on the whole key, not just part of a composite key. Third normal form (3NF): it is in 2NF, and no non-key column depends on another non-key column, which means no transitive dependency. A short memory line: every column depends on the key, the whole key and nothing but the key.

**Full process:** One bad table, fixed in three steps.

1. Start. A flat table with one row per order, where `items` holds a list:

```
order_id | customer_name | customer_email   | customer_country | country_name | items
101      | Anna Nowak    | anna@example.com | PL               | Poland       | KEYBOARD, MOUSE x2
```

2. 1NF: split `items` into one row per item, each cell atomic. The table now has one row per order line, keyed by `(order_id, sku)`.

```
order_id | sku      | quantity | customer_name | customer_email | customer_country | country_name
```

3. 2NF: `customer_name`, `customer_email` and the country columns depend on `order_id` only, which is half of the key `(order_id, sku)`. Move them out into `orders`. `quantity` depends on the whole key and stays in `order_items`.

4. 3NF: in `orders`, `country_name` depends on `customer_country`, which is not the key (`order_id`). That is a transitive dependency. In the same way the customer's name and email depend on the customer, not on the order. Move customer data to `customers`, keep `customer_id` in `orders`, and put country names in a `countries` table, or drop the column and compute it in the UI.

The result is the schema at the top of this file.

**Follow-ups:**
- *What is BCNF?* A stricter 3NF: every determinant of a dependency must be a candidate key. It matters only in rare tables with overlapping candidate keys.
- *Is normalizing to 3NF always right?* For transactional systems, usually yes. For reporting, denormalized tables are often better.

**Trap:** Reciting the definitions without an example. Interviewers ask "show me a table that violates 2NF".

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### What is denormalization and when do you use it?

Topic: sql-core | Standard | id: q0450

**Say:** Denormalization means storing some data twice, or storing precomputed values, to make reads faster or simpler. I accept it when the read path is much busier than the write path and the join cost is real: reporting tables, a cached order total, a count column. The price is that the copy can go stale, so I need one defined owner for the value and a way to keep it in sync, such as a trigger, a job, or a materialized view. A legitimate case in the sample schema is `order_items.unit_price`: it is a copy of the product price at the time of purchase, and it must not change when the catalog changes.

**Full process:** Check a denormalized value against its source. Say `orders` had a stored `total` column:

```sql
-- rows where a stored total disagrees with the sum of the items
SELECT o.id, o.total AS stored, SUM(i.quantity * i.unit_price) AS computed
FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id, o.total
HAVING o.total <> SUM(i.quantity * i.unit_price);
```

Every row returned is a consistency bug. (Not runnable on the seed schema, which has no `total` column. In a real system, this query is a good scheduled check.)

**Follow-ups:**
- *How would you keep the copy right?* Update it in the same transaction as the source, or use a trigger, or recompute on a schedule, and monitor drift with a query like the one above.

**Trap:** Denormalizing "for speed" before measuring. Fix the query and the indexes first.

**Source:** https://www.postgresql.org/docs/16/rules-materializedviews.html

### What constraints exist, and why do they matter?

Topic: sql-core | Standard | id: q0451

**Say:** Constraints are rules the database enforces on every write. `PRIMARY KEY` identifies a row and cannot be `NULL`. `UNIQUE` blocks duplicates and allows `NULL`s. `FOREIGN KEY` makes a value point to an existing row in another table. `NOT NULL` forbids missing values. `CHECK` enforces a condition, such as `quantity > 0`. `DEFAULT` fills a value when none is given. They matter because a rule in the database cannot be bypassed by a bug in one service, a script or a manual fix. For a tester they are also a list of test cases: each constraint is a negative test.

**Full process:** Each constraint in the seed schema, with the failing insert and the exact error.

```sql
-- NOT NULL
INSERT INTO customers (name, email, country, created_at) VALUES (NULL, 'n@x.com', 'PL', '2026-01-01');
-- ERROR: null value in column "name" of relation "customers" violates not-null constraint

-- UNIQUE
INSERT INTO customers (name, email, country, created_at) VALUES ('X', 'ben@example.com', 'PL', '2026-01-01');
-- ERROR: duplicate key value violates unique constraint "customers_email_key"

-- CHECK
INSERT INTO order_items (id, order_id, sku, quantity, unit_price) VALUES (99, 101, 'MOUSE', 0, 20);
-- ERROR: new row for relation "order_items" violates check constraint "order_items_quantity_check"

INSERT INTO orders (id, customer_id, status, ordered_at) VALUES (130, 1, 'refunded', now());
-- ERROR: new row for relation "orders" violates check constraint "orders_status_check"

-- FOREIGN KEY
INSERT INTO orders (id, customer_id, status, ordered_at) VALUES (131, 99, 'new', now());
-- ERROR: insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey"

-- PRIMARY KEY
INSERT INTO orders (id, customer_id, status, ordered_at) VALUES (101, 1, 'new', now());
-- ERROR: duplicate key value violates unique constraint "orders_pkey"
```

Add a constraint to an existing table: `ALTER TABLE orders ADD CONSTRAINT ... CHECK (...) NOT VALID;` adds it without scanning old rows, and `VALIDATE CONSTRAINT` checks them later with a lighter lock.

MySQL: `CHECK` is enforced from MySQL 8.0.16. Earlier versions parsed and ignored it.

**Follow-ups:**
- *Primary key versus unique key?* A table has one primary key and it cannot be `NULL`. It can have many unique keys, and they allow `NULL`s.
- *Surrogate versus natural key?* A surrogate key is a generated id with no business meaning (`id`). A natural key is real data (an email). I use a surrogate primary key, and a `UNIQUE` constraint on the natural key.
- *Is a rule in the application enough?* No. Two services, a script, or a race between two requests can still write bad data. Keep the rule in the database too.

**Trap:** Saying only what each constraint is, without how to test it. For every constraint, I write one test that tries to break it.

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### What are the foreign key actions (ON DELETE and ON UPDATE)?

Topic: sql-core | Standard | id: q0452

**Say:** The action says what happens to child rows when the parent row is deleted or its key is changed. `NO ACTION` (default) and `RESTRICT` reject the change. `CASCADE` applies the change to the children: delete the parent and the children are deleted too. `SET NULL` sets the child's reference to `NULL`. `SET DEFAULT` sets it to the column default. The difference between `NO ACTION` and `RESTRICT` in PostgreSQL is that `NO ACTION` can be deferred to the end of the transaction, `RESTRICT` cannot.

**Full process:** In the seed schema the two actions are visible.

```sql
-- orders.customer_id ... ON DELETE RESTRICT
BEGIN; DELETE FROM customers WHERE id = 4; ROLLBACK;
-- ERROR: update or delete on table "customers" violates foreign key constraint "orders_customer_id_fkey" on table "orders"

-- order_items.order_id ... ON DELETE CASCADE
BEGIN; DELETE FROM orders WHERE id = 101;
SELECT COUNT(*) FROM order_items WHERE order_id = 101;    -- 0
ROLLBACK;
```

Deleting customer 1 fails for another reason too: other customers reference it in `referred_by` (default `NO ACTION`), which gives `violates foreign key constraint "customers_referred_by_fkey"`. A self-referencing foreign key is still a foreign key.

PostgreSQL does not index the child column of a foreign key by itself. Without an index on `order_items.order_id`, every parent delete scans the child table.

**Follow-ups:**
- *When is CASCADE dangerous?* One `DELETE` can remove a large tree of data, and tests or admin scripts can wipe more than intended. I prefer `RESTRICT` for business data and `CASCADE` for owned parts, like order items of an order.
- *What does a test look like?* Delete the parent in the test database and assert the children according to the rule: gone for `CASCADE`, an error for `RESTRICT`.

**Trap:** Mixing up `TRUNCATE` and `DELETE`: `TRUNCATE` does not follow the `ON DELETE` rule, it simply refuses (see the real screening question above).

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### What is the difference between a stored procedure, a function and a trigger?

Topic: sql-core | Standard | id: q0453

**Say:** A stored procedure is a named block of SQL saved in the database that I run with `CALL`. A function does the same but returns a value and can be used inside a query. In PostgreSQL 11 and later, a procedure can control transactions (commit inside), and a function cannot. A trigger is code that runs by itself on an event: `INSERT`, `UPDATE`, `DELETE` or `TRUNCATE`, before or after, for each row or for the statement. Triggers are useful for audit logs and derived data, but they hide behavior, so I look for them when a test shows an unexpected data change.

**Full process:**

1. Procedure:

```sql
CREATE PROCEDURE cancel_order(p_id integer) LANGUAGE sql AS $$
  UPDATE orders SET status = 'cancelled' WHERE id = p_id AND status IN ('new', 'paid');
$$;

BEGIN; CALL cancel_order(107);
SELECT status FROM orders WHERE id = 107;      -- cancelled
ROLLBACK;
```

2. Trigger that writes an audit row:

```sql
CREATE TABLE audit (id serial, tbl text, op text, row_id int, at timestamptz DEFAULT now());

CREATE FUNCTION log_order_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit (tbl, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id));
  RETURN NULL;
END $$;

CREATE TRIGGER orders_audit AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_change();

BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 107;
DELETE FROM orders WHERE id = 110;
SELECT tbl, op, row_id FROM audit ORDER BY id;
ROLLBACK;
```

```
  tbl   |   op   | row_id
--------+--------+--------
 orders | UPDATE |    107
 orders | DELETE |    110
```

A row-level `DELETE` trigger does not fire on `TRUNCATE orders CASCADE`: the audit table stays empty. That is a test case for any audit requirement.

MySQL: `CREATE PROCEDURE ... BEGIN ... END` with `DELIMITER` in the client, `CALL` the same. Trigger syntax is `CREATE TRIGGER ... FOR EACH ROW`, with `NEW` and `OLD`, and no trigger on `TRUNCATE`.

**Follow-ups:**
- *Do you test stored procedures?* Yes, as a black box: call it with valid, edge and invalid input, and assert the rows it changes and the error it raises, in a rolled-back transaction.
- *What are the downsides of business logic in the database?* It is hard to version, review and debug, and it hides side effects. It is fast and close to the data.

**Trap:** Forgetting that triggers fire inside the same transaction. If the trigger fails, the original statement fails.

**Source:** https://www.postgresql.org/docs/16/sql-createprocedure.html and https://www.postgresql.org/docs/16/sql-createtrigger.html

### What are DDL, DML, DCL and TCL?

Topic: sql-core | Standard | id: q0454

**Say:** They are groups of SQL commands. DDL (data definition) defines structure: `CREATE`, `ALTER`, `DROP`, and in most classifications `TRUNCATE`. DML (data manipulation) changes data: `INSERT`, `UPDATE`, `DELETE`, `MERGE`. Many people put `SELECT` in DML, others call it DQL (query). DCL (data control) manages permissions: `GRANT`, `REVOKE`. TCL (transaction control) is `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`. In PostgreSQL DDL is transactional, in MySQL it commits implicitly.

**Full process:** A least-privilege role for a test that only reads:

```sql
CREATE ROLE qa_reader LOGIN PASSWORD 'change-me';
GRANT CONNECT ON DATABASE postgres TO qa_reader;
GRANT USAGE ON SCHEMA public TO qa_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO qa_reader;
-- qa_reader can now SELECT, and INSERT fails: ERROR: permission denied for table orders
```

Each line above is DCL. I use a read-only role when a test only needs to check the database, so a bug in the test cannot change data.

**Follow-ups:**
- *Is TRUNCATE DDL or DML?* It behaves like `DELETE` of all rows, but most databases classify it as DDL. In MySQL it commits implicitly. In PostgreSQL it is transaction-safe.
- *What is MERGE?* A statement (PostgreSQL 15 and later, and the SQL standard) that inserts, updates or deletes depending on a match. PostgreSQL also has `INSERT ... ON CONFLICT DO UPDATE`, and MySQL has `INSERT ... ON DUPLICATE KEY UPDATE`.

**Trap:** Saying `SELECT` is DML without noting that classifications differ. Say "DML or DQL, depending on the book".

**Source:** https://www.postgresql.org/docs/16/sql-commands.html

### Which data type do you use for money, ids and timestamps?

Topic: sql-core | Standard | id: q0455

**Say:** For money I use `numeric` (or `decimal`) with a fixed scale, never `float`, because binary floating point cannot store 0.1 exactly and the errors add up. Some systems store the amount in the smallest unit as an integer (cents). For ids I use `integer` or `bigint` with an identity column, or `uuid` when ids must be created outside the database. For points in time I use `timestamptz` in PostgreSQL and store UTC. I use `text` or `varchar` for strings, and in PostgreSQL there is no performance difference between them.

**Full process:**

```sql
SELECT 0.1::float8 + 0.2::float8 = 0.3::float8   AS float_equal,     -- false
       0.1::numeric + 0.2::numeric = 0.3::numeric AS numeric_equal;  -- true
```

Output: `float_equal f`, `numeric_equal t`. The seed schema uses `numeric(10,2)` for `unit_price`.

MySQL: `DECIMAL(10,2)`, `BIGINT UNSIGNED AUTO_INCREMENT`, `DATETIME` or `TIMESTAMP`. `varchar` needs a length.

**Follow-ups:**
- *Integer id overflow?* `integer` ends at about 2.1 billion. A busy table can pass it, so `bigint` is the safe choice for event tables.

**Trap:** Testing money with `float` in the test code too (`0.1 + 0.2` in JavaScript). Compare as integers (cents) or use a decimal library.

**Source:** https://www.postgresql.org/docs/16/datatype-numeric.html

## SQL for a QA engineer

### How do you verify data in the database after an action in the UI?

Topic: sql-core | Standard | id: q0456

**Say:** Do the action in the UI, then read the database to check the effect was really stored, not just shown. Find the row by something unique to the test, such as a generated email, and check the whole business effect: the row itself, its related rows, the status, the counts, and that nothing unrelated changed. Data often lands a moment later (queues, background jobs), so poll the query until the expected state appears, with a deadline, and never use a fixed sleep. Use a read-only database user for these checks.

**Full process:**

1. In the test, create a customer with a unique email, for example `qa-<timestamp>@example.com`, and keep the value.
2. Do the UI action (place an order).
3. Query with the unique value:

```sql
SELECT c.email, o.id AS order_id, o.status, i.sku, i.quantity
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
WHERE c.email = 'ben@example.com'
  AND o.ordered_at = (SELECT MAX(ordered_at) FROM orders WHERE customer_id = c.id)
ORDER BY i.id;
```

On the seed data the output is one row: `ben@example.com | 104 | cancelled | MOUSE | 1`.

4. In a Playwright test, poll the database query until the state appears. The helper is yours (a function that runs the SQL through a driver such as `pg`):

```ts
import { expect, test } from '@playwright/test';
import { queryOrders } from './db'; // your helper: runs the SELECT above with a parameter

test('new order is stored', async ({ page }) => {
  const email = `qa-${Date.now()}@example.com`;
  // ... create the customer and place an order in the UI ...
  await expect
    .poll(async () => (await queryOrders(email)).map((r) => r.status), { timeout: 15_000 })
    .toEqual(['paid']);
});
```

`expect.poll` retries the function until the assertion holds or the timeout runs out. It replaces a fixed sleep. Pass the email as a query parameter (`$1`), never glue it into the SQL.

5. Also check what should not have happened: row counts of unrelated tables, and that there is no duplicate (a double click must create one order, not two).

**Follow-ups:**
- *Why not trust the UI?* A UI can show optimistic or cached data. The database is the record. I check both: the UI says it, and the data confirms it.
- *Which environment do you query?* Only the test or staging database. Never production for a test, and never through a user that can write.

**Trap:** `SELECT * FROM orders ORDER BY id DESC LIMIT 1`. On a shared environment the newest row may belong to another test or person. Always filter by a value only your test created.

**Source:** https://playwright.dev/docs/test-assertions#expectpoll

### How do you set up and clean up test data in a database?

Topic: sql-core | Standard | id: q0457

**Say:** Each test creates the data it needs, with unique values, and removes it afterwards, so tests do not depend on each other or on run order. I create data through the product's API or a seed script, not by clicking through the UI, because it is faster and less flaky. For cleanup I delete only the rows my test created, found by a test-owned key, in an order that respects foreign keys (children first), or I rely on `ON DELETE CASCADE` where it is designed in. I do not `TRUNCATE` a shared environment. A good run ends with the account holding zero leftovers.

**Full process:**

1. Seed with explicit, unique, recognizable values (the sample seed does this: ids and emails are fixed).
2. Make each test own its data: a per-test email or id prefix, for example `qa-<run id>-<test id>`.
3. Clean up by owner key. Delete children first, or rely on the cascade:

```sql
BEGIN;
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = 1);
DELETE FROM orders WHERE customer_id = 1;
DELETE FROM customers WHERE id = 1;
-- ERROR: still referenced by customers 2 and 3 through referred_by: clean those rows first
ROLLBACK;
```

4. Verify the cleanup: a count query by the owner key must return 0.
5. For fast isolation in a database-level test suite, run each test in a transaction and roll it back at the end, or restore a template database (`CREATE DATABASE test_db TEMPLATE seed_db`). In end-to-end tests that go through a real application, a rolled-back transaction is not possible, because the application commits on its own connection.
6. On failure, clean up too: cleanup belongs in a fixture teardown that runs after a failed test.

**Follow-ups:**
- *Parallel workers share a database. How do you avoid collisions?* Unique keys per test, or one schema, project or account per worker. No test may depend on a global count.
- *Why not rely on a nightly reset?* A test that leaves data behind breaks the next run in the same day, and the cause is hard to find.

**Trap:** A cleanup that deletes by a broad filter (`DELETE ... WHERE status = 'new'`). It can delete another team's or another test's rows.

**Source:** https://www.postgresql.org/docs/16/sql-createdatabase.html

### How do you check a data migration with SQL (before and after comparison)?

Topic: sql-core | Standard | id: q0458

**Say:** I compare old and new in layers, cheapest first. First, row counts per table. Second, a checksum or aggregate per table or per column (sum of amounts, min and max dates, count of distinct keys). Third, a full row diff with `EXCEPT` in both directions, mapping columns where the new schema differs. Then I look for specific problems: orphan rows, duplicates, `NULL`s that were not `NULL` before, and changed formats such as time zones and encodings. I also sample rows by hand, because queries only check what I thought to ask.

**Full process:** Simulate a migration with a copy and three differences. Run it in one transaction and roll back.

```sql
BEGIN;
CREATE TEMP TABLE orders_before AS SELECT * FROM orders;       -- the "old" side

UPDATE orders SET status = 'shipped' WHERE id = 105;           -- a changed value
DELETE FROM orders WHERE id = 110;                             -- a lost row
INSERT INTO orders (id, customer_id, status, ordered_at)
VALUES (111, 5, 'new', '2026-04-11 09:00');                    -- an extra row

-- rows in the old data that are missing or different in the new data
SELECT 'before' AS side, * FROM (SELECT * FROM orders_before EXCEPT SELECT * FROM orders) a ORDER BY id;
-- rows in the new data that are missing or different in the old data
SELECT 'after' AS side, * FROM (SELECT * FROM orders EXCEPT SELECT * FROM orders_before) b ORDER BY id;
ROLLBACK;
```

```
  side  | id  | customer_id | status |     ordered_at      | coupon
--------+-----+-------------+--------+---------------------+--------
 before | 105 |           3 | paid   | 2026-03-02 08:00:00 |
 before | 110 |           4 | paid   | 2026-04-10 10:30:00 |

 side  | id  | customer_id | status  |     ordered_at      | coupon
-------+-----+-------------+---------+---------------------+--------
 after | 105 |           3 | shipped | 2026-03-02 08:00:00 |
 after | 111 |           5 | new     | 2026-04-11 09:00:00 |
```

Reading it: id 105 appears on both sides (changed), id 110 only in "before" (lost), id 111 only in "after" (extra). With real databases on two servers, `EXCEPT` cannot join them. Either load both sets into one place, or compare per-table counts and checksums computed on each side.

For a large table, compare in key ranges (for example by id bucket), so a mismatch narrows down fast.

**Follow-ups:**
- *What can a count match hide?* A table with the same number of rows can have wrong values. A count is the fast first check, not the proof.
- *What do you do when the new schema differs?* Write the mapping as a query: select from the old tables with the transformation, then `EXCEPT` against the new table. The mapping query is the test's expected result.
- *What do you do with legitimate differences?* List them with the reason (for example "trimmed whitespace", "time zone converted to UTC") and exclude them from the diff in code, so the remaining differences are all real.

**Trap:** Declaring success on "row counts match". Also, comparing in one direction only.

**Source:** https://www.postgresql.org/docs/16/queries-union.html

### How do you use row counts and checksums to compare two tables?

Topic: sql-core | Standard | id: q0459

**Say:** A row count is the fastest check. A checksum goes further: I build one string per row from all the columns in a fixed order, join the rows ordered by key, and hash the result. If the hashes are equal on both sides, the content is the same, and if not, I know which table to look into. It only says "same or different", so I use `EXCEPT` or key-range checks afterwards to find where. I handle `NULL` explicitly, otherwise `NULL` and an empty string look the same.

**Full process:**

```sql
SELECT 'orders' AS tbl,
       COUNT(*) AS row_count,
       md5(string_agg(concat_ws('|', id, customer_id, status, ordered_at, COALESCE(coupon, '<null>')),
                      E'\n' ORDER BY id)) AS checksum
FROM orders;
```

```
  tbl   | row_count |             checksum
--------+-----------+----------------------------------
 orders |        10 | 11acfbb448ef788d485f58c8834afdb8
```

Run the same query on both sides. The checksum above is the value for the seed data. Why each choice: `ORDER BY id` inside `string_agg` makes the order the same on both sides. `concat_ws` with a separator avoids `('ab','c')` and `('a','bc')` colliding. `COALESCE(coupon, '<null>')` makes `NULL` visible, because `concat_ws` skips `NULL` arguments. The format of timestamps must be the same on both sides, so cast to text explicitly if the databases differ.

Cheap aggregates catch many errors too: `SUM(unit_price * quantity)`, `MIN(ordered_at)`, `MAX(ordered_at)`, `COUNT(DISTINCT customer_id)`.

MySQL: `MD5(GROUP_CONCAT(CONCAT_WS('|', ...) ORDER BY id SEPARATOR '\n'))`, and raise `group_concat_max_len`, because the default (1,024 bytes) cuts the string off with only a warning (`Row 1 was cut by GROUP_CONCAT()`). MySQL also has `CHECKSUM TABLE`, but its value depends on the storage format and is not comparable across engines or servers of different versions.

**Follow-ups:**
- *Is md5 secure enough?* Not for security, and it is fine here. The goal is to detect accidental differences.
- *A table with 500 million rows?* Hash by key range (buckets) and compare bucket by bucket, in parallel.

**Trap:** `string_agg` without `ORDER BY`. The row order is not guaranteed, so equal data can produce different hashes.

**Source:** https://www.postgresql.org/docs/16/functions-aggregate.html

### How do you find orphan rows and missing related rows?

Topic: sql-core | Standard | id: q0460

**Say:** An orphan is a child row whose parent does not exist. I find it with a `LEFT JOIN` from the child to the parent and keep rows where the parent id is `NULL`, or with `NOT EXISTS`. With foreign keys in the database the result must be empty. I run it on migrated data and on tables where constraints were added late, or are off, which is common in imports. The mirror check finds parents that lack an expected child, such as an order with no items.

**Full process:**

```sql
-- items whose order does not exist (must be 0 rows with a foreign key)
SELECT i.id, i.order_id
FROM order_items i LEFT JOIN orders o ON o.id = i.order_id
WHERE o.id IS NULL;
```

Output on the seed data: 0 rows.

```sql
-- orders that have no items (can be legitimate: a draft)
SELECT o.id
FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
WHERE i.id IS NULL;
```

Output: `110`. A question for the product owner: should a paid order exist without items?

Also check that a foreign key exists at all:

```sql
SELECT conname, conrelid::regclass AS child, confrelid::regclass AS parent
FROM pg_constraint WHERE contype = 'f' ORDER BY conname;
```

On the seed schema this lists three foreign keys: `customers_referred_by_fkey`, `order_items_order_id_fkey`, `orders_customer_id_fkey`.

**Follow-ups:**
- *How can orphans exist when you have a foreign key?* The constraint was added `NOT VALID`, it was disabled during an import (`session_replication_role = replica` or `FOREIGN_KEY_CHECKS=0` in MySQL), or the data comes from a system without constraints.

**Trap:** Trusting the schema. Ask for the constraint list and check that the queries return zero.

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### Which database-level checks catch bugs that UI tests miss?

Topic: sql-core | Standard | id: q0461

**Say:** UI tests see what is displayed. Database checks see what is stored. I use them for: duplicates created by a double submit, wrong status or timestamps, missing related rows, leftover test data, wrong totals (a stored sum against the sum of the items), soft-deleted rows that still appear, wrong time zone or rounding, and changes to rows the user did not touch. I run them as short queries after a flow, and some as a scheduled health check.

**Full process:** Four ready queries on the seed schema.

```sql
-- 1. duplicates by business key (should be 0 rows)
SELECT email, COUNT(*) FROM customers GROUP BY email HAVING COUNT(*) > 1;

-- 2. impossible values (should be 0 rows)
SELECT id FROM order_items WHERE quantity <= 0 OR unit_price < 0;

-- 3. future dates (should be 0 rows)
SELECT id FROM orders WHERE ordered_at > now();

-- 4. paid orders without items (should be 0 rows, order 110 is a known data issue)
SELECT o.id FROM orders o
WHERE o.status IN ('paid', 'shipped')
  AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);
```

Queries 1 to 3 return nothing on the seed data. Query 4 returns `110`.

**Follow-ups:**
- *How do you pick which checks to write?* From the constraints, the business rules and the bugs found before: each past data bug becomes one check.

**Trap:** Writing checks that pass on empty data. Run them against data that includes a deliberate violation once, to see the check fail.

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### Which SQL mistakes do you see in test code?

Topic: sql-core | Standard | id: q0462

**Say:** Building the query by string concatenation, which allows SQL injection and breaks on quotes. Asserting on `ORDER BY` data without an order. Using `LIMIT 1` without `ORDER BY`. Selecting the newest row on a shared database. Leaving a transaction open so later tests wait on a lock. Using fixed sleeps instead of polling for the state. And checking only the count where the values matter.

**Full process:** For each mistake, the fix: parameters instead of string building, an explicit `ORDER BY` with a tie-break, a filter by a test-owned key, `COMMIT` or `ROLLBACK` in a `finally` or teardown, `expect.poll` with a deadline, and a row comparison next to the count.

**Follow-ups:**
- *How do you find an open transaction left by a test?* `SELECT pid, state, query FROM pg_stat_activity WHERE state = 'idle in transaction';`

**Trap:** Believing a query without `ORDER BY` returns rows in insertion order. It often does on small tables and then stops doing so.

**Source:** https://www.postgresql.org/docs/16/monitoring-stats.html

## Hands-on query tasks (25)

Run the seed block first. Every query below was run on PostgreSQL 16 against that seed, and the rows shown are the real output. Cover the solution, write the query yourself, then compare. MySQL differences are noted where they exist.

### Task 1: List the customers from Poland, sorted by name.

Topic: sql-core | Standard | id: q0463

**Say:** Filter with `WHERE country = 'PL'` and sort with `ORDER BY`. I add `id` as a second sort key so the order of the two Annas is the same on every run.

**Full process:**

```sql
SELECT id, name, email FROM customers WHERE country = 'PL' ORDER BY name, id;
```

```
 id |      name       |       email
----+-----------------+--------------------
  1 | Anna Nowak      | anna@example.com
  6 | Anna Nowak      | anna.n@example.org
  4 | Dawid Zielinski | dawid@example.com
```

**Follow-ups:**
- *Why is the country column `char(2)` safe to compare with 'PL'?* Both are two characters. With `char(n)` the trailing spaces are padded and ignored in comparisons, which is another reason many teams use `text` instead.

**Trap:** `ORDER BY name` alone leaves ties in an undefined order, which makes a test that asserts the list flaky.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### Task 2: Count the orders per customer, including customers with none.

Topic: sql-core | Standard | id: q0464

**Say:** `LEFT JOIN` from customers to orders so customers without orders stay, and `COUNT(o.id)`, not `COUNT(*)`, so a missing order counts as 0. I group by `c.id` too, because two customers share a name.

**Full process:**

```sql
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name ORDER BY c.id;
```

```
 id |      name       | orders
----+-----------------+--------
  1 | Anna Nowak      |      3
  2 | Ben Carter      |      2
  3 | Clara Diaz      |      3
  4 | Dawid Zielinski |      2
  5 | Eva Kral        |      0
  6 | Anna Nowak      |      0
```

**Follow-ups:**
- *What changes with an INNER JOIN?* Customers 5 and 6 disappear.

**Trap:** `COUNT(*)` after a `LEFT JOIN` returns 1 for customers with no orders.

**Source:** https://www.postgresql.org/docs/16/queries-table-expressions.html

### Task 3: Find the customers who have never placed an order.

Topic: sql-core | Standard | id: q0465

**Say:** `NOT EXISTS` with a correlated subquery. It is safe with `NULL` and reads like the question. The alternative is `LEFT JOIN ... WHERE o.id IS NULL`, which returns the same rows.

**Full process:**

```sql
SELECT c.id, c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
ORDER BY c.id;
```

```
 id |    name
----+------------
  5 | Eva Kral
  6 | Anna Nowak
```

**Follow-ups:**
- *Why not NOT IN?* A `NULL` in the subquery result makes it return nothing. Here `customer_id` is `NOT NULL`, but the habit protects you in other tables.

**Trap:** `NOT IN (SELECT customer_id FROM orders)` on a nullable column.

**Source:** https://www.postgresql.org/docs/16/functions-subquery.html

### Task 4: Show the total of every order, including an order that has no items.

Topic: sql-core | Standard | id: q0466

**Say:** Join items with `LEFT JOIN` from orders, because order 110 has no items, and sum quantity times unit price. The total of order 110 is `NULL`, which is the honest answer. I use `COALESCE(..., 0)` only if the report must show 0.

**Full process:**

```sql
SELECT o.id AS order_id, o.status, SUM(i.quantity * i.unit_price) AS total
FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
GROUP BY o.id, o.status ORDER BY o.id;
```

```
 order_id |  status   | total
----------+-----------+--------
      101 | paid      |  90.00
      102 | shipped   | 200.00
      103 | paid      |  50.00
      104 | cancelled |  20.00
      105 | paid      | 400.00
      106 | paid      |  25.00
      107 | new       |  50.00
      108 | shipped   |  70.00
      109 | paid      | 220.00
      110 | paid      |
```

**Follow-ups:**
- *Is a paid order without items a bug?* Probably, ask the product owner. The query is the way to find it.

**Trap:** An inner join silently hides order 110, and the revenue report looks fine.

**Source:** https://www.postgresql.org/docs/16/functions-aggregate.html

### Task 5: Which customers spent more than 200 on paid or shipped orders?

Topic: sql-core | Standard | id: q0467

**Say:** Filter the order status while joining (a row filter), group by customer, and keep groups with `HAVING SUM(...) > 200`.

**Full process:**

```sql
SELECT c.name, SUM(i.quantity * i.unit_price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id AND o.status IN ('paid', 'shipped')
JOIN order_items i ON i.order_id = o.id
GROUP BY c.id, c.name
HAVING SUM(i.quantity * i.unit_price) > 200
ORDER BY spent DESC;
```

```
    name    | spent
------------+--------
 Anna Nowak | 510.00
 Clara Diaz | 425.00
```

**Follow-ups:**
- *Why is Clara 425 and not 475?* Her order 107 has status `new` and is filtered out.

**Trap:** Forgetting the status filter counts cancelled orders as revenue.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### Task 6: Find the order with the second highest total.

Topic: sql-core | Standard | id: q0468

**Say:** Compute totals in a CTE, rank them with `DENSE_RANK` descending, and keep rank 2. `DENSE_RANK` handles ties correctly.

**Full process:**

```sql
WITH totals AS (
  SELECT o.id, SUM(i.quantity * i.unit_price) AS total
  FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.id
), ranked AS (
  SELECT id, total, DENSE_RANK() OVER (ORDER BY total DESC) AS rnk FROM totals
)
SELECT id, total FROM ranked WHERE rnk = 2 ORDER BY id;
```

```
 id  | total
-----+--------
 109 | 220.00
```

**Follow-ups:**
- *Without window functions?* `SELECT DISTINCT total ... ORDER BY total DESC OFFSET 1 LIMIT 1` gives the value, 220.00.

**Trap:** `LIMIT 1 OFFSET 1` without `DISTINCT` returns the top value again when two orders tie.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### Task 7: Return the latest order of each customer.

Topic: sql-core | Standard | id: q0469

**Say:** `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC)` in a subquery, then keep `rn = 1`. PostgreSQL also allows `DISTINCT ON (customer_id)` with the same ordering.

**Full process:**

```sql
SELECT id, customer_id, ordered_at
FROM (SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC) AS rn FROM orders o) x
WHERE rn = 1 ORDER BY customer_id;
```

```
 id  | customer_id |     ordered_at
-----+-------------+---------------------
 109 |           1 | 2026-04-05 13:00:00
 104 |           2 | 2026-03-01 18:45:00
 107 |           3 | 2026-04-01 11:20:00
 110 |           4 | 2026-04-10 10:30:00
```

**Follow-ups:**
- *Why a subquery?* A window function cannot be used in `WHERE`.

**Trap:** `MAX(ordered_at)` with `GROUP BY` cannot also return the order id.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### Task 8: Rank order items by price with RANK, DENSE_RANK and ROW_NUMBER.

Topic: sql-core | Standard | id: q0470

**Say:** The three functions differ only on ties. Same `OVER (ORDER BY unit_price DESC)`, three different numbers.

**Full process:**

```sql
SELECT sku, unit_price,
       RANK()       OVER (ORDER BY unit_price DESC)     AS rnk,
       DENSE_RANK() OVER (ORDER BY unit_price DESC)     AS dense_rnk,
       ROW_NUMBER() OVER (ORDER BY unit_price DESC, id) AS rn
FROM order_items WHERE id IN (1, 3, 4, 5, 7, 11) ORDER BY rn;
```

```
   sku    | unit_price | rnk | dense_rnk | rn
----------+------------+-----+-----------+----
 MONITOR  |     200.00 |   1 |         1 |  1
 MONITOR  |     200.00 |   1 |         1 |  2
 KEYBOARD |      50.00 |   3 |         2 |  3
 KEYBOARD |      50.00 |   3 |         2 |  4
 MOUSE    |      20.00 |   5 |         3 |  5
 CABLE    |       5.00 |   6 |         4 |  6
```

**Follow-ups:**
- *Which one for "top 3 prices"?* `DENSE_RANK <= 3`.

**Trap:** `RANK` skips numbers after a tie, so "rank 2" may not exist.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### Task 9: For customers 1 and 3, show the days since their previous order.

Topic: sql-core | Standard | id: q0471

**Say:** `LAG(ordered_at::date)` partitioned by customer and ordered by time gives the previous date. Subtracting two dates gives days. The first order has `NULL`.

**Full process:**

```sql
SELECT id, customer_id, ordered_at::date AS day,
       LAG(ordered_at::date) OVER w AS prev_day,
       ordered_at::date - LAG(ordered_at::date) OVER w AS days_since
FROM orders WHERE customer_id IN (1, 3)
WINDOW w AS (PARTITION BY customer_id ORDER BY ordered_at)
ORDER BY customer_id, ordered_at;
```

```
 id  | customer_id |    day     |  prev_day  | days_since
-----+-------------+------------+------------+------------
 101 |           1 | 2026-02-01 |            |
 102 |           1 | 2026-02-15 | 2026-02-01 |         14
 109 |           1 | 2026-04-05 | 2026-02-15 |         49
 105 |           3 | 2026-03-02 |            |
 106 |           3 | 2026-03-20 | 2026-03-02 |         18
 107 |           3 | 2026-04-01 | 2026-03-20 |         12
```

**Follow-ups:**
- *MySQL?* Use `DATEDIFF(a, b)` for the subtraction. The rest is the same in 8.0.

**Trap:** No `PARTITION BY`, so customer 3's first order is compared with customer 1's last.

**Source:** https://www.postgresql.org/docs/16/functions-window.html

### Task 10: Find customers that share the same name.

Topic: sql-core | Standard | id: q0472

**Say:** Group by name and keep groups with more than one row. I show the ids so a human can decide which row is the real one.

**Full process:**

```sql
SELECT name, COUNT(*) AS copies, MIN(id) AS keep_id, array_agg(id ORDER BY id) AS ids
FROM customers GROUP BY name HAVING COUNT(*) > 1;
```

```
    name    | copies | keep_id |  ids
------------+--------+---------+-------
 Anna Nowak |      2 |       1 | {1,6}
```

**Follow-ups:**
- *Is it a real duplicate?* Not necessarily: the emails differ. The business key decides.

**Trap:** Deleting by name alone merges two different people.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

### Task 11: Delete the duplicates from Task 10, keeping the lowest id, and undo it.

Topic: sql-core | Standard | id: q0473

**Say:** Number rows per name with `ROW_NUMBER`, delete rows with number above 1, check the result, and roll back because this is only practice.

**Full process:**

```sql
BEGIN;
DELETE FROM customers c
USING (SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn FROM customers) d
WHERE c.id = d.id AND d.rn > 1;
SELECT id, name FROM customers ORDER BY id;
ROLLBACK;
```

```
 id |      name
----+-----------------
  1 | Anna Nowak
  2 | Ben Carter
  3 | Clara Diaz
  4 | Dawid Zielinski
  5 | Eva Kral
```

**Follow-ups:**
- *MySQL?* `DELETE c FROM customers c JOIN (...) d ON d.id = c.id WHERE d.rn > 1`.

**Trap:** Running a delete without a transaction and without looking at the row count first.

**Source:** https://www.postgresql.org/docs/16/sql-delete.html

### Task 12: Monthly revenue of paid and shipped orders.

Topic: sql-core | Standard | id: q0474

**Say:** Cut the timestamp to the month with `date_trunc`, sum item totals, group by month. A CTE keeps it readable.

**Full process:**

```sql
WITH monthly AS (
  SELECT date_trunc('month', o.ordered_at)::date AS month,
         SUM(i.quantity * i.unit_price) AS revenue
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.status IN ('paid', 'shipped') GROUP BY 1
)
SELECT month, revenue FROM monthly ORDER BY month;
```

```
   month    | revenue
------------+---------
 2026-02-01 |  340.00
 2026-03-01 |  495.00
 2026-04-01 |  220.00
```

**Follow-ups:**
- *MySQL?* `DATE_FORMAT(o.ordered_at, '%Y-%m-01')` replaces `date_trunc`.

**Trap:** Grouping by the full timestamp gives one row per order.

**Source:** https://www.postgresql.org/docs/16/functions-datetime.html

### Task 13: Running total of Anna's orders (customer 1).

Topic: sql-core | Standard | id: q0475

**Say:** Total per order in a CTE, then `SUM(total) OVER (ORDER BY ordered_at)`.

**Full process:**

```sql
WITH t AS (
  SELECT o.id, o.ordered_at, SUM(i.quantity * i.unit_price) AS total
  FROM orders o JOIN order_items i ON i.order_id = o.id
  WHERE o.customer_id = 1 GROUP BY o.id, o.ordered_at
)
SELECT id, total, SUM(total) OVER (ORDER BY ordered_at) AS running_total
FROM t ORDER BY ordered_at;
```

```
 id  | total  | running_total
-----+--------+---------------
 101 |  90.00 |         90.00
 102 | 200.00 |        290.00
 109 | 220.00 |        510.00
```

**Follow-ups:**
- *Ties in ordered_at?* With the default frame, tied rows share one total. Use `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` for strict rows.

**Trap:** Using `GROUP BY` and losing the individual rows.

**Source:** https://www.postgresql.org/docs/16/tutorial-window.html

### Task 14: Label each order small, medium or large by total.

Topic: sql-core | Standard | id: q0476

**Say:** `CASE` with the largest threshold first. Under 50 is small, 50 to 199.99 is medium, 200 and above is large.

**Full process:**

```sql
SELECT o.id, SUM(i.quantity * i.unit_price) AS total,
       CASE WHEN SUM(i.quantity * i.unit_price) >= 200 THEN 'large'
            WHEN SUM(i.quantity * i.unit_price) >= 50  THEN 'medium'
            ELSE 'small' END AS size
FROM orders o JOIN order_items i ON i.order_id = o.id
GROUP BY o.id ORDER BY o.id;
```

```
 id  | total  |  size
-----+--------+--------
 101 |  90.00 | medium
 102 | 200.00 | large
 103 |  50.00 | medium
 104 |  20.00 | small
 105 | 400.00 | large
 106 |  25.00 | small
 107 |  50.00 | medium
 108 |  70.00 | medium
 109 | 220.00 | large
```

**Follow-ups:**
- *Boundary values?* 200.00 is large and 50.00 is medium, because the tests are `>=`. Test the boundary on purpose.

**Trap:** Putting `>= 50` first, so every large order becomes medium.

**Source:** https://www.postgresql.org/docs/16/functions-conditional.html

### Task 15: Count orders with and without a coupon, and find the ones that do not use WELCOME10.

Topic: sql-core | Standard | id: q0477

**Say:** `COUNT(*)` counts rows, `COUNT(coupon)` skips `NULL`. For "not WELCOME10" I use `IS DISTINCT FROM`, because `<>` drops the `NULL` rows.

**Full process:**

```sql
SELECT COUNT(*) AS all_rows,
       COUNT(coupon) AS with_coupon,
       COUNT(*) FILTER (WHERE coupon IS NULL) AS without_coupon,
       COUNT(*) FILTER (WHERE coupon <> 'WELCOME10') AS not_welcome,
       COUNT(*) FILTER (WHERE coupon IS DISTINCT FROM 'WELCOME10') AS not_welcome_null_safe
FROM orders;
```

```
 all_rows | with_coupon | without_coupon | not_welcome | not_welcome_null_safe
----------+-------------+----------------+-------------+-----------------------
       10 |           3 |              7 |           1 |                     8
```

**Follow-ups:**
- *MySQL?* No `FILTER`, use `SUM(coupon IS NULL)` and the null-safe operator `<=>`.

**Trap:** Believing `coupon <> 'WELCOME10'` covers the orders without a coupon.

**Source:** https://www.postgresql.org/docs/16/functions-comparison.html

### Task 16: List the orders placed in March 2026.

Topic: sql-core | Standard | id: q0478

**Say:** A half-open range: `>= '2026-03-01' AND < '2026-04-01'`. It includes the whole of 31 March and excludes 1 April at midnight.

**Full process:**

```sql
SELECT id, ordered_at FROM orders
WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01'
ORDER BY ordered_at;
```

```
 id  |     ordered_at
-----+---------------------
 104 | 2026-03-01 18:45:00
 105 | 2026-03-02 08:00:00
 108 | 2026-03-15 16:05:00
 106 | 2026-03-20 14:10:00
```

**Follow-ups:**
- *Why not BETWEEN?* Its upper bound is inclusive, so `BETWEEN '2026-03-01' AND '2026-03-31'` loses orders after midnight on 31 March.

**Trap:** `WHERE ordered_at::date ...` or `extract(month ...)` blocks an index on the column.

**Source:** https://www.postgresql.org/docs/16/functions-datetime.html

### Task 17: Which customers have at least one cancelled order?

Topic: sql-core | Standard | id: q0479

**Say:** `EXISTS` with a correlated subquery. It stops at the first match and cannot multiply rows the way a join would.

**Full process:**

```sql
SELECT c.id, c.name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'cancelled');
```

```
 id |    name
----+------------
  2 | Ben Carter
```

**Follow-ups:**
- *With a JOIN?* It works but returns a customer once per cancelled order, so you need `DISTINCT`.

**Trap:** `JOIN` plus `DISTINCT` hides the multiplication instead of avoiding it.

**Source:** https://www.postgresql.org/docs/16/functions-subquery.html

### Task 18: Customers who ordered in February or March: compare UNION and UNION ALL.

Topic: sql-core | Standard | id: q0480

**Say:** Same two queries, one with `UNION` (4 distinct customers) and one with `UNION ALL` (7 rows, with repeats).

**Full process:**

```sql
SELECT customer_id FROM orders WHERE ordered_at >= '2026-02-01' AND ordered_at < '2026-03-01'
UNION
SELECT customer_id FROM orders WHERE ordered_at >= '2026-03-01' AND ordered_at < '2026-04-01'
ORDER BY customer_id;
```

`UNION` output: `1, 2, 3, 4`. With `UNION ALL` instead: `1, 1, 2, 2, 3, 3, 4` (7 rows).

**Follow-ups:**
- *Which is faster?* `UNION ALL`, no duplicate removal.

**Trap:** Counting rows from a `UNION` and expecting the sum of the two counts.

**Source:** https://www.postgresql.org/docs/16/queries-union.html

### Task 19: Show each customer with the name of the customer who referred them.

Topic: sql-core | Standard | id: q0481

**Say:** A self join: `customers c LEFT JOIN customers r ON r.id = c.referred_by`. `LEFT` keeps customers nobody referred.

**Full process:**

```sql
SELECT c.name AS customer, r.name AS referred_by
FROM customers c LEFT JOIN customers r ON r.id = c.referred_by
ORDER BY c.id;
```

```
    customer     | referred_by
-----------------+-------------
 Anna Nowak      |
 Ben Carter      | Anna Nowak
 Clara Diaz      | Anna Nowak
 Dawid Zielinski | Ben Carter
 Eva Kral        |
 Anna Nowak      |
```

**Follow-ups:**
- *A whole referral chain?* `WITH RECURSIVE` walks the tree.

**Trap:** Using the same alias for both sides, which is an error.

**Source:** https://www.postgresql.org/docs/16/queries-with.html

### Task 20: Use a FULL OUTER JOIN to list customers without orders (and orders without customers).

Topic: sql-core | Standard | id: q0482

**Say:** A full join keeps unmatched rows from both sides. Filtering for a `NULL` on either side shows the gaps. Here only the customer side has gaps, which proves there are no orphan orders.

**Full process:**

```sql
SELECT c.id, c.name, COUNT(o.id) AS orders
FROM customers c FULL OUTER JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(o.id) = 0 OR c.id IS NULL
ORDER BY c.id;
```

```
 id |    name    | orders
----+------------+--------
  5 | Eva Kral   |      0
  6 | Anna Nowak |      0
```

**Follow-ups:**
- *MySQL?* There is no `FULL JOIN`. Use `LEFT JOIN ... UNION ... RIGHT JOIN`.

**Trap:** Expecting an orphan order row. The foreign key makes that impossible here.

**Source:** https://www.postgresql.org/docs/16/queries-table-expressions.html

### Task 21: Find what changed between a copy of orders and the current orders.

Topic: sql-core | Standard | id: q0483

**Say:** Copy the table, change some rows, then run `EXCEPT` both ways. A row in only one result is a difference. I roll back at the end.

**Full process:**

```sql
BEGIN;
CREATE TEMP TABLE orders_before AS SELECT * FROM orders;
UPDATE orders SET status = 'shipped' WHERE id = 105;
DELETE FROM orders WHERE id = 110;
INSERT INTO orders (id, customer_id, status, ordered_at) VALUES (111, 5, 'new', '2026-04-11 09:00');

SELECT 'before' AS side, * FROM (SELECT * FROM orders_before EXCEPT SELECT * FROM orders) a ORDER BY id;
SELECT 'after'  AS side, * FROM (SELECT * FROM orders EXCEPT SELECT * FROM orders_before) b ORDER BY id;
ROLLBACK;
```

```
  side  | id  | customer_id | status |     ordered_at      | coupon
--------+-----+-------------+--------+---------------------+--------
 before | 105 |           3 | paid   | 2026-03-02 08:00:00 |
 before | 110 |           4 | paid   | 2026-04-10 10:30:00 |

 side  | id  | customer_id | status  |     ordered_at      | coupon
-------+-----+-------------+---------+---------------------+--------
 after | 105 |           3 | shipped | 2026-03-02 08:00:00 |
 after | 111 |           5 | new     | 2026-04-11 09:00:00 |
```

Reading: 105 is changed, 110 is missing, 111 is new.

**Follow-ups:**
- *Tables on two servers?* Compare counts and checksums on each side, or load both into one database.

**Trap:** One direction only misses either the lost rows or the extra rows.

**Source:** https://www.postgresql.org/docs/16/queries-union.html

### Task 22: Compute a row count and a checksum for the orders table.

Topic: sql-core | Standard | id: q0484

**Say:** One query that returns the count and an md5 of all rows in a fixed order. Run it on both sides of a migration and compare the two lines.

**Full process:**

```sql
SELECT 'orders' AS tbl, COUNT(*) AS row_count,
       md5(string_agg(concat_ws('|', id, customer_id, status, ordered_at, COALESCE(coupon, '<null>')),
                      E'\n' ORDER BY id)) AS checksum
FROM orders;
```

```
  tbl   | row_count |             checksum
--------+-----------+----------------------------------
 orders |        10 | 11acfbb448ef788d485f58c8834afdb8
```

**Follow-ups:**
- *Why ORDER BY inside string_agg?* Row order is otherwise undefined, so equal data could hash differently.

**Trap:** `NULL`s skipped by `concat_ws`, so a `NULL` and a missing value look the same.

**Source:** https://www.postgresql.org/docs/16/functions-aggregate.html

### Task 23: Find order items without an order, and orders without items.

Topic: sql-core | Standard | id: q0485

**Say:** Two anti joins. The first must return no rows because of the foreign key. The second returns order 110, which is a data question for the product owner.

**Full process:**

```sql
SELECT i.id, i.order_id FROM order_items i LEFT JOIN orders o ON o.id = i.order_id WHERE o.id IS NULL;
-- 0 rows

SELECT o.id FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE i.id IS NULL;
-- 110
```

**Follow-ups:**
- *How do you prove the check can fail?* Run it once on a copy of the data with a deliberately deleted parent.

**Trap:** Zero rows on data where the constraint already prevents the problem proves nothing about imported data.

**Source:** https://www.postgresql.org/docs/16/ddl-constraints.html

### Task 24: Delete an order inside a transaction, see the cascade, and undo it.

Topic: sql-core | Standard | id: q0486

**Say:** Deleting order 101 also deletes its two items, because of `ON DELETE CASCADE`. Inside the transaction the counts drop, and after `ROLLBACK` they are back.

**Full process:**

```sql
BEGIN;
DELETE FROM orders WHERE id = 101;
SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items;
ROLLBACK;
SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_items) AS items;
```

```
 orders | items
--------+-------
      9 |    10
 orders | items
--------+-------
     10 |    12
```

**Follow-ups:**
- *And deleting a customer who has orders?* It fails with the foreign key error, because `orders.customer_id` is `RESTRICT`.

**Trap:** Running a destructive test on a shared database without a transaction.

**Source:** https://www.postgresql.org/docs/16/tutorial-fk.html

### Task 25: Verify the newest order of ben@example.com with its items, as a test would after a UI action.

Topic: sql-core | Standard | id: q0487

**Say:** Filter by the unique email, take the order with the newest timestamp, and join the items. A test asserts on the status and the items, not only on the count.

**Full process:**

```sql
SELECT c.email, o.id AS order_id, o.status, i.sku, i.quantity
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items i ON i.order_id = o.id
WHERE c.email = 'ben@example.com'
  AND o.ordered_at = (SELECT MAX(ordered_at) FROM orders WHERE customer_id = c.id)
ORDER BY i.id;
```

```
      email      | order_id |  status   |  sku  | quantity
-----------------+----------+-----------+-------+----------
 ben@example.com | 104      | cancelled | MOUSE |        1
```

**Follow-ups:**
- *Late data?* Poll this query with a deadline until the row appears.

**Trap:** `ORDER BY id DESC LIMIT 1` without the customer filter, on a shared database.

**Source:** https://www.postgresql.org/docs/16/sql-select.html

## NoSQL (concept only)

### What is NoSQL, and how is it different from a relational database?

Topic: db-nosql | Niche | id: q0488

**Say:** If you have not used NoSQL in production, say so plainly and explain that NoSQL means databases that do not use the relational table model. The main kinds are document stores (MongoDB), key-value stores (Redis), wide-column stores and graph databases. They usually trade strict schema and joins for flexible data shape and easy horizontal scaling.

**Follow-ups:**
- *How would you approach testing one?* The same questions: what is the schema contract, how does data get in, and what do I verify after an action. I would learn its query language first, and check the consistency guarantees of the specific product.

**Trap:** Saying "NoSQL has no schema". The schema still exists, but the application enforces it instead of the database.

**Source:** https://www.mongodb.com/docs/manual/core/data-modeling-introduction/

### When would you choose a document or key-value store over a relational database?

Topic: db-nosql | Niche | id: q0489

**Say:** If you have not worked with one, say so plainly and explain the concepts. A document store fits data read as one whole object, with a changing shape, such as a profile or a product catalog entry. A key-value store such as Redis fits caches, sessions and counters with very fast lookups by key. A relational database fits data with many relations and strict consistency, such as orders and payments.

**Follow-ups:**
- *What do you lose?* Joins across collections are limited or manual, and multi-document transactions are more restricted or costlier than in a relational database.

**Trap:** Choosing NoSQL "because it is faster". It is faster for some access patterns and slower for others.

**Source:** https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/

### What does eventual consistency mean, and what does it change for a tester?

Topic: db-nosql | Niche | id: q0490

**Say:** In a distributed store with replicas, a write may not be visible on every replica at once, but all replicas converge if writes stop. For a tester this means a read right after a write can return old data. Use a polling assertion and a deadline, not a fixed sleep. This is general knowledge of async systems, not derived from running a NoSQL database.

**Follow-ups:**
- *What is the CAP theorem?* In a network partition, a distributed system must choose between consistency and availability. It is a trade-off model, and each product makes its own choice.

**Trap:** Mixing up CAP "consistency" with ACID "consistency".

**Source:** https://www.mongodb.com/docs/manual/core/transactions/

### How would you test data stored in a document database?

Topic: db-nosql | Niche | id: q0491

**Say:** If you have not done it on a document database, say so plainly. Check the document shape against the agreed schema, required fields, types, and the relations kept as ids. Then verify the effect of an action by querying for a unique key, and check that old documents with an older shape still load.

**Follow-ups:**
- *Which risk is specific here?* Schema drift: documents written by different versions of the code have different shapes in the same collection.

**Trap:** Testing only new documents and missing the old shapes.

**Source:** https://www.mongodb.com/docs/manual/core/data-modeling-introduction/

## Data pipelines and ETL testing (concept, one real migration)

### What is ETL, and how do you test an ETL or data pipeline?

Topic: data-testing | Standard | id: q0492

**Say:** ETL means extract, transform, load: read data from a source, change it (clean, map, aggregate), and write it into a target. ELT loads first and transforms inside the warehouse. If you have not worked with a data warehouse or Snowflake, say so plainly, but explain that the testing idea for migration is the same: check each stage. Verify the source extract is complete, the transformation rules produce the expected values on known inputs, and the target matches the source after the mapping. Check counts, checksums, row diffs, nulls, duplicates and orphans, and rerun the job to prove it is idempotent.

**Full process:**

1. Completeness: row counts in source and target, per table and per day.
2. Correctness of the transformation: take a small input with known edge cases (nulls, long text, special characters, boundary dates) and compare the output with a hand-calculated expected result.
3. Reconciliation: aggregates (sums, min and max dates, distinct counts) on both sides, then `EXCEPT` both ways with the mapping applied to the source side.
4. Integrity in the target: primary key duplicates, orphans, `NOT NULL` columns.
5. Rerun: run the job twice. The second run must not create duplicates (idempotency), and a partial failure must be safe to restart.
6. Incremental loads: add, change and delete one source row and check the next run picks up exactly those.

```sql
-- target keys that appear twice after a rerun (must be 0 rows)
SELECT id, COUNT(*) FROM orders GROUP BY id HAVING COUNT(*) > 1;
```

**Follow-ups:**
- *What is the hard part?* Volume and time. Full diffs are too slow on huge tables, so compare in key ranges and sample deeply.
- *What do you do with a legitimate difference?* Document the reason in code (for example a trimmed field) and exclude it from the diff, so the rest of the diff is all real.

**Trap:** Reporting success on matching row counts only.

**Source:** https://docs.getdbt.com/docs/build/data-tests

### Which data quality checks do you run on a dataset?

Topic: data-testing | Standard | id: q0493

**Say:** The usual dimensions: completeness (no unexpected nulls, no missing rows), uniqueness (no duplicate keys), validity (values in an allowed set or range, correct format), consistency (the same fact agrees across tables), accuracy (it matches the real source) and freshness (the data is recent enough). Each one is a query that must return zero rows. I run them after a load and, for important tables, on a schedule.

**Full process:** Examples as zero-row queries on the seed schema.

```sql
SELECT id FROM customers WHERE email IS NULL OR email NOT LIKE '%@%';               -- validity
SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1;                      -- uniqueness
SELECT id FROM orders WHERE status NOT IN ('new', 'paid', 'shipped', 'cancelled');   -- allowed values
SELECT id FROM orders WHERE ordered_at > now();                                      -- sanity of dates
SELECT MAX(ordered_at) < now() - interval '1 day' AS stale FROM orders;              -- freshness
```

The first four return no rows on the seed data. The freshness query returns `t` on the seed data, because the seed dates are fixed.

Tools that run such checks declaratively: dbt tests (`unique`, `not_null`, `accepted_values`, `relationships`) and Great Expectations. I know them by concept, not from using them.

**Follow-ups:**
- *Where do the rules come from?* From constraints, business rules, and past defects.

**Trap:** Checks that never fail. Run each one once on data with a planted violation.

**Source:** https://docs.greatexpectations.io/docs/home/

### How do you test a migration of data from an old system to a new one?

Topic: data-testing | Standard | id: q0494

**Say:** I define the mapping first: which old field becomes which new field, with every transformation rule. Then I verify with data, not with trust: counts, aggregates, a full diff of mapped rows, orphans and duplicates in the new data, and a manual sample of real records, including the ugliest ones. I include old rows with unusual values (nulls, very long text, special characters, odd dates), because migrations break on those. At the end I can say what matched, what differed and why, and which evidence is real migration evidence and which only checks the display.

**Follow-ups:**
- *Is there a rollback plan to test?* Yes, I would ask whether the old data stays untouched, and test the rollback or re-run on a copy.
- *What about personal data?* In test copies of production data I scrub personal data first and check the scrubbing, with samples reviewed by a person.

**Trap:** Only testing the happy path with clean new test data, not copies of real old data.

**Source:** https://docs.getdbt.com/docs/build/data-tests

### What is a data warehouse, and how does it differ from a transactional database?

Topic: data-testing | Standard | id: q0495

**Say:** No hands-on warehouse experience is stated, so this is the concept. A transactional database (OLTP) serves many small reads and writes with strict consistency, normalized tables. A data warehouse (OLAP) stores history from many sources, usually denormalized in a star schema (a fact table with dimension tables), and is built for large analytic reads. Data reaches it through ETL or ELT pipelines, so testing it is mostly testing those pipelines and the numbers in reports.

**Follow-ups:**
- *What would you check first in a report?* That its total equals the total from the source system for the same period, and that nothing is double counted by a join.

**Trap:** Claiming warehouse experience from SQL skills. The query language is the same, the architecture and tools differ.

**Source:** https://docs.getdbt.com/docs/build/incremental-models

### How do you make a data pipeline test deterministic?

Topic: data-testing | Standard | id: q0496

**Say:** I control the input and the clock. I use a small fixed input file with known edge cases, a fixed "now" instead of the system time, and a fresh empty target for each run. I compare the output with an expected file in a defined order, never with whatever order the database returns. Then I run the same input twice to check that the second run changes nothing.

**Follow-ups:**
- *Why does ordering matter?* A query without `ORDER BY` can return rows in a different order on each run, so a test comparing lists becomes flaky.

**Trap:** Testing against a shared, moving dataset. The expected result then changes without any code change.

**Source:** https://docs.getdbt.com/docs/build/data-tests

## Rare tools from the ads

### What is Cosmos DB, and what would you watch for in testing?

Topic: data-platforms | Niche | id: q0497

**Say:** If you have not used Cosmos DB, say so plainly and explain: It's Azure's distributed NoSQL database. The partition key decides how data spreads, and throughput is measured in request units. It also offers several consistency levels, so a read right after a write may return old data unless the level guarantees otherwise. In tests, avoid asserting immediately after a write on a weak level, and ask which level the team uses.

**Source:** https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels

### What are Spark and Databricks, and how do you test a data job?

Topic: data-platforms | Niche | id: q0498

**Say:** If you have not used them, say so plainly and explain: Spark is an engine for processing large data across many machines, and Databricks is a cloud platform built around it. Testing a data job is close to the ETL checks you know: compare row counts and totals between source and target, check the schema, find duplicates and nulls, and rerun the job to confirm it doesn't double the data. Use a small hand-checked dataset, so the expected result is known.

**Source:** https://docs.databricks.com/aws/en/introduction/ and https://spark.apache.org/docs/latest/
