# Phase 5 rest and phase 6 spec: reuse, offline copy, mock interview and own cards

The contract for the tests and code of this session. Tests are written from this file, not from the code. Ideas:
- 10: content checks;
- 11: CONTRIBUTING;
- 12: data version and release notes;
- 69: offline copy on Pages;
- 71: `questions.json`;
- 59: job-ad paste;
- 60: role presets;
- 61: mock flow;
- 62: live-coding rehearsal;
- 63: own cards.

The same session moves the locator trainer out of the header (user, 2026-11-28).

Rules from earlier phases still apply (`docs/feasibility.md`, earlier specs):
- the page is one file that works by file://;
- Firefox tests use stock file:// rules;
- no browser dialogs; confirms are in the page;
- every change to saved progress goes through `update()`;
- question ids `qNNNN` never change.

## Words used here

- **Bank question**: a question from `topics/*.md`, id `qNNNN`.
- **Card**: a question the learner wrote, id `u` followed by 1 to 16 characters from `[0-9a-z]`. Cards live in this browser's saved progress and in the export file.
- **Topic slug**: the first field of a question's `Topic:` line, for example `pw-locators`.
- **Data version**: a label for the question set: `YYYY.MM.DD+<12 lowercase hex>`. The date is the commit date of the newest commit that changed `topics/`. The hex is the start of the SHA-256 of the question ids, titles and bodies, so the same questions always give the same hex. Without git history, the date part is `local` (`local+<hex>`).

## 1. Header and the locator drill

1. The header has three view buttons: `Learn`, `Quiz`, `Review`. There is no `#tab-locators` and no button named `Locators` in the header.
2. `#locators` and `go('locators')` stay. The address `#locators` still opens the drill, because e2e-casebook links it. While the drill is open, `#tab-learn` has class `on`.
3. The drill opens from two places:
   - In Learn, when the topic is Playwright (`01-playwright`), the side panel shows a button `#drill-open` named `Locator drill`.
   - Each question whose topic slug is `pw-locators` shows a button with class `drill-link`, named `Practise in the locator drill`, under its answer.
4. The drill view starts with a button `#loc-back` named `← Playwright`. It opens Learn on the Playwright topic.
5. The frozen pages contain no element with class `sandbox-nav`. The e2e-casebook case menu is gone: no "Case catalogue" heading and no "Jump to a case" box.
6. Layout:
   - At 1280×720, the locator box `#loc-input` and the frozen page's first `h1` or `h2` are both inside the window without scrolling.
   - At 390×844, both are also inside the window without scrolling.
7. Everything else in `docs/phase4-spec.md` stays: tasks, verdicts, the case link, and the parity with real Playwright.

## 2. Own cards (idea 63)

### Saved data

`store.cards` is an object: card id → `{ q, a, company, created }`.
- `q` (question): a string of 1 to 10,000 characters, not only spaces.
- `a` (answer): a string of 0 to 10,000 characters.
- `company`: a string of 0 to 80 characters. Empty means no company.
- `created`: a day, `YYYY-MM-DD`.

`store.companies` is an object: company name → note, a string of 0 to 10,000 characters.

Limits: at most 500 cards and at most 50 company notes.

Marks, notes, spaced review and saved code use the card id like a bank question id.

`cleanProgress` checks `cards` and `companies` part by part, as for the other keys:
- A bad card is listed as `cards.<id>`. An id not matching `^u[0-9a-z]{1,16}$` is bad too.
- A bad note is listed as `companies.<name>`.
- More than 500 cards is listed as `cards`; more than 50 notes as `companies`.

**Notes with no card.** `cleanProgress` drops a company note when no valid card has that company, compared after trimming the card's company, case included. Such a note could not be shown or deleted on the page; v0.3.0 left one behind when a company's last card moved to another company.
- The drop is silent: it is not a bad part, so an import with such a note still goes ahead.
- The drop comes before the 50-note limit, so dropped notes do not count toward it.
- It runs on every read of saved progress and on import. The next save writes the cleaned progress; a backup file on disk is not changed.

Import rejects a file with any bad part, as before. `FORMAT` stays 1, and saved progress keeps `v: 2`. A page from before this phase keeps keys it does not know, so cards survive a save by an older copy.

