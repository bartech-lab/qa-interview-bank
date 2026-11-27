// ---------- keys ----------
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
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
  overall();
  if (view === 'home') renderHome();
  if (view === 'review') renderReview();
  if (view === 'learn') renderSide();
});
const THEMES = ['auto', 'light', 'dark'];
function theme() { try { const t = localStorage.getItem(THEME_KEY); return THEMES.includes(t) ? t : 'auto'; } catch (e) { return 'auto'; } }
function showTheme() {
  const t = theme(), b = $('theme-btn'), name = t[0].toUpperCase() + t.slice(1);
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  b.textContent = { auto: '🌓', light: '☀️', dark: '🌙' }[t];
  b.setAttribute('aria-label', `Theme: ${name}`); b.title = `Theme: ${name}. Click to change.`;
}
function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(theme()) + 1) % 3];
  try { if (next === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch (e) {}
  showTheme();
}
showTheme();
showSaveError();
go('home');
