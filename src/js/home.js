// ---------- home ----------
function renderHome() {
  if (!store.mix || store.mix.day !== today()) update(() => {});  // save today's daily mix, so every tab and reload sees the same set
  $('home').innerHTML = `${todayCard()}
    <section class="toc" aria-labelledby="toc-title"><h2 id="toc-title">Topics</h2>
      <div class="toc-list">${files.map(topicRow).join('')}</div>
      <div class="toc-note">Each bar shows the questions you know, find shaky or didn't know, out of all questions in the topic. ${tierBadge('Core')} questions are the most asked in QA job ads. ${infoTiers()}</div></section>
    ${myCardsSection()}
    <footer class="homefoot"><div id="backuprow">${backupRow()}</div><div class="resetrow" id="resetrow">${resetRow(false)}</div>
      <p class="muted small" id="data-version">Questions: ${esc(DATA_VERSION)}, ${BANK} questions.</p>${offlineNote()}</footer>`;
}
function topicRow(f) {
  const qs = Q.filter(q => q.file === f), n = m => qs.filter(q => store[m][q.k]).length, w = m => (100 * n(m) / qs.length).toFixed(1) + '%';
  return `<button class="topic" onclick="go('learn','${f}')"><span class="t-name">${esc(fileMeta(f))}</span>
    <span class="bar" aria-hidden="true"><i class="k" style="width:${w('known')}"></i><i class="s" style="width:${w('shaky')}"></i><i class="m" style="width:${w('missed')}"></i></span>
    <span class="t-n">${n('known')} / ${qs.length}</span></button>`;
}
// Reset is confirmed in the page: a browser confirm() dialog is blocked in some embedded viewers.
function resetRow(asking) {
  const n = k => Object.keys(store[k]).length;
  if (!hasProgress(store)) return '';
  const parts = [[n('known'), 'known mark'], [n('shaky'), 'shaky mark'], [n('missed'), 'question', " you didn't know"], [n('notes'), 'note'], [n('code'), 'saved code edit'],
    [n('cards'), 'card'], [n('companies'), 'company note']];
  const what = parts.filter(([c]) => c).map(([c, w, tail = '']) => plural(c, w) + tail).join(', ').replace(/, ([^,]*)$/, ' and $1');
  return asking
    ? `<span id="reset-ask">Delete ${what}? This cannot be undone.</span>
       <button class="btn miss" id="reset-yes" onclick="resetProgress()">Yes, reset</button>
       <button class="btn" id="reset-no" onclick="$('resetrow').innerHTML = resetRow(false)">Cancel</button>`
    : `<button class="btn small" id="reset-btn" onclick="$('resetrow').innerHTML = resetRow(true)">Reset my progress</button>`;
}
// Reset deletes the saved progress, so a stale second tab cannot bring it back. The theme stays.
function resetProgress() {
  try { localStorage.removeItem(STORE_KEY); saveFailed = false; } catch (e) {}
  store = blank(); importState = { msg: null, kind: '', pending: null }; syncCards();
  showSaveError(); overall(); renderHome();
}

