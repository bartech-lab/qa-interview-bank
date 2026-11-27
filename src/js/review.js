// ---------- spaced review: boxes wait 1, 3, 7, 14 and 30 days (docs/phase2-spec.md) ----------
const BOX_DAYS = [1, 3, 7, 14, 30];
const markOf = (s, id) => MARKS.find(m => s[m][id]) || null;
// g is 'known' (knew it), 'shaky' or 'missed' (didn't know). s is the progress being changed inside update().
function grade(s, id, g) {
  const t = today(), e = s.srs[id];
  const box = g === 'known' ? (e ? Math.min(e.box + 1, 4) : 1) : g === 'shaky' ? (e ? Math.max(e.box - 1, 0) : 0) : 0;
  let due = addDays(t, BOX_DAYS[box]);
  if (s.exam && daysBetween(t, s.exam) >= 2 && addDays(s.exam, -1) < due) due = addDays(s.exam, -1);  // last review a day before the interview
  MARKS.forEach(m => delete s[m][id]);
  s[g][id] = 1; s.srs[id] = { box, last: t, due };
}
function unmark(s, id) { MARKS.forEach(m => delete s[m][id]); delete s.srs[id]; }
const isDue = (s, id, t) => !!s.srs[id] && s.srs[id].due <= t;
const byDue = s => (a, b) => (s.srs[a.k].due < s.srs[b.k].due ? -1 : s.srs[a.k].due > s.srs[b.k].due ? 1 : 0);
const dueList = (s, t) => Q.filter(q => isDue(s, q.k, t)).sort(byDue(s));

