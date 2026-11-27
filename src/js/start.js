// ---------- keys ----------
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (view === 'quiz' && pos < deck.length) {
    if (e.key === ' ' && !shown) { e.preventDefault(); reveal(); }
    if (shown && (e.key === '1' || e.key === '2')) rate(e.key === '2');
  }
  if (view === 'learn' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const list = learnList(), n = list[list.findIndex(q => q.i === current) + (e.key === 'ArrowRight' ? 1 : -1)];
    if (n) pick(n.i);
  }
});
go('home');