### Home

Below Topics, a section `#my-cards` with the heading `My cards`:
- **No cards:** the text `Add your own questions, for example one a company asked you. They stay in this browser and go into Export progress.` and a button `#card-add` named `Add a card`.
- **Cards:**
  - One row per company, with class `card-company`, in name order, then `No company` last if any card has none.
  - Each row is a button named `<company> · N card(s)`. It opens Learn on the cards, at that company's first card. It shows the name on the left and the count on the right, as the topic rows do.
  - The button `#card-add` named `Add a card`.

### Learn on cards

- `go('learn', 'my-cards')` shows the cards. In the side list, each company is a section, and `No company` comes last.
- The side panel's title is `My cards`, and it has an `Add a card` button `#card-add-side`.
- A card's article:
  - The crumbs read `My card` and the company if any. There is no tier badge.
  - The heading is the card's question, and the answer shows like a bank question's **Say**.
  - The marks (Known, Shaky), My note, Previous and Next work as for bank questions.
  - It has a button `#card-edit` named `Edit card`, and a button `#card-delete` named `Delete card`.
  - It has no `Report a problem with this answer` link and no e2e-casebook block. Card text must never reach a public issue.
- **Company note:** when the card has a company, the article shows a text box `.company-note`, named `Note for <company>`. It holds `store.companies[<company>]` and is shared by all cards of that company. Emptying it deletes the note.
- **Search** (`#lsearch`, in every topic and in My cards) matches, ignoring case, the question title, the answer text the article shows, and for a card its company. The hidden `Topic: … | <tier> | id: …` line is not searched, so `topic`, `core` or `my-cards` match only questions whose shown text holds the word. A question's id (`q0042`, or a card id) typed whole still finds that question.
- **Rendering:** card text goes through the same Markdown reader as bank answers. HTML in it shows as text. A link is a link only when it starts with `http://` or `https://`.

### Add and edit form

The form `#card-form` replaces the article. Its fields and buttons:
- `#card-q`, a text box named `Question`;
- `#card-a`, named `Answer`;
- `#card-company`, named `Company (optional)`, which suggests company names already used;
- `#card-save`, named `Save card`;
- `#card-cancel`, named `Cancel`.

Messages go to `#card-msg` (`role="alert"`). Each message below appears when its check fails, and nothing is saved:

| Check | Message |
|---|---|
| Question empty or only spaces | `Write the question first.` |
| A field over its limit | `<Field> is too long: at most N characters.` |
| 500 cards already, adding one more | `You have 500 cards, the most this page keeps. Delete one to add another.` |
| 50 company notes already, a new company with a note | `You have notes for 50 companies, the most this page keeps.` |

**Changing a card's company.** Saving a card with another company (any change, case included) when it was the only card of its old company, and that company has a note:
- **The new company has no note:** the note moves to the new company's name.
- **The new company has a note:** the old note is added after it, separated by one empty line (`<new note>\n\n<old note>`). If the joined note would pass 10,000 characters, nothing is saved and `#card-msg` says `The two company notes together are too long: at most 10,000 characters.`
- **The company field is now empty:** the first `Save card` saves nothing and `#card-msg` says `This was the last card for <old company>, so its note will be deleted. Press Save card again to save.` A second `Save card` with the same company field saves the card and deletes the note. Changing the company field in between asks again.

No other case changes a company note. In particular, no note is ever left under a company name that no card uses.

After saving, Learn shows the saved card. New ids are `u` plus the time in base 36 plus 4 random characters, and never repeat an existing id.

If storage is full, the existing `#save-error` banner shows. The card stays in this tab, as other progress does.

### Delete

`Delete card` asks in the page:
- the question `#card-delete-ask`: `Delete this card? Its marks and note go too.`;
- when it is the company's last card, the question adds ` It is the last card for <company>, so its company note goes too.`;
- the buttons `#card-delete-yes` (`Yes, delete`) and `#card-delete-no` (`Cancel`).

Yes removes the card, its marks, note, saved code and review date, and the company note when it was the last card. Learn then shows the next card, or home when none is left.

### Cards elsewhere

