// ---------- offline copy on Pages (docs/phase6-spec.md, section 6, idea 69) ----------
// Over http(s) only: the install file and a service worker beside the page (sw.js, built by tools/build.py) keep a copy
// in this browser. By file:// nothing is added, so a double-clicked page behaves as before.
let offlineReady = false;
const offlineNote = () => offlineReady ? '<p class="small" id="offline-note">This copy works offline in this browser after this visit.</p>' : '';
function offlineSetup() {
  if (!/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return;
  for (const [rel, href] of [['manifest', 'manifest.webmanifest'], ['apple-touch-icon', 'apple-touch-icon.png']]) {
    const link = document.createElement('link');
    link.rel = rel; link.href = href;
    document.head.append(link);
  }
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    offlineReady = true;
    const foot = document.querySelector('.homefoot');
    if (foot && !$('offline-note')) foot.insertAdjacentHTML('beforeend', offlineNote());
  }, () => {});  // no worker (a plain local server without sw.js): the page works as before, online only
}
