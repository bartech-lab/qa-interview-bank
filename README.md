# QA Interview Bank

About 1,000 interview questions for QA and test automation roles, each with a short answer to say out loud, the common trap, a full explanation and the likely follow-ups. Topics: Playwright, TypeScript and JavaScript, API testing, SQL, testing fundamentals, framework design and flaky tests, CI/CD and Docker, AI in QA, mobile, performance, security and accessibility, agile and leadership, and live-coding tasks.

## Use it

Build the page (see below), or take `qa-interview-bank.zip` from a release once one is published. Unzip it and double-click `index.html`. It opens in your browser, works offline and needs nothing installed.

- **Learn**: pick a topic and read question by question.
- **Quiz**: pick topics and a size, answer out loud, reveal, then mark whether you knew it. You can repeat the ones you missed.

Your progress is saved in your browser only, separately for each place you open the page from.

## Core, Standard, Niche

Tiers come from how often a topic appears in 537 QA job ads scanned in November 2026: Core in 30% or more (or set by hand), Standard in 10 to 30%, Niche under 10%. [docs/tiers.md](docs/tiers.md) lists every topic with its share.

The answers are written as a script you can say in first person. Where an answer depends on your own experience, it tells you to say what you really did. Never claim experience you do not have.

## Found a mistake?

Every answer has a "Report a problem with this answer" link that opens a prefilled issue with the question id. Include a link that shows the correct fact.

## Build it yourself

```sh
python3 tools/build.py         # writes dist/index.html and dist/qa-interview-bank.zip
npm ci && npx playwright install chromium firefox webkit
npm test                       # browser checks on the built page
python3 tools/leak_check.py    # content checks
```

The questions live in `topics/*.md`. Each question is a `###` heading followed by `Topic: <topic> | <tier> | id: qNNNN` and labelled blocks (`**Say:**`, `**Trap:**`, `**Full process:**`, `**Follow-ups:**`, `**Source:**`).

## Licence

Code: MIT ([LICENSE](LICENSE)). Questions and answers: CC BY-SA 4.0 ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)).
