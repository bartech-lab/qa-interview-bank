// Builds the third-party parts of the page into vendor/ (committed, so tools/build.py needs no Node):
//   codemirror.js  CodeMirror 6 with JavaScript/TypeScript and SQL, an IIFE that sets the global CM
//   sucrase.js     Sucrase's transform (type stripping), an IIFE that sets the global SUCRASE
//   sql-wasm.js    sql.js loader, unchanged; sql-wasm.wasm  SQLite compiled to WebAssembly, unchanged
//   playwright-injected.js  Playwright's locator engine as repackaged by playwright-injected, an IIFE that sets the global PWI (locator trainer)
//   LICENSES.txt   the licence of every package that ends up in those files, taken from esbuild's list of inputs
// Versions are pinned exactly in package.json. CI reruns this and fails when vendor/ changes.
//
// Usage: node tools/vendor.mjs
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'vendor');
const ALLOWED = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0']);
const BUNDLES = {
  codemirror: { global: 'CM', contents: `
    export { EditorView, basicSetup } from 'codemirror';
    export { keymap } from '@codemirror/view';
    export { indentLess } from '@codemirror/commands';
    export { syntaxHighlighting } from '@codemirror/language';
    export { classHighlighter } from '@lezer/highlight';
    export { javascript } from '@codemirror/lang-javascript';
    export { sql, SQLite } from '@codemirror/lang-sql';` },
  sucrase: { global: 'SUCRASE', contents: `export { transform } from 'sucrase';` },
  'playwright-injected': { global: 'PWI', contents: `export { InjectedScript, locatorOrSelectorAsSelector } from 'playwright-injected';` },
};
// Code in playwright-injected under licences other than Playwright's Apache-2.0 (docs/feasibility.md, probe 12): it must stay out of
// the bundle, or its notice must be added. Each is found by a text that minifying keeps.
const LEFT_OUT = {
  "Playwright's clock.ts (BSD-3-Clause, Christian Johansen)": 'Cannot fast-forward to the past',
  "Playwright's stackTrace.ts (MIT, Isaac Z. Schlueter, James Talmage and others)": '(?:eval at ',
};
// playwright-injected ships no licence file and no copyright line; its code is Playwright's (probe 12). Its notice is written here.
const injectedNotice = pkg => [
  `${pkg.name} ${pkg.version}: Playwright's browser-side locator code, repackaged by Moshe Kolodny. This page holds the parts the locator trainer`,
  `uses, repackaged and minified from Playwright's source (commit d466ac53, 2026-04-01) by this project's build.`,
  '',
  `The packaging (npm package ${pkg.name}) is under the MIT licence, author Moshe Kolodny:`,
  '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the',
  '"Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,',
  'distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the',
  'following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the',
  'Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF',
  'MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY',
  'CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE',
  'SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
  '',
  "The code itself is Playwright's, under the Apache License 2.0. Playwright's NOTICE file, unchanged:",
  '',
  fs.readFileSync(path.join(ROOT, 'node_modules/playwright-core/NOTICE'), 'utf8').trim(),
  '',
  'The Apache License 2.0, as shipped with Playwright:',
  '',
  fs.readFileSync(path.join(ROOT, 'node_modules/playwright-core/LICENSE'), 'utf8').trim(),
].join('\n');

// esbuild keeps an unused top-level `new RegExp(...)`, as it may have side effects; that kept stackTrace.ts's frame pattern in the
// trainer bundle. Marking those calls pure lets tree-shaking drop the unused ones.
const pureRegExp = { name: 'pure-regexp', setup(b) {
  b.onLoad({ filter: /playwright-injected[\\/]dist[\\/]index\.js$/ }, args => ({
    contents: fs.readFileSync(args.path, 'utf8').replaceAll('= new RegExp(', '= /* @__PURE__ */ new RegExp('), loader: 'js' }));
} };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
const packages = new Map();  // package dir -> package.json
const addPackage = dir => { if (!packages.has(dir)) packages.set(dir, JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'package.json'), 'utf8'))); };
for (const [name, { global, contents }] of Object.entries(BUNDLES)) {
  const result = await esbuild.build({
    stdin: { contents, resolveDir: ROOT }, bundle: true, minify: true, format: 'iife', globalName: global, platform: 'browser',
    target: 'es2022', outfile: path.join(OUT, `${name}.js`), legalComments: 'none', metafile: true, logLevel: 'warning',
    plugins: name === 'playwright-injected' ? [pureRegExp] : [],
  });
  const code = fs.readFileSync(path.join(OUT, `${name}.js`), 'utf8');
  for (const [what, mark] of Object.entries(LEFT_OUT)) {
    if (name === 'playwright-injected' && code.includes(mark)) throw new Error(`vendor/${name}.js holds ${what}; add its notice or drop the export that pulls it in`);
  }
  for (const input of Object.keys(result.metafile.inputs)) {
    const m = input.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (m) addPackage(`node_modules/${m[1]}`);
  }
}
for (const f of ['sql-wasm.js', 'sql-wasm.wasm']) fs.copyFileSync(path.join(ROOT, 'node_modules/sql.js/dist', f), path.join(OUT, f));
addPackage('node_modules/sql.js');

const notices = [];
// Plain order, the same in every locale.
for (const [dir, pkg] of [...packages].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  if (pkg.name === 'playwright-injected') { notices.push(injectedNotice(pkg)); continue; }
  if (!ALLOWED.has(pkg.license)) throw new Error(`${pkg.name}: licence ${pkg.license} is not in the allowed list; check it before bundling`);
  const file = fs.readdirSync(path.join(ROOT, dir)).find(f => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`${pkg.name}: no licence file in ${dir}`);
  notices.push(`${pkg.name} ${pkg.version} (${pkg.license})\n\n${fs.readFileSync(path.join(ROOT, dir, file), 'utf8').trim()}`);
}
notices.push('SQLite, compiled into sql-wasm.wasm, is in the public domain: https://sqlite.org/copyright.html');
const text = 'Third-party code in this page. sql.js, CodeMirror, Sucrase and playwright-injected are bundled and minified; each package and its licence follows.\n\n'
  + notices.join('\n\n' + '='.repeat(72) + '\n\n') + '\n';
fs.writeFileSync(path.join(OUT, 'LICENSES.txt'), text.replaceAll('-->', '- ->'));  // "-->" would end the page's licence comment
for (const f of fs.readdirSync(OUT).sort()) console.log(`vendor/${f}: ${fs.statSync(path.join(OUT, f)).size.toLocaleString('en')} bytes`);
console.log(`${packages.size} packages: ${[...packages.values()].map(p => p.name).join(', ')}`);
