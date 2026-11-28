// ---------- role presets and job-ad paste (docs/phase6-spec.md, section 3, ideas 59 and 60) ----------
// A question is in a role when its file is in the role's files or its topic slug in the role's slugs.
const AUTOMATION = ['ts-core', 'js-core', 'js-async', 'api-rest', 'api-tools', 'api-auth', 'ci-cd', 'git', 'sql-core'];
const ROLES = {
  'Manual QA': { files: ['05-testing-fundamentals'], slugs: ['agile', 'stakeholders', 'release', 'soft-skills', 'docs', 'api-rest', 'api-tools', 'sql-core', 'a11y', 'cross-compat', 'mobile-general'] },
  Automation: { files: ['01-playwright', '06-framework-and-flaky', '13-live-coding'], slugs: AUTOMATION },
  SDET: { files: ['01-playwright', '06-framework-and-flaky', '13-live-coding'], slugs: [...AUTOMATION, 'oop-patterns', 'unit-frameworks', 'api-contract',
    'api-integration', 'microservices', 'messaging', 'docker-k8s', 'ci-github', 'ci-gitlab', 'performance', 'security', 'data-testing'] },
  Lead: { files: ['11-agile-leadership'], slugs: ['test-strategy', 'test-risk', 'shift-left', 'test-levels', 'fw-architecture', 'fw-flaky', 'migration-frameworks', 'ci-cd', 'ai-testing', 'ai-tools'] },
};

// Job ad: the keyword patterns are a packed part, unpacked on the first Find topics. The ad never leaves the page.
const AD_MAX = 50000;
const ad = { text: '', found: null, ticked: new Set(), error: '' };
let keywordRules = null;
// Patterns follow the maintainer's scorer (Python): whole word, ignoring case unless "cs:". Python's \w and \b count every
// letter, so here they become Unicode classes; JavaScript's own \w is ASCII only and would split "testów" after "test".
const WORD = '[\\p{L}\\p{N}_]';
function keywordRegex(pattern) {
  const cs = pattern.startsWith('cs:');
  const src = (cs ? pattern.slice(3) : pattern).replace(/\\\\|\\w|\\b/g, m => m === '\\w' ? WORD : m === '\\b' ? `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))` : m);
  return new RegExp(`(?<!${WORD})(?:${src})(?!${WORD})`, cs ? 'gu' : 'giu');
}
async function keywordsLoad() {
  if (keywordRules) return keywordRules;
  const data = JSON.parse(await unpackText('keywords'));
  keywordRules = Object.entries(data).map(([slug, t]) => ({ slug, name: t.name, res: t.patterns.map(keywordRegex) }));
  return keywordRules;
}
function adPanel() {
  const f = ad.found, qn = slugs => Q.filter(q => !q.own && slugs.has(q.slug)).length;
  return `<label class="field">Paste a job ad<textarea id="ad-text" rows="6" maxlength="${AD_MAX}" oninput="ad.text=this.value.slice(0, AD_MAX)">${esc(ad.text)}</textarea></label>
    <p class="muted small">The ad stays in this browser.</p>
    <button class="btn" id="ad-match" onclick="adMatch()">Find topics</button>
    <div id="ad-result">${ad.error ? `<p class="loc-error" role="alert">${esc(ad.error)}</p>` : !f ? '' : !f.length
      ? '<p>No topic matched this ad. Pick topics from the Topic list instead.</p>'
      : `<p id="ad-count" class="small">${plural(f.length, 'topic')} matched, ${plural(qn(ad.ticked), 'question')}</p>
        <div class="ad-topics">${f.map(t => `<label class="ad-topic-row"><input type="checkbox" class="ad-topic" aria-label="${esc(t.name)}" ${ad.ticked.has(t.slug) ? 'checked' : ''}
          onchange="adTick('${t.slug}', this.checked)"> <span>${esc(t.name)}</span> <span class="muted small">${t.n} ${t.n === 1 ? 'match' : 'matches'}: ${t.words.map(esc).join(', ')}</span></label>`).join('')}</div>`}</div>`;
}
async function adMatch() {
  const box = $('ad-text');
  ad.text = (box ? box.value : ad.text).slice(0, AD_MAX);
  let rules;
  try { rules = await keywordsLoad(); ad.error = ''; } catch (e) { ad.error = 'This browser cannot unpack the topic keywords. Use a current Chrome, Edge, Firefox or Safari.'; renderSetup(); return; }
  const found = [];
  for (const r of rules) {
    let n = 0; const words = [];
    for (const re of r.res) for (const m of ad.text.matchAll(re)) {
      n++;
      if (words.length < 3 && !words.some(w => w.toLowerCase() === m[0].toLowerCase())) words.push(m[0]);
    }
    if (n) found.push({ slug: r.slug, name: r.name, n, words });
  }
  found.sort((a, b) => b.n - a.n || byName(a.name, b.name));
  ad.found = found; ad.ticked = new Set(found.map(t => t.slug));
  if (view === 'setup') renderSetup();
}
function adTick(slug, on) { on ? ad.ticked.add(slug) : ad.ticked.delete(slug); renderSetup(); }
