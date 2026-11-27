# Phase 1 feasibility: what runs in a double-clicked page

Measured on 2026-11-27. Chromium and Firefox ran on the maintainer's Linux laptop; WebKit ran in GitHub Actions (`ubuntu-latest`), because it does not start on that laptop.

**WebKit here is Playwright's Linux build of WebKit, not Safari.** Safari on a Mac or an iPhone has its own rules for files opened by double-click and its own privacy settings, so every WebKit row is a lower bound of what to check. A check on real Safari is still open (see the end).

## How to repeat it

```sh
node tools/probes.mjs setup                  # pinned packages and probe pages into probes/ (git-ignored)
node tools/probes.mjs snapshot <app-url>     # probe 11 only: freeze pages of a running sample app
node tools/probes.mjs run chromium firefox   # every probe by file:// and by http, results in probes/results-<browser>.json
```

WebKit: run the manual **Probes** workflow (Actions tab) with `browsers: webkit` and the sample app's `owner/name`; it uploads the same JSON files.

Each probe page reports into `window.__result`. "file" means the page was opened from disk (`file://`), like a double-click; "http" means a local web server. Probe 3 and 4 timings are the median of 5 cold loads, measured from the page's own time origin, so they include parsing the inlined code.

## Answers

"Yes in all three" below means Chromium 159, Firefox 159 and WebKit 27.2 (Linux build), by file:// and by http.

1. **A worker made from text in the page starts.** Yes in all three, as a `blob:` URL and as a `data:` URL. The 2023 Safari failure did not repeat in Linux WebKit; real Safari is unchecked.
2. **A sandboxed frame (`sandbox="allow-scripts"`, no same-origin) runs code and reports back** by `postMessage`. Yes in all three. The frame cannot read the page and has no `localStorage`; its origin is `null`.
3. **The sql.js single-file build loads** in all three, runs a CTE with a window function, and reports SQLite 3.54.1. Its wasm memory is 21.1 MB at start and stays 21.1 MB after 10,000 rows. Chromium's JS heap after the test: 9.5 MB; Firefox and WebKit do not report a JS heap.
4. **Start time** (median of 5, page open to ready, includes parsing the inlined code):
   - sql.js: Chromium 22 ms (file) / 25 ms (http); Firefox 68 / 32 ms; WebKit 101 / 118 ms.
   - QuickJS: Chromium 29 / 31 ms; Firefox 65 / 19 ms; WebKit 106 / 98 ms.
   - WebKit ran on a GitHub runner, Chromium and Firefox on the laptop, so compare within a row only.
   - Phone: **not measured**, no phone was available. Chromium with the CPU slowed 4x gives 91 to 106 ms for sql.js and 130 to 134 ms for QuickJS; that is an estimate, not a phone.
5. **A second file beside the HTML, on double-click:** a classic `<script src>` loads in all three. By file://, Chromium and WebKit refuse a module script, `fetch()` and a worker from a file; Firefox allows all four. By http everything loads. So a part beside the page must be a classic script that sets a global.
6. **An optional part from a public CDN, on double-click:** yes in all three. A classic script, its wasm by `fetch()` (CORS from origin `null`) and an ES module by `import()` all load from jsDelivr. An earlier try with Sucrase's `+esm` build failed in Chromium and Firefox because jsDelivr's rewrite of a dependency was broken, not because of file://; the probe now loads `style-mod`, which has no dependencies. Pin exact versions and test the CDN copy itself before relying on it.
7. **CodeMirror 6 with JavaScript/TypeScript, SQL and YAML** is 551,850 bytes minified (186,985 gzip) and mounts three working editors in all three.
8. **A time limit stops runaway code.**
   - Worker plus `terminate()` after 1 s stops `while(true){}` and recursion that catches its own stack error, in all three. Plain recursion ends by itself with the engine's stack error. The page's own timer never stalled more than 37 ms, and a new worker works afterwards.
   - QuickJS's interrupt handler stops `while(true){}` at 1,000 ms in all three.
   - QuickJS needs `setMaxStackSize` (256 KB tested). Without it, plain recursion in Chromium overflows the browser's stack inside the wasm code and breaks the QuickJS instance (`dispose` then throws).
   - Recursion that catches its own stack error overshoots QuickJS's 1 s deadline: 1.4 to 2.0 s with the stack limit, up to 4.2 s without it in Firefox and WebKit.
   - Conclusion: workers do the job in all three engines, so QuickJS (871 KB) is not needed. Keep it as the fallback if real Safari fails probe 1.
