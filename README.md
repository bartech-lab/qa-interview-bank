# QA Interview Bank

About 1,000 interview questions for QA and test automation roles. Each one has a short answer to say out loud, the common trap, a full explanation and the likely follow-up questions.

Topics: Playwright, TypeScript and JavaScript, API testing, SQL, testing fundamentals, framework design and flaky tests, CI/CD and Docker, AI in QA, mobile, performance, security and accessibility, agile and leadership, and live-coding tasks.

## Open it

The easiest way: download `qa-interview-bank.zip` from the latest [release](https://github.com/bartech-lab/qa-interview-bank/releases/latest), unzip it and double-click `index.html`.

Or build it yourself. You need Python 3.9 or newer (`python3 --version` shows it). Nothing else.

1. Get the files: on GitHub press **Code → Download ZIP** and unzip it, or run `git clone https://github.com/bartech-lab/qa-interview-bank.git`.
2. In a terminal, inside that folder, run:

   ```sh
   python3 tools/build.py
   ```

   It prints a line starting `OK: 1057 questions -> dist/index.html`. It also writes `dist/qa-interview-bank.zip`, the same page packed with the Markdown, for sharing.
3. Double-click `dist/index.html`. It opens in your browser and works offline.

On Windows, use `py tools/build.py` if `python3` is not found.

## Use it

- **Learn**: pick a topic, then read question by question. The arrow keys move between questions. Press **Mark as known** when you can answer it.
- **Quiz**: pick topics, which tiers and how many questions. Answer out loud, press Space to reveal, then 1 (didn't know) or 2 (knew it). At the end you can repeat the ones you missed.

Your progress stays in this browser only. A copy opened from another folder or another browser starts empty.

The answers are written as a script you can say in first person. Where an answer depends on your own experience, it tells you to say what you really did. Never claim experience you do not have.

## Core, Standard, Niche

- **Core**: the topic appears in 30% or more of 537 QA job ads scanned in November 2026, or it is set to Core by hand. Start here.
- **Standard**: in 10 to 30% of those ads.
- **Niche**: under 10%. Read it when a job ad names the topic.

[docs/tiers.md](docs/tiers.md) lists every topic with its share of ads.

## Found a mistake?

Under every answer there is a **Report a problem with this answer** link. It opens a GitHub issue with the question and its id filled in. Add a link that shows the correct fact.

## Change the questions

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
npm ci                          # once: installs Playwright (needs Node.js 20 or newer)
npx playwright install          # once: downloads Chromium, Firefox and WebKit
npm test                        # builds the page and runs the browser tests
```

`npm test` runs every test in three browsers at desktop and phone width. WebKit needs system libraries that Ubuntu and macOS have; on other Linux systems it may not start. Then run only the others: `npx playwright test --project 'chromium-*' --project 'firefox-*'`.

`leak_check.py` prints each problem line with a label. `[personal]` means the line states one person's career history, such as "I have used X" or "in a previous job". Reword it as advice ("If you have used X, say how"). If the line is fine as it is, read it once more, then run `python3 tools/leak_check.py --accept`. That stores a fingerprint of the line in `tools/reviewed-lines.txt`; commit that file with your change.

## Licence

Code: MIT ([LICENSE](LICENSE)). Questions and answers: CC BY-SA 4.0 ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)). Fonts: SIL Open Font License 1.1, with the text at the end of `index.html` and in [src/fonts/OFL.txt](src/fonts/OFL.txt).
