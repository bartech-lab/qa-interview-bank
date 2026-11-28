// ---------- keys ----------
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;  // contenteditable: the code editor
  if (view === 'quiz' && pos < deck.length) {
    if (e.key === ' ' && !shown) { e.preventDefault(); reveal(); }
    if (shown && ['1', '2', '3'].includes(e.key)) rate(['missed', 'shaky', 'known'][e.key - 1]);
  }
  if (view === 'learn' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const list = learnList(), n = list[list.findIndex(q => q.i === current) + (e.key === 'ArrowRight' ? 1 : -1)];
    if (n) pick(n.i);
  }
});
// Another tab saved: show its changes. Saving does not depend on this event (see update()).
window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY && e.key !== null) return;
  if (!saveFailed) store = read() || store;
  syncCards();
  overall();
  if (view === 'home') renderHome();
  if (view === 'review') renderReview();
  if (view === 'learn') renderSide();
});
const THEMES = ['auto', 'light', 'dark'];
const THEME_ICONS = {  // half-filled circle, sun, moon
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
};
function theme() { try { const t = localStorage.getItem(THEME_KEY); return THEMES.includes(t) ? t : 'auto'; } catch (e) { return 'auto'; } }
function showTheme() {
  const t = theme(), b = $('theme-btn'), name = t[0].toUpperCase() + t.slice(1);
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${THEME_ICONS[t]}</svg>`;
  b.setAttribute('aria-label', `Theme: ${name}`); b.title = `Theme: ${name}. Click to change.`;
}
function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(theme()) + 1) % 3];
  try { if (next === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch (e) {}
  showTheme();
}
showTheme();
// The questions are packed in the page: unpack them, then draw home and flag the page as ready (docs/phase3-spec.md).
async function boot() {
  let list;
  try { list = JSON.parse(await unpackText('data')); } catch (e) {
    $('home').innerHTML = '<p class="boot-error" role="alert">This browser cannot unpack the questions. Use a current Chrome, Edge, Firefox or Safari.</p>';
    return;
  }
  prepare(list);
  showSaveError();
  go('home');
  openFromAddress();
  document.documentElement.dataset.ready = '1';
  offlineSetup();
}
// Addresses other pages link to (docs/phase4-spec.md): #q0158 opens that question in Learn, #locators the locator drill (under Learn).
// Anything else, or an unknown id, leaves home open.
function openFromAddress() {
  const h = location.hash.slice(1);
  if (h === 'locators') { go('locators'); return; }
  const i = /^q\d{4}$/.test(h) ? Q.findIndex(q => q.id === h) : -1;
  if (i < 0) return;
  go('learn', Q[i].file);
  pick(i);
}
addEventListener('hashchange', () => { if (document.documentElement.dataset.ready === '1') openFromAddress(); });
boot();
