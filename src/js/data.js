// ---------- data ----------
const Q = JSON.parse(document.getElementById('data').textContent);
const META = {
  '01-playwright': ['🎭', 'Playwright'], '02-typescript-javascript': ['🟦', 'TypeScript & JavaScript'],
  '03-api': ['🔌', 'API testing'], '04-sql-databases': ['🗄️', 'SQL & databases'],
  '05-testing-fundamentals': ['🧪', 'Testing fundamentals'], '06-framework-and-flaky': ['🏗️', 'Framework design & flaky tests'],
  '07-ci-docker-cloud': ['🚀', 'CI/CD, Docker & Git'], '08-ai-testing-and-tools': ['🤖', 'AI in QA'],
  '09-mobile': ['📱', 'Mobile testing'], '10-performance-security-a11y': ['🛡️', 'Performance, security & a11y'],
  '11-agile-leadership': ['🧭', 'Agile & leadership'], '13-live-coding': ['⌨️', 'Live coding & home tasks'],
};
const TIERS = {
  Core: 'The topic appears in 30% or more of the QA job ads this bank was built from, or it is set to Core by hand. Only the first 5 questions of each such topic are Core; the rest are Standard.',
  Standard: 'Comes up often: in 10 to 30% of those job ads. Learn it after Core.',
  Niche: 'Rare: under 10% of the ads. Read it only when a job ad names the topic.',
};
const fileMeta = f => META[f] || ['📄', f];
Q.forEach((q, i) => {
  q.i = i; q.k = q.id;  // stable id from the Markdown, so saved progress survives edits
  q.tier = (q.body.match(/^Topic: .*?\| (Core|Standard|Niche)/m) || [])[1] || 'Niche';
  q.sec = (q.section || 'General').replace(/^Section \d+:\s*/i, '').replace(/\s*\(`?[\w-]+`?\)$/, '');
  q.f = fields(q.body);
});
const files = [...new Set(Q.map(q => q.file))];
let store = { known: {} };
try { store = Object.assign(store, JSON.parse(localStorage.getItem('qa-bank') || '{}')); } catch (e) {}
store.code = store.code || {};
// Progress saved by versions before ids was keyed by file and question text: move it to the id.
Q.forEach(q => { const old = q.file + '|' + q.q;
  if (store.known[old]) { store.known[q.k] = 1; delete store.known[old]; }
  if (old in store.code) { store.code[q.k] = store.code[old]; delete store.code[old]; } });
const save = () => { try { localStorage.setItem('qa-bank', JSON.stringify(store)); } catch (e) {} };
const known = q => !!store.known[q.k];
const $ = id => document.getElementById(id);

