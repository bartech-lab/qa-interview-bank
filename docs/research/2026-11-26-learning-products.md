**Research report: feature ideas for an offline QA/SDET interview bank, drawn from comparable products and their users**

Tags used throughout:
- **[F]** = I fetched and read the page (some fetches were truncated).
- **[S]** = I saw only the search-result extract, not the full page.
- **[own]** = my idea, no source.
- **file://** tags mark whether an idea works from a double-clicked HTML file ("file ok"), only when hosted ("hosted only"), or is unconfirmed ("unverified", see D).

Pages I fetched in full or in part: Tech Interview Handbook issues #275, #682, #683 and #722; the NeetCode, r/leetcode, r/college, r/CollegeRant, r/Anki and r/QualityAssurance (SDET interview) threads; the LeetCode study-plan post; the lydiahallie issues list; the sdet-interview-trainer repo; the Codility Reddit analysis; the GreatFrontEnd review by Marius Espejo; the ABC-of-FSRS wiki page; Execute Program's spaced-repetition page; and the AnkiDroid suggestions board. Everything else is [S].

---

## A. Coverage table

| # | Place | Searched / result |
|---|---|---|
| 1 | SRS and flashcard tools | Searched Anki (reviews, G2, Capterra, forums, releases, AnkiWeb decks), Mochi (docs, forum, changelog), RemNote (Product Hunt, stores, feedback board), Orbit (docs, author's notes), Quizlet (Reddit, Trustpilot, G2) and FSRS/ts-fsrs. Rich. AnkiWeb QA decks exist but are mostly ISTQB, with one quality complaint. |
| 2 | Interview platforms | GreatFrontEnd, BFE.dev, LeetCode, NeetCode, Exercism, Tech Interview Handbook, roadmap.sh, TestDome, Codility, HackerRank, interviewing.io, Pramp/Aced, Frontend Mentor, Execute Program, Boot.dev, Scrimba, Codecademy and Brilliant are covered. Brilliant is covered only through one thesis summary. CoderPad has only a Quora snippet. javascript.info appeared only in third-party lists, so it is effectively not covered. |
| 3 | QA-specific learning | TAU, Ministry of Testing, Playwright docs, community and GitHub issues, learn.cypress.io, Checkly, BrowserStack and TestMu/LambdaTest, and practice-site roundups. ultimateqa appeared only in one list. expandtesting never surfaced. ISTQB mock-exam apps were covered via Play Store and AnkiWeb. |
| 4 | Repos | sudheerj, lydiahallie, h5bp, Tech Interview Handbook (TIH), awesome-testing, awesome-playwright, plus 5 QA/SDET question-bank repos. Issues were read for the first four. |
| 5 | Registries | ts-fsrs, srs-everything, supermemo, spaced-repetition-lite, genanki, genanki-js, anki-apkg-export, mdbook-quiz, Quarto Quizkit and quizdown. H5P appeared only in one Quarto guide. |
| 6 | Stores | VS Code Marketplace and Obsidian pages were read directly. Chrome and Firefox data came via mirror sites (chrome-stats, extops), not the stores. Play Store data came partly via androidblip, whose review rows look templated, so treat them as low trust. The Apple App Store was reached directly. JetBrains Marketplace returned only the Academy and KotlinFlashKards pages, with no review text. |
| 7 | Forums and social | Reddit was rich. Hacker News Show HN threads returned little for single-file apps. The SQA Stack Exchange, Ministry of Testing club and dev.to threads were found. A retargeted Stack Overflow query returned nothing. YouTube channels yielded nothing usable. I ran no LinkedIn or X-targeted query. Medium gave one piece. Hashnode gave nothing. Discord and Slack content is not indexed. |
| 8 | Polish sources | jaktestowac (a gated checklist), playwright-info, testerzy, testuj, 4programmers (old threads), bulldogjob, justjoin, qalabs, testline and Udemy courses. Nothing from Wykop or Facebook groups, and no Polish YouTube pages were reachable. |
| 9 | Review sites and trade press | G2, Capterra, Product Hunt and AlternativeTo were productive. Trade press returned nothing on target after two differently worded queries (InfoQ nothing; The New Stack off-topic; Smashing and CSS-Tricks only tangential). |
| 10 | Learning science | Dunlosky 2013, the Butler, Foster and Carpenter confidence papers, the Parsons and worked-example reviews, Bjork, the Learning Design Wiki and mastery-threshold sources. All [S]. |
| 11 | Changelogs and request boards | Anki releases and forum, RemNote feedback board, Mochi forum and changelog, TIH issues (including the pinned master issue), Playwright issues, the Exercism blog, and the roadmap.sh changelog via a third-party description. No GreatFrontEnd public board was found. |
| 12 | Single-file and local-first | TiddlyWiki, Feather Wiki, TSOFA, SRS Anywhere, Learning Dojo, TermDecks, QuizCraft, kazepoy flashcard, Syncthing, web.dev and MDN storage pages. |

---

## B. Idea catalogue (115 ideas)

### Learning modes
1. Add a third state "review/shaky" (yellow) alongside done and not done. TIH #722 [F] https://github.com/yangshun/tech-interview-handbook/issues/722
2. Add a flag plus a personal note per question; the requester used a spreadsheet for this. TIH #682 [F] https://github.com/yangshun/tech-interview-handbook/issues/682
3. Add a global "Review queue" listing all weak and review-later items with status, type and topic filters. sdet-interview-trainer [F] https://github.com/TesterBaku/sdet-interview-trainer
4. Add a date-seeded daily mix interleaving topics. The same repo has one (10 items, rotates daily) [F]; iTer has five questions a day [S] https://apps.apple.com/us/app/iter-it-learning/id1224934068
5. Offer 1-week, 1-month and 3-month plans with progress tracking. GreatFrontEnd [S] https://www.greatfrontend.com/interviews/study-plans. A reviewer found the plans' composition confusing, so publish the rationale. Marius Espejo [F] https://mariusespejo.com/blog/greatfrontend-review
6. Add an "interview on date X" mode that compresses review intervals before the date. spaced-repetition-lite fitToExam [S] https://github.com/jackships/spaced-repetition-lite; RemNote exam date [S] https://androidwidgetcenter.com/remnote-notes-flashcards-review/
7. Add a cram mode that ignores the schedule. Obsidian Spaced Repetition [S] https://community.obsidian.md/plugins/obsidian-spaced-repetition
8. Gate Standard and Niche behind a Core mastery threshold (80-90% in one source, P≥0.85 plus 2 consecutive correct in another). Learning Design Wiki [S] https://wiki.learningdesignalliance.org/elements/mastery-progression/; Graspful [S] https://graspful.ai/docs/concepts/mastery-learning. Make it optional, because gamified apps were criticised for not letting people skip known material. UX thesis [S] https://felpscreative.com/projects/gamified-learning-ux/
9. Use "depends on" links between questions to unlock and order. Execute Program [F] https://www.executeprogram.com/spaced-repetition
10. Add company, role and seniority filters. GreatFrontEnd company tags [S] https://www.greatfrontend.com/interviews/pricing; TIH question-bank RFC [S] https://github.com/yangshun/tech-interview-handbook/issues/304
11. Add pattern and template cheatsheets per topic. An r/leetcode commenter asked for pattern templates [F] https://www.reddit.com/r/leetcode/comments/116l8oy/what_features_do_you_wish_leetcode_had_or_things/; sdet-interview-trainer has cheatsheets [F]
12. Add a short fundamentals primer before drills; GreatFrontEnd was criticised for lacking one. Marius Espejo [F]
13. Add a "reading mode" that interleaves a retrieval prompt every few hundred words. Orbit [S] https://notes.andymatuschak.org/zMRiwR4HFJHfFpyzLySREB9
14. Add an audio or commute mode (browser speech synthesis). sdet-interview-trainer Commute Mode [F]; AnkiDroid user wants keyboard control with the screen off [F] https://forums.ankiweb.net/c/ankidroid/suggestions/23.md?page=1 (file ok)

### Spaced repetition and scheduling
15. Make grading configurable, two-button by default (knew / didn't) with an optional four-button mode. Mochi forum asks for four-button FSRS [S] https://forum.mochi.cards/?page=1; an Anki forum thread (23 replies) wants Easy and Hard removed under FSRS [F] https://forums.ankiweb.net/c/ankidroid/suggestions/23.md?page=1; Mochi's own FSRS page defends binary grading [S] https://mochi.cards/docs/reviewing/fsrs
16. Use FSRS through ts-fsrs, with a desired-retention setting and a preview of the next interval for each answer. ts-fsrs README [S] https://github.com/open-spaced-repetition/ts-fsrs?tab=readme-ov-file; the Mochi, Flashcard Studio and VS Code plugin pages show the same pattern. Bundle size and the UMD build are unverified (D).
17. Use a tiny dependency-free scheduler as a lighter option, such as Leitner boxes at 1/3/7/14/30 days or fixed levels. Spaced Complexity [S] https://github.com/fokude/leetdaily; Execute Program uses 2d/1w/3w/2mo [F]; spaced-repetition-lite [S]
18. Store an append-only review log (card id, time, rating, state, duration) so a later optimizer or export is possible. fsrs-optimizer schema [S] https://github.com/open-spaced-repetition/fsrs-optimizer/
19. Add a client-side parameter optimizer once enough reviews exist (about 100). Decks plugin [S] https://community.obsidian.md/plugins/decks. Mochi has none [S].
20. Add a daily new-card cap, since Mochi recommends about 10 a day. Mochi docs [S] https://www.mochi.cards/docs/reviewing/
21. Add a suspend deck for N days (vacation) option. A Product Hunt commenter asked for it [S] https://hunted.space/product/flashcard
22. After a break, cap and reorder the backlog by lowest recall probability. FSRS handles late reviews better (the wiki now calls the "20-30% fewer reviews" figure old) [F] https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS; the Anki G2 review complains queues grow too large [S] https://www.g2.com/products/anki/reviews
23. Detect leeches (a card failed N times) and prompt "split or rewrite". Anki advice thread [S] https://www.reddit.com/r/Anki/comments/16n57oh/how_do_you_handle_leech_cards/; Drill [S] https://github.com/tienonic/drillcards
24. Mix topics by default (interleaving, moderate-utility in Dunlosky) with an optional single-topic filter. Dunlosky [S] https://journals.sagepub.com/doi/10.1177/1529100612453266
25. Ask for a typed or spoken one-liner before revealing, since generative responses beat recognition. UNB summary of Dunlosky [S] https://www.unb.ca/fredericton/cetl/services/teaching-tips/instructional-methods/effective-learning-techniques.html; Lemma type-in [S] https://community.obsidian.md/plugins/lemma-flashcards
26. Keep separate histories per card variant, for example the answer card and the trap card. Mochi multiple review histories [S] https://www.mochi.cards/docs/cards/; Rememorize direction [S] https://github.com/silverbucket/rememorize
27. Nudge "enough for today". Execute Program [S] https://www.executeprogram.com/faq
28. Add undo of the last rating. Kioku [S] https://marketplace.visualstudio.com/items?itemName=Justhiro55.kioku
29. Show a per-topic readiness figure from average predicted recall. ts-fsrs forgettingCurve [S]; Flashcard Studio weakest-deck ranking [S] https://community.obsidian.md/plugins/flashcard-studio

### Quiz and question formats
30. Ask for confidence (sure / unsure / guess) before the reveal and resurface high-confidence misses first. Hypercorrection: Foster [S] https://link.springer.com/article/10.1007/s10649-021-10084-7; Butler 2008 [S] https://doi.org/10.1037/0278-7393.34.4.918. Caveat: certainty-based marking did not raise exam scores (PMC [S] https://pmc.ncbi.nlm.nih.gov/articles/PMC6544949/), and one study found no gain in calibration (Perry [S] https://espace.library.uq.edu.au/view/UQ:334102).
31. Always give corrective feedback after an attempt; testing without feedback can leave students producing the wrong answers. Learning Design Wiki [S] https://wiki.learningdesignalliance.org/principles/retrieval-practice/
32. Add true/false grids with per-statement explanations shown only after solving. Quarto Quizkit [S] https://github.com/beyondsimulations/Quarto-Quizkit
33. Add predict-the-output and "will this test pass or fail" tracing questions. mdbook-quiz Tracing [S] https://github.com/cognitive-engineering-lab/mdbook-quiz; BFE.dev JS quizzes [S] https://bigfrontend.dev/quiz
34. Accept alternative spellings and answers for typed answers. mdbook-quiz [S]; the Anki 26.11 beta added a case-insensitive type filter [S] https://github.com/ankitects/anki/releases/
35. Support cloze with optional hints, with masks that don't reveal the answer's length. Mochi forum [S] https://forum.mochi.cards/?page=1
36. Add "review this flaky test" questions: show test code with smells and ask for critique. A commenter proposed it in the SDET thread [F] https://www.reddit.com/r/QualityAssurance/comments/1wz607z/sdet_interview/; code-review task [S] https://bulldogjob.pl/readme/rozmowa-techniczna-czyli-jaka
37. Add incident-style scenario questions with trade-offs. QA Quest "QA in Chaos" [S] https://play.google.com/store/apps/details?hl=en_US&id=com.whowantstobeaqa.game
38. Use a hint ladder (hint, then partial, then full). Exercism learning-exercise hints [S] https://exercism.org/blog/whats-new-in-v3-with-angelika
39. For multiple choice, explain why each wrong option is wrong. TestAcademy [S] https://www.testacademy.dev/interview-prep/questions; Procensic Anki deck fields [S] https://ankiweb.net/shared/info/379698638
40. Lint question text so the title doesn't give the answer away (80% hit rate reported by one reviewer). Devmaxx App Store [S] https://apps.apple.com/us/app/devmaxx/id6758278144
41. Offer Parsons and faded-Parsons ordering of Playwright test lines. Reordering alone showed a speed gain but no learning gain; adding self-explanation prompts helped. ACM review [S] https://dl.acm.org/doi/full/10.1145/3560266; PyKinetic [S] https://doi.org/10.1007/s40593-019-00184-0
42. Order tasks as worked example, then faded, then blank, and remove scaffolding as skill grows (expertise reversal). Ericson [S] https://juholeinonen.com/assets/pdf/ericson2022parsons.pdf
43. Shuffle option and question order. mdbook-quiz [S]
44. Add a timed mock exam with a question map, pass mark and per-topic score. Flashcard Studio exams [S]; a 6x50-question, 70%-pass Udemy format [S] https://www.udemy.com/course/rozmowa-kwalifikacyjna-dla-testera-oprogramowania-pytania/
45. Compute difficulty from your own miss rate; users dislike inconsistent easy/medium labels. r/leetcode [F]

### Mock interview and speaking practice
46. Add a mock-interview flow: type or say an answer, get a 60-90 second structure guide, reveal the model answer, self-rate. sdet-interview-trainer [F]
47. Let users record themselves and play back next to the model answer. My Interview Practice [S] https://www.g2.com/products/my-interview-practice/reviews. Microphone access from file:// is unverified (D).
48. Optional on-device speech-to-text (Chrome 139+ with a language pack; Firefox 160 desktop is on-device). MDN [S] https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API; micdrop [S] https://micdrop.dev/blog/web-speech-api. By default Chrome sends audio to a server, so label it clearly.
49. Format the "say aloud" answer as definition, when used, project example, takeaway. qalabs [S] https://qalabs.pl/rozmowa-rekrutacyjna-qa-jak-odpowiadac-na-pytania
50. Add a personal STAR story bank (found a bug, unclear requirement, priority call), stored locally. qalabs [S]; Medium piece [S] https://medium.com/@nosekbk/what-i-actually-look-for-when-i-interview-qa-engineers-and-how-you-can-prepare-c502682c39ed
51. Run follow-up chains, each hidden until you answer the previous one. AI mock tools advertise follow-ups: Showcaseme [S] https://showcaseme.in/interview-prep/qa-automation-engineer; SpeakFast [S] https://news.ycombinator.com/item?id=43597411. Your data already has follow-ups, so it needs no AI.
52. Add a live-coding rehearsal mode: 30-minute timer, "think aloud" prompts, happy path first. scrolltest [S] https://scrolltest.com/live-coding-sdet-interviews-10-exercises-walkthrough/; the 30-minute framework complaint [F] https://www.reddit.com/r/QualityAssurance/comments/1wz607z/sdet_interview/
53. Add a "teach it back in your own words" box before showing the answer. Mastery OS [S] https://github.com/HackerO112/Structured-learning; self-explanation prompts raised learning [S] https://doi.org/10.1007/s40593-019-00184-0
54. Export a printable mock-interview sheet for a friend to interview you. Pramp peer model [S] https://www.pramp.com/faq; TermDecks print [S] https://github.com/zntznt/termdecks
55. Add a bank of questions to ask the interviewer. rwasik.pl [S] https://rwasik.pl/o-co-pytac-na-rozmowie-o-prace-jako-tester; jaktestowac [S] https://jaktestowac.pl/rekrutacja/
56. Add an English-speaking drill for Polish users, since part of Polish interviews run in English. intervue.pl [S] https://intervue.pl/pytania-rekrutacyjne/tester-oprogramowania/; spoken-English for QA [S] https://levitintymur.com/mastering-spoken-english-for-qa-automation-engineers-real-questions-real-conversations/

### Code practice
57. Run JS tasks in a sandboxed iframe with no allow-same-origin, a postMessage channel, and a watchdog timeout started on "ready". yizhiweb [S] https://yizhiweb.top/guides/running-code-in-the-browser/; sandbox write-up [S] https://ericsekyere.ca/blog/polyglot-sandbox (srcdoc iframe needs no fetch; Worker from file:// unverified, see D)
58. Strip TypeScript with Sucrase or esbuild-wasm before running. yizhiweb [S]; Wovser docs [S] https://docs.wovser.ai/creating/code-challenges/ (bundle size is unverified)
59. Run SQL tasks on SQLite WASM with a seeded schema and a result-set diff. yizhiweb [S]; genanki-js uses sql.js [S]. A .wasm fetch fails on file://; Learning Dojo documents the sibling-fetch block [S] https://vahag.dev/projects/learning-dojo.html. An inline-wasm build is the workaround (hosted only, or inline).
60. Show visible edge-case tests and run hidden ones; hidden tests with no explanation caused 0% shocks. Codility Reddit analysis [S] https://www.codility.com/lab/codility-reddit-review/
61. Give a spec, target site and rubric for home tasks, and link a practice site. Practice sites [S] https://www.davidmello.com/software-testing/test-automation/best-websites-for-practicing-test-automation, https://playwright.aims-ai.com/blog/test-automation-practice-websites; deliverables and expectations [S] https://bulldogjob.pl/readme/rozmowa-techniczna-czyli-jaka
62. Replace "compare with the answer" with a rule-based checklist that flags smells in the textarea (waitForTimeout, brittle selectors). Exercism analyzers give predefined comments [S] https://exercism.org/blog/whats-new-in-v3-with-angelika (implementation [own])
63. Offer "complete the incomplete test" tasks with starter code rather than a blank page. An interviewer thread says it is the best assessment [S] https://www.reddit.com/r/QualityAssurance/comments/1e0a7gr/its_my_first_time_interviewing_sdets_what_should/
64. Show several accepted approaches per task, not one answer. Exercism approaches [S] https://github.com/exercism/v3/blob/main/docs/features-of-v3.md
65. Offer a "present your framework" mode (what worked, what didn't, what next). MoT thread [S] https://club.ministryoftesting.com/t/what-are-some-automation-engineer-interview-coding-tasks-that-are-relevant-to-ui-automation/85591; dev.to [S] https://dev.to/cydavid/how-to-conduct-an-sdet-technical-interview-1b6h
66. Link Try Playwright, trace.playwright.dev and the-internet pages for real hands-on follow-up. awesome-playwright [S] https://github.com/mxschmitt/awesome-playwright; Playwright trace viewer docs [S] https://playwright.dev/docs/trace-viewer

### Progress, stats and motivation
67. Add a GitHub-style activity heatmap. Kioku [S]; a heat-map fan on r/college [F] https://www.reddit.com/r/college/comments/wp9bkm/quizlet/
68. Count a streak day for any rated item and avoid punishing mechanics. Spaced Complexity [S]; "the queue is the leash, not a streak owl" [S] https://yakyacker.com/reviews/anki/
69. Show Core / Standard / Niche coverage per topic. GreatFrontEnd progress [S]; sdet-interview-trainer Progress page [F]
70. Show progress on the plan list itself (30/40, a Completed badge). LeetCode study-plan post [F] https://leetcode.com/discuss/post/6371228/LeetCode-Study-Plan-UI-is-terrible/
71. Record the completion time per item, plus "reset all". TIH #275 [F] https://github.com/yangshun/tech-interview-handbook/issues/275
72. Add a printable plan-completion certificate. GreatFrontEnd [S]; TAU says it is the most requested feature but declined it for learning paths [S] https://applitools.com/blog/upcoming-content-for-test-automation-university/ (low priority)
73. Add a weakest-topic-first dashboard with a one-tap study button. Flashcard Studio [S]
74. Chart calibration (confidence versus actual correctness) over time. Perry [S]; Foster [S] ([own] chart)
75. End each session with "Review mistakes". Flashcard Studio [S]; QA Quest Study Camp [S]; iTer wrong-answer notebook [S]
76. Mark items unlearned / learned / mastered, plus favourites. iTer [S]
77. Show a role-weighted "readiness %" for the target job. QA Quest "70% earns the virtual offer" [S] (formula [own])
78. Record seconds per question to flag slow-but-correct items. FSRS review_duration [S]; Mochi review history includes duration [S]
79. Export stats to CSV. TIH #275 [F]

### Content quality, freshness and contribution
80. Add a per-question "Report an error" button that opens a prefilled issue (question id and version). About 11 of the 20 listed open issues on lydiahallie are correctness or translation reports (my count) [F] https://github.com/lydiahallie/javascript-questions/issues; sudheerj issues [S] https://github.com/sudheerj/javascript-interview-questions/issues
81. Add a "last verified" date and a tool version per question (such as Playwright 1.x) with a stale flag. lydiahallie says its questions reflect 2019 syntax [S] https://github.com/lydiahallie/javascript-questions/; the h5bp content audit issue #935 [S] https://github.com/h5bp/Front-end-Developer-Interview-Questions/issues; Playwright's own concepts change with releases [S] https://playwright-info.vercel.app/pytania-rekrutacyjne-playwright; practice-site "last verified" tip [S] https://www.navtutorial.com/selenium/selenium-practice-websites
82. Run a link-check CI over sources. awesome-testing has a dead-link checker badge [S] https://github.com/TheJambo/awesome-testing/
83. Store one question per file with a schema, and validate it in CI. roadmap.sh uses per-topic markdown files synced on merge [S] https://github.com/nilbuild/developer-roadmap; mdbook-quiz schema [S]
84. Ship a real CONTRIBUTING file. h5bp has an open issue saying it doesn't exist [S] https://github.com/h5bp/Front-end-Developer-Interview-Questions/issues. TIH says "no formal contributing guidelines" [S] https://www.github.com/yangshun/tech-interview-handbook, and awesome-playwright's guidelines are placeholder text [S] https://github.com/mxschmitt/awesome-playwright/blob/main/CONTRIBUTING.md. These are anti-patterns.
85. Label good-first issues such as "add a trap, follow-up or source to question X". Exercism contributing [S] https://exercism.org/contributing; TIH lists none [S]
86. Keep stable question ids so translations and progress survive edits. h5bp translation backlog [S] https://github.com/h5bp/Front-end-Developer-Interview-Questions/issues/449; lydiahallie translation errors [F]; genanki stable GUIDs [S] https://github.com/kerrickstaley/genanki/
87. Publish release notes and a data-format version, with a migration for old progress. TIH versioning proposal #619 [S] https://github.com/yangshun/tech-interview-handbook/issues; mdbook-quiz semver [S]; Mochi and Anki changelogs [S] https://www.mochi.cards/changelog/
88. Add QC lints: duplicate detection, required fields, and answer-length limits. Procensic deck's QC checklist [S]
89. Show a provenance label (human-reviewed, AI-assisted or community) on each question. An AI-generated app was called "slop" in an App Store review [S] https://apps.apple.com/us/app/devmaxx/id6758278144; Codecademy content errors [S] https://www.trustpilot.com/review/codecademy.com
90. Let users submit "questions I was asked" (company type, round, month) to feed the tiers. TIH RFC [S] https://github.com/yangshun/tech-interview-handbook/issues/304; r/QualityAssurance scrape post, 328 points [S] https://www.reddit.com/r/QualityAssurance/comments/1dn14cy/i_scraped_all_qa_engineer_interview_questions_at/; r/Playwright interview-question posts [S] https://www.reddit.com/r/Playwright/comments/1wme5zq/photon_l1_interview_questions/
91. Show how tiers were derived (ad count, date, sample size), with a refresh script. LeetCode frequency data [S] https://leetcopilot.dev/blog/leetcode-vs-neetcode-which-is-better-2025 ([own] transparency)

### Personalisation
92. Paste a job ad and match keywords to auto-select topics and tier. Codility: 45.5% of 429 Reddit threads ask what one employer's test contains [S]; justjoin "every requirement is a potential question" [S] https://justjoin.it/blog/rozmowa-kwalifikacyjna-w-it-jak-sie-przygotowac; SpeakFast pastes job descriptions [S]. Keyword matching runs client-side (file ok).
93. Add role presets (manual, automation, SDET, lead) with different depth. qalabs level table [S]; QA Quest roles and Entry/Mid/Senior [S]
94. Default juniors to Core only, with Standard as an opt-in. [own]
95. Add a Polish/English UI and content toggle. TSOFA supports 24 languages [S] https://github.com/asweigart/tsofa-the-simple-offline-flashcard-app/; Polish-language demand per sources in section A
96. Let users add their own cards for target-company facts and personal mistakes. Bug2Brain "your mistakes are your curriculum" [S] https://marketplace.visualstudio.com/items?itemName=AnandShah.bug2brain; making your own cards beats premade decks [S] https://www.reddit.com/r/Anki/comments/1beckj4/making_your_own_cards_will_save_you_time_not_the/
97. Add a short pre-test diagnostic that skips known topics. Gamified apps wouldn't let known lessons be skipped [S] https://felpscreative.com/projects/gamified-learning-ux/

### Distribution, sync and offline
98. Add JSON export and import with a schema version and a "last backed up N days ago" prompt. Grind 75's pinned issue asks for device transfer, and users used localStorage console hacks [F] https://github.com/yangshun/tech-interview-handbook/issues/275; HN commenters want full-fidelity export including repetition history [S] https://news.ycombinator.com/item?id=27863409; Learning Dojo states export exists because file:// progress doesn't follow to localhost [S] (file ok)
99. Warn that localStorage is scoped per origin (file:// versus hosted) and can be evicted. MDN eviction [S] https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria; Mochi's web version "can clear them without warning" [S] https://spacedrepetition.info/apps/mochi
100. Request navigator.storage.persist() on a user gesture. web.dev [S] https://web.dev/articles/persistent-storage (hosted only, secure context; file:// unverified)
101. Make writes safe: keep the previous copy and write a new one, since a single-JSON-blob rewrite risks losing everything on a mid-write quit. Product Hunt comment [S] https://hunted.space/product/flashcard
102. Add "Save to file" through the File System Access API (Chromium only, needs a click each session). TiddlyWiki forum [S] https://talk.tiddlywiki.org/t/file-system-access-api-and-saving-locally/3619; TermDecks [S]
103. Document syncing the export file via Syncthing, Dropbox or git rather than building a backend. Syncthing guide [S] https://www.howtogeek.com/free-open-source-tool-solves-the-main-problem-with-local-first-apps/; kazepoy Dropbox sync [S] https://github.com/kazepoy/flashcard; VS Code SR plugin syncs via git [S] https://marketplace.visualstudio.com/items?itemName=RongBaichuan.vscode-spaced-repetition
104. Merge on import: union of reviews by card id, with the newest change winning. Lemma [S]; QuizCraft [S] https://github.com/1jazu11ahM/studydeck; TiddlyWiki merge-by-drag [S] https://github.com/TiddlyWiki/TiddlyWiki5/issues/2949
105. Export to Anki (.apkg in-browser, or TSV) with stable note ids. anki-apkg-export [S] https://github.com/repeat-space/anki-apkg-export; genanki-js [S] https://genanki.js.org/; MimoCard TSV [S] https://github.com/gyoomei/mimocard. Anki interop: kazepoy [S]; a HN commenter wants export to Anki [S] https://news.ycombinator.com/item?id=27863409
106. Import cards in a Question::Answer markdown syntax. Obsidian SR [S]; Flashcard Studio .apkg import [S]
107. Print or PDF a pocket cheat-sheet or cards. TermDecks [S]; TSOFA printable [S]; The Coding Cards sold a PDF [S] https://www.producthunt.com/products/the-coding-cards
108. Share a selection via the URL fragment. QuizCraft share links [S]
109. Build from separate source files into one HTML, and write the question data as a script (window.DATA = ...) not a fetched JSON. SRS Anywhere build [S] https://git.sr.ht/~jakob/srs-anywhere; Learning Dojo [S] (file ok)
110. Publish a standalone questions.json alongside the app so other tools can reuse it. HN advice to define an open file format [S] https://news.ycombinator.com/item?id=23947659; Mochi EDN export mentioned there [S]
111. Offer an optional hosted PWA copy with a service worker; a PWA install can improve persistent-storage odds. kazepoy [S]; web.dev offline data [S] https://web.dev/learn/pwa/offline-data (hosted only)
112. Offer an embeddable single-question web component for blog posts. Orbit's web component [S] https://docs.withorbit.com/

### Accessibility and UX
113. Provide full keyboard control: Space to reveal, 1-4 to grade, arrows to navigate, a "?" help overlay. Flashcard Studio [S]; TSOFA [S]. Also add tap-to-reveal, since Mochi's keyboard-first flow is awkward on touch [S] https://forum.mochi.cards/?page=1
114. Make swipe-to-rate optional and guard against slips. RemNote App Store review [S] https://apps.apple.com/us/app/remnote-notes-flashcards/id1545429784?see-all=reviews
115. Offer larger answer buttons and a separate height setting. AnkiDroid suggestion [F]
116. Provide light and dark themes that follow system preference with a manual override; respect "I only want dark". TIH #683 [F] https://github.com/yangshun/tech-interview-handbook/issues/683; dyslexia-friendly fonts [S] https://github.com/kazepoy/flashcard
117. Add a first-run sample tour and no blank start. Yak Yacker calls the blank first screen the quit moment [S]; Anki UI thread [F] https://www.reddit.com/r/Anki/comments/1l56142/why_do_a_lot_of_people_think_anki_has_an_outdated/; kazepoy Guided tour [S]
118. Use progressive disclosure: collapse the full explanation, follow-ups and sources by default. RemNote "busy interface" cons [S] https://www.producthunt.com/products/remnote/reviews; ThinkCards positioning [S] https://alternativeto.net/software/thinkcards/about/
119. Keep code lines short (about 32 characters) for mobile. badlydrawnrob [S] https://github.com/badlydrawnrob/anki?tab=readme-ov-file
120. Add a search query language (tag:, tier:, is:weak). kazepoy [S]; an instant-search request on the Anki forum [S]
121. Keep it fast at 1,000+ items; a Quizlet user said sets over 1,000 cards lag. r/quizlet [S] https://www.reddit.com/r/quizlet/comments/1f7zspc/help_product_feedback_from_quizlet_users/

### AI-assisted features (all must work without a server or with bring-your-own key or a local model)
122. Copy-paste prompt mode: the app builds the prompt (question, model answer, your answer) for any chat, and you paste the result back. ThinkCards [S]; kazepoy [S] (file ok)
123. Bring-your-own-key calls straight from the browser, with the key stored locally and a clear warning. kazepoy [S]; Flashcard Studio lists providers [S] (CORS unverified, D)
124. Allow a local model endpoint such as Ollama or LM Studio. Flashcard Studio mentions local models [S] (calls from file:// unverified, D)
125. Optional in-browser LLM: Chrome Prompt API (Gemini Nano, desktop only, about 22 GB free disk and GPU or 16 GB RAM) or WebLLM (WebGPU, model downloads of hundreds of MB to several GB). Chrome docs [S] https://developer.chrome.com/docs/ai/prompt-api; WebLLM [S] https://github.com/mlc-ai/web-llm?tab=readme-ov-file. Offer it as an opt-in enhancement; file:// support is unverified (D).
126. Use a Socratic follow-up generator: hints first, one question at a time. A study guide prompt says "do not give me the full answer yet" [S] https://github.com/ashleymcnamara/learn_to_code; Bug2Brain [S]
127. Generate cards for gaps from a pasted job ad. Mochi AI (free tier only 5,000 tokens a month) [S] https://www.mochi.cards/pricing/; MimoCard [S]
128. Label all AI output unverified and never overwrite shipped canon. Learners distrust wrong AI answers: JetBrains Academy study [S] https://arxiv.org/html/2501.17747; Codecademy AI complaints [S]
129. Add a non-AI fallback that scores your answer by coverage of a "key points" list. [own]; Exercism's predefined analyzer comments are the analogue [S]

### Community and growth
130. Use GitHub Discussions or Discord for question debate, with a weekly question. GreatFrontEnd private Discord [S] https://www.greatfrontend.com/blog/greatfrontend-black-friday-2026; Playwright Discord [S] https://playwright.dev/community/welcome; TAU Slack [S] https://testautomationu.applitools.com/ready-for-2027.html
131. Use a public roadmap with votes and a stated threshold. TIH's maintainer asked for 50 upvotes before building sync [F] https://github.com/yangshun/tech-interview-handbook/issues/275; RemNote feedback board [S] https://feedback.remnote.com/
132. Get listed on awesome-testing and awesome-playwright (CC0 lists that take PRs). [S] https://github.com/TheJambo/awesome-testing/, https://github.com/mxschmitt/awesome-playwright
133. Separate licences for code and content, and say what reuse is allowed. lydiahallie asks for attribution [S] https://github.com/lydiahallie/javascript-questions/; roadmap.sh content "cannot be republished" [S] https://stack.liuhuo.org/en/discover/roadmap-sh
134. State publicly "core features never paywalled". Quizlet backlash [F]

### Things users hate (anti-features to avoid)
135. Paywalling basic study modes, especially near exam time. r/college, 319 points and 45 comments [F] https://www.reddit.com/r/college/comments/wp9bkm/quizlet/; r/CollegeRant [F] https://www.reddit.com/r/CollegeRant/comments/1sb449x/best_alternatives_to_quizlet_locking_everything/; Trustpilot [S] https://www.trustpilot.com/review/www.quizlet.com
136. Ads or unskippable video during study. Trustpilot [S]; QA Quest "contains ads" [S]
137. A forced sign-up before seeing content or pricing. Devmaxx review [S]; HN reply "remove sign up wall" [S] https://news.ycombinator.com/item?id=42584851; TIH "no sign-in button, how to track solved problems?" [S] https://github.com/yangshun/tech-interview-handbook/issues
138. Streak guilt and XP that doesn't match effort. Boot.dev Trustpilot [S] https://nz.trustpilot.com/review/www.boot.dev; Scrimba guide [S] https://scrimbaguide.tech/docs/comparisons/scrimba-vs-boot-dev/
139. A review pile that explodes after a break. Anki G2 [S], RemNote review [S] https://www.saasodds.com/blog/remnote-review
140. A dense, jargon-heavy interface. Anki forum "To me, this app is a fail" [S] https://forums.ankiweb.net/t/to-me-this-app-is-a-fail/17042
141. Wrong or obsolete content with no fix channel. lydiahallie [F]; one AnkiWeb deck review says "40% of cards are inaccurate" [S] https://ankiweb.net/shared/info/2079727228
142. Hidden test results with no feedback. Codility [S]
143. Rewarding memorised definitions. A hiring-manager comment on r/QualityAssurance says "never liked the rehearsed candidate" [S] https://www.reddit.com/r/QualityAssurance/comments/1p4m4ou/how_can_i_improve_my_performance_in_qa_engineer/; qalabs "don't learn answers word for word" [S]. Keep spoken answers as outlines and ask for your own example.
144. Lock-in and no export. HN [S] https://news.ycombinator.com/item?id=27863409
145. Data loss on sync or save. RemNote lost-notes reports [S] https://androidwidgetcenter.com/remnote-notes-flashcards-review/

---

## C. The 15 ideas with the strongest evidence of user demand, ranked

Demand strength is judged from visible points, comments and maintainer tracking, not from vendor pages. A feature listed on a vendor's own page (GreatFrontEnd, TestDome, Codility, RecallDeck, PracHub) shows only that it exists, not that users want it.

1. **No paywall or ads on core study modes (#135-136).** r/college: 319 points, 45 comments [F] https://www.reddit.com/r/college/comments/wp9bkm/quizlet/. r/CollegeRant: 36 points, 17 comments [F]. Trustpilot summary of 90 reviews [S] https://www.trustpilot.com/review/www.quizlet.com.
2. **Easy onboarding and an uncluttered interface (#117-118, #140).** r/Anki thread: 83 points, 61 comments [F] https://www.reddit.com/r/Anki/comments/1l56142/why_do_a_lot_of_people_think_anki_has_an_outdated/. Also G2 [S] https://www.g2.com/products/anki/reviews, Capterra [S] https://www.capterra.com/p/229584/Anki/reviews/ and the Product Hunt RemNote reviews [S].
3. **Portable progress, export and import (#98, #104-105).** TIH's pinned master issue lists device transfer, reset and timestamps [F] https://github.com/yangshun/tech-interview-handbook/issues/275. Show HN threads with 118 and 140 points had export as the top ask [S] https://news.ycombinator.com/item?id=27863409, https://news.ycombinator.com/item?id=23947659.
4. **Spaced review of already-solved items with a daily queue (#16-17, #3).** Asked for on r/NeetCode [F] (2 points, 0 comments) and r/leetcode [F] (2 points, 8 comments; two of six comments ask for it). TIH #722 asks for a review state [F]. Several independent builders ship it: Spaced Complexity [S], Kioku [S]. Per-post volume is low, but the request keeps recurring in unrelated places.
5. **A flag / mark-for-review state with notes (#1-2).** TIH #722 and #682, with a "+1" and a spreadsheet workaround [F].
6. **Visible progress on lists and plans (#69-71).** LeetCode study-plan post [F] https://leetcode.com/discuss/post/6371228/LeetCode-Study-Plan-UI-is-terrible/; TIH #275 [F].
7. **A report-an-error path for wrong answers (#80, #141).** About 11 of the 20 listed open issues on lydiahallie are correctness or translation errors [F] https://github.com/lydiahallie/javascript-questions/issues; the AnkiWeb "40% inaccurate" review [S].
8. **Job-ad-driven focus and real-question tagging (#92, #90, #10).** In Codility's analysis, 195 of 429 Reddit threads (45.5%) ask what one employer's test contains [S] https://www.codility.com/lab/codility-reddit-review/ (the vendor's own data). r/QualityAssurance scraped-questions post: 328 points [S].
9. **Dark mode (#116).** TIH #683 has many commenters and an unresolved design debate on auto versus manual [F] https://github.com/yangshun/tech-interview-handbook/issues/683.
10. **Realistic live-coding practice and timed rehearsal (#52, #63).** The 30-minute framework thread: 29 points, 29 comments [F] https://www.reddit.com/r/QualityAssurance/comments/1wz607z/sdet_interview/. A request for live-coding practice problems [S] https://www.reddit.com/r/QualityAssurance/comments/18u0193/sdet_live_coding_interview_questions/. A thread asking whether live coding is necessary [S] https://www.reddit.com/r/Playwright/comments/1thi84a/are_live_coding_interviews_really_necessary/.
11. **Automatic checks and feedback on code (#60, #62).** GreatFrontEnd UI questions lack automated tests, per a reviewer [F] https://mariusespejo.com/blog/greatfrontend-review; Codility hidden-test frustration [S].
12. **Configurable grading buttons (#15).** The Anki forum thread to remove Easy and Hard has 23 replies [F]; Mochi users ask for the four-button version [S]. Opposite requests, so make it a setting.
13. **Touch-friendly and keyboard-first review (#113-115).** Mochi tap-to-reveal request [S], AnkiDroid button-height request [F], RemNote swipe complaint [S].
14. **Reliable data that doesn't vanish (#99-101, #145).** RemNote lost-notes reports [S], Mochi web storage warning [S], single-blob write-risk comment [S].
15. **Anki interop (#105-106).** kazepoy [S], Flashcard Studio [S], Obsidian Decks "import .apkg in one click" [S] https://community.obsidian.md/plugins/decks, and a HN commenter asking for export to Anki [S].

---

## D. Claims I could not verify

- **Whether FSRS and a scheduler fit the single-file budget.** I did not check ts-fsrs's bundled size. v6 needs Node 24 for development, and a browser UMD build is only mentioned in the npm text [S].
- **file:// behaviour was never tested, only inferred from docs.** This covers navigator.storage.persist() (MDN says secure context), microphone access, Web Worker and blob creation, fetching a .wasm file, calling a localhost model, and calling a cloud API (CORS). The Chrome Prompt API and WebLLM availability on file:// is also unknown. The Prompt API's Chrome 148 and hardware requirements come from the docs page [S].
- **NeetCode Pro "spaced repetition reminders".** Only blog posts from a LeetCode-helper site claim it [S] https://leetcopilot.dev/blog/leetcode-vs-neetcode-which-is-better-2025, while a Reddit user asks NeetCode for exactly that feature [F]. Conflicting, so unresolved.
- **Quizlet limiting "Learn" to five rounds per set.** Reported by a student newspaper [S] https://weekly.blog.gustavus.edu/2025/02/21/the-best-and-worst-quizlet-replacements/ and an r/college post [F]. The CollegeRant thread says it is now paid only [F]. I did not verify current Quizlet behaviour.
- **FSRS "20-30% fewer reviews".** The FSRS wiki itself says the figure is from old simulations [F]. Don't repeat it.
- **Vendor-authored sources** I used only for feature lists, not demand: GreatFrontEnd's own pages, the TestDome vs HackerRank comparison, Codility's Reddit analysis, RecallDeck's Anki-alternatives list, PracHub's BFE review, and the copilotinterview.com comparisons. androidblip's review rows look templated; treat as low trust.
- **Polish interview sources** (jaktestowac checklist, playwright-info) were seen only as search extracts. The jaktestowac checklist is behind an email form, so its contents are unknown.
- **The learning-science effect sizes** (hypercorrection, Parsons, mastery thresholds like 80-85%) come from abstracts and wiki summaries. I did not read the full papers, and the mastery-threshold figures are conventions from tutoring-system docs, not tested rules.
- **Chrome Web Store and Firefox Add-ons listings** were read through mirror sites, not the stores. User counts there are tiny (FlashTab 0-1 daily users), so they show that the format exists, not that it is wanted.
- **Not searched or no result:** LinkedIn and X posts, Hashnode, Wykop and Facebook groups, YouTube QA channels, expandtesting, GreatFrontEnd or Exercism public request boards. The H5P and JetBrains Marketplace results are thin.
- **Counts "about 11 of 20" and "Core/Standard/Niche" mappings** are my own tallies from the fetched lydiahallie issue list, not figures from the source.