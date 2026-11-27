// ---------- export and import of progress (docs/phase2-spec.md) ----------
const APP = 'qa-interview-bank', FORMAT = 1, MAX_IMPORT = 5000000;
let importState = { msg: null, kind: '', pending: null };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const hasProgress = s => ['known', 'shaky', 'missed', 'notes', 'code'].some(k => Object.keys(s[k]).length);

function exportProgress() {
  const t = today();
  update(s => { s.backup = t; });
  const file = { app: APP, format: FORMAT, exported: new Date().toISOString(), progress: store };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }));
  a.download = `qa-interview-bank-progress-${t}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  renderHome();
}
// Returns what is wrong with a parsed file, or '' when it can be imported. Any bad part rejects the whole file.
function importProblem(raw) {
  const not = 'This is not a QA Interview Bank progress file';
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== APP) return not + '.';
  if (typeof raw.format === 'number' && raw.format > FORMAT) return 'This file was made by a newer version of QA Interview Bank. Open it with that version or a newer copy of this page.';
  if (raw.format !== FORMAT) return not + ': its format is unknown.';
  const [, bad] = cleanProgress(raw.progress);
  return bad.length ? `This progress file is damaged (${bad.slice(0, 3).join(', ')}${bad.length > 3 ? ', …' : ''}). Nothing was imported.` : '';
}
function importFile(input) {
  const f = input.files[0];
  input.value = '';
  if (!f) return;
  const fail = msg => { importState = { msg, kind: 'error', pending: null }; renderBackupRow(); };
  if (f.size > MAX_IMPORT) return fail('This file is too large to be a progress file (over 5 MB). Nothing was imported.');
  f.text().then(text => {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return fail('This is not a QA Interview Bank progress file: it is not valid JSON.'); }
    const problem = importProblem(raw);
    if (problem) return fail(problem);
    importState = { msg: null, kind: '', pending: raw };
    renderBackupRow();
  }, () => fail('This file could not be read. Nothing was imported.'));
}
function importYes() {
  const raw = importState.pending, p = cleanProgress(raw.progress)[0], when = new Date(raw.exported);
  p.backup = isNaN(when) ? null : dayOf(when);
  store = p; save();
  const ids = new Set(['known', 'shaky', 'missed', 'notes', 'code', 'srs'].flatMap(k => Object.keys(p[k])));
  const foreign = [...ids].filter(id => !byId[id]).length;
  importState = { kind: 'ok', pending: null,
    msg: `Progress imported: ${plural(Object.keys(p.known).length, 'known mark')}.` + (foreign ? ` ${plural(foreign, 'question')} in the file ${foreign === 1 ? 'is' : 'are'} not in this version of the bank; ${foreign === 1 ? 'it is' : 'they are'} kept.` : '') };
  overall(); renderHome();
}
function importNo() { importState = { msg: null, kind: '', pending: null }; renderBackupRow(); }

function backupLine() {
  const b = store.backup, d = b ? Math.max(0, daysBetween(b, today())) : null;
  const when = d === null ? 'never' : d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
  return `<span id="backup-line" class="${hasProgress(store) && (d === null || d >= 7) ? 'warn' : ''}">Progress is saved in this browser only, for this file location. <span class="when">Last backup: ${when}</span></span>`;
}
function backupRow() {
  const p = importState.pending, here = Object.keys(store.known).length;
  return `<div class="backuprow">${backupLine()}
    <span class="brow-btns"><button class="btn small" id="export-btn" onclick="exportProgress()">Export progress</button>
    <label class="btn small filebtn">Import progress<input type="file" id="import-input" accept=".json,application/json" onchange="importFile(this)"></label></span>
    ${p ? `<span id="import-ask">Replace ${plural(here, 'known mark')} here with ${Object.keys(p.progress.known || {}).length} from the file? Everything else saved here is replaced too.</span>
      <button class="btn miss" id="import-yes" onclick="importYes()">Yes, replace</button><button class="btn" id="import-no" onclick="importNo()">Cancel</button>` : ''}
    ${importState.msg ? `<span id="import-msg" data-kind="${importState.kind}" role="status">${esc(importState.msg)}</span>` : ''}</div>`;
}
function renderBackupRow() { const el = $('backuprow'); if (el) el.innerHTML = backupRow(); }
