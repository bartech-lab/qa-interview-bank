**Report: QA Interview Bank feature ideas and evidence**

Only Kalyuga 2003 was opened as a full-text fetch. The Exa fetch returned the first 30,000 characters and cut off partway through the paper. Everything else marked [opened] was read in full on the page or in search excerpts of the page. Everything marked [snippet only] is search-excerpt only.

## A. Coverage table

| # | Place | Queries | Result |
|---|---|---|---|
| 1 | LinkedIn | 3 `site:linkedin.com` queries: Playwright/SDET questions, live-coding tips, flaky-test interview | Dozens of posts and comments came back, so it is well indexed. Comments are visible in many of them. |
| 2 | X / Twitter | `site:x.com` and `site:twitter.com` (2 wordings), a Playwright-team query, and a QA-voices query | The search tool reported no results for the site restriction. I found no indexed x.com post text. The only X evidence is secondhand. Angie Jones turned up only as 2017 to 2018 interviews and a webinar. |
| 3 | YouTube | 3 queries: English mock interviews, Polish interview videos, live-coding videos | English is well covered, with transcripts and one visible comment ask. Polish YouTube is thin: only Polish-language course pages and one DOU page about a video. |
| 4 | Polish communities | 5 queries: Wykop, testerzy.pl, Reddit, Facebook/Discord/Slack, Polish interview lists | Wykop threads and testerzy.pl articles are indexed. forum.testerzy.pl itself did not surface; only testerzy.pl articles did. Facebook groups appear only as link lists on other sites, with no post text. Discord and Slack are mentioned but their content is not indexed. Polish Reddit returned only r/praca titles and snippets. |
| 5 | Trade press | 5 queries covering Google Testing Blog, Fowler, The New Stack, Smashing and CSS-Tricks, Thoughtworks and InfoQ | Google Testing Blog, Fowler, New Stack, Smashing, CSS-Tricks and InfoQ gave usable content. Thoughtworks Radar returned nothing relevant. |
| 6 | Learning science | 5 queries, one per paper type | Kalyuga 2003 was fetched. The other papers were read through search excerpts of the actual PDFs and pages. |
| 7 | Licences | 6 queries plus fetches | The Scrum Guide and Kanban Guide primary pages were fetched. glossary.istqb.org is a JavaScript app and returned CRAWL_EMPTY_CONTENT. istqb.org/terms-and-conditions returned HTTP 500. |

## B. Ideas and demand signals

**Question formats and content**
- Scenario questions with a fixed answer shape of root cause, fix, then prevention across the framework, plus a "what the interviewer wants to hear" tip. [opened] https://www.linkedin.com/posts/zeeshanasgharr_playwright-typescript-sdet-interview-preparation-activity-7526047837969666049-4OtD
- A "test passes locally, fails about 30% in CI" scenario drill with trace-first reasoning. The commenter answer is "pull the trace first". [opened] same URL.
- Strict-mode violation and parallel-only failure questions. A commenter says the basic list is "useless" and wants real-time questions: iframe iteration, running 1000+ tests, scheduled smoke suites, and AI-in-automation. [opened] https://www.linkedin.com/posts/sujish-l_playwright-testautomation-sdet-activity-7495024209245405184-1MHz
- API and UI hybrid exercise: assert a Dashboard API field against the UI element, using the network logger. [opened] https://www.linkedin.com/posts/yugandhar-royal_qasdet-automation-interview-kit-2026-edition-activity-7517178616032481280-Ynia
- TypeScript questions for a Playwright audience: `any`, `type` vs `interface`, `Promise.all`, async/await pitfalls. [opened] https://www.linkedin.com/posts/raju5632_playwright-automationtesting-qa-activity-7411384516990173184-_gYq and the Barclays post above.
- Live-coding set: first non-repeating character, balanced brackets, compare two JSON responses ignoring dynamic fields, retry with backoff, log parsing for failing tests, flake-rate calculation. [opened] https://www.linkedin.com/posts/kushalparikh11_test-automation-framework-questions-activity-7415258657828839424-UAAI and https://qa.codes/blog/the-sdet-interview-loop-decoded
- Broken-links check, sorted-table check, new-tab handling, infinite scroll, and "log in via API once, reuse the token" as Playwright live tasks. [opened] https://techwithjatin.com/shop/playwright-typescript-coding-round
- Round simulation: a 45-minute live app with UI and API combined, AI tools allowed in the round, a K6 task, a Selenium Grid architecture question, and contract tests. [snippet only] https://www.linkedin.com/posts/japneet-sachdeva_japneetsachdeva-sdet-interview-activity-7453276561488879617-h7xV
- "How would you test X" scored on structure, with a risk-matrix helper. [opened] https://techscreen.app/articles/sdet-qa-automation-interview-guide-2026
- Polish-language bank: severity vs priority, "test the login form", SQL, and a bug-report template. [opened] https://intervue.pl/pytania-rekrutacyjne/tester-oprogramowania/ and https://qalabs.pl/rozmowa-rekrutacyjna-qa-jak-odpowiadac-na-pytania
- Polish Playwright question outline with a bilingual angle: hooks vs fixtures, ADRs, Promise.all, CDP, boundingBox. [opened] https://playwright-info.vercel.app/pytania-rekrutacyjne-playwright

