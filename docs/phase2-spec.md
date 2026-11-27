# Phase 2 spec: learning features (ideas 14 to 20)

The contract for the phase 2 tests and code. Tests are written from this file, not from the code. Ideas: 14 shaky state and notes, 15 review queue, 16 spaced review, 17 export and import with a backup hint (also idea 70), 18 interview-date mode, 19 daily mix, 20 light/dark switch.

Dates below are local calendar days written `YYYY-MM-DD`. "Today" is the local date of the browser clock when the page renders.

## Failure modes

Each line is covered by at least one test.

### Old saved progress (`localStorage['qa-bank']` written before this version)

1. Pre-id shape: `{ known: { "<file>|<question text>": 1 }, code: { "<file>|<question text>": "..." } }`. Moves to the question id (already covered by `page.spec.ts`; stays green).
2. Current shape `{ known, code }` with no `v`: loads unchanged; the first change writes the phase 2 shape and keeps `known` and `code` as they were.
3. Corrupt JSON (for example `{"known":`): the page loads with empty progress, no page error, no console error. The broken text is copied once to `localStorage['qa-bank-broken']` before anything overwrites `qa-bank`.
4. Wrong types: `known` is an array or a string, `code` holds a number, `srs` entries miss fields or carry a bad date, `exam` is `"tomorrow"`. Each bad part is dropped; the good parts load. No page error.
5. Written by a newer version (`v: 99` and a key this version does not know, for example `future: { a: 1 }`): loads the parts it knows. A later change keeps `future` unchanged and keeps `v: 99`.

### Bad import file

For every case: an error message in `#import-msg` (`data-kind="error"`), no confirm prompt, and `localStorage['qa-bank']` byte-identical before and after.

6. Not JSON. 7. Empty file. 8. JSON but not an object (`[]`, `"x"`, `null`). 9. `app` missing or not `"qa-interview-bank"`. 10. `format` higher than 1 (message names a newer version: `/newer version/i`). 11. `progress` missing. 12. Wrong value types inside `progress` (same rules as failure mode 4, but an import is all or nothing: any bad part rejects the whole file). 13. Larger than 5,000,000 bytes (message: `/too large/i`), rejected before reading.
14. A file chosen and then Cancel in the confirm: nothing changes.

### Storage full or blocked

15. `localStorage.setItem` throws (`QuotaExceededError`): `#save-error` with `role="alert"` becomes visible. The change still shows in the page (counter, buttons). No page error, no console error, no dialog.
16. When saving works again, the next change saves every change made while it failed, and `#save-error` hides.
17. `localStorage.getItem` throws on load (storage blocked): the page works with empty progress and shows `#save-error`.

### Clock change

18. Clock moved back after a rating (for example 10 days): nothing crashes, the rated question is not due, `#backup-line` never shows a negative number of days.
19. Clock moved forward past a due date: the question shows as due (count in `#due-count`, row under the Due filter).
20. Midnight passes with the page open: the next render (any navigation) uses the new day. The daily mix is rebuilt for the new day.

### Two tabs (the same file open twice)

Correctness must not depend on the `storage` event. Every change re-reads `localStorage`, applies itself, and writes back.

21. Tabs A and B are open. A marks q0001 known; then B, without reloading, marks q0002 known. Storage holds both.
22. A resets; then stale B marks q0003. Storage holds only q0003 (nothing deleted by A comes back).
23. A imports a file; then stale B marks q0004. Storage holds the imported progress plus q0004.
24. A writes a note on q0001; stale B marks q0002 known. The note survives.

### Narrow screen and dates

25. Home, Review, Learn and the quiz rating row fit a 390 px wide screen (no sideways scroll).
26. Interview date in the past, today, tomorrow, in 10 days; and cleared.

## Saved progress

`localStorage['qa-bank']`, JSON:

```
{
  v: 2,
  known:  { qNNNN: 1 },
  shaky:  { qNNNN: 1 },
  missed: { qNNNN: 1 },
  notes:  { qNNNN: "text" },          // an empty note removes the key
  code:   { qNNNN: "text" },
  srs:    { qNNNN: { box: 0..4, last: "YYYY-MM-DD", due: "YYYY-MM-DD" } },
  exam:   "YYYY-MM-DD" | null,
  backup: "YYYY-MM-DD" | null,
  mix:    { day: "YYYY-MM-DD", ids: [qNNNN, ...] },
  mixSize: 5 | 10 | 20                // default 10
}
```

- An id is in at most one of `known`, `shaky`, `missed`.
- Keys this version does not know are kept on every save; `v` is never lowered.
- Reset ("Reset my progress", then "Yes, reset") clears everything in `qa-bank`. It does not touch the theme.
- `localStorage['qa-bank-theme']`: `"light"` or `"dark"`; absent means follow the system. A device setting: not exported, not imported, not reset.

## Spaced review

Boxes 0 to 4 wait 1, 3, 7, 14 and 30 days.

| Rating | New box | Mark |
|---|---|---|
| Knew it | no entry: box 1 (3 days); else one up, at most 4 | `known` |
| Shaky | no entry: box 0; else one down, at least 0 | `shaky` |
| Didn't know | box 0 (1 day) | `missed` |

