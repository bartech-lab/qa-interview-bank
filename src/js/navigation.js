// ---------- navigation ----------
let view = 'home', topic = null, current = null;
const filter = { text: '', core: false };
function go(v, arg) {
  stopRuns();  // another view hides the old one without removing it, so its runs are stopped here
  view = v;
  $('tab-learn').classList.toggle('on', v === 'home' || v === 'learn');
  $('tab-quiz').classList.toggle('on', v === 'setup' || v === 'quiz');
  $('tab-review').classList.toggle('on', v === 'review');
  $('tab-locators').classList.toggle('on', v === 'locators');
  $('locators').classList.toggle('hidden', v !== 'locators');
  $('review').classList.toggle('hidden', v !== 'review');
  $('home').classList.toggle('hidden', v !== 'home');
  $('learn').classList.toggle('hidden', v !== 'learn');
  $('quiz').classList.toggle('hidden', v !== 'setup' && v !== 'quiz');
  if (v === 'home') renderHome();
  if (v === 'learn') { topic = arg; current = null; filter.text = ''; renderLearn(); }
  if (v === 'setup') renderSetup();
  if (v === 'review') renderReview();
  if (v === 'quiz') renderQuiz();
  if (v === 'locators') renderLocators();
  overall(); window.scrollTo(0, 0);
}

