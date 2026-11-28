// ---------- data ----------
let Q = [], files = [];  // filled by prepare() once the questions are unpacked (boot in start.js); Q ends with the learner's cards
let BANK = 0;  // how many of Q are bank questions; the cards follow them (syncCards)
const DATA_VERSION = /*DATA_VERSION*/;  // the question set's label, set by tools/build.py (docs/phase6-spec.md)
const META = {
  '01-playwright': 'Playwright', '02-typescript-javascript': 'TypeScript & JavaScript', '03-api': 'API testing',
  '04-sql-databases': 'SQL & databases', '05-testing-fundamentals': 'Testing fundamentals', '06-framework-and-flaky': 'Framework design & flaky tests',
  '07-ci-docker-cloud': 'CI/CD, Docker & Git', '08-ai-testing-and-tools': 'AI in QA', '09-mobile': 'Mobile testing',
  '10-performance-security-a11y': 'Performance, security & a11y', '11-agile-leadership': 'Agile & leadership', '13-live-coding': 'Live coding & home tasks', 'my-cards': 'My cards',
};
const TIERS = {
  Core: 'The topic appears in 30% or more of the QA job ads this bank was built from, or it is set to Core by hand. Only the first 5 questions of each such topic are Core; the rest are Standard.',
  Standard: 'Comes up often: in 10 to 30% of those job ads. Learn it after Core.',
  Niche: 'Rare: under 10% of the ads. Read it only when a job ad names the topic.',
};
const fileMeta = f => META[f] || f;  // topic name
function prepare(list) {
  Q = list;
  Q.forEach((q, i) => {
    q.i = i; q.k = q.id;  // stable id from the Markdown, so saved progress survives edits
    q.tier = (q.body.match(/^Topic: .*?\| (Core|Standard|Niche)/m) || [])[1] || 'Niche';
    q.sec = (q.section || 'General').replace(/^Section \d+:\s*/i, '').replace(/\s*\(`?[\w-]+`?\)$/, '');
    q.f = fields(q.body);
  });
  Q.forEach(q => { q.slug = (q.body.match(/^Topic: (\S+)/m) || [])[1] || ''; });
  files = [...new Set(Q.map(q => q.file))];
  BANK = Q.length;
  store = read() || blank();
  syncCards();
}
const bankQ = () => Q.slice(0, BANK);
const $ = id => document.getElementById(id);

// ---------- saved progress ----------
// localStorage['qa-bank'] holds everything below (docs/phase2-spec.md). Keys this version does not know are kept,
// so a copy of the page from a newer version does not lose its data when an older copy saves.
const STORE_KEY = 'qa-bank', THEME_KEY = 'qa-bank-theme', MARKS = ['known', 'shaky', 'missed'];
const CARD_ID = /^u[0-9a-z]{1,16}$/, CARD_MAX = 10000, COMPANY_MAX = 80, MAX_CARDS = 500, MAX_COMPANIES = 50;
const blank = () => ({ v: 2, known: {}, shaky: {}, missed: {}, notes: {}, code: {}, srs: {}, exam: null, backup: null, mix: null, mixSize: 10, locators: {}, locPage: null, cards: {}, companies: {} });

// Days are local calendar days as 'YYYY-MM-DD'; strings in this form compare in date order.
const pad = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayOf(new Date());
const addDays = (day, n) => { const [y, m, d] = day.split('-').map(Number); return dayOf(new Date(y, m - 1, d + n)); };
const daysBetween = (a, b) => { const u = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((u(b) - u(a)) / 864e5); };
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