**Product and feature signals**
- A competitor, Playwright Pad, already combines an in-browser IDE, live sandboxes and 300+ questions. [snippet only] https://playwrightpad.com/
- A competing simulator reveals the answer, then shows the interviewer's follow-up. It also shows an "asked %" per question, a high-frequency-only filter, and one-by-one practice mode. [snippet only] https://www.navtutorial.com/playwright-interview-simulator
- A "Try to answer in 60 to 90 seconds" timer, with a four-part structure of direct answer, technique, project example, trade-off. [snippet only] https://sdet-interview-trainer.vercel.app/mock-interview/playwright-typescript
- A practice mode that hides output until the learner predicts it. [opened] https://app.thetestingacademy.com/class/playwright-keyboard-hover-drag-drop-js-alerts
- Same page: `dragTo()` silently fails on a Kanban board and the working answer uses `boundingBox()` with mouse steps. This is a good locator-trainer trap exercise.
- Seeded flaky-test trace exercises: "find the race, fix it with `waitForResponse`". [opened] https://scrolltest.com/live-coding-sdet-interviews-10-exercises-walkthrough/
- A viewer comment on a YouTube channel offers to record a coding-challenge walkthrough if 20 people ask. That signals unmet demand for worked coding solutions. [snippet only] https://www.youtube.com/watch?v=N8Iqi3Gm74U
- A hiring manager runs db-fiddle SQL tasks (a join over 3 tables). They score the candidate talking through the schema and asking about relations. [opened] https://club.ministryoftesting.com/t/what-kind-of-test-can-you-give-the-candidates-as-part-of-the-interview/54861
- A hiring manager asks for a candidate to share a screen and find an XPath. [snippet only] https://www.reddit.com/r/QualityAssurance/comments/1of8v27/what_do_interviewers_usually_ask_in_qa_engineer/
- Hiring managers want a README that runs, assertions that answer the right question, and a real negative scenario. [opened] https://applitools.com/blog/preparing-for-a-technical-qa-engineer-job-interview/
- Google lists work-sample tests and structured interviews as the best predictors. [opened] https://students.googleblog.com/2015/06/how-are-interviews-at-google-different.html
- Google testing-hiring blog: "how would you test X" answers cluster into frameworks (input domain, divide and conquer, and others). [opened] https://testing.googleblog.com/2010/01/interviewing-insights-and-test.html
- A New Stack playground review lists design hints: show the library version, shareable URL per example, readable error output, and a stated retention policy. [opened] https://thenewstack.io/playgrounds-for-developers-uses-and-design-patterns/
- The same outlet shows Pyodide running client-side with no server, which is relevant to an offline single file. [snippet only] https://thenewstack.io/run-real-python-in-browsers-with-pyodide-and-webassembly/
- Smashing's catalogue of interactive learning tools names SQLBolt, TypeScript and regex games as the format to match. [snippet only] https://www.smashingmagazine.com/2021/09/interactive-learning-tools-front-end-developers/
- PlayCSS keeps state in the URL, and a CSS playground saves progress to localStorage with no account. Both support an offline, no-login design. [snippet only] https://playcss.dev/en and https://webdevpuneet.com/css-playground/
- Fowler's guide: push tests down the pyramid and treat duplicate tests as waste. This supports questions on layer choice. [snippet only] https://www.martinfowler.com/articles/practical-test-pyramid.html
- Playwright's official X post: MCP or CLI for agents (19 September 2026). [snippet only] https://subagentic.ai/posts/playwright-mcp-or-cli-agents/ (secondary source for an X post)