9. **An endless loop in a sandboxed frame freezes the whole page** in all three engines, not only WebKit: a 3-second busy loop in the frame stalled the page's timer for 3.0 s. User code must run in a worker; a frame alone does not protect the page.
10. **playwright-injected runs unchanged** on double-click and inside a sandboxed frame in all three. It returns the expected matches for role, name, level and hidden-element locators.
11. **Parity with real Playwright 1.65.1:** 746 of 746 locators match in Chromium and Firefox, 747 of 747 in WebKit, on 11 frozen pages of a public React practice app.
    - Each locator is `getByRole` with a role alone, or a role with an exact accessible name.
    - The roles and names were taken from the page by playwright-injected itself. A name that Playwright computes differently would still show as a mismatch, because the real `getByRole` would then match nothing.
    - Both sides were compared by the set of elements matched.
    - The bundled code is Playwright's source of 2026-04-01 (commit d466ac53), six releases behind 1.65.1.
12. **Notices for playwright-injected.** The npm package says MIT (author Moshe Kolodny) but ships no LICENSE file and no copyright line; its repository has no LICENSE file either. The code inside is Playwright's, under Apache-2.0. The page must ship:
    - the full Apache License 2.0 text (from `playwright-core/LICENSE`);
    - Playwright's NOTICE file, unchanged (identical at the bundled commit and in 1.65.1):

          Playwright
          Copyright (c) Microsoft Corporation

          This software contains code derived from the Puppeteer project (https://github.com/puppeteer/puppeteer),
          available under the Apache 2.0 license (https://github.com/puppeteer/puppeteer/blob/master/LICENSE).

    - a line saying the code was repackaged and minified from Playwright's source;
    - an MIT notice naming Moshe Kolodny for the packaging.
    The MIT licences of sql.js, CodeMirror and Sucrase go beside them, in one comment at the end of the page, as cvkit's creator does.

## Table

WebKit rows come from the Probes workflow run of b56e7ab. The table is rendered from the JSON results.

| Probe page | Browser | Version | Protocol | Result | Page size (raw / gzip) |
|---|---|---|---|---|---|
| p01-worker.html | chromium | 159.0.8154.6 | file | blob: ok; data: ok | 831 / 484 |
| p01-worker.html | chromium | 159.0.8154.6 | http | blob: ok; data: ok | 831 / 484 |
| p01-worker.html | firefox | 159.0 | file | blob: ok; data: ok | 831 / 484 |
| p01-worker.html | firefox | 159.0 | http | blob: ok; data: ok | 831 / 484 |
| p01-worker.html | webkit (Linux build, not Safari) | 27.2 | file | blob: ok; data: ok | 831 / 487 |
| p01-worker.html | webkit (Linux build, not Safari) | 27.2 | http | blob: ok; data: ok | 831 / 487 |
| p02-frame.html | chromium | 159.0.8154.6 | file | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p02-frame.html | chromium | 159.0.8154.6 | http | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p02-frame.html | firefox | 159.0 | file | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p02-frame.html | firefox | 159.0 | http | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p02-frame.html | webkit (Linux build, not Safari) | 27.2 | file | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p02-frame.html | webkit (Linux build, not Safari) | 27.2 | http | run: ok; parentAccess: blocked; storage: blocked; frameOrigin: null | 779 / 475 |
| p03-sql.html | chromium | 159.0.8154.6 | file | readyMs: median of 5: 22; initMs: median of 5: 13; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: 9.5 | 982,809 / 447,354 |
| p03-sql.html | chromium | 159.0.8154.6 | http | readyMs: median of 5: 25; initMs: median of 5: 14; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: 9.5 | 982,809 / 447,354 |
| p03-sql.html | firefox | 159.0 | file | readyMs: median of 5: 68; initMs: median of 5: 18; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: not reported | 982,809 / 447,354 |
| p03-sql.html | firefox | 159.0 | http | readyMs: median of 5: 32; initMs: median of 5: 19; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: not reported | 982,809 / 447,354 |
| p03-sql.html | webkit (Linux build, not Safari) | 27.2 | file | readyMs: median of 5: 101; initMs: median of 5: 59; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: not reported | 982,809 / 444,277 |
| p03-sql.html | webkit (Linux build, not Safari) | 27.2 | http | readyMs: median of 5: 118; initMs: median of 5: 77; rows: 3; firstRank: 1; sqlite: 3.54.1; wasmMBReady: 21.125; wasmMB10k: 21.125; jsHeapMB: not reported | 982,809 / 444,277 |
| p03-sql.html (CPU 4x slower) | chromium | 159.0.8154.6 | file | readyMs: median of 5: 106; note: CPU slowed 4x: an estimate for a mid-range phone, not a phone | 982,809 / 447,354 |
| p03-sql.html (CPU 4x slower) | chromium | 159.0.8154.6 | http | readyMs: median of 5: 91; note: CPU slowed 4x: an estimate for a mid-range phone, not a phone | 982,809 / 447,354 |
| p04-quickjs.html | chromium | 159.0.8154.6 | file | readyMs: median of 5: 29; initMs: median of 5: 16; wasmMB: 16; sum: 8 ms, returned 4999950000; endlessLoop: 1001 ms, InternalError: interrupted; recursion, default stack: 1 ms, host throws RangeError: Maximum call stack size exceeded; dispose throws RuntimeError; recursionThatCatches, default stack: 1 ms, host throws RangeError: Maximum call stack size exceeded; dispose throws RuntimeError; recursion, stack limit 256 KB: 2 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 1377 ms, InternalError: interrupted | 873,567 / 276,830 |
| p04-quickjs.html | chromium | 159.0.8154.6 | http | readyMs: median of 5: 31; initMs: median of 5: 16; wasmMB: 16; sum: 9 ms, returned 4999950000; endlessLoop: 1001 ms, InternalError: interrupted; recursion, default stack: 1 ms, host throws RangeError: Maximum call stack size exceeded; dispose throws RuntimeError; recursionThatCatches, default stack: 1 ms, host throws RangeError: Maximum call stack size exceeded; dispose throws RuntimeError; recursion, stack limit 256 KB: 2 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 1444 ms, InternalError: interrupted | 873,567 / 276,830 |
| p04-quickjs.html | firefox | 159.0 | file | readyMs: median of 5: 65; initMs: median of 5: 16; wasmMB: 16; sum: 3 ms, returned 4999950000; endlessLoop: 1001 ms, InternalError: interrupted; recursion, default stack: 5 ms, InternalError: stack overflow; recursionThatCatches, default stack: 3166 ms, InternalError: interrupted; recursion, stack limit 256 KB: 0 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 1536 ms, InternalError: interrupted | 873,567 / 276,830 |
| p04-quickjs.html | firefox | 159.0 | http | readyMs: median of 5: 19; initMs: median of 5: 6; wasmMB: 16; sum: 4 ms, returned 4999950000; endlessLoop: 1000 ms, InternalError: interrupted; recursion, default stack: 5 ms, InternalError: stack overflow; recursionThatCatches, default stack: 3153 ms, InternalError: interrupted; recursion, stack limit 256 KB: 1 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 1480 ms, InternalError: interrupted | 873,567 / 276,830 |
| p04-quickjs.html | webkit (Linux build, not Safari) | 27.2 | file | readyMs: median of 5: 106; initMs: median of 5: 55; wasmMB: 16; sum: 81 ms, returned 4999950000; endlessLoop: 1000 ms, InternalError: interrupted; recursion, default stack: 19 ms, InternalError: stack overflow; recursionThatCatches, default stack: 4240 ms, InternalError: interrupted; recursion, stack limit 256 KB: 1 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 2006 ms, InternalError: interrupted | 873,567 / 277,268 |
| p04-quickjs.html | webkit (Linux build, not Safari) | 27.2 | http | readyMs: median of 5: 98; initMs: median of 5: 46; wasmMB: 16; sum: 65 ms, returned 4999950000; endlessLoop: 1001 ms, InternalError: interrupted; recursion, default stack: 18 ms, InternalError: stack overflow; recursionThatCatches, default stack: 4195 ms, InternalError: interrupted; recursion, stack limit 256 KB: 2 ms, InternalError: stack overflow; recursionThatCatches, stack limit 256 KB: 2008 ms, InternalError: interrupted | 873,567 / 277,268 |
| p04-quickjs.html (CPU 4x slower) | chromium | 159.0.8154.6 | file | readyMs: median of 5: 130; note: CPU slowed 4x: an estimate for a mid-range phone, not a phone | 873,567 / 276,830 |
| p04-quickjs.html (CPU 4x slower) | chromium | 159.0.8154.6 | http | readyMs: median of 5: 134; note: CPU slowed 4x: an estimate for a mid-range phone, not a phone | 873,567 / 276,830 |
| p05-beside.html | chromium | 159.0.8154.6 | file | classicScript: ok; moduleScript: not loaded; fetch: fails: TypeError; workerFromFile: throws: SecurityError | 810 / 454 |
| p05-beside.html | chromium | 159.0.8154.6 | http | classicScript: ok; moduleScript: ok; fetch: ok; workerFromFile: ok | 810 / 454 |
| p05-beside.html | firefox | 159.0 | file | classicScript: ok; moduleScript: ok; fetch: ok; workerFromFile: ok | 810 / 454 |
| p05-beside.html | firefox | 159.0 | http | classicScript: ok; moduleScript: ok; fetch: ok; workerFromFile: ok | 810 / 454 |
| p05-beside.html | webkit (Linux build, not Safari) | 27.2 | file | classicScript: ok; moduleScript: not loaded; fetch: fails: TypeError; workerFromFile: error event | 810 / 453 |
| p05-beside.html | webkit (Linux build, not Safari) | 27.2 | http | classicScript: ok; moduleScript: ok; fetch: ok; workerFromFile: ok | 810 / 453 |
| p06-cdn.html | chromium | 159.0.8154.6 | file | classicScript: ok; wasm: ok, 37 ms; esmImport: ok, 12 ms | 884 / 460 |
| p06-cdn.html | chromium | 159.0.8154.6 | http | classicScript: ok; wasm: ok, 46 ms; esmImport: ok, 10 ms | 884 / 460 |
| p06-cdn.html | firefox | 159.0 | file | classicScript: ok; wasm: ok, 34 ms; esmImport: ok, 12 ms | 884 / 460 |
| p06-cdn.html | firefox | 159.0 | http | classicScript: ok; wasm: ok, 28 ms; esmImport: ok, 7 ms | 884 / 460 |
| p06-cdn.html | webkit (Linux build, not Safari) | 27.2 | file | classicScript: ok; wasm: ok, 57 ms; esmImport: ok, 15 ms | 884 / 461 |
| p06-cdn.html | webkit (Linux build, not Safari) | 27.2 | http | classicScript: ok; wasm: ok, 49 ms; esmImport: ok, 13 ms | 884 / 461 |
| p07-codemirror.html | chromium | 159.0.8154.6 | file | editors: 3; highlighted: yes | 552,449 / 187,304 |
| p07-codemirror.html | chromium | 159.0.8154.6 | http | editors: 3; highlighted: yes | 552,449 / 187,304 |
| p07-codemirror.html | firefox | 159.0 | file | editors: 3; highlighted: yes | 552,449 / 187,304 |
| p07-codemirror.html | firefox | 159.0 | http | editors: 3; highlighted: yes | 552,449 / 187,304 |
| p07-codemirror.html | webkit (Linux build, not Safari) | 27.2 | file | editors: 3; highlighted: yes | 552,449 / 188,563 |
| p07-codemirror.html | webkit (Linux build, not Safari) | 27.2 | http | editors: 3; highlighted: yes | 552,449 / 188,563 |
| p08-worker-limit.html | chromium | 159.0.8154.6 | file | endlessLoop: stopped by terminate() after 1000 ms; recursion: finished itself: RangeError; recursionThatCatches: stopped by terminate() after 1000 ms; afterwards: finished itself: ok; pageMaxGapMs: 20 | 1,280 / 636 |
| p08-worker-limit.html | chromium | 159.0.8154.6 | http | endlessLoop: stopped by terminate() after 1000 ms; recursion: finished itself: RangeError; recursionThatCatches: stopped by terminate() after 1000 ms; afterwards: finished itself: ok; pageMaxGapMs: 20 | 1,280 / 636 |
| p08-worker-limit.html | firefox | 159.0 | file | endlessLoop: stopped by terminate() after 1004 ms; recursion: finished itself: InternalError; recursionThatCatches: error event: too much recursion; afterwards: finished itself: ok; pageMaxGapMs: 24 | 1,280 / 636 |
| p08-worker-limit.html | firefox | 159.0 | http | endlessLoop: stopped by terminate() after 1000 ms; recursion: finished itself: InternalError; recursionThatCatches: error event: too much recursion; afterwards: finished itself: ok; pageMaxGapMs: 21 | 1,280 / 636 |
| p08-worker-limit.html | webkit (Linux build, not Safari) | 27.2 | file | endlessLoop: stopped by terminate() after 1004 ms; recursion: finished itself: RangeError; recursionThatCatches: stopped by terminate() after 1001 ms; afterwards: finished itself: ok; pageMaxGapMs: 25 | 1,280 / 637 |
| p08-worker-limit.html | webkit (Linux build, not Safari) | 27.2 | http | endlessLoop: stopped by terminate() after 1004 ms; recursion: finished itself: RangeError; recursionThatCatches: stopped by terminate() after 1000 ms; afterwards: finished itself: ok; pageMaxGapMs: 37 | 1,280 / 637 |
| p09-frame-freeze.html | chromium | 159.0.8154.6 | file | pageMaxGapMs: 3001; frozen: yes | 759 / 456 |
| p09-frame-freeze.html | chromium | 159.0.8154.6 | http | pageMaxGapMs: 3001; frozen: yes | 759 / 456 |
| p09-frame-freeze.html | firefox | 159.0 | file | pageMaxGapMs: 3000; frozen: yes | 759 / 456 |
| p09-frame-freeze.html | firefox | 159.0 | http | pageMaxGapMs: 3002; frozen: yes | 759 / 456 |
| p09-frame-freeze.html | webkit (Linux build, not Safari) | 27.2 | file | pageMaxGapMs: 3006; frozen: yes | 759 / 457 |
| p09-frame-freeze.html | webkit (Linux build, not Safari) | 27.2 | http | pageMaxGapMs: 3017; frozen: yes | 759 / 457 |
| p10-injected.html | chromium | 159.0.8154.6 | file | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,519 |
| p10-injected.html | chromium | 159.0.8154.6 | http | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,519 |
| p10-injected.html | firefox | 159.0 | file | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,519 |
| p10-injected.html | firefox | 159.0 | http | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,519 |
| p10-injected.html | webkit (Linux build, not Safari) | 27.2 | file | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,647 |
| p10-injected.html | webkit (Linux build, not Safari) | 27.2 | http | expected: 1,1,1,1,1; page: 1,1,1,1,1; sandboxedFrame: 1,1,1,1,1 | 153,752 / 44,647 |
| p11-parity | chromium | 159.0.8154.6 | file | 746 of 746 locators match on 11 pages | - |
| p11-parity | chromium | 159.0.8154.6 | http | 746 of 746 locators match on 11 pages | - |
| p11-parity | firefox | 159.0 | file | 746 of 746 locators match on 11 pages | - |
| p11-parity | firefox | 159.0 | http | 746 of 746 locators match on 11 pages | - |
| p11-parity | webkit (Linux build, not Safari) | 27.2 | file | 747 of 747 locators match on 11 pages | - |
| p11-parity | webkit (Linux build, not Safari) | 27.2 | http | 747 of 747 locators match on 11 pages | - |

## Sizes of the parts (minified, as inlined into the page)

| Part | Version | Raw bytes | Gzip bytes | Needed by |
|---|---|---|---|---|
| Today's page, `dist/index.html` | build of b56e7ab | 2,049,203 | 593,253 | - |
| of which question data | 1,057 questions | 2,010,752 | | - |
| of which page code and style | | 38,451 | | - |
| sql.js single-file build (`sql-wasm-inline.js`, wasm inlined as base64) | 1.17.0, SQLite 3.54.1 | 981,105 | 446,512 | phase 3 |
| CodeMirror 6 with JavaScript/TypeScript, SQL and YAML, esbuild minified | codemirror 6.0.2, lang-javascript 6.2.5, lang-sql 6.10.0, lang-yaml 6.1.3 | 551,850 | 186,985 | phase 3 |
| Sucrase type stripping, esbuild minified | 3.35.1 | 206,226 | 47,343 | phase 3 |
| playwright-injected (role engine and accessible names), esbuild minified | 1.59.1 | 151,475 | 43,741 | phase 4 |
| QuickJS single-file build with the core API, esbuild minified | quickjs-emscripten-core 0.32.0 | 871,176 | 275,711 | not needed (probe 8) |

## Size budget for the offline file

**Budget: `dist/index.html` stays at or below 4,500,000 bytes.** The limit applies to the HTML file, not the zip.

| | Bytes |
|---|---|
| Today | 2,049,203 |
| Phase 3 parts: sql.js, CodeMirror, Sucrase | + 1,739,181 |
| Phase 4 part: playwright-injected | + 151,475 |
| Expected after phases 3 and 4, before glue code | 3,939,859 |
| Left for glue code and new questions | 560,141 |

- The headroom is about 28% of today's question data. It is room for new content, not for another engine.
- QuickJS stays out: workers stopped runaway code in all three engines (probe 8).
- Start time does not set the limit: sql.js is ready within 22 to 118 ms (probe 4).
- When a change would pass the budget, sql.js (981,105 bytes, the largest part) moves to a classic script file beside the HTML. It loads only when a SQL task opens. Probe 5 shows a classic script beside the page loads on double-click in all three engines; a module, `fetch()` or a worker from a file does not.
- The zip should grow by about 0.72 MB, the gzip size of the new parts, to roughly 1.9 MB. This is estimated, not measured.
- Each phase checks the built size against this budget and records it here.

## Open

- Real Safari on a Mac and an iPhone: probes 1, 2, 5, 6, 8 and 9 by double-click. Linux WebKit passed them, but Safari's file rules may differ.
- Start time on a real phone (probe 4).
- Probes 13 to 16 belong to later phases.
