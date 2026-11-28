// ---------- live-coding rehearsal (docs/phase6-spec.md, section 5, idea 62) ----------
// Up to five tasks against one clock. The clock is read from Date.now(); code typed here is saved as in Learn.
const RH_MAX = 5, RH_MINUTES = [30, 45, 60];
const RH_PROMPTS = ['Restate the task in your own words.', 'Say your plan before you type.', 'Name an edge case.', 'Say how you would test it.', 'Say what you would improve with more time.'];
const rhs = { picked: [], min: 45 };
let rh = null;  // the running rehearsal: { tasks, idx, end, stage, since, spent, result, tick, timeup, done }
const rhTasks = () => Q.filter(q => q.file === '13-live-coding' && q.f.Starter);
function rhSetup() {
  const full = rhs.picked.length >= RH_MAX;
  return `<h3>Tasks <span class="muted">(up to ${RH_MAX})</span></h3>
    <div class="rh-list">${rhTasks().map(q => { const on = rhs.picked.includes(q.k);
      return `<label class="rh-row"><input type="checkbox" class="rh-task" aria-label="${esc(q.q)}" ${on ? 'checked' : ''} ${!on && full ? 'disabled' : ''} onchange="rhPick('${q.k}', this.checked)"> <span>${inline(q.q)}</span></label>`; }).join('')}</div>
    <h3>Time for the whole set</h3>
    <div class="chips">${RH_MINUTES.map(m => pressed(rhs.min === m, '', `${m} min`, `rhs.min=${m};renderSetup()`, 'chip rh-min')).join('')}</div>
    <div class="startrow"><button class="btn primary" id="rh-start" ${rhs.picked.length ? '' : 'disabled'} onclick="rhStart()">Start rehearsal</button>
      <span class="muted small">${plural(rhs.picked.length, 'task')}, ${rhs.min} min</span></div>`;
}
function rhPick(id, on) {
  if (on && !rhs.picked.includes(id) && rhs.picked.length < RH_MAX) rhs.picked.push(id);
  if (!on) rhs.picked = rhs.picked.filter(k => k !== id);
  renderSetup();
}
function rhStart() {
  const now = Date.now(), tasks = rhs.picked.map(k => byId[k]).filter(Boolean);
  rh = { tasks, idx: 0, end: now + rhs.min * 60000, stage: 0, since: now, spent: {}, result: {}, tick: null, timeup: false, done: false };
  go('rh');
}
function rhNote(i, outcome) {
  if (!rh || rh.done || view !== 'rh') return;
  const q = Q[i];
  if (!rh.tasks.includes(q)) return;
  if (outcome === 'Ran' && rh.result[q.k] && rh.result[q.k] !== 'Ran') return;  // a Check verdict outranks a later plain Run
  rh.result[q.k] = outcome;
}
function rhPaint() {
  const el = $('rh-clock');
  if (!rh || !el) { if (rh) clearInterval(rh.tick); return; }
  const left = rh.end - Date.now();
  el.textContent = clockText(left);
  el.classList.toggle('over', left < 60000);
  if (left <= 0) rhFinish(true);
}
function rhSpend() { const q = rh.tasks[rh.idx], now = Date.now(); if (q) rh.spent[q.k] = (rh.spent[q.k] || 0) + Math.max(0, now - rh.since); rh.since = now; }
function renderRh() {
  if (!rh) return go('setup');
  if (rh.done) return rhSummary();
  const q = rh.tasks[rh.idx], last = rh.idx === rh.tasks.length - 1;
  $('quiz').innerHTML = `<div class="qstage rh" id="rh">
    <div class="qtop"><span id="rh-step">Task ${rh.idx + 1} of ${rh.tasks.length}</span><span class="grow"></span><span id="rh-clock" class="mock-timer" role="timer" aria-label="Time left"></span><button class="btn small" id="rh-end" onclick="rhFinish(false)">End rehearsal</button></div>
    <div class="rh-prompt-row"><div class="lbl">Think out loud</div><p id="rh-prompt" aria-live="polite">${RH_PROMPTS[rh.stage]}</p>
      <button class="btn small" id="rh-next-prompt" ${rh.stage >= RH_PROMPTS.length - 1 ? 'disabled' : ''} onclick="rh.stage++;renderRh()">Next prompt</button></div>
    <div class="card qcard">${crumbs(q)}<h2>${inline(q.q)}</h2>${given(q)}</div>
    <div class="startrow"><button class="btn primary" id="rh-next" onclick="rhNext()">${last ? 'Finish' : 'Next task'}</button></div></div>`;
  rhPaint();
  if (!rh.tick) rh.tick = setInterval(rhPaint, 250);
}
function rhNext() {
  stopRuns(); rhSpend();
  if (rh.idx >= rh.tasks.length - 1) return rhFinish(false);
  rh.idx++; rh.stage = 0; renderRh(); window.scrollTo(0, 0);
}
function rhFinish(timeup) {
  if (!rh || rh.done) return;
  stopRuns(); rhSpend();
  clearInterval(rh.tick); rh.tick = null;
  rh.done = true; rh.timeup = timeup;
  rhSummary();
}
function rhSummary() {
  $('quiz').innerHTML = `<div class="qstage"><div class="card summary" id="rh-summary">
    <h2>Rehearsal finished</h2>${rh.timeup ? '<p id="rh-timeup" role="status">Time is up.</p>' : ''}
    <table class="mock-times"><thead><tr><th>Task</th><th>Time</th><th>Result</th></tr></thead><tbody>${rh.tasks.map(q =>
      `<tr><td>${inline(q.q)}</td><td>${clockText(rh.spent[q.k] || 0)}</td><td>${rh.result[q.k] || 'Not run'}</td></tr>`).join('')}</tbody></table>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn primary" onclick="rhStart()">Same tasks again</button><button class="btn" onclick="go('setup')">New rehearsal</button></div></div></div>`;
}
