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
function given(q) {
  const f = q.f, g = f.Starter || f['What you receive'];
  if (!g) return '';
  const code = starterCode(q);
  if (code === null) return `<div class="body"><div class="say"><div class="lbl">${f.Starter ? 'Starter code' : 'What you receive'}</div>${md(g)}</div></div>`;
  const intro = g.slice(0, g.indexOf('```')).trim(), min = taskMinutes(q);
  return `<div class="body"><div class="say"><div class="lbl">Your editor</div>${md(intro)}
    <div class="editor"><textarea class="ed" spellcheck="false" autocapitalize="off" autocomplete="off" oninput="edSave(${q.i}, this.value)" onkeydown="edKey(event, ${q.i})">${esc(store.code[q.k] ?? code)}</textarea>
    <div class="edbar">${min ? `<button class="btn tb" data-i="${q.i}" onclick="timerToggle(${q.i})">${timers[q.i] ? '■ Stop' : `▶ Start ${min} min timer`}</button><span class="clock" data-i="${q.i}"></span>` : ''}
      <button class="btn" onclick="compare(this, ${q.i})">Compare with the answer</button><button class="btn" onclick="edReset(this, ${q.i})">Reset to starter</button></div>
    <div class="cmp"></div></div></div></div>`;
}