| Where | Behaviour |
|---|---|
| Quiz and Mock topic chips | A `My cards` chip appears when cards exist. It picks every card. Tier choices never drop a card. |
| Review tab | Cards take part through their marks and review dates, like bank questions. |
| Daily mix | Due and marked cards take part. New, unrated cards do not enter the daily mix. |
| Header counter `n / 1057 known` | Counts bank questions only. |
| Import message | Ids starting with `u` that are in the file's `cards` never count as "not in this version of the bank". |
| Reset | Deletes cards too. The list of what goes names `N cards` when there are any. |
| Second tab | Another tab's new card shows after the `storage` event, as other progress does. |

## 3. Quiz setup: mode and topic source (ideas 59, 60, 61, 62)

### Mode

The setup card starts with three buttons named `Quiz`, `Mock interview` and `Live-coding rehearsal` (ids `#mode-quiz`, `#mode-mock`, `#mode-code`). The chosen one has `aria-pressed="true"`, and `Quiz` is the default.
- **Quiz:** as before.
- **Mock interview:** the same topic, tier, size and option choices as Quiz. The start button is named `Start mock interview (N questions)`.
- **Live-coding rehearsal:** its own setup, in section 5.

### Topic source (Quiz and Mock)

Three buttons pick how topics are chosen:
- `#src-list`, named `Topic list`, the default: the topic chips as before, plus `My cards` when cards exist.
- `#src-role`, named `Role`.
- `#src-ad`, named `Job ad`.

### Role presets (idea 60)

Four buttons with class `role-btn`, named `Manual QA`, `Automation`, `SDET` and `Lead`. A pressed role has `aria-pressed="true"`.

A question is in a role when its file is in the role's files or its topic slug is in the role's slugs. Tier, size and "Skip questions I already know" still apply. The line `#role-count` says `<Role>: N questions`, with N matching the start button's pool before the size cut.

| Role | Files | Slugs |
|---|---|---|
| Manual QA | `05-testing-fundamentals` | agile, stakeholders, release, soft-skills, docs, api-rest, api-tools, sql-core, a11y, cross-compat, mobile-general |
| Automation | `01-playwright`, `06-framework-and-flaky`, `13-live-coding` | ts-core, js-core, js-async, api-rest, api-tools, api-auth, ci-cd, git, sql-core |
| SDET | `01-playwright`, `06-framework-and-flaky`, `13-live-coding` | the Automation slugs, plus oop-patterns, unit-frameworks, api-contract, api-integration, microservices, messaging, docker-k8s, ci-github, ci-gitlab, performance, security, data-testing |
| Lead | `11-agile-leadership` | test-strategy, test-risk, shift-left, test-levels, fw-architecture, fw-flaky, migration-frameworks, ci-cd, ai-testing, ai-tools |

### Job-ad paste (idea 59)

- **Input:** `#ad-text`, a text box named `Paste a job ad`, at most 50,000 characters. Under it: `The ad stays in this browser.`
- **Matching:** the button `#ad-match`, named `Find topics`, matches the ad against `src/topic-keywords.json`. While it matches, the button is disabled (`aria-busy="true"`); it is enabled again once the result shows, so a second ad typed meanwhile is never overwritten by the first result. That file holds, for each of the 85 bank topic slugs, its name and keyword patterns.
- **Pattern rules** are those of the maintainer's scorer:
  - A pattern is a regular expression fragment, matched as a whole word, ignoring case.
  - A leading `cs:` makes it case-sensitive.
  - Whole word means no letter, digit or `_` right before or after the match, counting non-English letters such as `ą` or `ż`.
- **Result** goes in `#ad-result`:
  - One checkbox per matched topic, with class `ad-topic`, ticked, named `<topic name>`. Next to it: the number of matches and up to three matched words, for example `3 matches: playwright, locator, getByRole`.
  - Topics come in descending order of matches, then by name.
  - The line `#ad-count` says `N topics matched, M questions`. N counts every topic the ad matched; M counts the questions of the ticked topics.
  - Unticking a topic removes its questions from the pool.
- **No match** (or an empty ad), `#ad-result` says `No topic matched this ad. Pick topics from the Topic list instead.`, and the start button is disabled.
- **No reach:** matching never sends the ad anywhere. The page makes no network request.
- **Patterns compile:** every pattern in the file compiles in Chromium, Firefox and WebKit.