- `last` = today, `due` = today + the box's days.
- With an interview date E after tomorrow, `due` is at most E minus 1 day, and at least tomorrow. With E today, tomorrow or past, the date does not change `due`.
- Learn view: "Mark as known" applies Knew it; "Shaky" applies Shaky. Pressing a pressed button again removes the mark and the `srs` entry (the question is new again). Quiz ratings apply the table.
- A question is due when `srs.due` is today or earlier. A `due` in the future is not due, even if `last` is after today (clock moved back).

## Review queue

The Review view lists every question that is due, shaky, missed, or has a note.

- Filters (buttons, one active at a time, `aria-pressed="true"` on the active one): "All", "Due", "Shaky", "Missed", "With note". Default "All".
- Topic filter: `select#rq-topic`, first option "All topics" (value `""`), then one option per topic, value = topic file name (for example `01-playwright`).
- Rows: `.rq-row` with `data-id="qNNNN"`. Due questions first (oldest due date first), then the rest in bank order. Clicking a row opens that question in the Learn view.
- Button "Quiz these N" (N = rows shown) starts a quiz with exactly those questions. Hidden or disabled when N is 0.
- Empty queue: `#review` says so and points to the quiz (`/nothing to review/i`).

## Daily mix

- Built once per day and stored in `mix`, so both tabs and every reload see the same set that day.
- Size: `mixSize` (5, 10 or 20, default 10), chosen with `select#mix-size`. Changing it rebuilds today's mix.
- Order of picking: due questions (oldest due first), then shaky, then missed, then unseen Core questions, then unseen Standard questions. Unseen questions are taken one topic at a time in turn, with a shuffle seeded by today's date: the same day gives the same mix for the same progress.
- No question appears twice. Fewer questions than the size when the pool is smaller.
- Done = rated today (`srs[id].last` is today). `#mix-progress` text: `D / N done today`.
- `#mix-start` starts a quiz with the mix questions not done yet. When all are done it is disabled and reads "Daily mix done".

## Interview date

- `input[type=date]#exam-date` on the Today card sets `exam`; `#exam-clear` sets it back to null.
- `#exam-line` text: no date: `No interview date set`; E in 2 or more days: `Interview in N days`; tomorrow: `Interview tomorrow`; today: `Interview today`; past: `The interview date has passed`.
- `#exam-pace`, only when E is in the future: `To see every unseen Core question: N a day`, N = unseen Core count divided by days left, rounded up. Hidden when no Core question is unseen.

## Export and import

Export (`#export-btn`) downloads `qa-interview-bank-progress-YYYY-MM-DD.json` (today's date):

```
{ app: "qa-interview-bank", format: 1, exported: "<ISO 8601 time>", progress: { ...qa-bank, backup: today } }
```

- It sets `backup` to today in storage. It works from memory when storage is blocked.

Import (`input[type=file]#import-input`, accepts `.json`):

- Validate the whole file first (failure modes 6 to 13).
- A valid file shows an in-page confirm in `#import-ask`, naming the known marks on both sides, for example `Replace 12 known marks here with 40 from the file?`, with buttons `#import-yes` and `#import-no`. Never a browser dialog.
- Yes: progress becomes the file's `progress`, except the theme. `backup` becomes the date part of `exported`. `#import-msg` gets `data-kind="ok"`.
- Ids not in this bank are kept. When there are any, the ok message says how many: `/(\d+) questions? in the file (is|are) not in this version/`.

Backup hint, `#backup-line` on home beside the reset button:

- `Progress is saved in this browser only, for this file location.` and then `Last backup: never`, `Last backup: today`, `Last backup: 1 day ago` or `Last backup: N days ago`. A backup date after today (clock moved back) reads `today`.
- `#backup-line` gets class `warn` when there is any progress and the last backup is never or 7 or more days ago.

## Light and dark

- `#theme-btn` in the header cycles Auto, Light, Dark, Auto. Its accessible name contains the current choice: `/Theme: Auto/`, `/Theme: Light/`, `/Theme: Dark/`.
- Light and Dark set `data-theme="light"` / `"dark"` on `<html>`; Auto removes the attribute. Set before first paint, so a reload never flashes the other theme.
- Body background: light `rgb(246, 247, 249)`, dark `rgb(14, 16, 21)`. Auto follows the system (`prefers-color-scheme`).

## Page parts the tests use

| Part | Selector or name |
|---|---|
| Review tab | `#tab-review`; due count in `#tab-review .badge` when above 0 |
| Theme button | `#theme-btn` |
| Learn: known / shaky | `.known-btn`, `.shaky-btn`, both with `aria-pressed` |
| Learn: note | `textarea.note`, accessible name "My note"; saved on input |
| Quiz rating | buttons named `/Didn't know/` (key 1), `/Shaky/` (key 2), `/Knew it/` (key 3) |
| Review view | `#review`; filters by button name; `select#rq-topic`; `.rq-row[data-id]`; button `/Quiz these \d+/` |
| Today card (home) | `#today`, `#mix-start`, `#mix-progress`, `select#mix-size`, `#due-count` (number only), `#exam-date`, `#exam-clear`, `#exam-line`, `#exam-pace` |
| Backup row (home) | `#export-btn`, `#import-input`, `#import-ask`, `#import-yes`, `#import-no`, `#import-msg[data-kind]`, `#backup-line` |
| Save notice | `#save-error`, `role="alert"` |

Navigation: `go('review')` opens the Review view, like `go('home')`, `go('learn', file)` and `go('setup')` today.

Keys: today key `2` means Knew it; from this version `2` is Shaky and `3` is Knew it.
