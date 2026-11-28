// ---------- navigation ----------
let view = 'home', topic = null, current = null;
const filter = { text: '', core: false };
function go(v, arg) {
  stopRuns();  // another view hides the old one without removing it, so its runs are stopped here
  mockStop();
  if (rh && !rh.done && v !== 'rh') { rhSpend(); clearInterval(rh.tick); rh.tick = null; rh.done = true; }  // leaving ends a rehearsal
  view = v;
  $('tab-learn').classList.toggle('on', v === 'home' || v === 'learn' || v === 'locators');  // the locator drill lives under Learn
  $('tab-quiz').classList.toggle('on', v === 'setup' || v === 'quiz' || v === 'rh');
  $('tab-review').classList.toggle('on', v === 'review');
  $('locators').classList.toggle('hidden', v !== 'locators');
  $('review').classList.toggle('hidden', v !== 'review');
  $('home').classList.toggle('hidden', v !== 'home');
  $('learn').classList.toggle('hidden', v !== 'learn');
  $('quiz').classList.toggle('hidden', v !== 'setup' && v !== 'quiz' && v !== 'rh');
  if (v === 'home') renderHome();
  if (v === 'learn') { topic = arg; current = null; filter.text = ''; cardEdit = null; cardAsk = false; renderLearn(); }
  if (v === 'setup') renderSetup();
  if (v === 'review') renderReview();
  if (v === 'quiz') renderQuiz();
  if (v === 'locators') renderLocators();
  if (v === 'rh') renderRh();
  overall(); window.scrollTo(0, 0);
}

