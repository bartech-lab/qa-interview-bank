// Builds the third-party parts of the page into vendor/ (committed, so tools/build.py needs no Node):
//   codemirror.js  CodeMirror 6 with JavaScript/TypeScript and SQL, an IIFE that sets the global CM
//   sucrase.js     Sucrase's transform (type stripping), an IIFE that sets the global SUCRASE
//   sql-wasm.js    sql.js loader, unchanged; sql-wasm.wasm  SQLite compiled to WebAssembly, unchanged
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
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
const packages = new Map();  // package dir -> package.json
const addPackage = dir => { if (!packages.has(dir)) packages.set(dir, JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'package.json'), 'utf8'))); };
for (const [name, { global, contents }] of Object.entries(BUNDLES)) {
  const result = await esbuild.build({
    stdin: { contents, resolveDir: ROOT }, bundle: true, minify: true, format: 'iife', globalName: global, platform: 'browser',
    target: 'es2022', outfile: path.join(OUT, `${name}.js`), legalComments: 'none', metafile: true, logLevel: 'warning',
  });
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
  if (!ALLOWED.has(pkg.license)) throw new Error(`${pkg.name}: licence ${pkg.license} is not in the allowed list; check it before bundling`);
  const file = fs.readdirSync(path.join(ROOT, dir)).find(f => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`${pkg.name}: no licence file in ${dir}`);
  notices.push(`${pkg.name} ${pkg.version} (${pkg.license})\n\n${fs.readFileSync(path.join(ROOT, dir, file), 'utf8').trim()}`);
}
notices.push('SQLite, compiled into sql-wasm.wasm, is in the public domain: https://sqlite.org/copyright.html');
const text = 'Third-party code in this page. sql.js, CodeMirror and Sucrase are bundled and minified; each package and its licence follows.\n\n'
  + notices.join('\n\n' + '='.repeat(72) + '\n\n') + '\n';
fs.writeFileSync(path.join(OUT, 'LICENSES.txt'), text.replaceAll('-->', '- ->'));  // "-->" would end the page's licence comment
for (const f of fs.readdirSync(OUT).sort()) console.log(`vendor/${f}: ${fs.statSync(path.join(OUT, f)).size.toLocaleString('en')} bytes`);
console.log(`${packages.size} packages: ${[...packages.values()].map(p => p.name).join(', ')}`);