**Polish demand signals**
- testerzy.pl publishes questions without answers and says to answer in the comments. This points to demand for answers. [snippet only] https://testerzy.pl/baza-wiedzy/artykuly/pytania-rekrutacyjne-dla-testera
- Udemy: 80 questions in 8 sections, three SQL tasks, and a "test GitHub signup" task. [snippet only] https://www.udemy.com/course/pytania-i-odpowiedzi-rekrutacyjne-dla-testera/
- Wykop thread: interviewers ask for pseudo-code, logic puzzles, a Selenium form script, and part of the interview in English. [snippet only] https://wykop.pl/wpis/16632139/bede-mial-niedlugo-rozmowe-o-prace-jako-tester-apl
- The same author asks for English interview questions. [snippet only] https://wykop.pl/wpis/33402163/jutro-czeka-mnie-rozmowa-techniczna-na-stanowisko-
- A recruiter's mock interview (DOU, Mate academy) includes TCP/IP, "what happens when you open a URL", mobile device connections and ADB. [snippet only] https://dou.eu/community/posts/czy-mozna-sie-przygotowac-do-rozmowy-na-stanowisko-qa-testera-czesto-spotykane-pytania173755-734
- Facebook group "Testowanie oprogramowania" has 55,000+ members, and jaktestowac.pl runs a Discord. [snippet only] https://jaktestowac.pl/rekrutacja/

## C. Licence answers

