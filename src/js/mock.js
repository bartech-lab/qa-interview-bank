// ---------- mock interview (docs/phase6-spec.md, section 4, idea 61) ----------
// The clock is read from Date.now(), so a hidden tab or a slow timer never makes it lag. Typed answers stay in memory only.
const GUIDE = ['Direct answer in one sentence.', 'How it works, or the technique.', 'An example from your own work.', 'The trade-off, or when not to use it.'];
const MOCK_AMBER_MS = 90000;
const mock = { start: 0, stopped: null, guide: false, texts: {}, times: {}, tick: null };
const clockText = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function mockReset() { mockStop(); mock.texts = {}; mock.times = {}; mock.start = 0; mock.stopped = null; mock.guide = false; }
function mockStop() { clearInterval(mock.tick); mock.tick = null; }
const mockElapsed = () => (mock.stopped ?? Date.now()) - mock.start;
function mockPaint() {
  const el = $('mock-timer');
  if (!el) return mockStop();
  const ms = mockElapsed();
  el.textContent = clockText(ms);
  el.classList.toggle('over', ms >= MOCK_AMBER_MS);
}
function renderMock() {
  const q = deck[pos];
  if (!shown && !mock.start) { mock.start = Date.now(); mock.stopped = null; mock.guide = false; }
  const mine = mock.texts[q.k] || '';
  $('quiz').innerHTML = `<div class="qstage mock">
    <div class="qtop"><span>${pos + 1} / ${deck.length}</span>${roundBar()}<span id="mock-timer" class="mock-timer" role="timer" aria-label="Time on this question"></span><button class="btn small" onclick="endRound()">End</button></div>
    <div class="card qcard">${crumbs(q)}<h2>${inline(q.q)}</h2>${given(q)}
      ${shown ? `${mine.trim() ? `<div class="say" id="mock-mine"><div class="lbl">Your answer</div><p class="mine-text">${esc(mine)}</p></div>` : ''}${answer(q)}`
      : `<label class="field mock-field">Your answer (optional, not saved)<textarea id="mock-text" rows="5" oninput="mock.texts[deck[pos].k]=this.value">${esc(mine)}</textarea></label>`}
      <div class="mock-guide-row">${mock.guide ? `<div class="mock-guide-box"><div class="lbl">A good answer has four parts</div><ol id="mock-guide">${GUIDE.map(g => `<li>${g}</li>`).join('')}</ol></div>`
        : `<button class="btn" id="mock-guide-btn" onclick="mock.guide=true;renderMock()">Show structure guide</button>`}</div>
      ${shown ? '' : `<div class="reveal"><button class="btn primary" id="mock-show" onclick="mockShow()">Show answer <span class="kbd">Space</span></button></div>`}</div></div>
    ${shown ? `<div class="rate"><button class="btn miss" onclick="rate('missed')">Didn't know <span class="kbd">1</span></button>
      <button class="btn shaky" onclick="rate('shaky')">Shaky <span class="kbd">2</span></button>
      <button class="btn hit" onclick="rate('known')">Knew it <span class="kbd">3</span></button></div>` : ''}`;
  mockPaint();
  if (!shown && !mock.tick) mock.tick = setInterval(mockPaint, 250);
  window.scrollTo(0, 0);
}
function mockShow() {
  const box = $('mock-text'), q = deck[pos];
  if (box) mock.texts[q.k] = box.value;
  mock.stopped = Date.now(); mockStop();
  mock.times[q.k] = mockElapsed();
  shown = true; renderMock();
}
// After a rating the next question starts its own clock.
function mockRated(q) { if (!(q.k in mock.times)) mock.times[q.k] = mockElapsed(); mock.start = 0; mock.stopped = null; mock.guide = false; mockStop(); }
function mockSummary() {
  const asked = deck.slice(0, pos), typed = asked.filter(q => (mock.texts[q.k] || '').trim());
  return `<table class="mock-times"><thead><tr><th>Question</th><th>Time</th></tr></thead><tbody>${asked.map(q => `<tr><td>${inline(q.q)}</td><td>${clockText(mock.times[q.k] || 0)}</td></tr>`).join('')}</tbody></table>
    ${typed.length ? `<p class="startrow"><button class="btn" id="mock-copy" onclick="mockCopy()">Copy my answers</button></p><div id="mock-copy-out"></div>` : ''}`;
}
function mockCopyText() {
  return deck.slice(0, pos).filter(q => (mock.texts[q.k] || '').trim()).map(q => `Q: ${q.q}\nMy answer: ${mock.texts[q.k].trim()}`).join('\n\n');
}
function mockCopy() {
  const text = mockCopyText(), fallback = () => {
    $('mock-copy-out').innerHTML = `<label class="field">Copy this text<textarea id="mock-copy-text" rows="8" readonly>${esc(text)}</textarea></label>`;
    $('mock-copy-text').select();
  };
  try { navigator.clipboard.writeText(text).then(() => { $('mock-copy').textContent = 'Copied'; }, fallback); } catch (e) { fallback(); }
}