## 4. Mock interview (idea 61)

Each question shows on one card:
- crumbs and the question;
- a timer `#mock-timer` that counts up from `0:00` (m:ss) and gets class `over` from 1:30 on;
- a text box `#mock-text`, named `Your answer (optional, not saved)`.

Below the card:
- **`#mock-guide-btn`, named `Show structure guide`**, shows `#mock-guide`, an ordered list:
  1. `Direct answer in one sentence.`
  2. `How it works, or the technique.`
  3. `An example from your own work.`
  4. `The trade-off, or when not to use it.`
- **`#mock-show`, named `Show answer`** (or Space while no text box has focus):
  - stops the timer;
  - shows the answer as Quiz does;
  - when the text box is not empty, shows the typed text above the answer in `#mock-mine`, under the label `Your answer`;
  - after it, the three rating buttons (Didn't know, Shaky, Knew it; keys 1, 2, 3) rate and save as Quiz does.

The timer depends on the clock, not on ticks. After the tab has been hidden for 2 minutes, it shows at least `2:00` when the tab is shown again.

The summary is the Quiz summary plus a column of time per question. When anything was typed, it adds a button `#mock-copy`, named `Copy my answers`. That button copies each question and its typed answer as plain text. When the clipboard is refused, it shows the text in a selectable box `#mock-copy-text`.

Typed text is never saved to storage.

## 5. Live-coding rehearsal (idea 62)

### Setup

When the mode is `Live-coding rehearsal`, the setup shows:
- one checkbox per question in `13-live-coding` that has a Starter, with class `rh-task`, named by the question title;
- at most 5 ticked; the others are disabled while 5 are ticked;
- three buttons `.rh-min` named `30 min`, `45 min` and `60 min`; the default is 45, and the pressed one has `aria-pressed="true"`;
- `#rh-start`, named `Start rehearsal`, disabled while no task is ticked.

### During the rehearsal

The view `#rh` shows:
- `#rh-clock`: the time left, m:ss counting down, by the clock as in section 4;
- `#rh-step`: `Task N of M`;
- `#rh-prompt`: the think-aloud prompt. It starts at stage 1 for each task, and `#rh-next-prompt` (`Next prompt`) moves on:
  1. `Restate the task in your own words.`
  2. `Say your plan before you type.`
  3. `Name an edge case.`
  4. `Say how you would test it.`
  5. `Say what you would improve with more time.`
  - After stage 5 the button is disabled.
  - Under 560 px wide, the prompt sits on its own full-width line below its label and the button.
- the task's text and its editor with Run (and Check for SQL tasks), as in Learn;
- `#rh-next`, named `Next task`, or `Finish` on the last task;
- `#rh-end`, named `End rehearsal`.

### When it ends

When the clock reaches 0:
- running code stops;
- the summary shows the line `#rh-timeup`: `Time is up.`

The summary `#rh-summary` has one row per task: the title, the time spent (m:ss), and the result. The result is one of:
- `Not run`;
- `Ran`;
- `Correct`;
- `Not correct yet`.

Check gives the last two, for SQL tasks.

A runaway loop is stopped by the 5 s limit, as in Learn. The clock keeps running, and Next task still works.

Code typed in a rehearsal is saved like code typed in Learn.

## 6. Offline copy on Pages (idea 69)

1. **Build files.** The build writes beside `dist/index.html`:
   - `dist/sw.js`: a service worker with the data version in its cache name;
   - `dist/manifest.webmanifest`: name `QA Interview Bank`, `display: standalone`, start URL `./`;
   - `dist/icon.svg`, and the PNG icons `dist/icon-192.png` (192×192), `dist/icon-512.png` (512×512) and `dist/apple-touch-icon.png` (180×180), all opaque. Safari before version 26 and some Android launchers do not use SVG icons.
   - The manifest lists `icon.svg` (`sizes: "any"`), `icon-192.png` and `icon-512.png`, each with `purpose: "any"` and its real size.
   The Pages workflow publishes all these files. The zip does not need them. The worker caches every icon on install.
2. **Over http(s) only**, the page:
   - adds `<link rel="manifest" href="manifest.webmanifest">` and `<link rel="apple-touch-icon" href="apple-touch-icon.png">`;
   - is installable in Chromium: `Page.getInstallabilityErrors` lists nothing in a normal (not incognito) profile;
   - registers `sw.js`;
   - once the worker is active, shows `#offline-note` in the home footer: `This copy works offline in this browser after this visit.`
3. **By file://**, the page adds no manifest link, registers nothing, shows no `#offline-note`, and logs no console error.
4. **Fetch rule:** network first; when the network fails, the cached copy. After one visit, reloading with the server stopped shows the page with its questions (`html[data-ready="1"]`).
5. **New deploys:** while the server is up, a reload shows the newest page, never an older cached one. When a new data version activates, older caches are deleted.

## 7. Data version, questions.json, release notes (ideas 12, 71)

- **Home footer:** `#data-version` reads `Questions: <data version>, N questions.`
- **`dist/questions.json`:**
  - `dataVersion`, `license` (`CC BY-SA 4.0`), `source` (`https://github.com/bartech-lab/qa-interview-bank`) and `questions`.
  - Each question is `{ id, title, topic, tier, file, section, body }`. `body` is the Markdown from `topics/`, without the build's `run` and `seed=` fence marks.
  - Questions come in id order.
  - The zip holds the file too.
- **`python3 tools/release_notes.py <previous tag> [--repo <path>]`** prints Markdown to stdout. `--repo` is a git work tree laid out like this repository (default: this one):
  - a line with the data version;
  - the lines `Added: N`, `Removed: N` and `Changed: N`, each followed by its ids and titles (at most 50 per list, then `and N more`);
  - when any were removed: `Saved progress for removed questions is kept in your browser and in export files.`
  - Questions are compared by id, before and after: the previous tag's `topics/` against the working tree. A previous tag without `questions.json` works the same way. Exit 1 when the tag does not exist.
- **The Release workflow** checks content, builds, and attaches `qa-interview-bank.zip` and `questions.json`, with these notes as the release text.

## 8. Content checks and CONTRIBUTING (ideas 10, 11)

- **`python3 tools/content_check.py [file.md ...]`** checks the files given, or every `topics/*.md` when none is given. It exits 1 and names file, line and id when:
  - a question has no `Topic:` line or no `**Say:**`;
  - two question titles are equal after lowercasing and removing everything but letters, digits and spaces;
  - a `**Source:**` part holds a link that does not start with `http://` or `https://`.

  It exits 0 otherwise. It prints how many questions lack Trap, Full process, Follow-ups and Source, as information only.
- **Where it runs:** in CI, in `npm test` and in the pre-commit hook.
- **`.github/workflows/links.yml`** runs weekly and on manual start. It checks every unique Source link:
  - it fails on 404, 410 or a name that does not resolve, after one retry;
  - 401, 403, 429 and timeouts are listed as `blocked`, and do not fail.
- **`CONTRIBUTING.md`** holds:
  - the question template;
  - the required and optional parts;
  - the no-personal-history rule;
  - how to run the build, the content check and the tests.
- **`.github/ISSUE_TEMPLATE/`** holds two forms: `Improve a question` (with a question id field) and `New question`.

## Not in this phase

Speech recording (idea 65) and per-question structure guides (new content) are not built.

## Failure modes

Each has at least one test, seen failing on the page before this phase.

| # | Area | Failure mode | Expected |
|---|---|---|---|
| 1 | Drill | Old link `#locators` with no header tab | Drill opens; `#tab-learn` is `on` |
| 2 | Drill | Practice page still carries the casebook menu | No `.sandbox-nav` in the frame; heading in view at 1280×720 and 390×844 |
| 3 | Cards | Card text with `<img src=x onerror=...>` and `[x](javascript:alert(1))` | Shows as text; no element, no link, no dialog, no page error |
| 4 | Cards | Empty or space-only question | `Write the question first.`; nothing saved |
| 5 | Cards | Field over 10,000 characters | Message; nothing saved |
| 6 | Cards | 501st card | Refused with the 500 message |
| 7 | Cards | Storage full while saving a card | `#save-error` shows; card shows in this tab |
| 8 | Cards | Import file with a card id `q9999x` or a card without `q` | Whole file refused as damaged |
| 9 | Cards | Import file with good cards and marks on them | Imported; marks on cards not counted as "not in this version" |
| 10 | Cards | Second tab adds a card | First tab shows it after the storage event, without losing its own |
| 11 | Cards | Delete the last card of a company | Company note goes; home row goes |
| 12 | Cards | A card never shows a Report link | No issue link with card text anywhere |
| 13 | Cards | Header counter with cards marked known | Still counts bank questions only |
| 14 | Job ad | Empty ad | No-match message; Start disabled |
| 15 | Job ad | 60,000 characters pasted | Cut at 50,000; no freeze over 2 s |
| 16 | Job ad | Polish ad with `testów automatycznych` | Whole-word rule holds with Polish letters; no match inside a longer word |
| 17 | Job ad | Case-sensitive pattern | `cs:` pattern does not match a lowercase word |
| 18 | Job ad | Every pattern | Compiles in all three engines |
| 19 | Role | Role plus tier plus Skip known | Count equals the pool the quiz starts with |
| 20 | Mock | Tab hidden 2 minutes (clock moved) | Timer shows at least 2:00 |
| 21 | Mock | Typed answer | Shown beside the answer; not in storage |
| 22 | Mock | Clipboard refused | Text appears in `#mock-copy-text` |
| 23 | Rehearsal | `while (true) {}` in a task | Stopped at 5 s; clock keeps going; Next works |
| 24 | Rehearsal | Clock reaches 0 while code runs | Runs stop; `Time is up.` |
| 25 | Rehearsal | Sixth task ticked | Not possible: others disabled at 5 |
| 26 | Offline | Server stopped after one http visit | Reload shows the page, `data-ready="1"` |
| 27 | Offline | New deploy while online | Reload shows the new page |
| 28 | Offline | file:// | No manifest link, no `#offline-note`, no console error |
| 29 | Release notes | Previous tag without `questions.json` | Notes still list added, removed and changed |
| 30 | Release notes | Unknown tag | Exit 1 |
| 31 | Content check | Planted duplicate title, missing Say, `Source: www.x.com` | Exit 1 naming each |
| 32 | questions.json | Run marks | No `run` or `seed=` in any body fence |
| 33 | Cards | Last card of `Acme` (note `A`) moved to `Globex` (no note) | `store.companies` is `{ Globex: 'A' }`; Globex cards show note `A` |
| 34 | Cards | Last card of `Acme` (note `A`) moved to `Globex` (note `G`) | Globex note is `G\n\nA`; no `Acme` key |
| 35 | Cards | Same, joined notes over 10,000 characters | Joined-notes message; card and both notes unchanged |
| 36 | Cards | Company field emptied on the last card of `Acme` with a note | First save: warning, nothing saved; second save: card saved without company, `Acme` note gone |
| 37 | Cards | A card of `Acme` moved while another `Acme` card remains | `Acme` note unchanged; no note for the new company |
| 38 | Search | `core`, `topic` or `my-cards` typed in Learn search | Only questions whose shown text holds the word; a question's whole id still finds it |
| 39 | Offline | Manifest icons over http | Each listed icon is served, is a PNG or SVG as typed, and a PNG's real size equals its `sizes`; `apple-touch-icon.png` is 180×180 and opaque |
| 40 | Offline | Chromium install check over http | `Page.getInstallabilityErrors` is empty in a persistent profile |
| 41 | Cards | Saved progress with notes `Acme` (an `Acme` card exists) and `Initech` (no card) | After load and a save, `store.companies` is `{ Acme: … }`; Export holds no `Initech` |
| 42 | Cards | Import file with an orphan note and nothing else wrong | Import goes ahead without a bad-part message; the orphan is not in the store |
| 43 | Cards | Import file with 50 notes that have cards plus 1 orphan | Accepted: the orphan does not count toward the 50 limit |
| 44 | Cards | A note `Acme` whose only card has company `  Acme ` (spaces) or `acme` | Spaces: the note stays. Different case: the note is dropped |
| 45 | Rehearsal | 390 px wide, prompt `Say your plan before you type.` | The prompt takes at most two lines |
