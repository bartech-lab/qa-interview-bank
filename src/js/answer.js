// ---------- answer layout ----------
function fields(body) {
  const f = {}, marks = [...body.matchAll(/^\*\*(Starter|What you receive|Say|In the slot|Full process|Follow-ups|Trap|Source):\*\*/gm)];
  f.extra = (marks.length ? body.slice(0, marks[0].index) : body).replace(/^Topic: .*$/m, '').trim();
  marks.forEach((m, n) => f[m[1]] = body.slice(m.index + m[0].length, n + 1 < marks.length ? marks[n + 1].index : undefined).trim());
  return f;
}
// One sentence. A . ! ? ends it only when a space and a non-lowercase character follow, so "in..." and, "Node.js" and "1.65" stay inside.
const SENTENCE = /(?:`[^`]*`|`|[^.!?`]|[.!?](?![.!?]*["')]*(?:\s+[^a-z]|\s*$)))+(?:[.!?]+["')]*|$)\s*|[.!?]+["')]*\s*/g;
// Short answer: first sentence as a bold lead, the rest as short paragraphs of two sentences each.
function sayHtml(say) {
  if (!say) return '';
  if (/```|^\s*([-*]|\d+\.) /m.test(say)) return `<div class="say"><div class="lbl">Short answer</div>${md(say)}</div>`;
  const s = say.replace(/\s+/g, ' ').match(SENTENCE) || [say];
  const lead = s.shift(), paras = [];
  for (let i = 0; i < s.length; i += 2) paras.push(s.slice(i, i + 2).join(''));
  return `<div class="say"><div class="lbl">Short answer</div><div class="lead">${inline(lead.trim())}</div>${paras.filter(p => p.trim()).map(p => `<p>${inline(p.trim())}</p>`).join('')}</div>`;
}
function followUps(t) {
  return t.split(/\n(?=\s*- )/).map(x => x.replace(/^\s*- /, '').trim()).filter(Boolean).map(x => {
    const m = x.match(/^\*([^*]+)\*\s*([\s\S]*)$/);
    return m ? `<div class="fu"><div class="fq">${inline(m[1])}</div><div>${inline(m[2])}</div></div>` : `<div class="fu">${inline(x)}</div>`;
  }).join('');
}
function sources(t) {
  const urls = t.match(/https?:\/\/[^\s)>,]+/g) || [];
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  return urls.length ? `<div class="sources">Sources ${urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('')}</div>` : '';
}
// What the candidate gets before answering: starter code or the home task materials. Shown with the question.
// A predict question gets its code and a prediction box instead (idea 38).
function given(q) {
  if (isPredict(q)) return predictBox(q);
  const f = q.f, g = f.Starter || f['What you receive'];
  if (!g) return '';
  const code = starterCode(q);
  if (code === null) return `<div class="body"><div class="say"><div class="lbl">${f.Starter ? 'Starter code' : 'What you receive'}</div>${md(g)}</div></div>`;
  const intro = g.slice(0, g.indexOf('```')).trim(), min = taskMinutes(q), lang = starterLang(q), run = runnableTask(q);
  return `<div class="body"><div class="say"><div class="lbl">Your editor</div>${md(intro)}
    <div class="editor" data-i="${q.i}" data-lang="${lang}"><textarea class="ed" aria-label="Code editor" spellcheck="false" autocapitalize="off" autocomplete="off" oninput="edSave(${q.i}, this.value)" onkeydown="edKey(event, ${q.i})">${esc(store.code[q.k] ?? code)}</textarea>
    <div class="edbar">${run ? `<button class="btn primary run-btn" onclick="runTask(this, ${q.i})">Run</button>${lang === 'sql' ? `<button class="btn check-btn" onclick="checkTask(this, ${q.i})">Check my answer</button>` : ''}` : ''}
      ${min ? `<button class="btn tb" data-i="${q.i}" onclick="timerToggle(${q.i})">${timers[q.i] ? '■ Stop' : `▶ Start ${min} min timer`}</button><span class="clock" data-i="${q.i}"></span>` : ''}
      <button class="btn" onclick="compare(this, ${q.i})">Compare with the answer</button><button class="btn" onclick="edReset(this, ${q.i})">Reset to starter</button></div>
    ${run ? `${lang === 'sql' ? '<p class="muted small seed-note">Run and Check use the sample tables and rows from the start of this section.</p>' : ''}<div class="out" aria-live="polite"></div><div class="judge" aria-live="polite"></div>` : ''}
    <div class="cmp"></div></div></div></div>`;
}
const starterLang = q => { const m = (q.f.Starter || '').match(/```(\w*)\n/); return m ? m[1] : ''; };
const runnableTask = q => ['ts', 'sql'].includes(starterLang(q)) && !/@playwright\/test/.test(starterCode(q) || '');
const isPredict = q => /What does this print\?/.test(q.q) && predictCode(q) !== null;
function predictCode(q) { const m = (q.f['Full process'] || '').match(/^\s*```ts\b[^\n]*\n([\s\S]*?)^\s*```/m); return m ? m[1].replace(/\n$/, '') : null; }
function predictBox(q) {
  return `<div class="body"><div class="say predict"><div class="lbl">Predict the output</div><p>Write what this prints, one line per line of output. Then run it.</p>
    <pre><code>${esc(predictCode(q))}</code></pre>
    <textarea class="prediction" aria-label="Your prediction" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="Your prediction"></textarea>
    <div class="edbar"><button class="btn primary" onclick="predictRun(this, ${q.i})">Run and compare</button></div>
    <div class="out" aria-live="polite"></div><div class="predict-verdict" aria-live="polite" hidden></div></div></div>`;
}

// ---------- Run, Check, Run and compare ----------
function runTask(btn, i) {
  const box = btn.closest('.editor'), q = Q[i], code = editorCode(box), out = box.querySelector('.out');
  box.querySelector('.judge').innerHTML = '';
  return runButton(btn, ctl => starterLang(q) === 'sql' ? runSQL(code, q.seed, out, ctl) : runTS(code, out, ctl));
}
function checkTask(btn, i) {
  const box = btn.closest('.editor'), q = Q[i], code = editorCode(box), judge = box.querySelector('.judge');
  box.querySelector('.out').innerHTML = '';
  judge.innerHTML = '<div class="out-status">Checking…</div>';
  return runButton(btn, async ctl => {
    const v = await judgeSQL(q, code, ctl, judge);
    if (!judge.isConnected) return v;
    judge.innerHTML = `<div class="verdict" data-verdict="${v.verdict}">${esc(v.message)}</div>${v.detail ? `<div class="out-error">${esc(v.detail)}</div>` : ''}`;
    if (v.mine && v.want) {
      const two = document.createElement('div'); two.className = 'two-sets';
      two.append(resultTable(v.mine, 'Your result'), resultTable(v.want, 'Worked answer'));
      judge.append(two);
    }
    return v;
  });
}
function runBlock(btn) {
  const wrap = btn.closest('.runblock'), code = wrap.querySelector('pre code').textContent, out = wrap.querySelector('.out');
  const seed = btn.dataset.seed ? (byId[btn.dataset.seed] || {}).seed : null;
  return runButton(btn, ctl => btn.dataset.lang === 'sql' ? runSQL(code, seed, out, ctl) : runTS(code, out, ctl));
}
const outputLines = text => text.split('\n').map(l => l.trim()).filter(Boolean);
async function predictRun(btn, i) {
  const box = btn.closest('.predict'), out = box.querySelector('.out'), verdict = box.querySelector('.predict-verdict');
  const guess = outputLines(box.querySelector('.prediction').value);
  verdict.hidden = true;
  const r = await runButton(btn, ctl => runTS(predictCode(Q[i]), out, ctl));
  if (!r || !out.isConnected || r.status === 'stopped' || r.status === 'blocked' || r.status === 'unpack') return;
  const got = outputLines(r.lines.join('\n')), same = got.length === guess.length && got.every((l, n) => l === guess[n]);
  verdict.dataset.verdict = same ? 'match' : 'differ';
  verdict.textContent = same ? 'You got it: the output matches.' : 'Not quite: compare your lines with the output.';
  verdict.hidden = false;
  const fold = btn.closest('article, .qcard') && btn.closest('article, .qcard').querySelector('details.predict-answer');
  if (fold) fold.open = true;
}
