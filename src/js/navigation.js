// ---------- navigation ----------
let view = 'home', topic = null, current = null;
const filter = { text: '', core: false };
function go(v, arg) {
  view = v;
  $('tab-learn').classList.toggle('on', v === 'home' || v === 'learn');
  $('tab-quiz').classList.toggle('on', v === 'setup' || v === 'quiz');
  $('tab-review').classList.toggle('on', v === 'review');
  $('review').classList.toggle('hidden', v !== 'review');
  $('home').classList.toggle('hidden', v !== 'home');
  $('learn').classList.toggle('hidden', v !== 'learn');
  $('quiz').classList.toggle('hidden', v !== 'setup' && v !== 'quiz');
  if (v === 'home') renderHome();
  if (v === 'learn') { topic = arg; current = null; filter.text = ''; renderLearn(); }
  if (v === 'setup') renderSetup();
  if (v === 'review') renderReview();
  if (v === 'quiz') renderQuiz();
  overall(); window.scrollTo(0, 0);
}

