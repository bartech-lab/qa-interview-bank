// ---------- learn ----------
function learnList() {
  const s = filter.text.toLowerCase();
  return Q.filter(q => q.file === topic && (!filter.core || q.tier === 'Core') && (!s || q.k === s || searchText(q).includes(s)));
}
// What a search looks in: the title, the shown answer and a card's company. The hidden "Topic: … | id: …" line is left out,
// so "core" or "my-cards" does not match every question. Cached on the question; syncCards() makes new card objects.
const searchText = q => q.find ??= `${q.q}\n${q.body.replace(/^Topic: .*$/m, '')}\n${q.company || ''}`.toLowerCase();
function renderSide() {
  const list = learnList(), cur = Q[current], secs = [...new Set(list.map(q => q.sec))];
  $('side-list').innerHTML = secs.map(sec => { const qs = list.filter(q => q.sec === sec), open = (cur && cur.sec === sec) || filter.text || topic === CARDS;  // card lists are short: every company stays open
    return `<details ${open ? 'open' : ''}><summary>${inline(sec)}<span class="n">${qs.filter(known).length}/${qs.length}</span></summary>
      ${qs.map(q => `<div class="qlink ${q.i === current ? 'on' : ''}" onclick="pick(${q.i})"><span class="dot ${known(q) ? 'done' : ''}"></span><span>${inline(q.q)}</span></div>`).join('')}</details>`; }).join('')
    || `<p class="muted" style="padding:16px">${topic === CARDS && !filter.text ? 'No cards yet.' : 'No question matches.'}</p>`;
}
function renderLearn() {
  const list = learnList();
  if (!list.some(q => q.i === current)) current = list[0] ? list[0].i : null;
  $('side').innerHTML = `<div class="side-head">
      <button class="back" onclick="go('home')">← All topics</button>
      <div class="side-title">${esc(fileMeta(topic))}</div>
      <input class="search" id="lsearch" type="search" placeholder="Search in this topic…" value="${esc(filter.text)}">
      ${topic === CARDS ? `<button class="btn" id="card-add-side" onclick="cardNew()">Add a card</button>` : `<label class="switch"><input type="checkbox" id="lcore" ${filter.core ? 'checked' : ''}> Core questions only</label>
      <span class="muted small" style="line-height:1.4">${tierBadge('Core')} = most asked: in 30%+ of QA job ads, or set by hand.</span>`}
      ${topic === '01-playwright' ? `<button class="btn drill-open" id="drill-open" onclick="go('locators')">Locator drill</button>
        <span class="muted small" style="line-height:1.4">Type a locator and see what it matches on a real page.</span>` : ''}
    </div><div id="side-list"></div>`;
  $('lsearch').oninput = e => { filter.text = e.target.value; refresh(); };
  if ($('lcore')) $('lcore').onchange = e => { filter.core = e.target.checked; refresh(); };
  renderSide(); renderArticle();
}
function refresh() {  // re-filter without rebuilding the search box, so typing keeps focus
  const list = learnList();
  if (!list.some(q => q.i === current)) current = list[0] ? list[0].i : null;
  renderSide(); renderArticle();
}
function renderArticle() {
  if (topic === CARDS && cardEdit) { $('reader').innerHTML = cardForm(); $('card-q').focus(); return; }
  if (current === null) { $('reader').innerHTML = '<div class="article muted">No question matches.</div>'; return; }
  const list = learnList(), q = Q[current], idx = list.indexOf(q), prev = list[idx - 1], next = list[idx + 1];
  $('reader').innerHTML = `<article class="article">${crumbs(q)}<h2>${inline(q.q)}</h2>${given(q)}${isPredict(q) ? `<details class="block predict-answer"><summary>Show the answer <span class="hint">run it first</span></summary><div class="inner">${answer(q)}</div></details>` : answer(q)}
    ${q.slug === 'pw-locators' ? `<p class="drill-row"><button class="btn small drill-link" onclick="go('locators')">Practise in the locator drill</button></p>` : ''}
    <div class="navrow">
      <button class="btn known-btn ${known(q) ? 'on' : ''}" aria-pressed="${known(q)}" onclick="toggleMark('known')">${known(q) ? '✓ I know this' : 'Mark as known'}</button>
      <button class="btn shaky-btn ${store.shaky[q.k] ? 'on' : ''}" aria-pressed="${!!store.shaky[q.k]}" onclick="toggleMark('shaky')">${store.shaky[q.k] ? '✓ Shaky' : 'Shaky'}</button>
      <div class="grow"></div>
      <button class="btn" ${prev ? '' : 'disabled'} onclick="pick(${prev ? prev.i : ''})">← Previous</button>
      <button class="btn primary" ${next ? '' : 'disabled'} onclick="pick(${next ? next.i : ''})">Next →</button>
    </div><p class="muted small" style="text-align:right">Tip: the ← and → keys work too</p>
    <label class="notebox"><span>My note</span><textarea class="note" aria-label="My note" rows="3" placeholder="What to remember, an example from your own work, a link" oninput="noteSave(${q.i}, this.value)">${esc(store.notes[q.k] || '')}</textarea></label>${q.own ? cardTools(q) : ''}</article>`;
  $('reader').scrollTop = 0;
}
function pick(i) { current = i; renderSide(); renderArticle(); const el = $('side').querySelector('.qlink.on'); if (el) el.scrollIntoView({ block: 'nearest' });
  if (matchMedia('(max-width:860px)').matches) $('reader').scrollIntoView({ block: 'start' }); }  // phones: the list sits above; show the question
// Marks made while reading count for spaced review like quiz answers; pressing a pressed mark again clears it.
function toggleMark(m) { const q = Q[current]; update(s => { if (s[m][q.k]) unmark(s, q.k); else grade(s, q.k, m); }); overall(); renderSide(); renderArticle(); }
function noteSave(i, value) { update(s => { if (value.trim()) s.notes[Q[i].k] = value; else delete s.notes[Q[i].k]; }); }

