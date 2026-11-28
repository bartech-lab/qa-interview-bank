# Contributing to QA Interview Bank

Thank you for helping. Most changes are to the questions: plain Markdown files in `topics/`, one per topic.

The quickest help needs no setup. Open an issue with **Improve a question** (a missing trap, a better source, an out-of-date fact) or **New question**. The **Report a problem with this answer** link under every answer opens the first one with the question filled in.

## A question

The questions are plain Markdown in `topics/`, one file per topic. A question looks like this:

```markdown
### What is the difference between PUT and PATCH?

Topic: api-rest | Core | id: q0308

**Say:** The short answer, as you would say it out loud.

**Trap:** The answer that sounds right but loses the point.

**Full process:** The longer explanation, with code.

**Follow-ups:**
- *A likely next question?* Its short answer.

**Source:** https://link-to-the-docs
```

Keep the `id` of an existing question when you edit it; saved progress and issue reports point to it. A new question takes the next free id.

After a change, run the checks:

```sh
python3 tools/build.py          # the page builds
python3 tools/leak_check.py     # no answer states one person's career history
python3 tools/content_check.py  # every question has its Topic line and Say, no title repeats, Source links are http(s)
npm ci                          # once: installs Playwright (needs Node.js 20 or newer)
npx playwright install          # once: downloads Chromium, Firefox and WebKit
npm test                        # builds the page and runs the browser tests
```

`npm test` runs every test in three browsers at desktop and phone width. WebKit needs system libraries that Ubuntu and macOS have; on other Linux systems it may not start. Then run only the others: `npx playwright test --project 'chromium-*' --project 'firefox-*'`.

`leak_check.py` prints each problem line with a label. `[personal]` means the line states one person's career history, such as "I have used X" or "in a previous job". Reword it as advice ("If you have used X, say how"). If the line is fine as it is, read it once more, then run `python3 tools/leak_check.py --accept`. That stores a fingerprint of the line in `tools/reviewed-lines.txt`; commit that file with your change.

### Required and optional parts

- **Required:** the `### ` title, the `Topic: <topic> | <tier> | id: qNNNN` line and **Say:**. `tools/content_check.py` fails without them.
- **Optional:** **Trap:**, **Full process:**, **Follow-ups:** and **Source:**. Add them when they help; the check only counts the questions without them.
- **Titles** must not repeat, ignoring case and punctuation.
- **Source** links start with `https://` (or `http://`). Link the page that shows the fact: the official docs, a changelog, a standard.
- **Topic** is a slug from [docs/tiers.md](docs/tiers.md). A new topic also needs keyword patterns in `src/topic-keywords.json`, so the job-ad paste can find it; the build fails without them.

### Write for anyone

The answers are a script any candidate can read aloud. Never state one person's career ("I used X at my last job"). Write advice instead: "If you have used X, say where and what it caught." `tools/leak_check.py` flags such lines; the pre-commit hook runs it (`ln -s ../../tools/pre-commit .git/hooks/pre-commit`).

## Code changes

The page is one file built from `src/` by `tools/build.py`. Each feature has a spec in `docs/` (`phase2-spec.md` to `phase6-spec.md`); the browser tests are written from it. Change the spec first, then the tests, then the code.

- `python3 -m unittest discover -s tests/tools -t .` tests the tools.
- `npm test` builds the page and runs the browser tests.
- The page must keep working when opened by double-click (file://), with nothing loaded from the network.

## Releases

A maintainer pushes a tag `vX.Y.Z`. The Release workflow builds the page and attaches `qa-interview-bank.zip` and `questions.json`. The release text lists the questions added, removed and changed since the previous tag (`tools/release_notes.py`). Saved progress is keyed by question id, so keep ids stable.

## Licence

By contributing you agree that code is under MIT and questions and answers under CC BY-SA 4.0, as in [LICENSE](LICENSE) and [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
