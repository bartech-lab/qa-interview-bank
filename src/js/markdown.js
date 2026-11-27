// ---------- markdown ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(s) {
  const codes = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => (codes.push(c), `\u0000${codes.length - 1}\u0000`));
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, '$1<i>$2</i>')
       .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
       .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}
const LIST = /^\s*([-*]|\d+\.) /;
function md(text) {
  const out = [], L = text.split('\n'); let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^\s*```/.test(l)) { const b = [], info = l.trim().slice(3).split(/\s+/).filter(Boolean); i++; while (i < L.length && !/^\s*```/.test(L[i])) b.push(L[i++]); i++;
      const pre = `<pre><code>${esc(b.join('\n')).replace(/(^|\s)(\/\/.*|#\s.*|--\s.*)$/gm, '$1<span class="c">$2</span>')}</code></pre>`;
      // "run" in the fence (added by the build, idea 39): a Run button under the block. "seed=ID": SQL runs on that question's seed.
      const seed = (info.find(w => w.startsWith('seed=')) || '').slice(5);
      out.push(info.includes('run') ? `<div class="runblock">${pre}<div class="edbar"><button class="btn run-block" data-lang="${esc(info[0])}"${seed ? ` data-seed="${esc(seed)}"` : ''} onclick="runBlock(this)">Run</button></div><div class="out" aria-live="polite"></div></div>` : pre);
      continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]);
      out.push('<table>' + rows.filter(r => !/^\|[\s:|-]+\|$/.test(r)).map((r, n) => '<tr>' + r.replace(/^\||\|$/g, '').split('|')
        .map(c => `<${n ? 'td' : 'th'}>${inline(c.trim())}</${n ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table>'); continue; }
    if (LIST.test(l)) { const ol = /^\s*\d+\./.test(l), items = [];
      while (i < L.length && LIST.test(L[i])) { let it = L[i++].replace(LIST, '');
        while (i < L.length && /^\s{2,}\S/.test(L[i]) && !LIST.test(L[i])) it += ' ' + L[i++].trim();
        items.push(`<li>${inline(it)}</li>`); }
      out.push(`<${ol ? 'ol' : 'ul'}>${items.join('')}</${ol ? 'ol' : 'ul'}>`); continue; }
    if (/^#{2,6} /.test(l)) { out.push(`<p><b>${inline(l.replace(/^#+ /, ''))}</b></p>`); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < L.length && L[i].trim() && !/^(\s*```|\||\s*([-*]|\d+\.) |#{2,6} )/.test(L[i])) p.push(L[i++]);
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