// ---------- daily mix ----------
function seeded(text) {  // FNV-1a hash of the text seeds mulberry32
  let a = 2166136261;
  for (const c of text) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
function shuffled(list, rnd) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Due first, then shaky, then missed, then unseen Core and Standard questions taken one topic at a time.
function buildMix(s, t) {
  const rnd = seeded(t), unseen = q => !markOf(s, q.k) && !s.srs[q.k], picked = dueList(s, t).map(q => q.k);
  picked.push(...Q.filter(q => s.shaky[q.k]).map(q => q.k), ...Q.filter(q => s.missed[q.k]).map(q => q.k));
  for (const tier of ['Core', 'Standard']) {
    const piles = shuffled(files, rnd).map(f => shuffled(Q.filter(q => q.file === f && q.tier === tier && unseen(q)), rnd));
    for (let n = 0; piles.some(p => p.length > n); n++) piles.forEach(p => { if (p[n]) picked.push(p[n].k); });
    if (new Set(picked).size >= s.mixSize) break;
  }
  return [...new Set(picked)].slice(0, s.mixSize);
}
const byId = Object.fromEntries(Q.map(q => [q.k, q]));
function todayMix() {
  const t = today(), ids = store.mix && store.mix.day === t ? store.mix.ids : buildMix(store, t);
  return ids.map(id => byId[id]).filter(Boolean);
}
const doneToday = q => !!store.srs[q.k] && store.srs[q.k].last === today();
function setMixSize(n) { update(s => { s.mixSize = n; s.mix = { day: today(), ids: buildMix(s, today()) }; }); renderHome(); }

// ---------- interview date ----------
function setExam(value) { update(s => { s.exam = isDay(value) ? value : null; }); renderHome(); }
function examLines() {
  const e = store.exam, t = today();
  if (!e) return ['No interview date set', ''];
  const left = daysBetween(t, e);
  if (left < 0) return ['The interview date has passed', ''];
  if (left === 0) return ['Interview today', ''];
  const unseenCore = Q.filter(q => q.tier === 'Core' && !markOf(store, q.k) && !store.srs[q.k]).length;
  return [left === 1 ? 'Interview tomorrow' : `Interview in ${left} days`,
    unseenCore ? `To see every unseen Core question: ${Math.ceil(unseenCore / left)} a day` : ''];
}

// ---------- Today card on home ----------
function todayCard() {
  const mix = todayMix(), done = mix.filter(doneToday).length, due = dueList(store, today()).length, [line, pace] = examLines();
  return `<section id="today" class="card today" aria-label="Today">
    <div class="trow"><div class="tmain"><b>Daily mix</b><span id="mix-progress" class="muted small">${done} / ${mix.length} done today</span></div>
      <select id="mix-size" aria-label="Questions in the daily mix" onchange="setMixSize(+this.value)">${[5, 10, 20].map(n => `<option value="${n}" ${store.mixSize === n ? 'selected' : ''}>${n} a day</option>`).join('')}</select>
      <button class="btn primary" id="mix-start" ${done < mix.length ? '' : 'disabled'} onclick="startQuiz(todayMix().filter(q => !doneToday(q)))">${done < mix.length ? (done ? 'Continue the daily mix' : 'Start the daily mix') : 'Daily mix done'}</button></div>
    <div class="trow"><div class="tmain"><b>Due for review</b><span class="muted small"><span id="due-count">${due}</span> question${due === 1 ? '' : 's'} today</span></div>
      <button class="btn" onclick="go('review')">Open review</button></div>
    <div class="trow"><div class="tmain"><label for="exam-date"><b>Interview date</b></label><span id="exam-line" class="muted small">${line}</span><span id="exam-pace" class="muted small" ${pace ? '' : 'hidden'}>${pace}</span></div>
      <input type="date" id="exam-date" value="${store.exam || ''}" onchange="setExam(this.value)">
      <button class="btn" id="exam-clear" ${store.exam ? '' : 'disabled'} onclick="setExam('')">Clear</button></div>
  </section>`;
}

// ---------- Review view ----------
const rf = { by: 'All', topic: '' };
const WHY = { Due: (s, q, t) => isDue(s, q.k, t), Shaky: (s, q) => !!s.shaky[q.k], Missed: (s, q) => !!s.missed[q.k], 'With note': (s, q) => !!s.notes[q.k] };
function queue() {
  const t = today(), test = rf.by === 'All' ? (s, q) => Object.values(WHY).some(w => w(s, q, t)) : WHY[rf.by];
  const list = Q.filter(q => (!rf.topic || q.file === rf.topic) && test(store, q, t));
  return [...list.filter(q => isDue(store, q.k, t)).sort(byDue(store)), ...list.filter(q => !isDue(store, q.k, t))];
}
function renderReview() {
  const list = queue(), t = today();
  const tags = q => Object.keys(WHY).filter(w => WHY[w](store, q, t)).map(w => `<span class="tag ${w.replace(' ', '-')}">${w}</span>`).join('');
  $('review').innerHTML = `<div class="wrap"><div class="card setup review">
    <h2>Review</h2><p class="muted" style="margin:0">Questions that are due again, that you marked shaky or missed, or that carry your note.</p>
    <div class="chips rq-filters">${['All', ...Object.keys(WHY)].map(w => `<button class="chip ${rf.by === w ? 'on' : ''}" aria-pressed="${rf.by === w}" onclick="rf.by='${w}';renderReview()">${w}</button>`).join('')}</div>
    <select id="rq-topic" aria-label="Topic" onchange="rf.topic=this.value;renderReview()"><option value="">All topics</option>${files.map(f => `<option value="${f}" ${rf.topic === f ? 'selected' : ''}>${esc(fileMeta(f)[1])}</option>`).join('')}</select>
    ${list.length ? `<div class="startrow"><button class="btn primary" onclick="startQuiz(queue())">Quiz these ${list.length}</button></div>
      <div class="rq-list">${list.map(q => `<button class="rq-row" data-id="${q.k}" onclick="openQuestion(${q.i})"><span class="rq-q">${inline(q.q)}</span><span class="rq-meta">${tags(q)}<span class="muted small">${fileMeta(q.file)[0]} ${esc(fileMeta(q.file)[1])}</span></span></button>`).join('')}</div>`
    : `<p class="empty">Nothing to review here yet. Questions you mark shaky, miss in a quiz or write a note on show up here, and so do questions due again.</p>
       <button class="btn" onclick="go('setup')">Start a quiz</button>`}</div></div>`;
}
function openQuestion(i) { filter.core = false; go('learn', Q[i].file); pick(i); }
