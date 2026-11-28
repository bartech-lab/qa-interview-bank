// ---------- own cards and company notes (docs/phase6-spec.md, section 2, idea 63) ----------
// Cards live in store.cards; Q holds the bank questions first (BANK of them), then one entry per card, rebuilt by syncCards().
const CARDS = 'my-cards', NO_COMPANY = 'No company';
let cardEdit = null, cardAsk = false, cardWarned = false;  // cardEdit: null, or { id } (id null for a new card); cardAsk: the delete question is showing;
// cardWarned: the form said the old company's note will be deleted, and the company field has not changed since
const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
const companyOf = c => (c.company || '').trim();
const noteOf = (s, name) => Object.hasOwn(s.companies, name) ? s.companies[name] : null;  // own keys only: a company may be called "constructor"
function syncCards() {
  Q.length = BANK;
  const ids = Object.keys(store.cards).sort((a, b) => {
    const x = store.cards[a], y = store.cards[b], cx = companyOf(x), cy = companyOf(y);
    if (!cx !== !cy) return cx ? -1 : 1;  // cards without a company come last
    return byName(cx, cy) || (x.created < y.created ? -1 : x.created > y.created ? 1 : 0) || (a < b ? -1 : 1);
  });
  for (const id of ids) {
    const c = store.cards[id], body = `Topic: ${CARDS} | Core | id: ${id}\n\n**Say:** ${c.a || ''}`;
    Q.push({ i: Q.length, k: id, id, own: true, file: CARDS, slug: CARDS, tier: 'Core', q: c.q, body, f: { extra: '', Say: c.a || '' },
      company: companyOf(c), sec: companyOf(c) || NO_COMPANY });
  }
  byId = Object.fromEntries(Q.map(q => [q.k, q]));
}
const cardList = () => Q.slice(BANK);
const cardsOf = company => cardList().filter(q => q.company === company);

// Home: the My cards section below Topics.
function myCardsSection() {
  const list = cardList(), groups = [...new Set(list.map(q => q.company))];
  const row = c => { const n = cardsOf(c).length;
    return `<button class="card-company" onclick="openCards(${esc(JSON.stringify(c))})"><span class="t-name">${esc(c || NO_COMPANY)}</span><span class="sr-sep"> · </span><span class="n">${plural(n, 'card')}</span></button>`; };
  return `<section id="my-cards" aria-labelledby="my-cards-title"><h2 id="my-cards-title">My cards</h2>
    ${list.length ? `<div class="card-rows">${groups.map(row).join('')}</div>`
      : '<p class="muted">Add your own questions, for example one a company asked you. They stay in this browser and go into Export progress.</p>'}
    <button class="btn small" id="card-add" onclick="cardNew()">Add a card</button></section>`;
}
function openCards(company) {
  const first = cardsOf(company)[0];
  cardEdit = null; cardAsk = false;
  go('learn', CARDS);
  if (first) pick(first.i);
}
function cardNew() {
  cardAsk = false;
  if (view !== 'learn' || topic !== CARDS) go('learn', CARDS);
  cardEdit = { id: null }; cardWarned = false; renderArticle();
}
function cardEditOpen() { cardAsk = false; cardWarned = false; cardEdit = { id: Q[current].k }; renderArticle(); }

