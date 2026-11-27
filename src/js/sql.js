// ---------- SQL runner and judge (ideas 36 and 37, docs/phase3-spec.md) ----------
// The SQL worker: the sql.js loader comes first in the same text, then this. Each script runs on a fresh database
// built from the seed; a CREATE TABLE for a table the seed made becomes CREATE TABLE IF NOT EXISTS.
function sqlWorkerMain() {
  const KEEP = 10001;  // rows kept per result set; more are counted, not kept
  let SQL = null;
  self.onmessage = async ({ data: { wasm, seed, scripts, tables } }) => {
    try { SQL = SQL || await initSqlJs({ wasmBinary: wasm }); }
    catch (e) { postMessage({ type: 'error', text: 'Error: SQLite did not start: ' + e.message }); postMessage({ type: 'done' }); return; }
    const results = scripts.map(text => {
      const db = new SQL.Database(), sets = [];
      let error = null, dump = null;
      try {
        if (seed) db.run(seed);
        const made = db.exec("SELECT lower(name) FROM sqlite_master WHERE type = 'table'");
        const seeded = made.length ? made[0].values.map(v => v[0]) : [];
        const sql = text.replace(/\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)(["`[]?)(\w+)(["`\]]?)/gi,
          (m, a, name, b) => seeded.includes(name.toLowerCase()) ? `CREATE TABLE IF NOT EXISTS ${a}${name}${b}` : m);
        for (const stmt of db.iterateStatements(sql)) {
          const columns = stmt.getColumnNames(), values = [];
          let count = 0;
          while (stmt.step()) { if (count++ < KEEP) values.push(stmt.get()); }
          if (columns.length) sets.push({ columns, values, count });
          stmt.free();
        }
      } catch (e) { error = e.message; }
      if (tables && !error) {
        dump = {};
        for (const t of tables) { const r = db.exec(`SELECT * FROM "${t}"`); dump[t] = r.length ? { columns: r[0].columns, values: r[0].values } : { columns: [], values: [] }; }
      }
      db.close();
      return { sets, error, dump };
    });
    postMessage({ type: 'result', results });
    postMessage({ type: 'done' });
  };
  postMessage({ type: 'ready' });
}

let sqlParts = null;
async function sqlWorker() {
  if (!sqlParts) {
    const [loader, wasm] = await Promise.all([unpackText('sqljs'), unpack('sqlwasm')]);
    sqlParts = { url: URL.createObjectURL(new Blob([loader, `\n;(${sqlWorkerMain})();\n`], { type: 'text/javascript' })), wasm };
  }
  return sqlParts;
}
const seedTables = seed => [...(seed || '').matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)/gi)].map(m => m[1]);

// Runs scripts in one worker; resolves { status, ms, results } or { status: 'blocked' | 'unpack' | 'timeout' | 'stopped' }.
async function sqlRun(scripts, seed, tables, ctl = {}, out = null) {
  let parts;
  try { parts = await sqlWorker(); } catch (e) { return { status: 'unpack' }; }
  if (ctl.stopped || (out && !out.isConnected)) return { status: 'stopped' };
  let results = null, error = null;
  const wasm = parts.wasm.slice();
  const h = startWorker(parts.url, { wasm, seed, scripts, tables }, [wasm.buffer], { line() {}, error: t => { error = t; }, result: m => { results = m.results; } });
  h.out = out; ctl.h = h;
  const r = await h.done;
  return { ...r, results, error };
}

function resultTable(set, title) {
  const wrap = document.createElement('div');
  wrap.className = 'out-set';
  const shown = set.values.slice(0, ROW_SHOW);
  const cell = v => v === null ? '<td class="null">NULL</td>' : `<td>${esc(v instanceof Uint8Array ? `<${v.length} bytes>` : String(v))}</td>`;
  wrap.innerHTML = `${title ? `<div class="lbl">${esc(title)}</div>` : ''}<div class="out-scroll"><table><thead><tr>${set.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${shown.map(row => `<tr>${row.map(cell).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="out-count">${set.count === 0 ? 'No rows' : plural(set.count, 'row')}${set.count > ROW_SHOW ? `. Showing the first ${ROW_SHOW} of ${set.count} rows.` : ''}</p>`;
  return wrap;
}

// Run: every result set as a table.
async function runSQL(code, seed, out, ctl = {}) {
  const panel = outPanel(out);
  const r = await sqlRun([code], seed, null, ctl, out);
  if (!out.isConnected) return r;
  if (r.status === 'blocked') { out.innerHTML = `<div class="out-error">${esc(MSG.blocked)}</div>`; return r; }
  if (r.status === 'unpack') { panel.error(MSG.unpack); panel.end({ status: 'done', ms: 0 }); return r; }
  if (r.error) panel.error(r.error);
  const res = r.results && r.results[0];
  if (res) { res.sets.forEach(set => panel.node(resultTable(set))); if (res.error) panel.error(res.error); }
  panel.end(r);
  return r;
}

// ---------- judging ----------
const valueKey = v => v === null ? 'N' : typeof v === 'number' ? 'n' + (Number.isInteger(v) ? v : +v.toPrecision(12)) : typeof v === 'string' ? 's' + v : 'b' + String(v);
const rowKey = row => JSON.stringify(row.map(valueKey));
function rowDiff(mine, want) {
  const count = new Map();
  for (const r of want) { const k = rowKey(r); count.set(k, (count.get(k) || 0) + 1); }
  let extra = 0;
  for (const r of mine) { const k = rowKey(r), n = count.get(k) || 0; if (n) count.set(k, n - 1); else extra++; }
  let missing = 0; for (const n of count.values()) missing += n;
  return { missing, extra };
}
function workedAnswer(q) {
  const m = (q.f['Full process'] || '').match(/^\s*```sql answer( ordered)?\b[^\n]*\n([\s\S]*?)^\s*```/m);
  return m ? { code: m[2], ordered: !!m[1] } : null;
}
// Compares the user's SQL with the worked answer of task q. Resolves { verdict, message, mine, want } (sets to show).
async function judgeSQL(q, code, ctl = {}, out = null) {
  const ref = workedAnswer(q);
  const tableMode = /\b(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(ref.code);
  const tables = tableMode ? seedTables(q.seed) : null;
  const r = await sqlRun([code, ref.code], q.seed, tables, ctl, out);
  if (r.status === 'blocked' || r.status === 'unpack' || r.status === 'stopped') return { verdict: r.status, message: r.status === 'blocked' ? MSG.blocked : r.status === 'unpack' ? MSG.unpack : MSG.stopped };
  const fail = { verdict: 'error', message: 'Your SQL stopped with an error, so there is nothing to compare.' };
  if (r.status !== 'done' || !r.results) return { ...fail, detail: r.status === 'timeout' ? MSG.timeout : r.error };
  const [mine, want] = r.results;
  if (mine.error) return { ...fail, detail: mine.error };
  if (tableMode) {
    for (const t of tables) {
      const a = mine.dump[t], b = want.dump[t], d = rowDiff(a.values, b.values);
      if (d.missing || d.extra) {
        return { verdict: 'rows', message: `Not yet: after your statements, table ${t} has ${plural(d.missing, 'row')} missing and ${d.extra} extra.`,
          mine: { ...a, count: a.values.length }, want: { ...b, count: b.values.length } };
      }
    }
    return { verdict: 'match', message: 'Correct: the tables match the worked answer.' };
  }
  const a = mine.sets[mine.sets.length - 1], b = want.sets[want.sets.length - 1];
  if (!a) return { verdict: 'noresult', message: 'Your SQL returned no result. End it with a SELECT.' };
  const show = { mine: a, want: b };
  if (a.columns.length !== b.columns.length) return { verdict: 'columns', message: `Your result has ${plural(a.columns.length, 'column')}; the worked answer has ${b.columns.length}.`, ...show };
  if (a.count === 0 && b.count > 0) return { verdict: 'empty', message: `Your query returned no rows; the worked answer has ${b.count}.`, ...show };
  const d = rowDiff(a.values, b.values);
  if (d.missing || d.extra) return { verdict: 'rows', message: `Not yet: ${plural(d.missing, 'row')} missing and ${d.extra} extra compared with the worked answer.`, ...show };
  if (ref.ordered && a.values.some((row, i) => rowKey(row) !== rowKey(b.values[i]))) return { verdict: 'order', message: 'The rows are right but in the wrong order. This task asks for a set order.', ...show };
  return { verdict: 'match', message: 'Correct: your result matches the worked answer.' };
}
