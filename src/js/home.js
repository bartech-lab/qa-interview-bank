// ---------- home ----------
function renderHome() {
  const count = t => Q.filter(q => q.tier === t).length, step = { Core: 'Start here', Standard: 'Next', Niche: 'Only if needed' };
  $('home').innerHTML = `
    <div class="hero"><h1>Get ready for your QA interview</h1>
      <p>${Q.length} interview questions. Each one has a short answer to say out loud, a common trap, the full explanation and likely follow-ups. Pick a topic to read, or switch to <b>Quiz</b> to test yourself.</p></div>
    <div class="tiers">${Object.entries(TIERS).map(([t, d]) => `<div class="card">${tierBadge(t)} <span class="muted small">${count(t)} questions</span><b>${step[t]}</b><span class="muted small">${d}</span></div>`).join('')}</div>
    <div class="grid">${files.map(f => { const qs = Q.filter(q => q.file === f), k = qs.filter(known).length, c = qs.filter(q => q.tier === 'Core').length;
      return `<button class="card topic" onclick="go('learn','${f}')"><span class="ico">${fileMeta(f)[0]}</span><span class="name">${esc(fileMeta(f)[1])}</span>
        <span class="muted small">${qs.length} questions · ${c} Core</span><span class="meter"><i style="width:${100 * k / qs.length}%"></i></span>
        <span class="muted small">${k ? `${k} known` : 'Not started'}</span></button>`; }).join('')}</div>
    <div class="resetrow" id="resetrow">${resetRow(false)}</div>`;
}
// Reset is confirmed in the page: a browser confirm() dialog is blocked in some embedded viewers.
function resetRow(asking) {
  const k = Object.keys(store.known).length, c = Object.keys(store.code).length;
  if (!k && !c) return '<span class="muted small">Your progress is saved in this browser only.</span>';
  const what = [k && `${k} known mark${k > 1 ? 's' : ''}`, c && `${c} saved code edit${c > 1 ? 's' : ''}`].filter(Boolean).join(' and ');
  return asking
    ? `<span id="reset-ask">Delete ${what}? This cannot be undone.</span>
       <button class="btn miss" id="reset-yes" onclick="resetProgress()">Yes, reset</button>
       <button class="btn" id="reset-no" onclick="$('resetrow').innerHTML = resetRow(false)">Cancel</button>`
    : `<button class="btn small" id="reset-btn" onclick="$('resetrow').innerHTML = resetRow(true)">Reset my progress</button>`;
}
function resetProgress() { store = { known: {}, code: {} }; save(); overall(); renderHome(); }

