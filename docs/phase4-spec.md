# Phase 4 spec: Playwright practice (ideas 50 and 51)

The contract for the phase 4 tests and code. Tests are written from this file, not from the code. Ideas: 50 locator trainer on frozen pages, 51 links from Playwright questions to e2e-casebook cases. Ideas 52 and 81 (a dev container and an Open in Codespaces link) live in e2e-casebook; this page only links to them.

Rules from phase 1 that apply (`docs/feasibility.md`): nothing beside the HTML; Firefox tests use stock file:// rules; third-party licences go in the one comment at the end of the page. The trainer runs Playwright's locator engine in a sandboxed frame, the setup probe 10 measured in all three engines.

## Words used here

- **Frozen page**: a copy of one e2e-casebook page, taken by the `snapshot` step of the maintainer's probe runner, without its scripts. The ten pages are in `src/locators/pages/` (`<id>.html`, one shared `style.css`). Ids and titles are in `src/locators/tasks.json` under `pages`.
- **Task**: an entry of `tasks` in `src/locators/tasks.json`: `id`, `page`, `task` (the instruction shown), `answer` (a reference locator).
- **Locator text**: what the learner types, in Playwright's JavaScript form, for example `getByRole('button', { name: 'Save' })`.
- **Matched set**: the elements of the frozen page that a locator matches.

## Packed parts

