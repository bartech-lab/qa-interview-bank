// ---------- editor: a typing box like an interview tool; CodeMirror replaces it once unpacked (run.js) ----------
function starterCode(q) {
  const m = (q.f.Starter || '').match(/```\w*\n([\s\S]*?)```/);
  return m ? m[1].replace(/\n$/, '') : null;
}
function taskMinutes(q) { const m = q.q.match(/(\d+) min\b/); return m ? +m[1] : 0; }
function edSave(i, value) { update(s => { s.code[Q[i].k] = value; }); }
function edKey(e, i) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { const b = e.target.closest('.editor').querySelector('.run-btn'); if (b) { e.preventDefault(); b.click(); } return; }
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  e.target.setRangeText('  ', e.target.selectionStart, e.target.selectionEnd, 'end');
  edSave(i, e.target.value);
}
function edReset(btn, i) {
  update(s => { delete s.code[Q[i].k]; });
  setEditorCode(btn.closest('.editor'), starterCode(Q[i]));
}
function compare(btn, i) {
  const box = btn.closest('.editor').querySelector('.cmp'), f = Q[i].f;
  if (box.innerHTML) { box.innerHTML = ''; return; }
  const full = (f['Full process'] || '').match(/```[^\n]*\n[\s\S]*?```/g);
  const ans = f['In the slot'] || (full ? full[full.length - 1] : '');
  box.innerHTML = `<div class="lbl">${f['In the slot'] ? 'Enough for the time limit' : 'Worked solution'}</div>${md(ans)}`;
}
const timers = {};
function timerTick(i) {
  if (!timers[i]) return;
  const left = Math.round((timers[i] - Date.now()) / 1000), s = Math.abs(left);
  document.querySelectorAll(`.clock[data-i="${i}"]`).forEach(el => {
    el.textContent = (left < 0 ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    el.classList.toggle('over', left < 0);
  });
}
function timerToggle(i) {
  const label = text => document.querySelectorAll(`.tb[data-i="${i}"]`).forEach(b => { b.textContent = text; });
  if (timers[i]) {
    clearInterval(timers[i + 'id']); delete timers[i]; delete timers[i + 'id'];
    document.querySelectorAll(`.clock[data-i="${i}"]`).forEach(el => { el.textContent = ''; });
    label(`▶ Start ${taskMinutes(Q[i])} min timer`); return;
  }
  timers[i] = Date.now() + taskMinutes(Q[i]) * 60000;
  timers[i + 'id'] = setInterval(() => timerTick(i), 500); timerTick(i);
  label('■ Stop');
}
// "Report a problem" opens a prefilled GitHub issue; the id keeps the report attached to the question after edits.
const REPO = 'https://github.com/bartech-lab/qa-interview-bank';
function report(q) {
  const title = `[${q.id}] ${q.q}`.slice(0, 200);
  const body = `Question: ${q.q}\nId: ${q.id}\nTopic file: ${q.file}\n\nWhat is wrong or out of date:\n\nSource that shows it (link):\n`;
  return `<p class="report small"><a href="${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}" target="_blank" rel="noopener">Report a problem with this answer</a> <span class="muted">${esc(q.id)}</span></p>`;
}
function answer(q) {
  const f = q.f, fu = f['Follow-ups'] ? (f['Follow-ups'].match(/^\s*- /gm) || []).length : 0;
  return `<div class="body">${f.extra ? md(f.extra) : ''}${sayHtml(f.Say)}
    ${f['In the slot'] ? `<div class="say"><div class="lbl">Enough for the time limit</div>${md(f['In the slot'])}</div>` : ''}
    ${f.Trap ? `<div class="trap"><div class="lbl">Common trap</div>${md(f.Trap)}</div>` : ''}
    ${f['Full process'] ? `<details class="block"><summary>Full explanation <span class="hint">steps and code</span></summary><div class="inner">${md(f['Full process'])}</div></details>` : ''}
    ${fu ? `<details class="block"><summary>Follow-up questions <span class="hint">${fu} the interviewer may ask next</span></summary><div class="inner">${followUps(f['Follow-ups'])}</div></details>` : ''}
    ${f.Source ? sources(f.Source) : ''}${report(q)}</div>`;
}
const tierBadge = t => `<span class="tier ${t}" title="${esc(TIERS[t])}">${t}</span>`;
const crumbs = q => `<div class="crumbs">${tierBadge(q.tier)}<span>${esc(fileMeta(q.file))}</span><span>${inline(q.sec)}</span></div>`;
const infoTiers = () => `<span class="info" tabindex="0">?<span class="tip"><b>What do Core, Standard and Niche mean?</b>${Object.entries(TIERS).map(([n, d]) => `<p>${tierBadge(n)} ${d}</p>`).join('')}</span></span>`;

function overall() {
  const n = Q.filter(known).length, due = dueList(store, today()).length;
  $('ov-text').innerHTML = `${n} / ${Q.length}<span class="ov-word"> known</span>`; $('ov-bar').style.width = (100 * n / Q.length) + '%';
  $('tab-review').innerHTML = `Review${due ? ` <span class="badge" title="Due today">${due}</span>` : ''}`;
}