// Checks a saved or imported progress object part by part. Returns the good parts and a list of the bad ones.
function cleanProgress(raw) {
  const out = blank(), bad = [], isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(raw)) return [out, ['progress is not an object']];
  for (const k in raw) if (!(k in out)) out[k] = raw[k];
  if (raw.v !== undefined) { if (Number.isInteger(raw.v) && raw.v > 0) out.v = Math.max(raw.v, 2); else bad.push('v'); }
  const map = (name, ok) => {
    if (raw[name] === undefined) return;
    if (!isObj(raw[name])) return bad.push(name);
    for (const [id, x] of Object.entries(raw[name])) ok(x, id) ? out[name][id] = x : bad.push(`${name}.${id}`);
  };
  MARKS.forEach(m => map(m, x => x === 1));
  map('notes', x => typeof x === 'string'); map('code', x => typeof x === 'string'); map('locators', x => x === 1);
  map('srs', x => isObj(x) && Number.isInteger(x.box) && x.box >= 0 && x.box <= 4 && isDay(x.last) && isDay(x.due));
  for (const k of ['exam', 'backup']) if (raw[k] !== undefined && raw[k] !== null) { if (isDay(raw[k])) out[k] = raw[k]; else bad.push(k); }
  if (raw.mix !== undefined && raw.mix !== null) {
    if (isObj(raw.mix) && isDay(raw.mix.day) && Array.isArray(raw.mix.ids) && raw.mix.ids.every(i => typeof i === 'string')) out.mix = { day: raw.mix.day, ids: raw.mix.ids.slice() };
    else bad.push('mix');
  }
  if (raw.locPage !== undefined && raw.locPage !== null) { if (typeof raw.locPage === 'string') out.locPage = raw.locPage; else bad.push('locPage'); }
  if (raw.mixSize !== undefined) { if ([5, 10, 20].includes(raw.mixSize)) out.mixSize = raw.mixSize; else bad.push('mixSize'); }
  // Own cards and company notes (docs/phase6-spec.md, section 2).
  const str = (x, min, max) => typeof x === 'string' && x.length >= min && x.length <= max;
  map('cards', (x, id) => CARD_ID.test(id) && isObj(x) && str(x.q, 1, CARD_MAX) && x.q.trim() !== '' && str(x.a, 0, CARD_MAX)
    && (x.company === undefined || str(x.company, 0, COMPANY_MAX)) && isDay(x.created));
  map('companies', (x, name) => str(name, 1, COMPANY_MAX) && str(x, 0, CARD_MAX));
  // A note whose company no card uses cannot be shown or deleted (v0.3.0 left one when a company's last card moved): drop it
  // silently, before the 50-note limit, so such a backup still imports.
  const used = new Set(Object.values(out.cards).map(c => (c.company || '').trim()));
  for (const name of Object.keys(out.companies)) if (!used.has(name)) delete out.companies[name];
  if (Object.keys(out.cards).length > MAX_CARDS) bad.push('cards');
  if (Object.keys(out.companies).length > MAX_COMPANIES) bad.push('companies');
  for (const id of Object.keys(out.known)) { delete out.shaky[id]; delete out.missed[id]; }
  for (const id of Object.keys(out.shaky)) delete out.missed[id];
  return [out, bad];
}

let saveFailed = false, readFailed = false;
// Saved progress, or null when storage cannot be read (blocked). Missing or broken progress gives a blank one.
function read() {
  let text;
  try { text = localStorage.getItem(STORE_KEY); readFailed = false; } catch (e) { readFailed = true; return null; }
  if (text === null) return blank();
  let raw;
  try { raw = JSON.parse(text); } catch (e) {
    try { if (localStorage.getItem(STORE_KEY + '-broken') === null) localStorage.setItem(STORE_KEY + '-broken', text); } catch (e2) {}
    return blank();
  }
  const s = cleanProgress(raw)[0];
  // Progress saved by versions before ids was keyed by file and question text: move it to the id.
  Q.forEach(q => { const old = q.file + '|' + q.q;
    if (s.known[old]) { s.known[q.k] = 1; delete s.known[old]; }
    if (old in s.code) { s.code[q.k] = s.code[old]; delete s.code[old]; } });
  // Known marks from before spaced review have no review date: spread their first review over days 3 to 16.
  if (raw && raw.v === undefined) {
    const t = today();
    Q.filter(q => s.known[q.k] && !s.srs[q.k]).forEach((q, i) => { s.srs[q.k] = { box: 1, last: t, due: addDays(t, 3 + i % 14) }; });
  }
  return s;
}
let store = blank();
function showSaveError() { const box = $('save-error'); if (box) box.hidden = !(saveFailed || readFailed); }
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); saveFailed = false; } catch (e) { saveFailed = true; }
  showSaveError();
}
// Every change goes through update(): read what another tab may have saved, apply this one change, save.
// While saving or reading fails, the copy in memory is the newest, so it is kept and saved in full once storage works.
function update(change) {
  if (!saveFailed) store = read() || store;
  const t = today();
  if (!store.mix || store.mix.day !== t) store.mix = { day: t, ids: buildMix(store, t) };  // today's mix is fixed at its first save
  change(store); save();
  syncCards();  // another tab may have added or removed cards
}
const known = q => !!store.known[q.k];