// Learn: the add and edit form, shown instead of the article.
function cardForm() {
  const c = cardEdit.id ? store.cards[cardEdit.id] || {} : {}, names = [...new Set(cardList().map(q => q.company).filter(Boolean))].sort(byName);
  return `<form class="article card-form" id="card-form" onsubmit="event.preventDefault(); cardSave()">
    <h2>${cardEdit.id ? 'Edit card' : 'Add a card'}</h2>
    <p class="muted small">Cards stay in this browser and go into Export progress. They are never sent anywhere.</p>
    <label class="field">Question<textarea id="card-q" rows="3">${esc(c.q || '')}</textarea></label>
    <label class="field">Answer<textarea id="card-a" rows="8">${esc(c.a || '')}</textarea></label>
    <label class="field">Company (optional)<input id="card-company" type="text" list="card-companies" autocomplete="off" value="${esc(c.company || '')}" oninput="cardWarned=false"></label>
    <datalist id="card-companies">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <p id="card-msg" role="alert"></p>
    <div class="navrow"><button class="btn primary" id="card-save" type="submit">Save card</button><button class="btn" id="card-cancel" type="button" onclick="cardCancel()">Cancel</button></div></form>`;
}
function cardSave() {
  const qv = $('card-q').value, av = $('card-a').value, cv = $('card-company').value.trim(), id = cardEdit.id;
  const say = t => { $('card-msg').textContent = t; };
  if (!qv.trim()) return say('Write the question first.');
  for (const [name, v, max] of [['Question', qv, CARD_MAX], ['Answer', av, CARD_MAX], ['Company', cv, COMPANY_MAX]])
    if (v.length > max) return say(`${name} is too long: at most ${max.toLocaleString('en')} characters.`);
  if (!id && Object.keys(store.cards).length >= MAX_CARDS) return say(`You have ${MAX_CARDS} cards, the most this page keeps. Delete one to add another.`);
  // The company's note follows its last card to the new company name, so no note is left under a name no card uses.
  const old = id && store.cards[id], was = old ? companyOf(old) : '';
  const moving = was && was !== cv && noteOf(store, was) !== null && cardsOf(was).length === 1;
  if (moving && noteOf(store, cv) !== null && (noteOf(store, cv) + '\n\n' + noteOf(store, was)).length > CARD_MAX)
    return say(`The two company notes together are too long: at most ${CARD_MAX.toLocaleString('en')} characters.`);
  if (moving && !cv && !cardWarned) {
    cardWarned = true;
    return say(`This was the last card for ${was}, so its note will be deleted. Press Save card again to save.`);
  }
  let newId = id;  // an edit keeps its id, so marks and notes stay on the card
  while (!newId || (!id && byId[newId])) newId = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  update(s => {
    s.cards[newId] = { q: qv, a: av, company: cv, created: old ? old.created : today() };
    const from = noteOf(s, was), to = noteOf(s, cv);
    if (!moving || from === null) return;
    if (cv) s.companies[cv] = to === null ? from : to + '\n\n' + from;
    delete s.companies[was];
  });
  syncCards();
  cardEdit = null; cardWarned = false;
  current = byId[newId].i;
  overall(); renderSide(); renderArticle();
}
function cardCancel() {
  cardEdit = null;
  if (!cardList().length) return go('home');
  renderArticle();
}

// Learn: a card's own parts under its answer: the company note, Edit and Delete.
function cardTools(q) {
  const last = q.company && cardsOf(q.company).length === 1;
  return `${q.company ? `<label class="notebox"><span>Note for ${esc(q.company)}</span><textarea class="note company-note" aria-label="Note for ${esc(q.company)}" rows="3"
      placeholder="What this company asked, who you talked to, what to prepare" oninput="companyNoteSave(${esc(JSON.stringify(q.company))}, this.value)">${esc(noteOf(store, q.company) || '')}</textarea></label>
      <p id="card-msg" role="alert"></p>` : ''}
    <div class="navrow card-tools">${cardAsk
      ? `<span id="card-delete-ask">Delete this card? Its marks and note go too.${last ? ` It is the last card for ${esc(q.company)}, so its company note goes too.` : ''}</span>
         <button class="btn miss" id="card-delete-yes" onclick="cardDelete()">Yes, delete</button><button class="btn" id="card-delete-no" onclick="cardAsk=false;renderArticle()">Cancel</button>`
      : `<button class="btn" id="card-edit" onclick="cardEditOpen()">Edit card</button><button class="btn" id="card-delete" onclick="cardAsk=true;renderArticle()">Delete card</button>`}</div>`;
}
function companyNoteSave(company, value) {
  const msg = $('card-msg');
  if (value.trim() && noteOf(store, company) === null && Object.keys(store.companies).length >= MAX_COMPANIES) {
    if (msg) msg.textContent = `You have notes for ${MAX_COMPANIES} companies, the most this page keeps.`;
    return;
  }
  if (value.length > CARD_MAX) { if (msg) msg.textContent = `Note is too long: at most ${CARD_MAX.toLocaleString('en')} characters.`; return; }
  if (msg) msg.textContent = '';
  update(s => { if (value.trim()) s.companies[company] = value; else delete s.companies[company]; });
}
function cardDelete() {
  const q = Q[current], id = q.k, company = q.company, last = company && cardsOf(company).length === 1;
  const list = learnList(), at = list.indexOf(q);
  update(s => { delete s.cards[id]; unmark(s, id); delete s.notes[id]; delete s.code[id]; if (last) delete s.companies[company]; });
  cardAsk = false;
  syncCards();
  const rest = learnList();
  if (!rest.length) return go('home');
  current = rest[Math.min(at, rest.length - 1)].i;
  overall(); renderSide(); renderArticle();
}
