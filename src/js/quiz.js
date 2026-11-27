// ---------- quiz ----------
const qs = { topics: new Set(), tier: 'Core', size: 20, onlyNew: true };
let deck = [], pos = 0, shown = false, result = { hit: [], shaky: [], miss: [] };
function pool() {
  const tiers = { Core: ['Core'], Standard: ['Core', 'Standard'], All: ['Core', 'Standard', 'Niche'] }[qs.tier];
  return Q.filter(q => (!qs.topics.size || qs.topics.has(q.file)) && tiers.includes(q.tier) && (!qs.onlyNew || !known(q)));
}
function toggleTopic(f) { qs.topics.has(f) ? qs.topics.delete(f) : qs.topics.add(f); renderSetup(); }
function renderSetup() {
  const n = pool().length;
  $('quiz').innerHTML = `<div class="wrap"><div class="card setup">
    <h2>Quiz yourself</h2><p class="muted" style="margin:0">One question at a time. Say your answer out loud, reveal it, then be honest: did you know it?</p>
    <h3>Topics <span class="muted">(none selected means all)</span></h3>
    <div class="chips">${files.map(f => `<button class="chip ${qs.topics.has(f) ? 'on' : ''}" onclick="toggleTopic('${f}')">${esc(fileMeta(f))}</button>`).join('')}</div>
    <h3>Which questions ${infoTiers()}</h3>
    <div class="chips">${[['Core', 'Core only (most asked)'], ['Standard', 'Core + Standard'], ['All', 'Everything']].map(([v, l]) => `<button class="chip ${qs.tier === v ? 'on' : ''}" onclick="qs.tier='${v}';renderSetup()">${l}</button>`).join('')}</div>
    <h3>How many</h3>
    <div class="chips">${[10, 20, 50, 0].map(v => `<button class="chip ${qs.size === v ? 'on' : ''}" onclick="qs.size=${v};renderSetup()">${v || 'All'}</button>`).join('')}</div>
    <h3>Options</h3>
    <label class="switch"><input type="checkbox" ${qs.onlyNew ? 'checked' : ''} onchange="qs.onlyNew=this.checked;renderSetup()"> Skip questions I already know</label>
    <div class="startrow"><button class="btn primary" ${n ? '' : 'disabled'} onclick="startQuiz()">Start ${Math.min(n, qs.size || n)} questions</button>
      <span class="muted small">${n} match these settings</span></div></div></div>`;
}
// The daily mix keeps its order (reviews first, then new questions); every other quiz is shuffled.
// round: 'mix' (the daily mix, in order), 'more' (Keep going) or 'quiz' (anything else, shuffled).
let round = 'quiz';
function startQuiz(list, inOrder) {
  round = inOrder ? 'mix' : 'quiz';
  deck = list ? list.slice() : pool();
  if (!inOrder) for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  if (!list && qs.size) deck = deck.slice(0, qs.size);
  pos = 0; shown = false; result = { hit: [], shaky: [], miss: [] }; go('quiz');
}
// Keep going: one question at a time in the order of picking, with no count, until End or until none is left.
function keepGoing() {
  const q = nextExtra();
  if (!q) return;
  round = 'more'; deck = [q]; pos = 0; shown = false; result = { hit: [], shaky: [], miss: [] }; go('quiz');
}
function endRound() { if (round !== 'more') return go('setup'); deck = deck.slice(0, pos); renderSummary(); }
function renderQuiz() {
  if (pos >= deck.length) return renderSummary();
  const q = deck[pos];
  $('quiz').innerHTML = `<div class="qstage">
    <div class="qtop"><span>${round === 'more' ? `${pos} answered` : `${pos + 1} / ${deck.length}`}</span>${roundBar()}<button class="btn small" onclick="endRound()">End</button></div>
    <div class="card qcard">${crumbs(q)}<h2>${inline(q.q)}</h2>${given(q)}
      ${shown ? answer(q) : `<div class="reveal"><p class="muted">Answer out loud first. Then check yourself.</p>
        <button class="btn primary" onclick="reveal()">Show answer <span class="kbd">Space</span></button></div>`}</div></div>
    ${shown ? `<div class="rate"><button class="btn miss" onclick="rate('missed')">Didn't know <span class="kbd">1</span></button>
      <button class="btn shaky" onclick="rate('shaky')">Shaky <span class="kbd">2</span></button>
      <button class="btn hit" onclick="rate('known')">Knew it <span class="kbd">3</span></button></div>` : ''}`;
  window.scrollTo(0, 0);
}
// The round so far: knew it, shaky and didn't know as parts of the whole round.
function roundBar() {
  const [h, s, m] = [result.hit.length, result.shaky.length, result.miss.length], all = round === 'more' ? Math.max(h + s + m, 1) : deck.length;
  const w = n => (100 * n / all).toFixed(1) + '%';
  return `<span class="bar" role="img" aria-label="${h} knew it, ${s} shaky, ${m} didn't know"><i class="k" style="width:${w(h)}"></i><i class="s" style="width:${w(s)}"></i><i class="m" style="width:${w(m)}"></i></span>`;
}
function reveal() { shown = true; renderQuiz(); }
function rate(g) {
  const q = deck[pos];
  update(s => grade(s, q.k, g));
  result[{ known: 'hit', shaky: 'shaky', missed: 'miss' }[g]].push(q);
  overall(); pos++; shown = false;
  if (round === 'more' && pos >= deck.length) { const n = nextExtra(new Set(deck.map(d => d.k))); if (n) deck.push(n); }
  renderQuiz();
}
function renderSummary() {
  const more = round !== 'quiz' && !todayMix().some(q => !doneToday(q)) && nextExtra();
  const h = result.hit.length, again = [...result.shaky, ...result.miss], m = again.length, pct = h + m ? Math.round(100 * h / (h + m)) : 0;
  $('quiz').innerHTML = `<div class="qstage"><div class="card summary">
    <h2>Round finished</h2>
    <div class="stats3"><div><b>${h}</b><span class="muted">knew it</span></div><div><b>${m}</b><span class="muted">to review</span></div><div><b>${pct}%</b><span class="muted">score</span></div></div>
    ${m ? `<ul class="missed">${again.map(q => `<li>${result.shaky.includes(q) ? '<span class="tag Shaky">Shaky</span>' : `<span class="tag Missed">Didn't know</span>`}<span>${inline(q.q)}</span></li>`).join('')}</ul>` : ''}
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      ${more ? `<button class="btn primary" onclick="keepGoing()">Keep going</button>` : ''}
      ${m ? `<button class="btn ${more ? '' : 'primary'}" onclick="startQuiz([...result.shaky, ...result.miss])">Repeat the ${m} to review</button>` : ''}
      <button class="btn" onclick="go('setup')">New round</button></div></div></div>`;
}