1. The built page holds two more packed parts (same format as phase 3, tags `#pack-pwi` and `#pack-frozen`): `pwi` (Playwright's locator engine from `vendor/playwright-injected.js`) and `frozen` (the frozen pages, their stylesheet and the tasks).
2. Both are unpacked on the first visit to the Locators tab, at most once per page load. Opening the page, Learn, Quiz and Review unpack neither.
3. If unpacking fails, `#locators` shows `This browser cannot unpack the locator trainer. Use a current Chrome, Edge, Firefox or Safari.` with `role="alert"`. No page error.

## Locators tab (idea 50)

### Parts, ids and names

| Part | Id, role, name |
|---|---|
| Header tab | `#tab-locators`, a button named `Locators`; class `on` while the view is open |
| View | `#locators`; hidden unless the view is open; `go('locators')` opens it |
| Page picker | `#loc-page`, a `<select>` named `Frozen page`; one option per page in `pages` order, the option text is the page title, the value is the page id |
| Frame | `#loc-frame`, an `<iframe>` with `sandbox="allow-scripts"` (nothing else), titled `Frozen page: <title>` |
| Locator box | `#loc-input`, a text box named `Locator` |
| Result line | `#loc-state`, `role="status"` |
| Task list | `#loc-tasks`, a list named `Tasks on this page`; one item per task of the page; each item holds a button whose name is the task text |
| Task check | `#loc-verdict`, `role="status"`, empty while no task is chosen |
| Show an answer | a button named `Show an answer`, shown while a task is chosen; it reveals the task's answer in `#loc-answer` |
| Case link | `#loc-case`, a link named `Case N on e2e-casebook: <case title>` (the page's `case` and `caseTitle` in `tasks.json`) to `https://github.com/bartech-lab/e2e-casebook/blob/main/<doc>`, opening in a new tab |

### Behaviour

1. Opening the tab shows the first page, or the page chosen last in this browser (`store.locPage`). Choosing another page shows it in the frame, keeps the text in `#loc-input`, and evaluates it again on the new page. No highlight from the old page remains.
2. The learner types in `#loc-input`. About 150 ms after the last key, the text is evaluated on the frozen page. Only the result of the latest text ever shows: a slower earlier result never replaces a newer one.
3. `#loc-state` carries `data-input` (the exact text it answers, before any clean-up), `data-state` and, when there is a count, `data-count`. Its text by state:

| `data-state` | When | Text |
|---|---|---|
| `empty` | the box is empty or only spaces | `Type a locator, for example getByRole('button', { name: 'Save' }).` |
| `unsupported` | the text is not a locator this trainer reads (see 4) | `This is not a locator the trainer can read. Start with getByRole, getByText, getByLabel, getByPlaceholder, getByAltText, getByTitle, getByTestId or locator, and leave out actions such as click().` |
| `invalid` | the text is read, but the engine rejects it (for example `locator('button[')` or `locator('foo=bar')`) | `Playwright would reject this locator: <the engine's message>` |
| `none` | 0 elements match | `No element matches.` |
| `one` | 1 element matches | `1 element matches.` |
| `many` | N > 1 elements match | `N elements match. An action such as click() would fail in strict mode; narrow it down.` |

4. Clean-up before reading: surrounding spaces, one leading `await `, a leading `page.`, a trailing `;`, and `page.` in front of a locator inside the text (for example `filter({ has: page.getByRole('button') })`) are removed. Text inside quotes is never changed. The cleaned text must start with `getByRole(`, `getByText(`, `getByLabel(`, `getByPlaceholder(`, `getByAltText(`, `getByTitle(`, `getByTestId(` or `locator(`, and must be read completely by Playwright's own locator reader (`locatorOrSelectorAsSelector`). A text that is exactly one `locator('<selector>')` call goes to the engine as that selector even when the reader refuses it, as `page.locator()` does, so a broken selector shows as `invalid`. Otherwise the state is `unsupported`: this covers `foo()`, `getByRole(` without its end, a trailing `.click()` and frame locators.
5. `.or(<locator>)` and `.and(<locator>)` work anywhere in the chain and inside `has:` / `hasNot:`, matching what Playwright builds for them (`internal:or`, `internal:and`): Playwright's own text reader, in every version, has no `.or()` and `.and()`. A `filter({ ... })` with several options works like consecutive filters in Playwright's order: `hasText`, `hasNotText`, `has`, `hasNot`, `visible`.
6. Matched elements carry the attribute `data-qa-match` and are outlined in the frame. No other element carries it. A new result removes every old mark before setting new ones. With 0 matches, nothing is marked.
7. The first match is scrolled into view inside the frame. The bank page itself does not scroll.
8. The frozen page cannot go anywhere: clicks on links, buttons and submit buttons, and form submits, are cancelled inside the frame. The frame never navigates and never loads anything from the network, by file:// or over http.
9. The frame cannot reach the bank page: it has no access to the page's DOM or `localStorage` (no `allow-same-origin`). The bank page accepts messages only from its own frame (`event.source` is the frame's window); any other message, whatever its shape, changes nothing.

### Tasks

1. Choosing a task (its button gets `aria-pressed="true"`, the others `false`) keeps the typed text and checks it at once.
2. While a task is chosen, every result is also compared with the matched set of the task's answer, by element identity:
   - same set: `#loc-verdict` has `data-verdict="pass"` and reads `Passed: your locator matches exactly what the task asks for.`; the task is saved as passed;
   - different count: `data-verdict="count"`, `Not yet: your locator matches N elements; the task wants M elements.` Both counts use `1 element` for one and `N elements` otherwise, `0 elements` included;
   - same count, other elements: `data-verdict="other"`, `Not yet: your locator matches other elements than the task asks for.`;
   - states `empty`, `unsupported`, `invalid`: no verdict (`data-verdict` absent, empty text).
3. A passed task's item has class `passed` and its button name ends with `, passed`. Passing is saved in `localStorage['qa-bank']` under `locators` (`{ "<task id>": 1 }`) through the same read-before-write as phase 2, so two tabs do not overwrite each other. Reload keeps it. Export and import carry it. An import whose `locators` is not an object of `1` values is rejected whole, as phase 2 rejects any bad part; the message names `locators`. On reading saved progress (not an import), a bad `locators` entry is dropped and the rest kept.
4. Saved progress from before phase 4 (no `locators` key) loads without error and shows no task as passed.
5. `Show an answer` reveals the answer text in `#loc-answer`. It does not fill the box and does not mark the task as passed.
6. The chosen page is saved in the progress object (`localStorage['qa-bank']`) under `locPage`. An unknown saved page id falls back to the first page.

### Parity with real Playwright (done-when of phase 4)

Every locator of the parity set below (rows 49 to 57 added in phase 4's follow-up for `.or()`, `.and()` and multi-option filters) and every task answer is typed into the trainer on its page in the built page. Real Playwright 1.65.1 builds the same locator on `#loc-frame` (the text with `page.` in front (locators inside `.or()`, `.and()` and `has:` carry their own `page.` in the table, as in real test code), evaluated with `page` bound to `page.frameLocator('#loc-frame')`) and collects its matched set. The elements marked `data-qa-match` must be exactly that set, in Chromium, Firefox and WebKit, by file://.

- Guard against an empty pass: an entry marked 0 below must match 0 elements in real Playwright; every other entry at least 1.
- Phase 6 removed the case menu from the frozen pages. Rows 14, 18, 19 and 46 targeted it and now target the page content. No page has a `title` attribute any more, so no row uses `getByTitle`.
- Mix rule, checked by the test itself: at most a third of the parity set uses only `getByRole` calls; every kind in the "kind" column appears at least once; at least 10 entries are typed the way learners type (column "typed").
- If a locator ever matches differently, the trainer stops accepting that form (state `unsupported`) or states the limit on screen, and the parity test expects that instead. The entry stays in the set.

| # | Page | Locator text | Kind | Typed | Real count |
|---|---|---|---|---|---|
| 1 | notes | `getByText('Trip ideas')` | text | | ≥1 |
| 2 | shop | `getByText('backpack')` | text | case | ≥1 |
| 3 | orders | `getByText('Page 1 of 3', { exact: true })` | text | | ≥1 |
| 4 | orders | `getByText('page 1', { exact: true })` | text | case | 0 |
| 5 | orders | `getByText(/PLN$/)` | text | regex | ≥1 |
| 6 | orders | `getByText('  page   1 of ')` | text | spaces | ≥1 |
| 7 | signup | `getByLabel('email')` | label | case | ≥1 |
| 8 | settings | `getByLabel('Display')` | label | partial | ≥1 |
| 9 | billing-details | `getByLabel('Full name', { exact: true })` | label | | ≥1 |
| 10 | expense-claims | `getByLabel(/pass/i)` | label | regex | ≥1 |
| 11 | expense-claims | `getByPlaceholder('ewa@')` | placeholder | partial | ≥1 |
| 12 | expense-claims | `getByPlaceholder('EWA@EXAMPLE.COM', { exact: true })` | placeholder | case | 0 |
| 13 | shop | `getByTestId('order-total')` | testid | | ≥1 |
| 14 | notes | `getByRole('listitem').filter({ has: page.getByText('Book notes') })` | filter |  | ≥1 |
| 15 | shop | `getByTestId('order')` | testid | partial | 0 |
| 16 | gallery | `getByAltText('photo 1 of')` | alt | case | ≥1 |
| 17 | gallery | `getByAltText(/Photo \d of/)` | alt | regex | ≥1 |
| 18 | gallery | `getByAltText('Photo 1 of 24 from the trip')` | alt |  | ≥1 |
| 19 | gallery | `getByAltText('from the trip')` | alt | partial | ≥1 |
| 20 | orders | `locator('tbody tr')` | css | | ≥1 |
| 21 | shop | `locator('[data-testid="order-total"]')` | css | | ≥1 |
| 22 | settings | `locator('select option')` | css | | ≥1 |
| 23 | notes | `locator('li input[type=checkbox]')` | css | | ≥1 |
| 24 | playlist | `locator('li:has-text("Slow Train") button')` | css | | ≥1 |
| 25 | product-tabs | `locator('//h1')` | xpath | | ≥1 |
| 26 | orders | `locator('tbody tr').filter({ hasText: 'Piotr' })` | filter | | ≥1 |
| 27 | orders | `getByRole('row').filter({ hasNotText: 'PLN' })` | filter | | ≥1 |
| 28 | shop | `getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Reviews for Pen' }) })` | filter | | ≥1 |
| 29 | notes | `locator('li').filter({ hasText: /ideas$/ })` | filter | regex | ≥1 |
| 30 | playlist | `getByRole('listitem').filter({ hasText: 'slow' }).getByRole('button')` | filter | case | ≥1 |
| 31 | orders | `locator('tbody tr').nth(2)` | nth | | ≥1 |
| 32 | playlist | `getByRole('button', { name: /^Move/ }).last()` | last | regex | ≥1 |
| 33 | gallery | `getByRole('img').first()` | first | | ≥1 |
| 34 | notes | `getByRole('checkbox').nth(-1)` | nth | | ≥1 |
| 35 | signup | `getByRole('button', { name: 'show PASSWORD' })` | role | case | ≥1 |
| 36 | signup | `getByRole('button', { name: 'Show', exact: true })` | role | | 0 |
| 37 | product-tabs | `getByRole('tabpanel', { includeHidden: true })` | role | | ≥1 |
| 38 | billing-details | `getByRole('radio', { checked: false })` | role | | ≥1 |
| 39 | orders | `getByRole('button', { disabled: true })` | role | | ≥1 |
| 40 | product-tabs | `getByRole('heading', { level: 1 })` | role | | ≥1 |
| 41 | settings | `getByRole('combobox', { name: /them/i })` | role | regex | ≥1 |
| 42 | shop | `getByRole('checkbox', { checked: true })` | role | | ≥1 |
| 43 | product-tabs | `getByRole('tab', { selected: true })` | role | | ≥1 |
| 44 | shop | `getByRole('link', { name: 'reviews for' })` | role | partial | ≥1 |
| 45 | orders | `getByRole('cell', { name: 'Ann' })` | role | | ≥1 |
| 46 | playlist | `getByLabel('Move Slow Train')` | label |  | ≥1 |
| 47 | shop | `page.getByRole('button', { name: 'Add Pen' });` | role | prefix | ≥1 |
| 48 | signup | `await page.getByLabel('Name', { exact: true })` | label | prefix | ≥1 |
| 49 | notes | `getByRole('button', { name: 'Star' }).or(page.getByRole('button', { name: 'Archive' }))` | or |  | ≥1 |
| 50 | notes | `getByRole('checkbox').and(page.getByLabel('Trip ideas'))` | and |  | ≥1 |
| 51 | shop | `getByRole('link', { name: 'Reviews for Pen' }).or(page.getByRole('button', { name: 'Add Pen' })).first()` | or |  | ≥1 |
| 52 | orders | `getByRole('row').filter({ hasText: 'Ann' }).and(page.getByRole('row').filter({ hasText: '1006' }))` | and |  | ≥1 |
| 53 | shop | `getByRole('listitem').filter({ has: page.getByRole('button').or(page.getByRole('link')) })` | or |  | ≥1 |
| 54 | orders | `getByRole('row').filter({ has: page.getByRole('cell', { name: 'Ann' }), hasText: '400' })` | filter |  | ≥1 |
| 55 | orders | `getByRole('row').filter({ hasNotText: 'ann', hasText: /Ewa|Ola/ }).first()` | filter | case | ≥1 |
| 56 | playlist | `getByRole('listitem').filter({ visible: true, hasText: 'slow' })` | filter | case | ≥1 |
| 57 | orders | `getByRole('row').filter({ hasText: /a{1,2}, b|Ann/, has: page.getByRole('cell', { name: '400' }) })` | filter | regex | ≥1 |

## Links to e2e-casebook (idea 51)

1. `src/casebook.json` holds `cases` (keyed by case number: `title`, `doc`, `page`, and `solution` when the case has a worked solution) and `links` (question id to a list of case numbers). The build fails when a link names an unknown question id or a case number missing from `cases`.
2. Below the answer of a linked question (in Learn, and in the quiz once the answer shows), one block `.casebook`, a region named `Practise on e2e-casebook`, holds per linked case:
   - a link named `Case N: <title>` to `https://github.com/bartech-lab/e2e-casebook/blob/main/<doc>`;
   - a link named `Try case N live` to `https://e2e-proving-ground.onrender.com/?try=<page>` (the page part URL-encoded as a query value);
   - when the case has `solution`: a link named `Worked solution for case N` to `https://github.com/bartech-lab/e2e-casebook/tree/main/solutions/cases/<solution>#readme`.
   Once per block: a link named `Run real Playwright in GitHub Codespaces` to `https://codespaces.new/bartech-lab/e2e-casebook?quickstart=1`, and the sentence `The live demo sleeps when idle and can take about a minute to wake.`
3. Every link in the block opens in a new tab (`target="_blank"`, `rel="noopener"`).
4. Questions without links show no `.casebook` block.

## Addresses (for the e2e-casebook learning path)

1. Opening the page with `#qNNNN` (an existing question id) shows that question in Learn, its topic open. `#locators` opens the Locators tab.
2. Changing the address to such a value while the page is open does the same.
3. An unknown id (`#q9999`), another value or no `#` part leaves home open, with no page error.
4. `data-ready="1"` is set after the address was followed.

## Known limit (stated, not tested)

A regular expression that takes very long to match (for example `getByText(/(a+)+$/)` on long text) can freeze the tab, because matching runs inside the frame and a busy frame freezes the page in all three engines (probe 9). Only the learner's own tab is affected.

## Failure modes the tests cover

1. Empty box, spaces only.
2. Not a locator: `foo()`, `getByRole(` unfinished, `getByRole('button').click()`, `getByRole('button').or(foo())`, `frameLocator('#x').getByRole('button')`. And the opposite: `.or()`, `.and()` and multi-option filters are read (parity rows 49 to 57).
3. Read but rejected: `locator('button[')` (bad CSS), `locator('foo=bar')` (unknown engine).
4. 0, 1 and many matches, with the right number in the text.
5. Prefixes: `await`, `page.`, `;`, and `page.` inside `has:`. A string that contains `page.` (for example `getByText('page.one')`) keeps it.
6. Fast typing: a slow earlier result never shows after a newer one (`data-input` equals the box text).
7. Switching page clears marks and re-evaluates the text.
8. Clicking a link or a submit button in the frame changes nothing: the frame keeps its document.
9. The frame is sandboxed without same-origin; the page ignores a message that does not come from the frame (for example `window.postMessage` from the page itself with a fake result).
10. Task: pass, wrong count, same count but other elements; saved, kept after reload, kept across two tabs, absent in old progress, bad `locators` on import.
11. Show an answer reveals the answer only.
12. Locators tab by file:// in Chromium, stock-rules Firefox and WebKit.
13. Unpacking fails (no `DecompressionStream`): the alert shows, no page error.
14. Casebook block: shown on a linked question with the exact links, absent on an unlinked one, present in the quiz after Show answer.
15. Parity table above plus every task answer.
