Nothing was written to disk. Results are marked [O] if I opened the page or API response, [S] if I only saw search highlights, and "own" for my inference. One caveat on [O]: the URLs I fetched through the Exa page tool were cut to about 700 characters each, so for those I read only the top of the page.

## A. Coverage table

Tooling beyond Exa:
- `gh search repos/code` and `gh api` ran through the logged-in GitHub CLI account (bartech-lab).
- `registry.npmjs.org` and the jsDelivr data API were queried with curl.
- The gzip and brotli sizes in B are my own measurements of files served by jsDelivr. I used gzip -9, and brotli at quality 9 or 11.

| # | Searched | Returned | Gap |
|---|---|---|---|
| 1 Editors | Registry and jsDelivr for all 9 packages; Monaco npm/changelog/FAQ [S]; CM6 bundling page [S]; lite-monaco size page [S]; second query on CM6 sizes | Versions, licences, raw sizes. Third-party CM6 and Monaco bundle sizes. Monaco FAQ says file:// pages cannot create workers. | No source for textarea-overlay beyond the CodeJar/CodeFlask packages. Prism and highlight.js publish dates not fetched. |
| 2 TypeScript | TS blog, tsgo repo, npm page, play/v2, PR 64174, wasip1 npm page [O]; Bluesky, tswasm, tsrs README, debuff blog, structs playground [S]; Node docs [S]; @typescript/vfs and twoslash-cdn docs [S]; TC39 issue 246 [S] | Strong. Official wasip1 build exists (experimental). TS 7.0.2 is the native release. 6.0 was the last JS compiler. | tsc.wasm gzip size not measurable (jsDelivr returned a 49-byte reply for files over 50 MB). Playground v2 page was an empty shell when opened. |
| 3 Run JS safely | ShadowRealm repo [O], Mozilla issue and Ladybird PR [S]; quickjs-emscripten README [S]; andbox iframe page [S]; Endo lockdown docs [S]; MDN Worker [S]; Safari file:// blob-worker Q&A [S] | Solid. Loop-protection facts are well sourced. | No 2026 test of blob workers from file://. No evidence either way for sandboxed srcdoc iframes served from a file:// page. |
| 4 SQL | sql.js site and releases [S]; sqlite-wasm README and test page [S]; PGlite docs and a size-measurement blog [S]; AlaSQL wiki and PR 2412 [S]; sqlgym [O]; registries and jsDelivr | Good. | No DuckDB or wa-sqlite behaviour from file://. wa-sqlite has no npm licence. |
| 5 Node-like runtimes | webcontainers.io (browser support, enterprise, headers) [S]; Sandpack FAQ and Nodebox LICENSE [S]; CheerpX licensing and docs [S]; container2wasm [S]; esm.sh and JSPM docs [S]; Runno [S] | Good. | Offline WebContainers not found. No hard number for "in-browser npm install" beyond esm.sh/JSPM. |
| 6 Playwright | Playwright issues 4738, 34124, 23514, 32042 [S]; playwright-crx [S]; trace-viewer docs [S]; trace.playwright.dev, LICENSE, playwright-injected GitHub and npm [O]; component-testing docs [S]; try.playwright.tech [S]; Locator League and Locator Lab [O]; testing-playground [O]; Checkly docs [S] | Good. Playwright cannot run inside a page. A shim path exists via playwright-injected. | Cypress-in-StackBlitz: two queries gave only a 2022 issue. Nothing found for Cypress or WebdriverIO running in a browser. |
| 7 Hand-offs | StackBlitz docs (open-from-github, embedding, project-config) [S]; CodeSandbox define API [S]; Codespaces docs [S]; Ona posts [S]; TS Playground URL handbook [S]; dbfiddle llms.txt [S]; sqlime [S]; JetBrains templates [S]; VS Code web extensions and walkthroughs [S] | Good. | `npm create` templates: no dedicated source (own). A `devcontainer.json` is a Codespaces file I cite only through the docs [S]. |
| 8 API practice | MSW browser guide and releases [S]; Mirage and Pretender [S]; Hoppscotch interceptor docs [S] | MSW needs a service worker. Mirage/Pretender patch fetch and XHR in the page. | HAR replay: no source found. HTTP status simulators: none found. Hoppscotch embedding: not found. |
| 9 Playground products | LiveCodes [O], plus npm and gh API; codapi [O]; Runno [S]; marimo [O]; Starlight codeblocks and Docusaurus live codeblock [S]; Sandpack and CodeSandbox [S] | Good. | Not covered: Observable Framework (npm data only), Val Town, Deno playground, JS Bin clones, mdx-live. Runme: one mention only (Starlight discussion #3391 [S]). JupyterLite: one tutorial snippet. |
| 10 Judging | type-challenges and TypeHero guidelines [S]; Exercism, LeetCode, Execute Program pages [S]; sqlgym [O]; SQLPlay architecture [S]; SQLBolt/SQLZoo/pgexercises comparison [S]; Code Defenders and Parsons papers [S] | Good for SQL result comparison and for type tests. | DataLemur, BFE.dev internals: no source. GreatFrontEnd: two reviews only. |
| 11 Community | HN items 21807598 and 46435308 [S]; Stack Overflow Q&As [S]; Reddit r/QualityAssurance [S]; dev.to Pyodide post [S]; Hew and abdkarim write-ups [S] | Some. | r/webdev, r/typescript, r/Playwright: no relevant threads found. No Safari memory report. |
| 12 Registries and code search | npm and JSR search APIs; `gh search code` for sql-wasm-inline and `data:application/wasm;base64`; `gh search repos` | npm: the single-file ecosystem is thin (vite-plugin-singlefile 2.3.4 and similar). JSR: `@sebastianwessel/quickjs` only. Code search: sql.js example HTML and a few demos. Repo search: only one tiny hit (mazmazabou/zs-sql-practice). | My first three repo searches used too many keywords and returned `[]`. `gh search code` needs few keywords. |
| Pages headers | MDN and coi-serviceworker (opened) plus a Stack Overflow answer [S] | GitHub Pages cannot set COOP/COEP headers (Stack Overflow answer, 2021, [S]). The service-worker shim exists. | No first-party GitHub statement. |

## B. Feasibility table

Conventions:
- "gz" and "br" are my own measurements of the named file as served by jsDelivr.
- "reg" is the registry `unpackedSize` for the whole package. It is not a download size.
- file:// is "yes" or "no" only where a source I read says so. Otherwise it is "unknown".
- Inlining JS is raw. Inlining wasm needs base64, which adds about one third.
- Under file:// there is no transport compression, so raw size is what the user pays.

| Tech | Version, date | Licence | Size (source) | file:// | Headers | Inline in one HTML | Notes |
|---|---|---|---|---|---|---|---|
| Monaco | 0.58.0, 2026-11-23 | MIT | reg 80.1 MB. `min/vs`: 127 JS files, 17.5 MB raw. ts.worker 7.08 MB raw, 1.55 MB gz. editor.worker 314 KB raw, 89 KB gz. editor.main.css 397 KB (jsDelivr listing). Core chunk (editor-*.js 2.88 MB raw) not gzipped by me. | Workers not creatable on file:// (npm FAQ [S]). 2016 changelog: falls back to UI thread [S]. | None | Impractical: the `.worker.ts` entries need separate worker files. Maintainers said inlining everything is about 6 MB (2019 issue [S]). | Language services need workers. Chromium, Firefox and Safari supported (own knowledge, not re-checked). |
| CodeMirror 6 | codemirror 6.0.2 (2025-06-19); view 6.44.2 | MIT | Third-party esbuild --minify: basicSetup + lang-javascript 506 KB / 170 KB gz; minimalSetup + js 406 / 138 KB; bare minimalSetup 285 / 94 KB (issoh.co.jp, Oct 2026 [S]). Official page quotes about 400 KB, 135 KB gz [S]. | unknown, but it is plain JS with no worker needed | None | Yes, it is an ES bundle. | Best fit for an offline single file. `lang-sql`, `lang-javascript(typescript:true)`, `lang-yaml` etc. exist as separate packages (package list [S]). |
| Ace | 1.45.2, 2026-10-21 | BSD-3-Clause | ace.js min 479 KB raw / 128 KB gz; mode-javascript 28 KB; mode-sql 5 KB; worker-javascript 411 KB raw (jsDelivr). | unknown | None | Yes for the core and modes. Its workers are separate files. | Older architecture. Fine, but no advantage over CM6. |
| prism-code-editor | 5.4.0, 2026-09-06 | MIT | reg 2.96 MB (all languages and maps). Core chunks 5 to 35 KB raw (jsDelivr). | unknown | None | Yes | Prism-based, so tokenising is light. Upstream repo not found by `gh api` guess. |
| CodeJar | 5.0.0 | MIT | dist/codejar.js 13.4 KB raw, 4.0 KB gz | unknown | None | Yes | Needs a separate highlighter. |
| CodeFlask | 1.4.1 | MIT | build/codeflask.min.js 24.7 KB raw (jsDelivr) | unknown | None | Yes | Bundles Prism. No notable recent activity (not checked). |
| Shiki | 4.6.0, 2026-11-02 | MIT | onig.wasm 467 KB raw; each grammar is a separate chunk. Bundle sizes not measured. | unknown | None | Awkward (wasm + many chunks). Use the JS regex engine if needed (own). | Good for a build-time highlighting pass in the Python injector. |
| Prism | 1.30.0 | MIT | prism.js 58 KB raw / 17 KB gz | unknown | None | Yes | Plain. |
| highlight.js | 11.12.0 | BSD-3-Clause | per-language files; total not measured | unknown | None | Yes | Same role as Prism. |
| Textarea overlay | n/a | n/a | n/a | unknown | None | Yes | No source (own). CodeJar and CodeFlask are examples. Accessibility and IME are the risks. |
| TypeScript (JS compiler) | 6.0.3 (last JS line; blog says 6.0 is the last JS-based release) | Apache-2.0 | lib/typescript.js 9.14 MB raw, 1.64 MB gz, 1.29 MB br. Lib `.d.ts` up to about 1.5 MB (vfs README [S]). dom lib 2.35 MB raw (jsDelivr). | unknown | None | Not feasible in a 2 MB budget. | The `@typescript/typescript6` package (6.0.2, 10.5 KB) is only a shim around `typescript@^6`. |
| TypeScript native | 7.0.2, 2026-07-08 [O] | Apache-2.0 | npm launcher plus platform binaries; not a browser asset | no | None | no | The `typescript` npm page shows 7.0.2 [O]. Exports include `./unstable/*` entries (registry). |
| TS 7.1 wasip1 build (`@typescript/typescript-wasip1-wasm`) | 7.1.0-dev.20261030.1 (PR merged 2026-10-29) [O] | Apache-2.0 | tsc.wasm 52,616,552 B raw; dom lib 2.4 MB (jsDelivr). gz/br not measured. Third-party tsgo builds: 46 MB / about 10 MB gz (structs [S]); tswasm 29 MiB / 6.8 MiB (README [S]). | unknown | A PR comment says the LSP stdin needs SharedArrayBuffer and COOP/COEP [O]. Reactor API use: unknown. | no | Experimental, "may change without notice" [O]. Official Playground v2 uses it per the Bluesky post [S]. |
| tsrs (Rust port of TS 7 checker) | `@tsrs/wasm` 7.1.0-beta.tsrs5 | Apache-2.0 | package reg 10.1 MB. Third-party blog: 2.2 MB br first visit, 1.9 MB of it the compiler (tsrs 0.18, not this version) [S]. | unknown | none stated; single-threaded [S] | Needs wasm base64; raw size not found | In-memory files, JSON diagnostics, checks and emits [S]. Errors may differ from tsc. Safari worker stack is smaller [S]. |
| @typescript/vfs | 1.6.6 | MIT | reg 257 KB | unknown | None | Yes | It fetches lib files from `playgroundcdn.typescriptlang.org` and caches in localStorage [S]. The offline path needs the libs bundled. |
| twoslash | 0.3.9; twoslash-cdn on esm.sh | MIT | reg 139 KB | unknown | None | Needs TS and the libs | `// ^?` and `// @errors` markers. Useful for "predict the type" quizzes. |
| Sucrase | 3.35.1, 2025-11-19 | MIT | jsDelivr `+esm` bundle: 186 KB raw / 41 KB gz. A Starlight page claims about 50 kB [S]. | unknown | None | Yes | Strips types only; no checking. Handles enums. |
| esbuild-wasm | 0.28.2, 2026-08-08 | MIT | esbuild.wasm 13.98 MB raw / 3.7 MB gz / 3.1 MB br; browser.min.js 54 KB raw | unknown | None | Too large for the offline file | For lazy loading only. |
| swc wasm | `@swc/wasm-web` 1.16.22, 2026-11-05 | Apache-2.0 | wasm_bg.wasm 18.3 MB raw / 5.4 MB gz | unknown | None | no | Same role as esbuild. |
| oxc | oxc-transform 0.160.0 (2026-11-23) wasm32-wasip1 3.84 MB raw; `@oxc-parser/binding-wasm32-wasi` parser.wasm 1.78 MB raw / 588 KB gz | MIT | see left | unknown | WASI packages; browser needs a shim (`parser.wasi-browser.js` exists) | Possible but unproven | Strip and transform only. |
| ts-blank-space | 0.9.0, 2026-05-12 | Apache-2.0 | out/index.js 26 KB raw / 5.7 KB gz; depends on `typescript` 5.1.6 to 6.0.x (registry) | unknown | None | Only together with the 9 MB TypeScript compiler | Not a lightweight path in a page. |
| amaro | 1.3.0, 2026-10-27 | MIT | lib/wasm.js 3.01 MB raw (jsDelivr) | unknown | None | Possible (base64 inside the JS file) | This is Node's own stripper. It matches `node file.ts` behaviour. |
| Node type stripping | Stable from v25.2.0 and v24.12.0; on by default in v23.6/v22.18; flag `--experimental-transform-types` removed in v26 [S] | n/a | n/a | n/a | n/a | n/a | Node 26.13.1 docs [S]. Erasable syntax only (no enum, runtime namespace, parameter properties). |
| Types as comments | TC39 stage 1; still open issue "blocked at stage 1" [S] | n/a | n/a | n/a | n/a | n/a | No browser implementation. Do not plan on it. |
| Sandboxed iframe (`srcdoc`, `sandbox="allow-scripts"`) | Web platform | n/a | none | unknown (no file:// test found); origin is opaque | None | Yes (built at runtime) | Use postMessage with target `"*"`. A synchronous infinite loop freezes the page in Safari/WebKit, and in Chromium without site isolation [S]. |
| Blob-URL Worker | Web platform | n/a | none | 2023 report: failed in Safari 16.5.1 from file://, fine in Chrome and Edge [S]. No Firefox evidence. | None | Yes | Killable with `worker.terminate()`. CSP details differ in Safari [S]. |
| QuickJS (quickjs-emscripten) | 0.32.0, 2026-02-16; vendors QuickJS 2025-09-13 [S] | npm MIT (gh licence field empty) | singlefile browser variant `emscripten-module.browser-*.mjs` 828 KB raw (listing). Separate wasm 503 KB raw / 231 KB gz. `dist/index.global.js` 2.37 MB raw / 686 KB gz (this file, not the minimal variant). | unknown | None | Yes (singlefile variant) | Has an interrupt handler, memory limit, stack limit [S]. No DOM or `fetch`. |
| ShadowRealm | TC39 stage 2.7 (repo [O]) | n/a | n/a | n/a | n/a | n/a | Mozilla: "no longer being pursued", suggested negative position [S]. Ladybird removed it [S]. Not usable. |
| SES / Endo | 2.3.0, 2026-08-13 | Apache-2.0 | lockdown.umd.js 519 KB raw | unknown | None | Yes | Docs say a compartment cannot stop infinite loops or OOM [S]. Use it only on top of a worker. |
| sql.js | 1.17.0, 2026-11-19; SQLite 3.54.1 since 1.16 [S] | npm MIT (GitHub licence "NOASSERTION") | sql-wasm-inline.js 981 KB raw / 446 KB gz / 371 KB br; sql-wasm.wasm 688 KB raw / 336 KB gz | Inline build designed for single-file use [S]. A 2021 blog and a 2023 Q&A report base64 loading works [S]. Not retested on 1.17. | None | Yes | Window functions and CTEs: SQLite 3.54.1 supports both (own knowledge). FTS5 is not in the default build [S]. |
| Official SQLite wasm | 3.54.1-build1, 2026-10-19 | Apache-2.0 (npm) | sqlite3.wasm 879 KB raw / 406 KB gz; index.mjs 657 KB | "Browsers do not support loading WASM files via file:// URLs" per the test-page notes [S] | COOP/COEP only for OPFS persistence [S] | Unknown (needs a custom wasm loader) | Worker1/Promiser API deprecated since 2026-04-15 [S]. |
| wa-sqlite | 1.0.0, 2024-01-05 (npm); repo pushed 2026-11-18 | npm: none; GitHub: MIT | reg 2.18 MB | unknown | None for memory VFS | unknown | Less convenient than sql.js for this use. |
| PGlite | 0.6.0, 2026-11-23 | Apache-2.0 | pglite.wasm 9.47 MB raw / 3.38 MB gz; pglite.data 6.30 MB raw / 1.87 MB gz; pglite.js 436 KB. A blog measured 5.74 MB over the wire after pre-gzipping the data file [S]. | unknown | None stated | Too big for the offline file | Real Postgres dialect (window functions, CTEs, `FILTER`, arrays, `RETURNING`). Single exclusive connection [S]. Postgres 18.6 reported by that blog [S]. |
| DuckDB-WASM | 1.33.1-dev57.0 (2026-06-22) | MIT | duckdb-eh.wasm 35.9 MB raw / 8.1 MB gz | unknown | threads variant (`coi`) needs isolation | no | Heavy. For analytic SQL only. |
| AlaSQL | 4.23.4, 2026-11-25 | MIT | alasql.min.js 541 KB raw / 120 KB gz | unknown | None | Yes | Only `ROW_NUMBER()` documented [S]. LEAD/LAG PR was open, not merged, with a known limitation [S]. `RECURSIVE`, `RANK`, `WINDOW` marked unsupported in its keyword table [S]. Poor fit for interview SQL. |
| WebContainers | `@webcontainer/api` 1.6.4, 2026-04-14 | npm MIT; usage governed by StackBlitz terms | api 181 KB reg | no (needs SAB and cross-origin isolation) | COOP same-origin and COEP require-corp (or credentialless, Chromium only) [S] | no | Commercial production use needs a licence; prototypes do not [S]. Chromium full; Firefox and Safari "beta" [S]. Cannot run Playwright browsers (issues 2021, 2023, 2025 [S]). |
| Nodebox | 0.1.9, 2023-11-29 | Sustainable Use License (internal/non-commercial) [S] | reg 102 KB | unknown | unknown | unknown | Stale (no release since 2023). Avoid. |
| Sandpack | 2.20.0, 2025-02-14 (gh release) | Apache-2.0 (FAQ [S]); templates using Nodebox carry its licence | `@codesandbox/sandpack-react` reg 1.2 MB | no (needs a bundler iframe served over http) own | None for static templates | no | Last release 2025-02. |
| CheerpX / WebVM | CheerpX 1.2.8 (docs script URL [S]); WebVM pushed 2026-11-16 | Free for personal and FOSS; self-hosting needs a paid licence [S] | disk images up to 2 GB, fetched on demand [S] | no | SAB needed (own, not verified) | no | Hosting the runtime yourself is not allowed on the free tier. |
| container2wasm | v0.8.5, 2026-11-04 | Apache-2.0 (own knowledge, not read) | image-size dependent | no | unknown | no | Experimental x86 emulation; slow [S]. |
| Runno | npm 0.10.3 (gh release 0.10.2, 2025-05-18) | MIT | dist/main.js 1.67 MB raw | no | COOP+COEP required [S] | no | Python, Ruby, QuickJS, SQLite, C, PHP via WASI [S]. |
| Pyodide | 314.0.8, 2026-11-13 | MPL-2.0 | pyodide.asm.wasm 9.6 MB raw / 3.5 MB gz; stdlib zip 2.5 MB | no (2019 issue: needs base64 workaround, 218 MB zip [S]) | None | no | For comparison only. |
| esm.sh / JSPM | esm.sh MIT; `@jspm/generator` Apache-2.0 (gh) | see left | n/a | works from a file:// page only if CORS permits (own, unverified) | None | no | Needs the network every time unless pinned and cached. JSPM generator has an offline cache for Node, not for pages [S]. |
| Playwright (Node) | 1.65.1 | Apache-2.0 [O LICENSE] | playwright-core reg 14 MB | no | n/a | no | Maintainers: "designed to run on Node.js only" (issues 34124, 4738 [S]). |
| playwright-crx | 0.15.0, 2025-06-11 | Apache-2.0 | reg 51.7 MB | no (Chrome extension, `chrome.debugger`) | n/a | no | Not usable in a page [S]. |
| Trace viewer | trace.playwright.dev | Apache-2.0 (Playwright) | n/a | no ("must be loaded over http:// or https://") [O] | None | no | Loads traces entirely in the browser, no upload [S]. `?trace=<url>` needs CORS on the zip [S]. |
| playwright-injected | 1.59.1, 2026-04-12 [O] | npm says MIT; it bundles Playwright's Apache-2.0 code [O] | dist/index.js 296 KB raw / 72 KB gz / 62 KB br | unknown (ES module) | None | Yes (one ESM bundle, zero dependencies) | Exposes `InjectedScript`, `asLocator`, `querySelectorAll`, `ariaSnapshot`, role and accessible-name utilities [O]. README warns the API is internal and may change. Pinned 1.59.1 while Playwright is at 1.65.1. 179 weekly downloads. |
| DOM Testing Library | 10.4.2 | MIT | reg 2.47 MB | unknown | None | Yes | `getByRole` etc. Not Playwright semantics. `dom-accessibility-api` 0.7.1 and `aria-query` 5.3.2 are its parts (registry). |
| MSW | 3.0.8, 2026-11-26 | MIT | reg 3.45 MB | no (service worker needs http/https; `register()` throws for other schemes [S]) | none, but secure context | no | v3 is ESM-only [S]. |
| Mirage / Pretender | n/a | n/a | not measured | unknown | None | Yes | Patch `fetch` and `XMLHttpRequest` in-page [S]. Pretender: "only works in the browser". |
| LiveCodes | app v49, 2026-05-08; sdk 0.14.1 | MIT | sdk reg 423 KB; app size not found | no | none stated | no | Static app, self-hostable [O]. Its compilers load as needed. |
| codapi | widget `@antonz/codapi` 0.20.1; server v0.14.2, 2026-08-22 | Apache-2.0 | widget about 5 KB per its FAQ [S] | partial | None | Widget only | The JS sandbox runs in the page ("completely in-browser") [O]. Other sandboxes need its server (3 MB Go binary, Docker) [S]. |
| marimo WASM | not fetched | Apache-2.0 (npm) | n/a | no ("cannot be opened directly from the filesystem") [O] | none stated | no | `--single-file` still loads assets from a CDN [O]. |
| Hoppscotch | n/a | MIT (CE) | n/a | n/a | n/a | no | CORS bypass needs its agent, proxy or browser extension [S]. No embed mode found. |
| coi-serviceworker | 0.1.7 | MIT | 12 KB reg | no (needs https or localhost) | adds COOP/COEP via service worker | must be a separate file; "can't bundle it" [O] | Reloads the page on first visit [O]. |

## C. Recommended stacks

### (i) Fully offline single file, under a size budget

Budget (my arithmetic, not measured): today's 2.0 MB. All figures below are raw, and only the wasm parts pay the base64 premium.
- CodeMirror 6 plus language packs: about 0.5 MB.
- sql.js inline: 0.98 MB.
- Sucrase `+esm`: 0.19 MB.
- Total added: about 1.7 MB, giving a file of about 3.7 MB.
- Optional QuickJS singlefile, 0.83 MB more: roughly 4.5 MB. Only worth it if a hard, worker-free timeout matters.

Layout:
- JS and TS: strip types with Sucrase, run in a blob worker with a watchdog `terminate()`. Fall back to a sandboxed iframe in Safari, where blob workers from file:// failed in the 2023 report.
- SQL: sql.js inline, graded by result-set comparison.
- Playwright locators: playwright-injected (296 KB raw) over a sandboxed iframe of frozen HTML (see D).

Trade-offs:
- No type checking offline. The JS compiler costs 9 MB, and the TS 7 wasm 52 MB.
- "Predict the type" questions would need static, pre-computed hover text from the injector script (own idea).
- Postgres-only features (arrays, `FILTER`) are unavailable. SQLite lacks them.
- Whether a sibling classic `<script src>` file could keep the HTML smaller is unproven. Test it (E5).

### (ii) Single file plus optional lazy assets when online

Same core as (i). When `location.protocol === "https:"` or `navigator.onLine`, fetch heavier pieces:
- Type checking via tsrs (about 1.9 MB brotli per a third-party blog) or TS 6.0.3 from jsDelivr.
- Postgres via PGlite (about 5.7 MB over the wire, measured by a blog).
- Deterministic JS checks via QuickJS.
- The official TS Playground link for anything else.

jsDelivr sent `access-control-allow-origin: *` on the file I probed, so a file:// page (origin `null`) should be able to `fetch` it. Workers still need a blob wrapper, because a Worker script must be same-origin, `blob:` or `data:` [S].

Trade-offs:
- Two code paths to test.
- A pinned CDN version is a supply-chain surface.
- The "online only" features vanish silently offline unless the UI says so.

### (iii) Hosted GitHub Pages build

Ship the same file, plus:
- A real `/assets` tree (CM6, sql.js wasm, PGlite, tsrs or tsgo, esbuild-wasm), lazy-loaded.
- A service worker for offline caching (not possible from file://).
- coi-serviceworker if cross-origin isolation is needed. GitHub Pages cannot send COOP/COEP (Stack Overflow answer, 2021 [S]).
- Self-host every asset so `COEP: require-corp` does not break CDN loads.

When you need isolation:
- WebContainers, Runno, and the TS 7 LSP-over-stdin path.
- Not for sql.js, QuickJS, CM6, Monaco or PGlite.

Trade-offs:
- The first-load reload from coi-serviceworker.
- Monaco workers need a real server (fine here), and a 7 MB ts.worker if you use its TS service.
- WebContainers need a commercial licence for production commercial use, and Chromium for full support.

### (iv) Hand-off links to external sandboxes

- **TypeScript:** TS Playground `#code/<lz-string>` plus `?ts=` (documented URL structure [S]). The v2 playground uses TS 7 per the Bluesky post [S].
- **SQL:** db<>fiddle (POST `/run`, real Postgres 8.4 to 19, SQLite up to 3.53, DuckDB; fiddles are CC0, the engine is AGPL [S]). Or sqlime `#gist:<id>`.
- **Node and JS:** StackBlitz `stackblitz.com/github/<owner>/<repo>?startScript=test` (documented [S]). Browser caveat: Chromium full, Firefox and Safari beta [S]. CodeSandbox `/api/v1/sandboxes/define` (sandboxes only, not Devboxes [S]).
- **e2e-casebook (real Playwright):** Codespaces, because WebContainers cannot launch browser binaries (issues [S]). Free quota: 120 core-hours/month on Free plans, so 60 hours on a 2-core machine [S]. Put a `devcontainer.json` in the repo.
- **Gitpod:** classic sunset 2025-10-15, now Ona; "Open in Gitpod" buttons redirect [S].
- **Courses:** a JetBrains Academy course repo (YAML plus tests, template repos [S]) and a VS Code walkthrough (`contributes.walkthroughs` [S]). Web-extension limits apply (no child processes [S]).

Trade-offs: leaves the page, needs accounts or quota, and can break when a third party changes (Ona already did).

## D. Idea catalogue

Evidence tags: [O] opened, [S] snippet, "own" = no source, my idea.

### Interview Bank (1 to 28)

1. Run-the-snippet button for JS answers in a blob worker with 2 s watchdog. Own; worker pattern: https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker [S]
2. Sandboxed iframe runner for snippets needing a DOM (`allow-scripts`, no same-origin). https://opensource.johnhenry.me/andbox/iframe-mode/ [S]
3. "Predict the output" quiz: learner types console output, page diffs against a recorded run. Own.
4. Console capture bridge (override `console.*`, `onerror`, post to parent). https://abdkarim.com/work/playground [S]
5. TypeScript snippets: strip types with Sucrase then run. https://ewels.github.io/starlight-codeblocks/features/run-code/ [S]
6. "Will this compile?" quiz with twoslash markers. https://twoslash.netlify.app/packages/cdn [S]
7. Type-level challenges with `Expect<Equal<>>` run through lazy-loaded tsrs. https://github.com/typehero/typehero/blob/main/challenges/challenge-guidelines.md [S]
8. TS Playground "open in" link for every TS question. https://www.typescriptlang.org/_playground-handbook/url-structure.html [S]
9. SQL editor on sql.js with each question's schema pre-seeded. https://github.com/l69d/sqlgym [O]
10. SQL grading: compare result sets, order-insensitive unless the question says ORDER BY. https://github.com/Yogesh0627/sqlplay/blob/main/docs/ARCHITECTURE.md [S]
11. Show expected vs actual rows side by side on a wrong answer. https://github.com/l69d/sqlgym [O]
12. Window-function drill set (ranks, running totals, gaps and islands). https://github.com/l69d/sqlgym [O]
13. Hidden test cases for SQL: run the learner query against a second seed dataset. Own.
14. "Fix the failing query" mode: given a broken join, learner repairs it. Own.
15. Postgres-flavour toggle via lazy PGlite for dialect questions (`FILTER`, `RETURNING`). https://pglite.dev/docs/about [S]
16. "Fix the failing test" JS exercises with a mini `expect` shim. Own.
17. Parsons problems for test structure (arrange the lines of a Playwright test). https://www2.eecs.berkeley.edu/Pubs/TechRpts/2020/Archive/EECS-2020-88.pdf [S]
18. Mutation game: learner's test must kill each hidden mutant of a small function. https://study.code-defenders.org/papers/ECSEE16_MutationEducation.pdf [S]
19. API-test questions run against a Pretender/Mirage fake backend in the page. https://github.com/pretenderjs/pretender/ [S]
20. HTTP status "what would this return" simulator. Own.
21. Shell/Docker/YAML snippets: syntax-highlight only and a "copy to terminal" button; no execution. Own.
22. YAML question: lint pasted YAML with a small parser and highlight the broken line. Own.
23. Self-grading flashcards with a JS or SQL "prove it" button per card. Own.
24. Spaced-repetition scheduling stored in localStorage. Own.
25. Per-question "open in StackBlitz" template link for Node/Express questions. https://developer.stackblitz.com/guides/integration/open-from-github [S]
26. Per-question "open in Codespaces" link for Playwright questions. https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository [S]
27. Link out to db<>fiddle with the question's schema prefilled. https://staging.dbfiddle.uk/llms.txt [S]
28. Hide the IDE panel on file:// when a feature is unsupported, with a one-line reason. Own.

### Playwright practice tied to the casebook (29 to 48)

29. Locator lab against frozen HTML snapshots of casebook pages in a sandboxed iframe. Prior art: https://qaladder.org/locator-lab.html [O]
30. Live highlight of matches as the learner types `getByRole(...)`, with a match counter. https://qaladder.org/locator-lab.html [O]
31. Use playwright-injected's `querySelectorAll`/`asLocator` to evaluate and print locators. https://github.com/kolodny/playwright-injected [O]
32. "Why is this locator fragile?" mode with a mutating page, as in Locator Lab hard mode. https://qaladder.org/locator-lab.html [O]
33. Fix an AI-suggested wrong locator. https://locatorleague.dev/ [O]
34. Show the aria snapshot of the page next to the learner's locator. https://github.com/kolodny/playwright-injected [O]
35. Convert locator between JS/Python/Java/C# using `asLocator`. https://github.com/kolodny/playwright-injected [O]
36. "Pick the best locator for this element" multiple choice generated from `generateSelector`. https://github.com/kolodny/playwright-injected [O]
37. Mini Playwright shim in the page (`page.getByX().click()/fill()`, `expect().toBeVisible()`) over a frozen DOM, so snippets run without Node. Own; building blocks: https://testing-library.com/docs/queries/about/ [S]
38. Mark shim gaps honestly: no auto-wait, no real navigation, no CDP events. Own.
39. Casebook "bug cards": each of the 200+ cases shows the planted bug, the failing assertion and a hint. Own.
40. "Which planted bug does your test catch?": run the learner's assertions against several mutated DOM variants of one casebook screen. Own; idea basis: mutation papers above [S].
41. Ship a sample `trace.zip` per bug and link `trace.playwright.dev/?trace=<url>`. https://playwright.dev/docs/trace-viewer [S]
42. Quiz on reading a trace: "which action failed and why?" Own.
43. Link each Interview Bank question to its casebook case id and live demo on Render. Own.
44. "Open casebook in Codespaces" button with Playwright preinstalled via `devcontainer.json`. https://docs.github.com/en/billing/concepts/product-billing/github-codespaces [S]
45. `npm create`-style starter for casebook tests. Own.
46. Component-testing question set explaining `mount()` and stories. https://playwright.dev/docs/test-components [S]
47. Playwright MCP explainer question set. Package exists: `@playwright/mcp` 0.0.86 (registry). Own.
48. Cypress vs Playwright architecture flashcards. https://www.checklyhq.com/docs/comparisons/frameworks/playwright-vs-cypress/ [S]

### e2e-casebook (49 to 58)

49. In-app "inspector" overlay (dev toggle) that prints Playwright locators for the clicked element via playwright-injected. https://github.com/kolodny/playwright-injected [O]
50. Built-in bug-toggle panel: flip planted bugs on/off to compare passing and failing runs. Own.
51. "Reset data" and per-visitor private state, as the QA Playground did. https://www.reddit.com/r/QualityAssurance/comments/1x35bm4/i_build_a_qa_playground_for_playwright_and_more/ [S]
52. Public reference solutions hidden behind a spoiler, as the same playground did. Same URL [S]
53. Pre-recorded HAR/trace per bug for offline replay (HAR replay is a Playwright feature; no source read). Own.
54. MSW-in-the-page for a "demo without backend" mode on GitHub Pages. https://mswjs.io/guides/integrations/browser [S]
55. WebdriverIO/Cypress variants of each case documented side by side. Own.
56. `devcontainer.json` with Playwright browsers for Codespaces. https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository [S]
57. StackBlitz link that opens the casebook app only (no tests). https://developer.stackblitz.com/guides/integration/open-from-github [S]
58. Gamified levels over the 200 cases, like Playwright Quest. https://www.reddit.com/r/QualityAssurance/comments/1ve7a7o/i_built_a_game_to_learn_playwright_typescript/ [S]

### cvkit creator (59 to 66)

59. CodeMirror 6 YAML editor with lint markers for the CV schema. Own; package `@codemirror/lang-yaml` is part of the CM6 family (no version fetched).
60. Live schema validation with line-level errors. Own.
61. "Fix my broken YAML" sample CVs as exercises. Own.
62. Diff view between two CV versions. `@codemirror/merge` exists per the CM6 package list [S].
63. Template playground: edit the HTML/CSS template in an iframe preview. Own.
64. YAML-to-JSON toggle. Own.
65. Shareable CV link with the YAML in the URL hash (lz-string, as the TS Playground does). https://www.typescriptlang.org/_playground-handbook/url-structure.html [S]
66. Print-to-PDF preflight checker (page breaks, overflow). Own.

## E. Blockers and unknowns that need a measured spike

1. Do blob-URL workers start from a file:// page in current Safari, Firefox and Chrome? The 2023 Safari failure was `Cannot load blob:null/...` [S].
2. Does a `sandbox="allow-scripts"` srcdoc iframe run, and can it postMessage back, from a file:// page in all three browsers? Is the page's origin `null` usable as the postMessage target?
3. Do sql.js 1.17.0 `sql-wasm-inline.js` and `WebAssembly.instantiate` of a base64 module work from file:// in Safari, and what is the peak memory?
4. How slow is parsing and compiling the 981 KB inline file, and the 833 KB QuickJS one, on a mid-range laptop and a phone?
5. Does a sibling classic `<script src="ide.js">` load from file:// in all three browsers? If yes, a two-file layout could keep the HTML small.
6. Does `fetch()` or dynamic `import()` of a jsDelivr URL work from a file:// origin (CORS, `null` origin) in each browser?
7. Does the official `@typescript/typescript-wasip1-wasm` build work in the reactor/API mode without COOP/COEP, with the `typescript/wasm` host? Its measured gzip and brotli size?
8. Does `@tsrs/wasm` 7.1.0-beta.tsrs5 produce the same diagnostics as `tsc` on the `Expect<Equal<>>` challenge set, and what is the raw wasm size and Safari stack behaviour?
9. Which Monaco 0.58.0 features work when `MonacoEnvironment` returns blob workers from file://, and does it still fall back to the UI thread?
10. How large is a minimal CM6 build (view, state, commands, language, lang-javascript, lang-sql, lang-yaml) with the project's own esbuild settings?
11. Do the 4 to 6 QuickJS interrupt handler budgets reliably stop `while(true){}` and runaway recursion, and what is the memory limit behaviour?
12. In Safari, does a synchronous infinite loop inside an iframe freeze the page? Does a worker-based runner avoid that (own check, since andbox did not measure Firefox [S])?
13. Does playwright-injected 1.59.1 run unmodified in a file:// page and an opaque-origin srcdoc iframe? Are `asLocator` and `querySelectorAll` stable on casebook DOM?
14. How closely do playwright-injected role and name results match real Playwright 1.65.1 on the casebook pages (parity table)?
15. Licence hygiene: playwright-injected's npm MIT label versus bundled Apache-2.0 code. Which NOTICE text must ship in a public repo?
16. Does GitHub Pages plus coi-serviceworker give `crossOriginIsolated === true` in Safari, and does `credentialless` degrade (it is Chromium-only per WebContainers docs [S])?
17. Does PGlite 0.6.0 start from a Pages build with `fsBundle` and the `.data` file pre-gzipped, and what are the cold-start time and memory?
18. Can the trace viewer open a casebook `trace.zip` hosted on GitHub Pages (CORS and HEAD with Content-Length, as the 2021 issue describes [S])?
19. Is a StackBlitz handoff for the casebook app useful in Firefox and Safari (beta support [S])? Do the Playwright tests have to run elsewhere?
20. Codespaces free quota versus a Playwright suite run (browsers install time, hours consumed).
21. Offline service-worker caching of a large lazy asset set on GitHub Pages: eviction behaviour and storage quota.
22. Does the Python injector approach still work if the lazy parts are referenced by hash-pinned URLs (reproducible builds)?