**Scrum Guide: CC BY-SA 4.0, and it is share-alike.** The PDF says: "This publication is offered for license under the Attribution Share-Alike license of Creative Commons, accessible at https://creativecommons.org/licenses/by-sa/4.0/legalcode". Source: https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf [opened]. The HTML guide calls itself "The 2020 Scrum Guide TM" (https://scrumguides.org/scrum-guide.html). I did not check what the TM implies.

**Kanban Guide (May 2025): the primary PDF contradicts itself.** Source: https://kanbanguides.org/the-kanban-guide/2025.5/pdf/kanban-guide.v2025.5.en.pdf [snippet only].
- The preface says: "offered for license under the Attribution ShareAlike license of Creative Commons".
- The closing "License" section says: "licensed ... under a Creative Commons Attribution 4.0 International License".
- The Open Guide to Kanban says the May 2025 guide "is licensed under the Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)" (https://kanbanguides.org/open-guide-to-kanban/, snippet only).
- Treat it as CC BY-SA 4.0 unless the authors clarify. The conservative choice is to apply share-alike.
- The kanbanguides.org HTML fetch was truncated before any licence text appeared.

**ISTQB glossary and name: not confirmed from the primary page.**
- glossary.istqb.org could not be fetched (CRAWL_EMPTY_CONTENT). istqb.org/terms-and-conditions returned HTTP 500.
- Third-party hosted PDF exports of the glossary app carry this line: "Except where otherwise noted, content on this site is licensed under a Creative Commons Attribution 4.0 International license." Example: https://nstqb.org/istqbGlossary.pdf (v4.8.1), also https://digimetics.com/assets/images/ISTQB-testing.pdf (v4.6.2). This is attribution only, with no share-alike. It is a mirror, not the primary page.
- The CC BY 4.0 legal text says "Patent and trademark rights are not licensed" (§2(b)(2)) and forbids implying endorsement (§2(a)(6)). [opened] https://spdx.org/licenses/preview/CC-BY-4.0.html
- ISTQB syllabi carry a stricter notice: "Extracts for non-commercial use from this document may be copied if the source is acknowledged ... Any other use of this syllabus is prohibited without first obtaining the approval in writing of the ISTQB". [opened] https://istqb.org/wp-content/uploads/sdm-uploads/ISTQB-CTAL-TA-Syllabus-v4.0-EN-4.pdf
- Use of the ISTQB trademarks and logos is a benefit reserved for accredited training providers. I found no primary-page policy for using the name descriptively. [snippet only] https://istqb.org/become-a-training-provider/

## D. Design rules from the papers

**Kalyuga, Ayres, Chandler & Sweller 2003, Educational Psychologist 38(1), 23–31** [opened, first 30,000 characters of the PDF]
1. Section "Interactions between levels of expertise and the worked example effect": worked examples help novices, but the advantage disappears and then reverses with experience. Rule: offer a "show worked answer" mode for novices and default to attempt-first for experienced learners.
2. Same section, citing Renkl and colleagues: fade worked examples gradually; fading beat an abrupt switch to problems. Rule: step the learner from full solution, to a solution with one step blanked, to a bare prompt.
3. Section "Split-attention and redundancy": explanations that are essential for a novice become redundant for an expert. Rule: let learners hide explanations once they are proficient.
4. Section "Isolated or interacting elements": the effect depends on the learner's expertise, so it needs a learner-level setting.

**Dunlosky et al. 2013, Psychological Science in the Public Interest 14(1), 4–58** [opened as excerpts: abstract, summary, Table 1]
5. Practice testing and distributed practice rated high utility, interleaving moderate (Summary and Table 1). Rule: make Quiz mode the default over rereading, and space repeats.
6. Practice testing section (pp. 29–35, from a secondary summary at https://www.unb.ca/fredericton/cetl/_assets/documents/teaching-tips/instructional-methods/effectivelearningtechniquescogedpsychology.pdf): generative formats such as recall or short answer beat recognition formats, and correct-answer feedback helps. Rule: ask the learner to type or pick the answer before it is shown, and always show the correct answer.
7. Interleaving: helps when problem types look alike, and blocking may be better when they are dissimilar (from the Scientific American digest of the paper, https://www.scientificamerican.com/article/what-works-what-doesn-t/). Rule: mix similar question types, such as locator strategies or API status codes, within one session.

**Ericson et al. 2022 (ITiCSE-WGR), "Parsons Problems and Beyond"** [read as search excerpts of the PDF]
8. Section 2.3, defining characteristics: a limited set of fragments, optional distractors, and immediate execution-based or line-based feedback. Rule: for code ordering, give 6 to 10 lines and offer a "run it" check.
9. Follow-up studies: distractors raised post-test scores by 11 percentage points in a randomised trial, but can exceed what some learners can handle (https://dl.acm.org/doi/fullHtml/10.1145/3632620.3671114). Rule: make distractors optional and tied to difficulty.
10. Adaptive Parsons problems (https://dl.acm.org/doi/10.1145/3230977.3231000): make a problem easier when the learner is struggling. Rule: remove a distractor after a failed attempt.

**Hypercorrection**
11. Butterfield & Metcalfe 2006 (https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Butterfield_Metcalfe_2006.pdf): errors made with high confidence are the most likely to be corrected when the right answer is shown. Rule: collect a confidence rating before revealing the answer, and flag high-confidence misses for immediate review.
12. Butler, Fazio & Marsh 2011 (https://doi.org/10.3758/s13423-011-0173-y): after one week the corrections faded and high-confidence errors tended to come back. Rule: re-ask high-confidence misses after a delay.
13. Metcalfe & Eich 2019 (open access, https://link.springer.com/article/10.1186/s41235-019-0153-8): people who err with confidence are vulnerable to false feedback. Rule: keep answer keys correct and sourced.

**Interleaving, meta-analysis**
14. Ruitenburg et al. 2026 (https://link.springer.com/article/10.1007/s10648-026-10225-5): interleaving helped with delayed or no feedback but not with immediate feedback, and the evidence base is small. Treat that as a hypothesis to test, not a rule.