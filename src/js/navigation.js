// ---------- navigation ----------
let view = 'home', topic = null, current = null;
const filter = { text: '', core: false };
function go(v, arg) {
  view = v;
  $('tab-learn').classList.toggle('on', v === 'home' || v === 'learn');
  $('tab-quiz').classList.toggle('on', v === 'setup' || v === 'quiz');
  $('home').classList.toggle('hidden', v !== 'home');
  $('learn').classList.toggle('hidden', v !== 'learn');
  $('quiz').classList.toggle('hidden', v !== 'setup' && v !== 'quiz');
  if (v === 'home') renderHome();
  if (v === 'learn') { topic = arg; current = null; filter.text = ''; renderLearn(); }
  if (v === 'setup') renderSetup();
  overall(); window.scrollTo(0, 0);
}

