// ---------- locator trainer (idea 50, docs/phase4-spec.md) ----------
// Frozen e2e-casebook pages run in a sandboxed frame with Playwright's locator engine (playwright-injected, packed part pwi).
// The page sends the cleaned locator text; the frame reads it, matches, marks the matches and answers with element indexes.
const LOC_METHODS = /^(getByRole|getByText|getByLabel|getByPlaceholder|getByAltText|getByTitle|getByTestId|locator)\(/;
const LOC_MSG = {
  empty: "Type a locator, for example getByRole('button', { name: 'Save' }).",
  unsupported: 'This is not a locator the trainer can read. Start with getByRole, getByText, getByLabel, getByPlaceholder, getByAltText, getByTitle, getByTestId or locator, and leave out actions such as click().',
  unpack: 'This browser cannot unpack the locator trainer. Use a current Chrome, Edge, Firefox or Safari.',
};
const loc = { data: null, engine: '', page: null, task: null, seq: 0, ready: false, pending: null, timer: 0, shown: false };

// A quote character, or a / that starts a regex literal (after ( , : [ { or at the start), opens a span the scanners skip.
function quoteAt(t, i) {
  const c = t[i];
  if (c === "'" || c === '"' || c === '`') return c;
  return c === '/' && /(^|[(,:[{])\s*$/.test(t.slice(0, i)) ? '/' : null;
}
// Removes what Playwright code carries around a locator: spaces, one leading await, a trailing ;, and page. before a locator.
// Text inside quotes is left alone.
function cleanLocator(text) {
  const t = text.trim().replace(/^await\s+/, '').replace(/;\s*$/, '').trim();
  let out = '', quote = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < t.length) out += t[++i];
      else if (c === quote) quote = null;
      continue;
    }
    if (quoteAt(t, i)) { quote = c; out += c; continue; }
    if (t.startsWith('page.', i) && (i === 0 || /[\s(,:{[]/.test(t[i - 1]))) { i += 4; continue; }
    out += c;
  }
  return out;
}

// Runs inside the frame, after playwright-injected has set the global PWI. Messages come only from the bank page.
function locBridge() {
  const ua = navigator.userAgent;
  const inj = new PWI.InjectedScript(window, { isUnderTest: false, sdkLanguage: 'javascript', testIdAttributeName: 'data-testid', stableRafCount: 0,
    browserName: /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chromium' : 'webkit', customEngines: [] });
  // A frozen page goes nowhere: links, buttons and forms do nothing.
  for (const t of ['click', 'auxclick', 'dblclick', 'submit']) addEventListener(t, e => e.preventDefault(), true);
  // Playwright's reader refuses a locator('...') whose selector it cannot parse; page.locator() passes it on and the engine throws,
  // so a single locator('...') call goes to the engine as it is.
  const single = /^locator\((['"`])((?:\\.|(?!\1)[^\\])*)\1\)$/;
  const readOne = text => {
    const s = PWI.locatorOrSelectorAsSelector('javascript', text, 'data-testid');
    if (s && s !== text) return s;
    const m = single.exec(text);
    return m ? m[2].replace(/\\(.)/g, '$1') : '';
  };
  // The first .or( or .and( outside quotes and brackets: [index, 'or' | 'and', index of its closing bracket], or null.
  function combinator(text) {
    let depth = 0, quote = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
      if (quoteAt(text, i)) quote = c;
      else if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (depth === 0 && c === '.') {
        const op = /^\.(or|and)\(/.exec(text.slice(i));
        if (!op) continue;
        let d = 0, q = null;
        for (let j = i + op[0].length - 1; j < text.length; j++) {
          const x = text[j];
          if (q) { if (x === '\\') j++; else if (x === q) q = null; continue; }
          if (quoteAt(text, j)) q = x;
          else if (x === '(') d++;
          else if (x === ')' && --d === 0) return [i, op[1], j];
        }
        return null;
      }
    }
    return null;
  }
  // Playwright's text reader has no .or() and .and(); a.or(b) in a test becomes a >> internal:or="<b>", so the trainer builds
  // the same selector. Only calls at the top of the chain are read this way; one nested inside filter() stays unreadable.
  // A has: or hasNot: value that holds .or( or .and( is read on its own and put back as the selector Playwright builds for it.
  function readHas(text) {
    const subs = [];
    let out = '', i = 0, quote = null;
    while (i < text.length) {
      const c = text[i];
      if (quote) { out += c; if (c === '\\') out += text[++i] || ''; else if (c === quote) quote = null; i++; continue; }
      if (quoteAt(text, i)) { quote = c; out += c; i++; continue; }
      const m = /^(has|hasNot)\s*:\s*/.exec(text.slice(i));
      if (!m || (i > 0 && /[\w$]/.test(text[i - 1]))) { out += c; i++; continue; }
      let j = i + m[0].length, d = 0, q = null;
      for (; j < text.length; j++) {
        const x = text[j];
        if (q) { if (x === '\\') j++; else if (x === q) q = null; continue; }
        if (quoteAt(text, j)) q = x;
        else if (x === '(' || x === '{' || x === '[') d++;
        else if (x === ')' || x === '}' || x === ']') { if (d === 0) break; d--; }
        else if (x === ',' && d === 0) break;
      }
      const value = text.slice(i + m[0].length, j).trim();
      if (combinator(value)) { subs.push(value); out += `${m[1]}: locator('__qa_has${subs.length - 1}__')`; }
      else out += text.slice(i, j);
      i = j;
    }
    return [out, subs];
  }
  // Playwright's reader takes one option per filter({ ... }). A test's filter({ hasText, has }) applies its options one after
  // another in this order (Playwright's Locator), so the trainer writes them as consecutive filters.
  const FILTER_ORDER = ['hasText', 'hasNotText', 'has', 'hasNot', 'visible'];
  function splitFilters(text) {
    let out = '', i = 0, quote = null;
    while (i < text.length) {
      const c = text[i];
      if (quote) { out += c; if (c === '\\') out += text[++i] || ''; else if (c === quote) quote = null; i++; continue; }
      if (quoteAt(text, i)) { quote = c; out += c; i++; continue; }
      const m = /^\.filter\(\s*\{/.exec(text.slice(i));
      if (!m) { out += c; i++; continue; }
      const parts = [];
      let j = i + m[0].length, start = j, d = 0, q = null;
      for (; j < text.length; j++) {
        const x = text[j];
        if (q) { if (x === '\\') j++; else if (x === q) q = null; continue; }
        if (quoteAt(text, j)) q = x;
        else if (x === '(' || x === '{' || x === '[') d++;
        else if ((x === ')' || x === ']') && d > 0) d--;
        else if (x === '}' && d > 0) d--;
        else if ((x === ',' || x === '}') && d === 0) { parts.push(text.slice(start, j).trim()); start = j + 1; if (x === '}') break; }
      }
      const close = /^\}\s*\)/.exec(text.slice(j));
      const opts = parts.filter(Boolean).map(o => [(/^(\w+)\s*:/.exec(o) || [])[1], o]);
      if (!close || !opts.length || opts.some(([k]) => !FILTER_ORDER.includes(k))) { out += c; i++; continue; }
      opts.sort((x, y) => FILTER_ORDER.indexOf(x[0]) - FILTER_ORDER.indexOf(y[0]));
      out += opts.map(([, o]) => `.filter({ ${splitFilters(o)} })`).join('');
      i = j + close[0].length;
    }
    return out;
  }
  const read = raw => {
    const text = splitFilters(raw);
    const [plain, subs] = readHas(text);
    if (subs.length) {
      let sel = read(plain);
      for (const [n, value] of subs.entries()) {
        const inner = read(value), mark = JSON.stringify(`__qa_has${n}__`);
        if (!sel || !inner || !sel.includes(mark)) return '';
        sel = sel.replace(mark, () => JSON.stringify(inner));
      }
      return sel;
    }
    const cut = combinator(text);
    if (!cut) return readOne(text);
    const [i, op, j] = cut;
    const left = read(text.slice(0, i)), right = read(text.slice(i + op.length + 2, j));
    if (!left || !right) return '';
    const joined = `${left} >> internal:${op}=${JSON.stringify(right)}`;
    const rest = text.slice(j + 1);
    if (!rest) return joined;
    const mark = '__qa_joined__', more = read(`locator('${mark}')${rest}`);
    return more.startsWith(mark) ? joined + more.slice(mark.length) : '';
  };
  const match = sel => inj.querySelectorAll(inj.parseSelector(sel), document);
  const index = els => { const all = [...document.querySelectorAll('*')]; return els.map(e => all.indexOf(e)); };
  function show(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (/(auto|scroll)/.test(st.overflowY) && p.scrollHeight > p.clientHeight) p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - p.clientHeight / 3;
    }
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) window.scrollBy(0, r.top - innerHeight / 3);
  }
  addEventListener('message', e => {
    if (e.source !== parent || !e.data || typeof e.data.seq !== 'number') return;
    const { seq, text, ref } = e.data;
    document.querySelectorAll('[data-qa-match]').forEach(el => el.removeAttribute('data-qa-match'));
    const out = { seq };
    if (text) {
      const sel = read(text);
      if (!sel) out.state = 'unsupported';
      else {
        try {
          const els = match(sel);
          els.forEach(el => el.setAttribute('data-qa-match', ''));
          out.ids = index(els);
          if (els[0]) show(els[0]);
        } catch (err) { out.state = 'invalid'; out.error = String((err && err.message) || err).split('\n')[0]; }
      }
    }
    if (ref) { try { out.ref = index(match(read(ref))); } catch (err) { out.ref = null; } }
    parent.postMessage(out, '*');
  });
  parent.postMessage({ ready: true }, '*');
}

async function locLoad() {
  if (!loc.data) {
    const [data, engine] = await Promise.all([unpackText('frozen'), unpackText('pwi')]);
    loc.data = JSON.parse(data);
    loc.engine = engine;
  }
}

async function renderLocators() {
  const box = $('locators');
  if (!loc.data) {
    try { await locLoad(); } catch (e) { box.innerHTML = `<p class="loc-error" role="alert">${LOC_MSG.unpack}</p>`; return; }
  }
  if (view !== 'locators') return;
  const pages = loc.data.pages;
  if (!loc.page) loc.page = (pages.find(p => p.id === store.locPage) || pages[0]).id;
  box.innerHTML = `<div class="loc-wrap">
    <section class="loc-panel">
      <h2>Locator trainer</h2>
      <p class="muted small">Type a Playwright locator. Its matches light up on a frozen copy of an e2e-casebook page, read by Playwright's own locator engine.</p>
      <label class="loc-field">Frozen page <select id="loc-page" onchange="locPick(this.value)">${pages.map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></label>
      <label class="loc-field">Locator <input id="loc-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" oninput="locTyped()"></label>
      <p id="loc-state" role="status"></p>
      <h3>Tasks on this page</h3>
      <ol id="loc-tasks" aria-label="Tasks on this page"></ol>
      <p id="loc-verdict" role="status"></p>
      <p id="loc-reveal" hidden><button class="btn small" onclick="locReveal()">Show an answer</button> <code id="loc-answer" hidden></code></p>
      <p class="small"><a id="loc-case" target="_blank" rel="noopener"></a></p>
    </section>
    <div class="loc-stage"><iframe id="loc-frame" sandbox="allow-scripts"></iframe></div>
  </div>`;
  if (!loc.listening) { addEventListener('message', locReply); loc.listening = true; }
  locShowPage();
}

function locShowPage() {
  const p = loc.data.pages.find(x => x.id === loc.page);
  $('loc-page').value = p.id;
  const link = $('loc-case');
  link.href = `https://github.com/bartech-lab/e2e-casebook/blob/main/${p.doc}`;
  link.textContent = `Case ${p.case} on e2e-casebook: ${p.caseTitle}`;
  loc.task = null;
  loc.pending = null;  // a late answer from the old page must not show
  locTasks();
  const frame = $('loc-frame');
  frame.title = `Frozen page: ${p.title}`;
  loc.ready = false;
  // No closing script tag may appear literally here: this file itself sits inside the page's one <script> element.
  const end = '<' + '/script', script = code => `<script>${code.replaceAll(end, '<\\/script')}${end}>`;
  const head = `<style>${loc.data.css}</style><style>[data-qa-match] { outline:3px solid #e8590c !important; outline-offset:2px; background-color:rgba(232,89,12,.14) !important; }</style>`
    + script(loc.engine) + script(`${quoteAt}\n(${locBridge})()`);
  frame.srcdoc = loc.data.html[p.id].replace('</head>', () => head + '</head>');  // a function: the engine code holds "$&", which a replacement string would expand
}

function locTasks() {
  const tasks = loc.data.tasks.filter(t => t.page === loc.page);
  $('loc-tasks').innerHTML = tasks.map(t => {
    const passed = !!(store.locators || {})[t.id];
    return `<li class="${passed ? 'passed' : ''}"><button class="loc-task" aria-pressed="${loc.task === t.id}"${passed ? ` aria-label="${esc(t.task)}, passed"` : ''} onclick="locChoose('${t.id}')">${esc(t.task)}</button></li>`;
  }).join('');
  const chosen = loc.data.tasks.find(t => t.id === loc.task);
  $('loc-reveal').hidden = !chosen;
  const ans = $('loc-answer');
  ans.hidden = !(chosen && loc.shown);
  ans.textContent = chosen && loc.shown ? chosen.answer : '';  // the answer is in the page only once revealed
  if (!chosen) { const v = $('loc-verdict'); v.textContent = ''; delete v.dataset.verdict; }
}

function locPick(id) {
  if (!loc.data.pages.some(p => p.id === id)) return;
  loc.page = id;
  update(s => { s.locPage = id; });
  locShowPage();
}
function locChoose(id) { loc.task = loc.task === id ? null : id; loc.shown = false; locTasks(); locSend(); }
function locReveal() { loc.shown = true; locTasks(); }
function locTyped() { clearTimeout(loc.timer); loc.timer = setTimeout(locSend, 150); }

// Sends the box text (and the chosen task's answer) to the frame; only the answer to the newest message is shown.
function locSend() {
  const input = $('loc-input');
  if (!input) return;
  const raw = input.value, text = cleanLocator(raw);
  const task = loc.data.tasks.find(t => t.id === loc.task);
  const state = !text ? 'empty' : LOC_METHODS.test(text) ? null : 'unsupported';
  loc.pending = { seq: ++loc.seq, raw, state, msg: { seq: loc.seq, text: state ? '' : text, ref: task && !state ? cleanLocator(task.answer) : '' } };
  if (loc.ready) $('loc-frame').contentWindow.postMessage(loc.pending.msg, '*');
}

function locReply(e) {
  const frame = $('loc-frame');
  if (!frame || e.source !== frame.contentWindow || !e.data) return;
  if (e.data.ready) { loc.ready = true; locSend(); return; }
  const p = loc.pending;
  if (!p || e.data.seq !== p.seq) return;
  const out = $('loc-state'), r = e.data;
  const state = p.state || r.state || (r.ids.length === 0 ? 'none' : r.ids.length === 1 ? 'one' : 'many');
  out.dataset.input = p.raw;
  out.dataset.state = state;
  if (r.ids && !p.state && !r.state) out.dataset.count = r.ids.length; else delete out.dataset.count;
  out.textContent = state === 'invalid' ? `Playwright would reject this locator: ${r.error}`
    : state === 'none' ? 'No element matches.' : state === 'one' ? '1 element matches.'
    : state === 'many' ? `${r.ids.length} elements match. An action such as click() would fail in strict mode; narrow it down.` : LOC_MSG[state];
  locVerdict(state, r);
}

function locVerdict(state, r) {
  const v = $('loc-verdict');
  const task = loc.data.tasks.find(t => t.id === loc.task);
  if (!task || !['none', 'one', 'many'].includes(state) || !Array.isArray(r.ref)) { v.textContent = ''; delete v.dataset.verdict; return; }
  const mine = [...r.ids].sort((a, b) => a - b).join(), want = [...r.ref].sort((a, b) => a - b).join();
  const n = c => c === 1 ? '1 element' : `${c} elements`;
  if (mine === want) {
    v.dataset.verdict = 'pass';
    v.textContent = 'Passed: your locator matches exactly what the task asks for.';
    if (!(store.locators || {})[task.id]) { update(s => { s.locators = s.locators || {}; s.locators[task.id] = 1; }); locTasks(); }
  } else if (r.ids.length !== r.ref.length) {
    v.dataset.verdict = 'count';
    v.textContent = `Not yet: your locator matches ${n(r.ids.length)}; the task wants ${n(r.ref.length)}.`;
  } else {
    v.dataset.verdict = 'other';
    v.textContent = 'Not yet: your locator matches other elements than the task asks for.';
  }
}
