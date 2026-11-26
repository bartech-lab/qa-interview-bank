# Testing fundamentals: strategy, design, levels, risk, defects, requirements, tools, web, ISTQB, BDD

How to study this file: read it in order, because later answers lean on earlier ones. Start with "Test strategy and planning" and "Test design techniques", since almost every ad in the market asks for them and the worked examples (boundary values, decision table, state transition) must be said out loud with real numbers. Say each **Say** paragraph aloud first, then read the Follow-ups and the Trap. The "test this login / elevator / pencil / checkout" answers are a method, not a script: learn the order of the steps, not the sentences. Testing fundamentals have no single official page, so each entry cites the ISTQB syllabus (CTFL v4.0.1) or glossary, or a well-known primary source (Fowler, Google Testing Blog, Cucumber docs, Dan North, Hendrickson).

## Test strategy and planning

### What is the difference between a test strategy and a test plan?

Topic: test-strategy | Core | id: q0499

**Say:** A test strategy is the general approach to testing, and it changes slowly. It says which levels and types of testing we do, how we use automation, how we pick what to test first, what tools and environments we use, and what "good enough" means. A test plan is for one project, release or iteration. It says what exactly we test now, who does it, when, with which environments and data, what the risks are and when we stop. So the strategy answers "how do we test here in general", and the plan answers "what do we do for this release". The strategy is read by the whole team, the plan mostly by the people running that release and by stakeholders who approve scope and dates.

**Full process:** how I would show the difference on a real product, with the same release.
1. Strategy line: "Logic is covered by unit tests, contracts by API tests, and E2E only covers the money paths. Every merge request runs the fast suites. Risk decides depth."
2. Plan line for release 4.2: "New checkout coupons. Risk: high (money). Scope: coupon API, checkout UI, three browsers. Not in scope: loyalty points. Entry: build deployed to staging, smoke green. Exit: no open P1 or P2 bugs, coupon decision table fully executed. Owner: me and one developer. Dates: Tuesday to Thursday."
3. Show that the plan points back to the strategy and says where it deviates. ISTQB wants this: a plan "demonstrates that testing will adhere to the existing test policy and test strategy (or explains why the testing will deviate from them)".

**Follow-ups:**
- *Who writes each one?* The strategy comes from the QA lead or the most senior tester with the engineering lead, and the team agrees to it. The plan comes from whoever owns testing for that release, with the product owner and developers.
- *Where do they live?* A strategy in a wiki page of one or two pages that people actually read. A plan can be a ticket or a short document per release. In an agile team the plan can be a section in the epic.
- *Can you have a strategy without a plan?* Yes, in small teams the strategy covers most things and each story just gets a short test note. You cannot have a good plan with no strategy, because every plan then re-decides the basics.

**Trap:** Saying "the strategy is a big document and the plan is a small one". Size is not the difference. Scope and lifetime are: strategy is general and long-lived, plan is specific and short-lived. Another wrong answer is to treat them as the same thing with two names.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.1 (test plan) and glossary entries "test strategy", "test plan": https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Build a test strategy for a new product from zero. Walk me through it.

Topic: test-strategy | Core | id: q0500

**Say:** I start with questions, not with tools. Who are the users, what does the business lose if this breaks, what is the release rhythm, what is the architecture, and who is on the team. From that I list the product risks and rank them by likelihood and impact. Then I pick levels and types of testing to cover each risk at the cheapest layer that can catch it: unit and API tests for logic and contracts, a few E2E tests for the money and sign-up flows, exploratory sessions for new features, and non-functional checks for the risks that need them. I define exit criteria, a way to report status, and how bugs flow. I put the first thin slice of it in CI in week one, and I review the strategy after the first release, because the first version is always a guess.

**Full process:** the ten steps I would run, in order, and what each produces.
1. Context interview (day 1, with the product owner, an engineer and support if there is any). Questions: who pays and who uses it, what is the worst thing that can happen (money, data, safety, reputation), how often we release, what regulations apply, what already exists. Output: a one-page context note.
2. Architecture walk with an engineer. Questions: which services, which databases, which third parties, what is async, where does state live. Output: a diagram with the integration points marked, since they are where bugs cluster.
3. Risk list. Brainstorm with the team, then score each risk as likelihood times impact on a 3-level scale. Output: a ranked list of 10 to 20 risks. Example top risks for a shop: wrong price at checkout, payment taken twice, order lost, login broken, personal data leaked, slow pages at peak.
4. Test levels and types per risk. For each top risk, choose the cheapest layer that can catch it. Wrong price: unit tests on the price function plus a decision table. Payment taken twice: API test with a repeated request and an idempotency key, plus one E2E check. Login broken: one E2E smoke test. Output: a table "risk, layer, type, owner".
5. Automation approach. Fast tests (static checks, unit, API) run on every merge request. A small E2E smoke suite runs on every merge request too if it stays under about 10 minutes, and the wider regression runs nightly or before release. Say what is deliberately not automated (see the "what not to automate" entry). Output: a pyramid or trophy sketch with rough ratios and a rule for where a new test goes.
6. Environments and data. Which environments exist, who owns them, how test data is created (per-test accounts, seeding, cleanup), how third parties are faked. Output: environment list and a data rule.
7. Entry and exit criteria, and a Definition of Done for a story. Example exit: all planned tests run, no open critical or major bug, smoke green on the release candidate, risks accepted in writing. Output: a short checklist.
8. Defect process. Severity and priority scales, who triages, what a good report contains, the workflow in the tracker. Output: a one-page rule plus a bug template.
9. Reporting. Which two or three numbers go to stakeholders: for example escaped bugs per release, how long the pipeline takes, how many tests are flaky, risk coverage. Output: one dashboard or a weekly note. Avoid vanity numbers such as "test cases written".
10. Review and adapt. Schedule a check after the first release and after every big incident. Output: a changelog at the bottom of the strategy page.

**Follow-ups:**
- *What do you do in the first week, concretely?* Steps 1 to 3, then a smoke test for the main flow in CI. A thin working pipeline teaches more than a thick plan.
- *What if there are no requirements yet?* I test the idea early: review the first stories and mockups for ambiguity, write acceptance criteria with the product owner, and use exploratory sessions on every build. The strategy says so explicitly.
- *How do you know it worked?* Fewer bugs escape to production, the pipeline stays fast and trusted, and developers are not afraid to change code. Martin Fowler's test is: you rarely get bugs that escape, and you are rarely hesitant to change code for fear of production bugs.
- *One person in QA, many developers: what changes?* Developers own unit and component tests, I own the strategy, the risk list, the E2E layer and exploratory sessions, and I coach on how to write better tests. The strategy has to fit the team size.

**Trap:** Starting with "we will use Playwright and a Page Object Model". A tool choice is step 5 at best. A strategy that opens with tools shows you have a framework habit, not a quality plan. The second trap is a wish list with no risk ranking, which cannot be prioritised when time runs out.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 5.1 and 5.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf ; Martin Fowler, Test Coverage (the "enough testing" test): https://martinfowler.com/bliki/TestCoverage.html

### What goes into a test plan, and what goes into a test strategy document?

Topic: test-strategy | Core | id: q0501

**Say:** The ISTQB list for a test plan is: context (scope, objectives, test basis), assumptions and constraints, stakeholders and communication, a risk register, the test approach (levels, types, techniques, entry and exit criteria, metrics, data and environment needs), and budget and schedule. A strategy document is shorter and more general: principles, the layers and what each covers, automation approach, environments and data rules, defect process, roles and reporting. In an agile team I keep both short enough that people read them.

**Full process:** a one-page test plan skeleton I would paste into a wiki.
1. Scope: in, out, and why out.
2. Test basis: stories, acceptance criteria, designs, API docs.
3. Risks: top five with likelihood, impact and what we do about each.
4. Approach: levels, types, techniques, what is automated and what is manual or exploratory.
5. Entry criteria: build deployed, smoke green, test data ready.
6. Exit criteria: planned tests run, no open critical or major defects, known issues listed and accepted.
7. Environments and data: where we test, how data is made.
8. People and schedule: who tests what, when, and who decides to release.
9. Reporting: who gets status and how often.

**Follow-ups:**
- *Does an agile team need a plan at all?* It needs the thinking, not the document. A refinement note per story plus a release checklist usually covers it.
- *What is the standard behind the formal version?* ISO/IEC/IEEE 29119-3 has templates. Mention it, do not recite it.

**Trap:** Copying a 40-page IEEE-style template nobody reads. A plan nobody reads has no value, and the ISTQB text itself says the value of planning is the thinking it forces.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the test pyramid?

Topic: test-strategy | Core | id: q0502

**Say:** The test pyramid is a picture of how to spread automated tests across layers. Many small, fast, isolated unit tests at the bottom, fewer service or integration tests in the middle, and very few slow end-to-end UI tests at the top. The higher the layer, the slower and more expensive the test, the more things can break it for unrelated reasons, and the harder it is to see what failed. Mike Cohn drew it in his 2009 book, with the layers unit, service and UI. Martin Fowler's rule of thumb is: the more high-level you get, the fewer tests you should have.

**Full process:** how I use it in a review, in three questions.
1. For this new test, what is the smallest layer where the bug it guards against would show up?
2. If I put it higher, what extra do I get that the lower layer cannot give (real browser, real wiring, real data)?
3. Is the answer worth the extra seconds and the extra flake risk? If not, move it down.

**Follow-ups:**
- *Why not just E2E everything?* Slow feedback, flakiness, and a failure that could be anywhere. Google's testing blog says a bug found by an E2E test "could be anywhere in the product" and suggests as a first guess 70% unit, 20% integration and 10% E2E, with the exact mix depending on the team.
- *What are the anti-patterns?* The ice cream cone (mostly E2E, few unit tests) and the hourglass (many unit and E2E tests, few integration tests), both named in the Google post.
- *Do the layer names matter?* No. Fowler says it is fine to use other names as long as the team is consistent. ISTQB 4.0.1 says the same: the number and naming of layers may differ.

**Trap:** Quoting 70/20/10 as a law. Google calls it "a good first guess" that differs per team. The other trap is saying the pyramid is about the number of tests only. It is about cost, speed and confidence per layer.

**Source:** Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html ; Google Testing Blog, Just Say No to More End-to-End Tests: https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html ; ISTQB CTFL v4.0.1 section 5.1.6: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What are the criticisms of the test pyramid? Is it still right?

Topic: test-strategy | Core | id: q0503

**Say:** The pyramid is a good default, but critics have fair points. Unit and integration are blurry words, so teams argue about what goes where. For many modern frontends and services, a unit test with everything mocked proves little, so Kent C. Dodds proposed the testing trophy: static checks at the base, then unit, mostly integration tests in the middle, and a few E2E on top. Spotify's honeycomb says the same for microservices. Fowler's 2021 article says these shapes show where to put effort, and that the real point is to spend effort where confidence per cost is highest. My view: keep the pyramid's cost logic, and decide the middle layer by what your system actually is.

**Full process:** how I apply "pyramid or trophy" to a real system.
1. Is there a lot of pure logic (pricing, rules, parsing)? Then unit tests carry real value: pyramid-like.
2. Is the product mostly wiring (UI, API, database, third parties)? Then integration tests with the real wiring and only the network edge faked give more confidence: trophy-like.
3. Is it a set of small services? Then contract and service-level tests matter most.
4. In all cases keep static analysis (types, lint) as the cheapest layer, and keep E2E small.

**Follow-ups:**
- *What did Dodds actually claim?* "Write tests. Not too many. Mostly integration." Lower layers need more tests to cover the same code, and integration tests strike a good balance of confidence against speed and cost. He wrote it about JavaScript applications, not as a law for all systems.
- *Which one do you use?* Neither as a religion. I pick the layer per check.
- *Does the trophy say E2E is bad?* No. E2E gives the most confidence and costs the most, so you keep a few.

**Trap:** Saying "the pyramid is dead". The honest line is: the shape depends on the system, and the cost-versus-confidence reasoning behind the pyramid still holds.

**Source:** Martin Fowler, On the Diverse And Fantastical Shapes of Testing: https://www.martinfowler.com/articles/2021-test-shapes.html ; Kent C. Dodds, Write tests. Not too many. Mostly integration.: https://kentcdodds.com/blog/write-tests

### How do you choose the test layer for a given check?

Topic: test-strategy | Standard | id: q0504

**Say:** I ask where the bug would live and what is the cheapest place that can see it. Pure logic goes to a unit test. A rule between two components, or an API contract, goes to an integration or API test. Something only a real browser can show, like a redirect, focus, layout, or a flow across several pages, goes to E2E. Then I check cost: speed, flake risk, and how clear the failure message will be. I would rather have one E2E test for the happy path and many API or unit tests for the edge cases behind it.

**Full process:** a worked example, a coupon on checkout.
1. The rule "10% off orders over 100, not combined with another coupon" has many cases. They go to a unit test or a decision table at API level: 12 cases, milliseconds each.
2. The API returns the right total for a cart with a coupon. One API test per important response and error.
3. The browser shows the discounted total and the error message for an invalid coupon. One E2E test for the happy path, one for the error text.
4. Accessibility of the coupon field (label, error announced) is an E2E or component check with role-based locators.
5. Result: 12 + 3 + 2 tests, and only 2 of them are slow.

**Follow-ups:**
- *When is E2E the only option?* When the bug is in the wiring between real parts: routing, session, a race between browser and server, a third-party widget.
- *How do you stop the team putting everything at the top?* Write the rule down: new tests start at the lowest layer that can fail for the right reason, and a reviewer can ask "why not lower?".
- *What do you say to a developer who says unit tests are enough?* Unit tests prove the parts, not the wiring. One example from a real escape usually settles it.

**Trap:** Choosing the layer by what you can write fastest, or by the tool you like. Choose it by where the defect would show up and by cost.

**Source:** Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html ; Kent C. Dodds, Static vs Unit vs Integration vs E2E: http://kentcdodds.com/blog/static-vs-unit-vs-integration-vs-e2e-tests

### You think a test belongs at integration level, not E2E, but the developer refuses to write it there. How do you convince them?

Topic: test-strategy | Standard | id: q0505

**Say:** First I ask why they refuse, because the reason decides the answer. Usually it is time, a missing test harness, or a belief that the E2E test already covers it. Then I make it about cost and evidence, not my opinion. An E2E test for a business rule is slow, can fail for reasons unrelated to the rule, and when it fails it does not say which part broke. The same check at integration level runs in milliseconds on every merge request and points at the exact cause. Then I make the lower layer cheap for them: as an SDET I offer to write it myself, or to pair, and to add the helper or fixture that is missing. If we still disagree, we agree a team rule, such as "a new test starts at the lowest layer that can catch the bug", and the tech lead or the team decides. Until then I keep the risk covered at a higher layer, so nothing ships untested.

**Full process:** the coupon rule from the previous entry, 12 cases.
1. Ask the reason and listen. "No time" needs help, "no harness" needs a fixture, "E2E covers it" needs data.
2. Show numbers from our own pipeline: how long the 12 cases take as E2E versus as integration tests, and how often the E2E version failed for unrelated reasons.
3. Show what a failure tells each reader: an E2E failure says "checkout failed"; an integration failure says "coupon not applied above 100".
4. Remove the cost: write the first test myself, or pair on it, so the next ones are copy and change.
5. Propose a short trial: one rule at the lower layer for two weeks, then compare run time and failures.
6. If there is still no agreement, take the layer rule to the team (retro, definition of done, review checklist), and record the decision. Keep one E2E happy path either way.

**Follow-ups:**
- *What if the developer is senior and the lead backs them?* I accept the decision, record the cost I expect, and bring numbers back later if it shows up.
- *Why not just write the E2E test and move on?* I do, as a stopgap, so the risk is covered. But every slow, vague test makes the pipeline worse for the whole team, so I still raise it.
- *Who owns integration tests?* The team does. In an SDET role I can write them myself, which usually ends the argument.

**Trap:** Quoting the pyramid as a rule ("Fowler says so"). A developer is convinced by their own run times and failure messages, not by a diagram. The other trap is turning it into a fight over the layer while the risk stays untested.

**Source:** Google Testing Blog, Just Say No to More End-to-End Tests: https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html ; Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html

### What should you not automate?

Topic: test-strategy | Standard | id: q0506

**Say:** I do not automate a check that runs once, a check where the expected result is a human judgement (does this look right, is this copy clear, is this flow pleasant), a feature that changes every week, or anything that costs more to keep stable than it saves. I also do not automate to look busy: a test I would delete when it fails is not worth writing. Exploratory work, first looks at new features, usability and visual taste stay manual. ISTQB lists "using a test tool when manual testing is more appropriate" as a risk of automation.

**Full process:** my filter, five questions. Automate when most answers are yes.
1. Will it run many times (every merge, every release)?
2. Is the expected result exact and machine-checkable?
3. Is the feature stable enough to survive a month?
4. Can the test be made deterministic (data, time, network)?
5. Is the cost of a miss high enough to justify the upkeep?
Output: a "keep manual or explore" list in the strategy, reviewed each quarter.

**Follow-ups:**
- *What about a bug that happened once?* Add a regression test at the lowest layer that catches it. That one is usually worth it.
- *And visual checks?* Visual regression works for stable pages if the noise is controlled (trackers, dynamic data). It is a tool for change detection, not taste.

**Trap:** "Automate everything that can be automated". The question is what should be, not what can be.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 6.2 (risks of test automation): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Why not 100% test automation?

Topic: test-manual | Core | id: q0507

**Say:** Because automation only checks what someone thought of in advance, and it checks it the same way every time. Testing shows the presence of defects, and finding the unexpected needs a person who learns while testing. Automated checks also have a price: writing, upkeep, flaky failures, and false confidence from a green run. Some things are bad targets: usability, one-time checks, fast-changing features. So I automate repeatable regression and checks with exact results, and I keep people for exploration, new features and judgement. The goal is the best mix, not the highest automation percentage.

**Full process:** how I would argue it to a manager who wants a number.
1. Ask what the percentage measures. "100% automated" counts test cases, not risk.
2. Show the cost: a test that costs two hours a month to keep stable and guards a low-risk path has a negative return.
3. Give a better target: "all critical flows have a fast automated check, exploratory sessions cover every new feature, flaky rate under X%".
4. Offer one number that matters: escaped defects per release.

**Follow-ups:**
- *And 100% code coverage?* Fowler: high coverage numbers are too easy to reach with low-quality testing, and he would be suspicious of 100%. Coverage helps find untested code, it does not measure test quality.
- *What does the human add that automation cannot?* Curiosity, the ability to notice what is odd without a rule for it, and judgement about whether the behaviour is acceptable to a user.

**Trap:** Answering "manual testing is dead" or "automation is always better". Both are slogans. Also do not apologise for liking exploratory testing: it is a skilled activity.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.3 and 6.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf ; Martin Fowler, Test Coverage: https://martinfowler.com/bliki/TestCoverage.html

### Is 100% code coverage a good target?

Topic: test-strategy | Standard | id: q0508

**Say:** No. Coverage tells you which lines no test ran. It does not tell you whether the tests check anything. If you make a number the target, people reach it with tests that run code and assert nothing. Fowler expects a high coverage in the upper 80s or 90s from teams that test thoughtfully, and says 100% smells of tests written to please the number. I use coverage to find untested code, then ask whether that code worries me. Better questions: how many bugs escape, and are developers afraid to change code?

**Follow-ups:**
- *Is there a better measure of test quality?* Mutation testing: change the code on purpose and see if tests fail. Example: using Stryker on a project to find tests that never fail.
- *Can you have too many tests?* Yes, when tests slow you down, for example when a small code change forces many test edits. That usually means duplicated or implementation-coupled tests.

**Trap:** Saying "more coverage is always better", or setting a gate like "no merge under 87%" without a reason. Brian Marick, quoted by Fowler: "I expect a high level of coverage. Sometimes managers require one. There's a subtle difference."

**Source:** Martin Fowler, Test Coverage: https://martinfowler.com/bliki/TestCoverage.html

### How do you decide which tests go into the regression suite, or pick 30 of 100 for a run?

Topic: test-design | Core | id: q0509

**Say:** By risk, with a second look at change impact. I rank tests by what a failure would cost (money, data, core flows, regulated behaviour), how often that area breaks, and what the current change touches. ISTQB names three ways to order tests: risk-based, coverage-based and requirements-based. For the 30, I take the smoke path, the tests close to the change, and the tests for areas with a history of defects. The other 70 run later, in the nightly or pre-release run. I also review the suite regularly and delete tests that no longer pay.

**Full process:** my selection on a release with a checkout change.
1. List what changed (diff, tickets). That is the impact area.
2. Tag every test by area, risk (high, medium, low) and layer.
3. Select: all smoke tests, all high-risk tests in the impact area, medium-risk tests that touch shared code, and tests for the last three production bugs.
4. Run those first. If they pass, release can proceed on a risk-accepted basis while the rest runs.
5. Record what was skipped and why, in the test report.

**Follow-ups:**
- *Where does a tag come from?* From the tracker or test files: a `@smoke` or `@checkout` tag, a folder, or a field in the test management tool.
- *Do you run the same 30 every time?* No. The pesticide effect applies: the same tests wear out, so rotate and add.

**Trap:** "I run them all". That is not a strategy, and it does not scale. The other trap is picking "the easiest 30".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.5 (test case prioritization): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the most significant testing strategy decision you have made?

Topic: test-strategy | Standard | id: q0510

**Say:** Example: end-to-end tests passed on a configuration that customers never saw, because the test environments had drifted from the production feature flags. The cheapest fix was not more tests but a guard: a read-only export of production flags, a CI job that compares production with the test environment and opens a comment on the merge request when they differ, and a second run with each new flag turned on for everyone. The outcome was that drift became visible in code review, and later false alarms were removed by checking flag usage before alerting. The lesson: a strategy decision can be about what the tests run against, not only which tests to write.

**Follow-ups:**
- *What was the risk of that decision?* The export endpoint exposes configuration, so make it token-protected and read-only, and with no token set it rejects every request.
- *How did you know it worked?* Mismatches showed up as comments in review, instead of surfacing later as unexplained failures.

**Trap:** Telling a tool story ("we moved to Playwright"). Pick a decision with a context, an alternative, and an outcome you can measure.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.2 (risk-based testing): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you keep the automation strategy consistent with the overall test strategy?

Topic: test-strategy | Standard | id: q0511

**Say:** I write down the rules that connect them: which layer a test goes to, what runs on every merge request and what runs nightly, what is out of scope for automation, and what counts as flaky. Then I make the rules checkable. For example, turn recurring review comments into ESLint rules, so a bad pattern fails automatically instead of being argued in every merge request. I also review the suite on a schedule: remove duplicates, remove dead helpers, and check that each test still maps to a risk.

**Follow-ups:**
- *How do you detect drift?* Metrics: pipeline time, flaky rate, tests per layer, escaped bugs. If the E2E share grows while escapes do not drop, the strategy has drifted.
- *Who owns the strategy when the team grows?* The team, with one named owner who runs the review.

**Trap:** An automation strategy that is a tool list. It should answer what to automate, where, and why.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.1 (plan adheres to the strategy): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How did you know your test strategy was working?

Topic: test-strategy | Standard | id: q0512

**Say:** I look for outcomes, not activity. Escaped defects per release go down. The pipeline stays fast and trusted, so developers do not ignore red. The flaky rate is measured and low. Releases do not need a long manual freeze. And people are not afraid to change code. I also check that every top risk has at least one test or review at the right layer. I do not report test case counts as success.

**Full process:** four numbers I would track.
1. Escaped defects: production bugs found per release, with the area. Source: tracker.
2. Defect detection percentage: bugs found before release divided by all bugs found before and after. ISTQB lists it as a defect metric.
3. Flaky rate: failed-then-passed runs divided by all runs, per suite. Source: CI.
4. Pipeline time to feedback, per stage.
Output: one weekly line, with a trend.

**Follow-ups:**
- *What is wrong with test case pass rate?* It measures execution, not coverage of risk, and it improves when you delete hard tests.
- *How do you handle a metric that gets gamed?* Pair it with a second one, for example flaky rate plus escaped bugs.

**Trap:** Quoting only coverage or test count.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.3.1 (test metrics): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf ; Martin Fowler, Test Coverage: https://martinfowler.com/bliki/TestCoverage.html

### How do you estimate the effort to test a feature or automate a set of scenarios?

Topic: test-strategy | Standard | id: q0513

**Say:** I break the work into small tasks, because small estimates are more accurate than large ones, and I say clearly that an estimate rests on assumptions. For a feature I use the team's history (the ratio of test effort to development effort on similar work) and a three-point estimate for the unknown parts: optimistic a, most likely m, pessimistic b, and E = (a + 4m + b) / 6. For automation I add setup, data, flake hardening and upkeep, which people forget. In scrum I estimate with planning poker as a team.

**Full process:** a three-point example.
1. Task: automate checkout coupon tests. a = 6 hours, m = 9 hours, b = 18 hours.
2. E = (6 + 4 x 9 + 18) / 6 = 10 hours.
3. SD = (b - a) / 6 = 2 hours, so I say "10 hours, plus or minus 2".
4. Add risk buffer for new test data work if the environment is not ready.

**Follow-ups:**
- *Which techniques does ISTQB name?* Ratios, extrapolation, Wideband Delphi (planning poker is a variant) and three-point estimation.
- *What if you are asked for a date too early?* I give the range, list the assumptions, and show which scope can move.

**Trap:** Giving one number with no assumptions.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What are the testing quadrants?

Topic: test-levels | Core | id: q0514

**Say:** The agile testing quadrants, from Brian Marick and used by Lisa Crispin, sort tests by two questions: is the test facing the business or the technology, and does it support the team or critique the product. Q1 is technology-facing and supports the team: unit and component tests. Q2 is business-facing and supports the team: functional tests, examples, API tests. Q3 is business-facing and critiques the product: exploratory, usability, user acceptance. Q4 is technology-facing and critiques the product: smoke and non-functional tests. I use it as a checklist to see which kind of testing is missing.

**Follow-ups:**
- *Is it a sequence?* No, it is a map, not an order.
- *Which quadrants are usually automated?* Q1, most of Q2 and Q4. Q3 is often manual.

**Trap:** Presenting it as a process. It is a way to talk to developers and business people about test types.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.7: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What are entry and exit criteria, and how do you decide when testing is done?

Topic: test-strategy | Standard | id: q0515

**Say:** Entry criteria are the preconditions to start a test activity, for example the build is deployed, smoke tests pass, test data and environment are ready. Exit criteria say what must be true to call the activity finished: planned tests run, coverage reached, no open critical or major defects, known issues listed. Testing is never "done" in the sense of "no bugs left". It is done when the exit criteria are met, or when time or budget runs out and the stakeholders have seen the risk and accepted it, which ISTQB explicitly allows. In agile, exit criteria often become the Definition of Done, and entry criteria the Definition of Ready.

**Full process:** exit criteria I would set for a release.
1. All planned high-risk tests executed, and every failure triaged.
2. Zero open critical or major defects; each remaining minor defect has an owner and a decision.
3. Smoke tests green on the release candidate build, not on an earlier build.
4. Regression suite green, or each failure explained as a known and accepted issue.
5. Risks and untested areas written down and accepted by the product owner.

**Follow-ups:**
- *What if the date arrives before the criteria?* I report which criteria are not met and what risk remains, and the decision belongs to the business. I do not move the criteria quietly.
- *Who decides to release?* The product owner or release manager decides. Give the evidence and a recommendation. State clearly whether independent go or no-go calls were made.

**Trap:** "Testing is done when we find no more bugs". That cannot be proven (testing shows presence, not absence of defects).

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What goes into a test completion (closure) report, and what do you do at test closure?

Topic: test-strategy | Standard | id: q0516

**Say:** At closure I do two things: make the useful testware available for later, and tell stakeholders the result. The test completion report has: a test summary, the evaluation of product quality against the original objectives and exit criteria, deviations from the plan, impediments and workarounds, metrics, unmitigated risks and defects not fixed, and lessons learned. I also close or move open defects to the backlog, archive test data and scripts, leave environments in an agreed state, and hold a short retrospective. In agile this happens at the end of each iteration and release in a lighter form.

**Follow-ups:**
- *Who reads it?* The release manager and product owner read the risks and not-fixed list. The team reads lessons learned.
- *What is the difference from a progress report?* A progress report is regular and covers the period (progress, blockers, new risks, plans). A completion report is one-off and judges the whole activity against exit criteria.

**Trap:** A report with only pass and fail counts. The part decision-makers need is the residual risk.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.4.1 and 5.3.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Test design techniques

### What is equivalence partitioning? Show a worked example.

Topic: test-design | Core | id: q0517

**Say:** Equivalence partitioning splits the possible values of an input into groups that the system should treat the same way. If one value from a group finds a bug, any other value from the group should find it too, so one test per group is enough. The groups must not overlap and must not be empty. I include invalid groups as well as valid ones. For an age field on a ticket form that accepts whole numbers 0 to 120, I get groups for 0 to 12 (child), 13 to 64 (adult), 65 to 120 (senior), below 0, above 120, and non-numbers. Six groups, six tests, instead of 121 values.

**Full process:** the example step by step, as I would say it at a whiteboard.
1. Read the rule. "Ticket price by age: 0 to 12 pays 5, 13 to 64 pays 10, 65 to 120 pays 6. Age is a whole number."
2. Valid partitions: P1 = 0 to 12, P2 = 13 to 64, P3 = 65 to 120.
3. Invalid partitions: P4 = below 0, P5 = above 120, P6 = not a whole number (letters, empty, 12.5).
4. One test per partition, picking a value from the middle: 6 -> price 5, 40 -> price 10, 80 -> price 6, -5 -> error, 150 -> error, "abc" -> error.
5. Coverage = partitions exercised divided by partitions found. Six of six is 100% EP coverage.
6. Note what EP does not give: the edges. For that I add boundary value analysis (next entry).
With multiple fields, "each choice" coverage means each partition of each field appears in at least one test. It does not cover combinations, so I add a decision table or pairwise for those.

**Follow-ups:**
- *What are partitions made of besides inputs?* Outputs, configuration, time-related values and interface parameters can all be partitioned.
- *What is the main purpose of EP?* To cut the number of tests while keeping coverage of every distinct behaviour. It is not to pick the values likely to fail (that is BVA).
- *What if the spec is silent on invalid input?* I ask. A missing rule for invalid input is itself a finding.

**Trap:** Testing three values from the same group and calling it thorough. Another trap: forgetting invalid groups.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.2.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is boundary value analysis? Show 2-value and 3-value with an example.

Topic: test-design | Core | id: q0518

**Say:** Boundary value analysis tests the edges of the ordered partitions, because developers most often make mistakes there: a less-than written instead of less-or-equal, a boundary shifted by one, or missing. With 2-value BVA, each boundary gives two tests: the boundary value and its closest neighbour in the next partition. With 3-value BVA each boundary gives three: the value and both neighbours. For the ticket age field the boundaries are 12 and 13, 64 and 65, plus 0 and 120 at the ends. 3-value is stricter, and it catches bugs 2-value can miss.

**Full process:** the age example, with the table I would write.
1. Partitions (ordered): below 0 | 0 to 12 | 13 to 64 | 65 to 120 | above 120.
2. Boundary values: 0, 12, 13, 64, 65, 120 (and the outer edges of the invalid groups: -1, 121).
3. 2-value BVA tests: -1 and 0; 12 and 13; 64 and 65; 120 and 121. Expected: error, price 5; price 5, price 10; price 10, price 6; price 6, error.
4. 3-value BVA adds the other neighbour: 1; 11; 14; 63; 66; 119. These are not boundary values themselves.
5. Why 3-value matters, from the ISTQB syllabus: if the rule `x <= 10` is wrongly coded as `x = 10`, the 2-value tests x = 10 and x = 11 both give the expected result, so the bug hides. x = 9 from 3-value fails and exposes it.
6. For floating-point or money fields, decide the smallest step (0.01) before choosing neighbours.

**Follow-ups:**
- *Can BVA be used on unordered data?* No. It needs ordered partitions, because "between" must make sense.
- *Which boundaries do testers forget?* Dates and time (end of month, DST change, midnight), string length, file size, list size (0, 1, many, max) and counts such as "3 failed logins".
- *Is BVA only for numbers?* No. A list with 0, 1 and the max number of items is a boundary test too.

**Trap:** Testing only the exact boundary value and not its neighbour. The bug is usually "off by one", and you only see it on the other side.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is decision table testing? Show a worked example.

Topic: test-design | Core | id: q0519

**Say:** A decision table is for rules where several conditions combine to give different outcomes. The conditions and actions are rows, and each column is one combination of condition values with its expected actions. You test every feasible column, so no combination is forgotten. It also finds gaps and contradictions in the requirements, because while filling the table you find combinations the spec never mentions. The cost is that the number of columns doubles with each new condition, so for many conditions I minimise the table or choose columns by risk.

**Full process:** an example with three conditions.
1. Rules from the spec: members get 5% off. A valid coupon gives 10% off. Coupon and member discount cannot be combined: the member discount stays and the coupon is rejected. Orders of 100 or more ship free.
2. Conditions: C1 member, C2 total at least 100, C3 valid coupon. Actions: A1 5% off, A2 10% off, A3 free shipping, A4 coupon rejected.
3. Full table, 2 x 2 x 2 = 8 columns (T = true, F = false, X = action happens):

| | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 |
|---|---|---|---|---|---|---|---|---|
| C1 member | T | T | T | T | F | F | F | F |
| C2 total >= 100 | T | T | F | F | T | T | F | F |
| C3 valid coupon | T | F | T | F | T | F | T | F |
| A1 5% off | X | X | X | X | | | | |
| A2 10% off | | | | | X | | X | |
| A3 free shipping | X | X | | | X | X | | |
| A4 coupon rejected | X | | X | | | | | |

4. Eight columns, eight tests. I cannot merge columns here, because C2 changes shipping and C1 and C3 change the discount, so no condition is irrelevant everywhere.
5. What the table found: the spec does not say whether a coupon is rejected with a message, or silently ignored (A4). Ask the product owner. That is a requirement defect found before any code runs.

**Follow-ups:**
- *What do "-" and "N/A" mean in a table?* "-" means the condition does not affect the outcome and lets you merge columns. "N/A" means the combination is impossible.
- *What is the coverage?* Executed feasible columns divided by all feasible columns.
- *When do you not use it?* For a single field or a pure range (use EP and BVA), or for sequences over time (use state transition).

**Trap:** Writing only the happy column and one negative. The point is the combinations.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is state transition testing? Show a worked example.

Topic: test-design | Core | id: q0520

**Say:** State transition testing is for behaviour that depends on history: the system is in a state, an event happens, and the next state depends on both. I draw the states and transitions, or better a state table with states in rows and events in columns, so the empty cells show the invalid transitions. A test is a sequence of events and the states it produces. Coverage levels are: all states, all valid transitions (0-switch), and all transitions including attempts at invalid ones. Good examples are an order lifecycle, a subscription, and a login with lockout.

**Full process:** a login with lockout after three bad passwords for 15 minutes.
1. States: S0 normal, S1 one failure, S2 two failures, S3 locked.
2. Events: bad password, good password, 15 minutes pass, reset link used.
3. State table (blank means no transition or not allowed):

| State | bad password | good password | 15 min pass | reset link |
|---|---|---|---|---|
| S0 | S1 | S0, logged in | | |
| S1 | S2 | S0, logged in, counter reset | | |
| S2 | S3, "account locked" email | S0, logged in, counter reset | | |
| S3 | S3 | S3, rejected even with the right password | S0 | S0 |

4. Valid transitions: 8 (counting the S3 self-loops as separate checks, 10). 0-switch coverage means one step through each.
5. A sequence test that finds a classic bug: bad, bad, good, bad, bad. The user must not be locked, because the good login reset the counter. A system that never resets locks on the fourth attempt overall, because it counts the third bad password.
6. A test for an invalid transition: in S3 enter the right password and expect rejection. Test one invalid transition per test case, so a failure does not mask another.

**Follow-ups:**
- *Why a state table over a diagram?* The table shows invalid transitions as empty cells, so you remember to test them.
- *Where else do you see states in a web app?* Order status, ticket status, payment status, a wizard, a toggle with loading and error states, and websocket connection (connected, reconnecting, offline).

**Trap:** Testing each state once and each event once. The bugs are in the sequences and in the transitions nobody drew.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.2.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is pairwise (combinatorial) testing and when do you use it?

Topic: test-design | Standard | id: q0521

**Say:** Pairwise testing covers every pair of values of any two parameters, instead of every full combination. It works because research by NIST found that most failures are caused by one or two parameters, with progressively fewer by three or more. I use it for configuration-style inputs, like browser, operating system, language and plan type, where a full matrix explodes. A tool generates the set. Pairwise does not cover rules where the outcome depends on a specific combination of three or more values, so for business rules I use a decision table.

**Full process:**
1. List parameters and values: browser (Chrome, Firefox, Safari), device (desktop, phone), language (en, pl), plan (free, paid).
2. Full matrix: 3 x 2 x 2 x 2 = 24 tests.
3. Generate a pairwise set with a tool such as NIST ACTS, or an online generator. Typically about 6 to 8 tests cover every pair.
4. Add the known-risky combinations by hand (Safari on phone with Polish and a paid plan) and run them.
5. NIST also recommends higher-strength coverage (4-way to 6-way) where assurance needs are high.

**Follow-ups:**
- *What are its limits?* It does not know your business rules, and constraints between values (Safari only on Apple devices) must be defined, or you test impossible combinations.

**Trap:** Saying pairwise "tests everything". It cuts tests by assumption about how failures happen.

**Source:** NIST, Combinatorial Testing: https://www.nist.gov/programs-projects/combinatorial-testing ; NIST CSRC, Interactions involved in software failures: https://csrc.nist.gov/projects/automated-combinatorial-testing-for-software/combinatorial-methods-in-testing/interactions-involved-in-software-failures

### What are error guessing and checklist-based testing?

Topic: test-design | Standard | id: q0522

**Say:** Both are experience-based techniques. In error guessing the tester uses knowledge of how software usually fails to try inputs and situations where defects are likely: empty values, very long strings, special characters, double clicks, expired sessions, divide by zero. In checklist-based testing the tester works through a list built from experience and from why software fails, so important things are not forgotten. A good checklist has no items a script could check, nothing that belongs in exit criteria, and nothing too general. These techniques complement the formal ones, they do not replace them.

**Follow-ups:**
- *Which technique fits "correct input not accepted, incorrect input accepted, wrong output format, division by zero"?* Error guessing, since that is a list of typical faults and the tester builds tests from it.
- *What is the main difference between black-box techniques and experience-based techniques?* Black-box techniques derive tests from specifications and models (EP, BVA, decision tables, state transitions). Experience-based techniques derive them from the tester's skill, intuition and knowledge of past defects.

**Trap:** Calling error guessing "random clicking". It is systematic if it is based on a defect history.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.4.1 and 4.4.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What are statement coverage and branch coverage, and what do they tell you?

Topic: test-design | Standard | id: q0523

**Say:** Statement coverage is the percentage of executable statements that tests ran. Branch coverage is the percentage of decision outcomes tests ran, so for each `if` both the true and the false way. Branch coverage is stronger: 100% branch coverage implies 100% statement coverage, but not the other way. For `if (x > 0) { y = 1 }` one test with x = 5 gives 100% statement coverage and 50% branch coverage, because the false path never ran. Coverage shows which code tests never touched. It does not show that the tests check anything.

**Follow-ups:**
- *Who uses this?* Developers at component level, mostly. A QA engineer should know it to review unit tests and to talk about coverage numbers sensibly.
- *Does 100% branch coverage mean no bugs?* No. Missing code (a missing branch) cannot be covered, and assertions may be weak.

**Trap:** Treating coverage as quality. See the coverage entry above.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.3.1 and 4.3.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between black-box, white-box and grey-box testing?

Topic: test-levels | Core | id: q0524

**Say:** Black-box testing derives tests from the specification and behaviour, without looking at the implementation. White-box testing derives tests from the code or structure: statements, branches, data flows. Grey-box is in between: do not read the code line by line, but use some internal knowledge, such as the database schema, the API calls behind a screen, or logs, to design better tests and to check the real result, for example whether the record in the database matches what the UI shows. Most work is black-box and grey-box. White-box knowledge helps when reviewing unit tests.

**Follow-ups:**
- *Which one is better?* Neither. They find different defects. ISTQB says white-box can support black-box by showing which structure the black-box tests missed.
- *Are they test levels?* No. They are test types and can be applied at every test level.

**Trap:** Saying black-box is "manual" and white-box is "automated". Both can be either.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between a test scenario, a test case and a checklist? When do you use each?

Topic: test-design | Standard | id: q0525

**Say:** A test scenario is a short statement of what to test, like "user pays with an expired card". A test case is the detailed version: preconditions, steps, data and expected result. A checklist is a list of conditions to verify with no steps. I use test cases for complex or regulated logic where steps and exact data matter, and for anything someone else must repeat. I use scenarios and checklists for fast-changing features and for experienced people, because detailed cases go out of date quickly and cost a lot to maintain. Exploratory testing charters sit next to these for learning work.

**Follow-ups:**
- *What makes a good test case?* One clear purpose, a specific expected result, independent of other cases, data stated, traceable to a requirement or risk, and easy to read for someone new.
- *Where do you keep them?* In a test management tool or in the same repository as the code for automated ones. See the test management entries.

**Trap:** Writing a test case with eight steps and four checks. When it fails you do not know which part failed.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.4.1 and 4.4.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What does a good test case look like? Show one.

Topic: test-design | Standard | id: q0526

**Say:** A good test case has one purpose, its own data, a precondition, a short list of steps, and an expected result that someone can check without guessing. It does not depend on another test. It has a title that tells you what failed when it fails. And it links to the requirement or risk it covers.

**Full process:** one written example.
1. Title: "Checkout rejects an expired coupon and keeps the cart total."
2. Preconditions: logged-in customer with a cart worth 120; coupon SAVE10 expired yesterday.
3. Steps: open the cart; enter SAVE10; apply.
4. Expected: an error "This coupon has expired" is shown next to the field, the total stays 120, no discount line appears, and the coupon field keeps its text.
5. Trace: coupon rule "expired coupons are rejected".
6. Data note: create the coupon in setup with a past expiry date, so the test does not depend on the calendar.

**Follow-ups:**
- *Positive or negative first?* The happy path first, then negatives, then non-functional, as ISTQB suggests for acceptance tests.

**Trap:** Expected result like "works correctly". It cannot fail.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.4.1 and 4.5.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What negative test cases would you write for a GET API?

Topic: test-design | Standard | id: q0527

**Say:** I think in groups: authentication and authorisation, input validation, the resource state, and the contract of the error. Missing or expired token should give 401. A valid token without permission should give 403. A resource that does not exist should give 404. A bad ID format or bad query parameter should give 400 or 422. Very large page sizes, negative offsets and SQL or script characters in filters must be handled safely. A wrong method should give 405. In every case the error body should be consistent and must not leak internals, such as a stack trace.

**Full process:** with Playwright's request API, a short example for a users endpoint.

```ts
import { test, expect } from '@playwright/test';

test.describe('GET /api/users/:id negative cases', () => {
  test('no token is rejected', async ({ request }) => {
    const res = await request.get('/api/users/1', { headers: { Authorization: '' } });
    expect(res.status()).toBe(401);
  });

  test('unknown id gives 404 with a JSON error', async ({ request }) => {
    const res = await request.get('/api/users/999999999');
    expect(res.status()).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });

  test('malformed id gives 400 and no stack trace', async ({ request }) => {
    const res = await request.get('/api/users/abc');
    expect(res.status()).toBe(400);
    expect(await res.text()).not.toMatch(/^\s+at /m);
  });

  test('page size above the maximum is rejected or capped', async ({ request }) => {
    const res = await request.get('/api/users?limit=100000');
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      expect((await res.json()).items.length).toBeLessThanOrEqual(100);
    }
  });
});
```

The URLs, header and the cap of 100 are my assumptions for this example. I read the real contract first and pin the exact status the API documents.

**Follow-ups:**
- *Why not assert only the status code?* A 200 with the wrong body or a leaked secret is still a bug.
- *Where does this belong in the pyramid?* API layer. It is cheap and covers what the UI cannot easily trigger.

**Trap:** Only testing 404.

**Source:** Playwright, API testing: https://playwright.dev/docs/api-testing ; HTTP semantics, RFC 9110 status codes: https://www.rfc-editor.org/rfc/rfc9110.html#name-status-codes

### What is a test oracle, and how do you know the expected result?

Topic: test-design | Standard | id: q0528

**Say:** A test oracle is how you decide whether the result is correct. Sources are the specification and acceptance criteria, a previous version of the product, a similar product, a calculation done another way, a domain expert, user expectations, or consistency within the product. When there is no written spec, I combine several sources and I ask the product owner about the gaps. When the oracle is weak, I say so in the bug report ("this seems inconsistent with the other screen") rather than claiming a defect with certainty.

**Follow-ups:**
- *What about AI output?* It has no exact oracle. A good rule is to assert on the UI that always renders and on structured facts, not on the wording of an AI reply.
- *What is the "oracle problem"?* For some systems you cannot cheaply compute the correct answer. Then you test properties (the total equals the sum of lines) instead of exact values.

**Trap:** Using the application's own output as the expected value in an automated test. The test then proves nothing.

**Source:** ISTQB Glossary (test oracle, test basis): https://www.erikvanveenendaal.nl/site/wp-content/uploads/ISTQB-Glossary-Foundation-V4.1-2023.pdf ; ISTQB CTFL v4.0.1, section 1.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Which test technique do you use when the requirements are incomplete, or time is short?

Topic: requirements | Core | id: q0529

**Say:** Exploratory testing, usually in time-boxed sessions with a charter. ISTQB says it is useful when specifications are few or inadequate, or when there is significant time pressure, and it works best with an experienced tester who knows the domain. I combine it with a risk list so the time goes to the areas that matter most, and I record what I learned as new test ideas or acceptance criteria. I also ask questions early, since each answer removes a guess.

**Follow-ups:**
- *What do you do with what you find?* Turn stable findings into written criteria and automated checks, and raise open questions with the product owner.

**Trap:** "I wait for the requirements." Time keeps moving, and the product owner often does not know the answer until they see the behaviour.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.4.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you test data-driven scenarios with large data sets?

Topic: test-design | Standard | id: q0530

**Say:** I separate the test logic from the data, and I choose which data is worth running. I do not run every row. I pick rows by technique: equivalence classes, boundaries, and a few known problem records. In code, I keep the data in a typed list or a CSV or JSON file next to the test, and generate one test per row. For very large sets I run a sample on every merge and the whole set nightly.

**Full process:** a Playwright parameterised test.

```ts
import { test, expect } from '@playwright/test';

const cases = [
  { age: 0, price: 5 },
  { age: 12, price: 5 },
  { age: 13, price: 10 },
  { age: 64, price: 10 },
  { age: 65, price: 6 },
  { age: 120, price: 6 },
];

for (const { age, price } of cases) {
  test(`ticket price for age ${age} is ${price}`, async ({ request }) => {
    const res = await request.get(`/api/price?age=${age}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).price).toBe(price);
  });
}
```

The endpoint is invented for the example. The rows are the boundary values from the age example, so the data table doubles as the design document.

**Follow-ups:**
- *Why does each row get its own test name?* A failure then names the row that broke.

**Trap:** Loading 10,000 rows into one test, so one failure hides the rest.

**Source:** Playwright, Test parameterization: https://playwright.dev/docs/test-parameterize

## "Test this" exercises: login, elevator, pencil, checkout

### How do you answer a "test this object or feature" question in an interview?

Topic: test-design | Standard | id: q0531

**Say:** I do not start listing test cases. I start with questions: who uses it, what is it for, what are the rules, what can go wrong for them, what is out of scope. Then I name the risks, group the tests by quality area (function, input, state, errors, security, usability, accessibility, performance, compatibility), and apply techniques: partitions and boundaries for inputs, a decision table for rules, a state model for anything with history. I say which ones I would automate and where, and which I would explore by hand. Last, I say what I would not test and why. The interviewer is judging the method more than the list.

**Full process:** the order I follow, every time. About 5 minutes spoken.
1. Clarify the goal and the user. Ask 3 to 5 questions and state assumptions aloud.
2. Name the top three risks (money, data, safety, reputation).
3. Split into areas: functional, inputs, states and sequences, errors and recovery, security, usability and accessibility, performance, compatibility.
4. Pick techniques per area: EP and BVA for fields, decision table for rules, state transitions for flows.
5. Say the layers: what is a unit or API test, what is one E2E test, what is exploratory.
6. Say what is out of scope and the question you would ask the product owner.
7. Finish with the first five tests you would run, to show prioritisation.

**Follow-ups:**
- *What if the interviewer says "no more questions, just test it"?* I state my assumptions in one sentence and carry on. Making assumptions explicit is the skill.
- *How long should the list be?* Short and ordered by risk. A long flat list shows no prioritisation.

**Trap:** A flat list of 40 ideas with no questions, no risk order and no layers.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.4.1 (test analysis and design) and 4.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How would you test a login page?

Topic: test-design | Standard | id: q0532

**Say:** First questions: username or email, password rules, remember me, social login, lockout, two-factor, password reset. Top risks: someone who should not get in does, someone who should get in cannot, and credentials leak. Then I cover groups: valid login, invalid credentials with a generic message that does not reveal which part was wrong, field validation with boundaries, lockout after repeated failures as a state transition, session behaviour (cookie flags, logout, expiry, back button), security basics (HTTPS, no password in URL or logs, rate limiting), accessibility (labels, keyboard, error announcement), and compatibility. I automate one E2E happy path plus a few API-level checks for the rules, and I explore the rest.

**Full process:** my test list for the first pass, by group, with expected outcomes.
1. Happy path: valid email and password lands on the right page, session cookie is set with Secure and HttpOnly flags (check with devtools or a response header assertion).
2. Invalid credentials: wrong password, unknown user, both gives the same generic message and similar response time. Why: no account enumeration.
3. Validation: empty fields; email without "@"; email with spaces around it; very long email (255 and 256 characters); password at its minimum and maximum length; Unicode and special characters; paste with trailing space.
4. Lockout (state table): 3 bad passwords locks for 15 minutes; a good login after 2 bad ones resets the counter; locked account rejects even the right password; unlock by wait or by reset link.
5. Session: logout ends the session on the server, the Back button does not show private pages, a session expires after idle time, two tabs behave sanely, "remember me" lasts as specified.
6. Password reset: link works once, expires, a second request invalidates the first, the message does not reveal if the email exists.
7. Security basics: SQL and script characters in fields are handled safely; brute force is rate limited; password is not in the URL, logs or the network trace in readable form where it should not be; HTTP redirects to HTTPS.
8. Accessibility: fields have labels, the error is announced to a screen reader and linked to the field, the whole form works with keyboard only, focus order is logical.
9. Compatibility: password managers fill it; autofill; mobile keyboard types (email keyboard, no auto-capitalise).
10. Third-party sign-in if present: denied consent, cancelled flow, an account with the same email.

A Playwright smoke test for step 1, using role locators:

```ts
import { test, expect } from '@playwright/test';

test('a valid user signs in and lands on the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
```

Labels, names and the URL are placeholders. The credentials come from environment variables, not from the code.

**Follow-ups:**
- *Which of these are API tests?* Lockout counters, rate limiting and the error responses. Only the happy path and a couple of UI behaviours need the browser.
- *What would you not test in the UI?* Every wrong-password variant. One UI check, many API checks.

**Trap:** Only "valid and invalid login". Stopping before lockout, session, reset and accessibility is the junior answer.

**Source:** OWASP Web Security Testing Guide, authentication and session testing: https://owasp.org/www-project-web-security-testing-guide/ ; Playwright, Locators: https://playwright.dev/docs/locators

### How would you test an elevator? (And two lifts in sync in a four-floor building?)

Topic: test-design | Standard | id: q0533

**Say:** I would start by asking what we are testing: the control software, the whole elevator, or the user experience. Then I list the risks: safety first (door closes on a person, falls, overload, stops between floors, fire), then correctness (goes to the right floor, serves requests in a sensible order), then usability (buttons, display, sound, accessibility for wheelchair users and the blind), then performance (waiting time, many requests at once), then failure handling (power loss, sensor fault). For two lifts in sync on four floors, I test the dispatch logic as a state machine: which lift answers a call, what happens when both are called, when one fails, and that they do not both go to the same call.

**Full process:** how I would structure it aloud.
1. Questions: single or group control, capacity, floors 0 to 3, any VIP or fire mode, is there a spec.
2. Safety (highest risk): door sensor stops closing when blocked; the door never opens between floors; overload (above rated weight) refuses to move and warns; the emergency stop and alarm work; fire mode sends the lift down and stops normal calls.
3. Functional with EP and BVA: floors 0, 1, 2, 3 are valid; there is no floor -1 or 4; pressing the current floor opens the door; pressing a button twice is one request; the top-floor "up" call and the ground-floor "down" call do not exist.
4. State model: idle, moving up, moving down, doors opening, doors open, doors closing. Events: call, floor button, arrive, timeout, overload. Test invalid transitions: a floor button pressed while the doors are closing; a call pressed mid-travel.
5. Two lifts in sync (decision table): conditions are call direction, position of each lift, direction of each lift, whether one lift is out of service. Action is which lift responds. Check the nearest idle lift answers; a lift moving the same way and passing the floor answers; if one lift is out of service the other takes all calls; never two lifts for the same call.
6. Concurrency: calls from all four floors at once; 20 button presses in a second; a call at the moment a lift arrives.
7. Non-functional: waiting time under load; noise and ride smoothness; display and voice announcements; accessibility (braille buttons, height, announcements).
8. Failure: power cut during motion (the brake holds, it goes to the nearest floor on restart); communication loss between the two controllers (each lift keeps working alone).

**Follow-ups:**
- *What would you automate?* The dispatch logic in a simulator: thousands of random call sequences, with checks such as "no call waits more than N seconds" and "no two lifts get the same call". Safety checks stay as formal inspections and physical tests.
- *What is the first test?* The door sensor. It is the safety risk with the highest impact.

**Trap:** Listing buttons to press. A senior answer puts safety first and models the behaviour as states and rules.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.2.3 and 4.2.4 (decision tables, state transitions): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How would you test a pencil?

Topic: test-design | Standard | id: q0534

**Say:** The point of this question is to see how I think, so I ask first: who uses it (a child, an artist, an office), what is it for, and what standard applies. Then the areas. Function: it writes, with a clear line, on different papers, and it erases. Quality: the lead does not break when writing or in a drop, the wood sharpens cleanly, the eraser removes without smearing. Safety: non-toxic paint and materials, no splinters, the eraser is not a choking hazard for a young child. Usability: grip and length, comfortable for a long writing session. Durability and environment: heat, humidity, a bag. Also cost and packaging. I would also do some exploratory play, like writing at odd angles, since that finds real defects.

**Full process:** tests grouped by area, with a measurable check each.
1. Function: write a line of 100 metres on standard paper and measure darkness and width; write on glossy, recycled and cardboard paper; erase and check that no mark remains.
2. Reliability: sharpen 20 times with a standard sharpener and check the lead does not break; drop the pencil from 1 metre onto a hard floor 10 times, then sharpen and check for internal lead breaks.
3. Safety: lab check of paint for toxic substances (a standard for children's goods applies); the end cap and eraser cannot detach under a pull force.
4. Usability: 10 people write for 15 minutes, with a short questionnaire on grip and comfort.
5. Environment: 40 degrees and 90% humidity for a week, then check warping and the glue; freezing temperatures.
6. Compatibility: fits common sharpeners and mechanical pencil holders, if it is claimed to.
7. Edge: left-handed use, writing upside down, very hard pressure, a very light touch.

**Follow-ups:**
- *Which test is the highest risk?* Safety for children, because the impact is largest, and a recall or injury ends the product.
- *How do you know it is "good enough"?* From the spec and the market: a darkness grade (HB), a lifetime of writing, and user satisfaction, defined before testing.

**Trap:** Answering "I write with it and see". Name the users, the standard, the risks and measurable checks.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.4.1 (test analysis and design: what to test, how to test): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How would you test a checkout flow?

Topic: test-design | Standard | id: q0535

**Say:** Checkout is the highest-risk flow in a shop: money, personal data and trust. I would ask about payment providers, countries and currencies, taxes, shipping options and the order state model. Risks first: wrong price, a double charge, a paid order that is lost, a failed payment that still creates an order, personal data leaked. Then coverage: price rules as a decision table, address and card fields by partitions and boundaries, order and payment states, and failure paths such as declined cards, timeouts and the user pressing Back or refreshing. Most checks are API-level; I keep one E2E test per payment method and the main failure path. I also run exploratory sessions on money flows, and I check accessibility and mobile.

**Full process:** the test areas, in the order I would run them.
1. Cart and price rules (API and unit): quantity limits, discounts and coupons as a decision table, taxes and rounding (check totals to the cent for many items), currency conversion.
2. Address and contact fields: required fields, postal code formats per country, name with apostrophe and non-Latin letters, long values, paste, autofill.
3. Shipping options: availability per country, price per weight band (boundary values), cut-off times for same-day delivery.
4. Payment, happy paths: each supported method in the provider's test mode (card, wallet, bank transfer). Check the order exists once, amount and currency match, and the confirmation email contains the right data.
5. Payment, failure paths: declined card, insufficient funds, authentication (3-D Secure) abandoned, provider timeout, provider returns success after the user left (webhook arrives later). The order must end in a clear state, with no charge without an order and no order without a charge.
6. Idempotency: double click on "Pay", refresh after submit, resend of the same request. One charge only.
7. State and sessions: Back button after payment, expired cart price (the price changed while in the cart), stock sold out during checkout, two browser tabs.
8. Security and privacy: HTTPS, card data never stored or logged by us, someone cannot see another user's order by changing an ID in the URL (broken access control), coupon cannot be reused.
9. Accessibility and usability: whole flow by keyboard, errors announced and linked to fields, readable on a phone, a guest checkout path.
10. Non-functional: load on the payment step during a sale, slow network behaviour, tracking events fired once.
11. Compatibility: three browsers and at least one real phone for payment pages with redirects.

**Follow-ups:**
- *How do you test payments without charging real cards?* The provider's sandbox and test cards. Real-money checks are a small manual smoke test after release, agreed with the business.
- *What do you automate?* Price rules, API contract, one happy path per payment method, one failure path. Everything money-related that is deterministic.
- *What would worry you most?* A webhook that arrives late or twice. Orders and payments are two systems that must agree.

**Trap:** Testing only "add to cart, pay, see confirmation". Real checkout bugs live in failure paths and in the disagreement between payment and order.

**Source:** OWASP Web Security Testing Guide, business logic and authorization testing: https://owasp.org/www-project-web-security-testing-guide/ ; OWASP Top 10:2025 (A01 Broken Access Control): https://owasp.org/Top10/2025/

### How would you test a search box?

Topic: test-design | Standard | id: q0536

**Say:** I would ask what it searches (products, tickets, users), whether it is exact or fuzzy, and how results are ranked. Risks: wrong or missing results, slow results, and injection. Then groups: empty and one-character queries; long queries; special characters and Unicode (accents, Polish letters, emoji); case and whitespace; multiple words; typos; pagination and sorting; filters combined with the query; no results page; the same query with different permissions (a user must not see other tenants' data); and speed on a big data set. I check search-as-you-type for race conditions, where an older slow response overwrites a newer one.

**Follow-ups:**
- *What is the classic automation trap?* Asserting on result order or count in shared data. Create your own data with a unique term and search for it.
- *Where would you test ranking?* At API or unit level, with a fixed index.

**Trap:** Only testing a word that exists.

**Source:** OWASP Web Security Testing Guide (input validation testing): https://owasp.org/www-project-web-security-testing-guide/

### How do you approach testing a new feature?

Topic: web-testing | Core | id: q0537

**Say:** I start before there is code. I read the story and ask what problem it solves, who uses it, and what the acceptance criteria are, and I look for ambiguity. I join the refinement and write down questions and risks. When the first build is ready, I do a short exploratory session to learn how it behaves, and then I decide the checks: lower-level tests I ask developers to cover, API checks, one E2E flow, and the manual areas such as usability and accessibility. I test the happy path, the negative paths, the boundaries, and what the feature touches around it. Before closing, I check the bug list, update the regression suite, and write what I did not cover.

**Full process:**
1. Refinement: acceptance criteria written as examples; open questions listed; risks named.
2. Test design: techniques per rule (partitions, decision table, state model); data needs; environment needs.
3. First build: exploratory session of 45 to 60 minutes with a charter; log bugs and new questions.
4. Automate what is stable and valuable, at the cheapest layer.
5. Regression check on neighbouring features, based on what the change touches.
6. Sign-off note: what was tested, what was not, known issues.

**Follow-ups:**
- *Who writes the unit tests?* Developers. I review them and suggest cases, such as boundaries.
- *What if the feature is behind a flag?* I test with the flag on and off, since both states reach production.

**Trap:** "I wait for the feature to be finished." By then the cheapest defects are gone.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.4.1, 2.1.5 and 5.1.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Test levels and types

### What are the test levels, and what is the difference between unit, integration, system and acceptance testing?

Topic: test-levels | Core | id: q0538

**Say:** ISTQB names five levels. Component (unit) testing checks one piece in isolation, usually by developers. Component integration testing checks the interfaces and interaction between components. System testing checks the whole product end to end for functions and quality characteristics, often by an independent test team. System integration testing checks the interfaces to other systems and external services, in an environment close to production. Acceptance testing checks that the system meets the business need, ideally with the intended users. Levels differ by test object, objective, test basis, typical defects and who is responsible.

**Follow-ups:**
- *Is E2E a level?* No. "End-to-end" describes a test that goes through the whole path. It usually runs at system or system integration level, and many teams also call it acceptance.
- *Who owns which level?* Developers own the lowest two, a test team the middle two, and the business the last, with QA helping.

**Trap:** Mixing up levels and types. A level is where in the build you test. A type is what quality you test (function, performance, security).

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between functional and non-functional testing? Give examples.

Topic: test-levels | Core | id: q0539

**Say:** Functional testing checks what the system does: its functions, correct and complete. Non-functional testing checks how well it does it. The ISO 25010 list used by ISTQB is performance efficiency, compatibility, usability, reliability, security, maintainability, portability and safety. A login that works is functional. A login that takes 8 seconds under load, fails in Safari, or cannot be used with a screen reader is a non-functional problem. Both can be tested at all levels, and non-functional tests are best started early, since late discovery of non-functional defects can threaten a project.

**Follow-ups:**
- *Give a cheap early non-functional check.* A performance assertion in a component test, an accessibility scan in CI, a lint rule for security-sensitive code.
- *Which non-functional types have you done?* Accessibility with screen readers and keyboard, performance baselines for GraphQL APIs with JMeter, compatibility across browsers and devices, and security basics such as role permissions.

**Trap:** Thinking non-functional means "performance only".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between smoke, sanity and regression testing?

Topic: test-levels | Core | id: q0540

**Say:** A smoke test is a small, fast check of the main functions to see if a build is stable enough to test further. If it fails, we stop and send the build back. A regression test checks that a change did not break something that worked before, and it is wide. Sanity testing is the one with confusing definitions. The ISTQB glossary lists "sanity test" as a synonym of smoke test. In common practice many teams use it for a narrow check after a small change or bug fix, to see that the change makes sense before deeper testing. So I say: smoke is broad and shallow on the whole build, sanity is narrow and focused on the change, and regression is broad and deep over what already existed. I also say that the terms vary by team, so I define them at the start of a project.

**Full process:** how this looks in a pipeline.
1. On every build: smoke suite, 5 to 10 tests of the core flows, a few minutes. Failed means the build is rejected.
2. After a hotfix: sanity check of the fixed area plus the closest neighbours, then smoke.
3. Before release: full regression, with the risk-based selection described earlier, plus exploratory sessions on new features.

**Follow-ups:**
- *Is a smoke test automated?* Almost always, because it runs on every build.
- *Smoke test versus regression test in one sentence?* Smoke asks "is the build worth testing", regression asks "did the change break what worked".

**Trap:** Claiming one strict definition of sanity as if it were official. The official glossary says the opposite of the popular split, so say both.

**Source:** ISTQB Glossary (smoke test, regression testing), Foundation V4.1: https://www.erikvanveenendaal.nl/site/wp-content/uploads/ISTQB-Glossary-Foundation-V4.1-2023.pdf ; ISTQB CTFL Syllabus v4.0.1, section 2.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between retesting (confirmation testing) and regression testing?

Topic: test-levels | Standard | id: q0541

**Say:** Confirmation testing, also called retesting, checks that a specific defect is fixed: I run the test that failed, or the steps that reproduced it, again. Regression testing checks that the change, including the fix, did not break something else, in the same component or elsewhere. I do confirmation first and regression after. Regression suites grow with each release, so they are the best candidate for automation. Before choosing the scope I do an impact analysis, to see what the change could reach.

**Follow-ups:**
- *Who should retest a fix?* ISTQB prefers the person who found the defect, because they know exactly what they saw.
- *How wide should regression be?* By risk and impact: the area, its dependencies, and the core flows.

**Trap:** Using the words as synonyms.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### You ran 10 tests and 5 failed. Do you rerun the whole regression or only the failed tests?

Topic: test-levels | Standard | id: q0542

**Say:** First I find out why they failed. Rerunning blindly hides the answer. I look at the failures, group them by cause (product bug, test bug, environment, data, flaky), and report real bugs. When a fix arrives, I rerun the failed tests for confirmation, then a regression set chosen by what the fix touches, plus the smoke suite. A full rerun is worth it when the fix is in shared code or the risk is high. I do not hide flakiness with retries: if a test passes on rerun, I note the flaky failure and root-cause it later.

**Full process:**
1. Triage each failure from logs, trace and screenshots; classify it.
2. File defects for product bugs; fix tests and data for the rest.
3. After the fix build: rerun the 5 failed tests, then the tests for the area and its neighbours.
4. If the fix changed shared code, run the full suite.
5. Report: what was rerun and why that scope.

**Follow-ups:**
- *Is a retry setting a good idea?* Only for a named test, with a reason. A global retry hides flakiness.

**Trap:** "Rerun until green".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### A production issue needs validation, but the full regression takes hours. What do you do?

Topic: test-levels | Standard | id: q0543

**Say:** I do not run all of it. I reproduce the problem, understand the fix, and run a risk-based set: the confirmation test, the tests around the changed code, the smoke suite and the money or data flows, in parallel. If I can, I verify directly in a production-like environment and watch monitoring after release. I tell the release owner clearly what was covered and what was not, since this is an accepted-risk decision, not a hidden one. Afterwards the full suite still runs, and I add a regression test so the bug cannot come back.

**Follow-ups:**
- *What if the fix cannot be reproduced locally?* Use logs and production-like data; add the logging that would have helped.
- *How do you shorten the full regression in the long run?* Parallelism, sharding, moving tests down to lower layers, deleting duplicates.

**Trap:** Going silent while you run everything, or releasing with no stated scope.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.3 (maintenance testing, hot fixes, impact analysis): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you stop an E2E suite from becoming a bottleneck?

Topic: test-levels | Standard | id: q0544

**Say:** I attack the cause: too many slow tests at the top, flakiness, and a serial run. I move checks down to API and component level, delete duplicates, fix flaky tests at their root, run in parallel with sharding, and split the suite so only the right slice runs for a change: smoke on every merge request, the wider suite nightly. I measure pipeline time and flaky rate, and I keep a budget, for example a smoke suite under 10 minutes. I also make failures easy to read, with traces and screenshots, so a red build is fast to triage.

**Full process:**
1. Measure: time per stage, slowest tests, failure rate per test over the last 30 days.
2. Remove: duplicates and tests that guard no risk.
3. Move down: logic checks that need no browser.
4. Stabilise: fix the top flaky tests by root cause.
5. Parallelise: workers and shards; keep tests independent so they can run in any order.
6. Select: tag smoke, regression and area; run by change.
7. Watch: report time and flaky rate weekly.

**Follow-ups:**
- *Is more workers always better?* No. Past a point you hit shared state and a loaded environment, which creates flakiness. Sharding across machines is safer than more workers on one.

**Trap:** Adding more retries.

**Source:** Google Testing Blog, Just Say No to More End-to-End Tests: https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html ; Playwright, Parallelism and sharding: https://playwright.dev/docs/test-parallel

### Why do you use mocks, stubs or emulation in E2E tests?

Topic: test-levels | Standard | id: q0545

**Say:** Only for the things I do not own or cannot control: a payment provider, an email service, a third-party map, a slow or paid API, or a failure I need to trigger on demand, such as a server error or a timeout. Everything I own stays real, so the test still proves the wiring. Mocks make tests faster and deterministic, but each mock removes confidence in that integration. So I mock the edge, keep a few real integration checks, and sometimes use contract tests to keep the mock honest.

**Follow-ups:**
- *Emulated devices versus real devices?* Emulation is cheap and good for layout and viewport logic. Real devices find things emulators miss: hardware, push notifications, real browser engines on a phone.
- *Which Playwright feature is this?* Network interception with `page.route` can fulfil a request with a fake response.

**Trap:** Mocking the backend in an "end-to-end" test and calling it E2E.

**Source:** Kent C. Dodds, Static vs Unit vs Integration vs E2E (mock as little as possible): http://kentcdodds.com/blog/static-vs-unit-vs-integration-vs-e2e-tests ; Playwright, Mock APIs: https://playwright.dev/docs/mock

### What are the integration testing strategies (big bang, top-down, bottom-up)?

Topic: test-levels | Standard | id: q0546

**Say:** Big bang combines all components at once and tests. It is simple but hard to debug, because a failure could be anywhere. Top-down starts from the top module and replaces lower ones with stubs. Bottom-up starts from the lowest modules and uses drivers for the callers. Today most teams integrate continuously, in small steps, with a build on each merge, which avoids a long integration phase. ISTQB says component integration testing depends heavily on the chosen strategy.

**Follow-ups:**
- *What are a stub and a driver?* A stub stands in for a lower module that the code under test calls. A driver stands in for a caller of the code under test.
- *What is the sandwich approach?* A mix of top-down and bottom-up: integrate from both ends and meet in the middle.

**Trap:** Presenting big bang as normal practice in an agile team.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is maintenance testing, and how do you test a hotfix?

Topic: test-levels | Standard | id: q0547

**Say:** Maintenance testing is testing changes to a system that is already in operation: planned enhancements, corrective changes and hotfixes, environment upgrades or migrations, and retirement. I do impact analysis first, then test the change and look for regressions in the unchanged parts, which is most of the system. The scope depends on the risk of the change, the size of the system and the size of the change. For a hotfix, I confirm the fix, run smoke and the neighbouring regression tests, and add a regression test.

**Follow-ups:**
- *What triggers maintenance testing?* A modification, a migration of the system or its environment, or its retirement.
- *What if there is no time for full regression?* Use the impact analysis to pick the tests by risk: the changed area, its neighbours, and the critical flows.

**Trap:** Treating hotfixes as exempt from testing.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Risk-based testing

### What is risk-based testing, and how do you apply it?

Topic: test-risk | Standard | id: q0548

**Say:** Risk-based testing means choosing what to test, how deeply and in what order by the risk of failure. Risk has two parts: likelihood that it happens and impact if it does. I list the product risks with the team, score each by likelihood times impact, and spend the most testing on the top of the list. High-risk areas get more techniques and earlier, deeper tests, and low-risk ones get light checks or none. Risk analysis starts early and is repeated when things change.

**Full process:** a worked example with a 3x3 scale (1 low, 2 medium, 3 high), for a small shop.
1. List risks with the team: wrong price, double charge, order lost, login broken, slow search, product page text typo, personal data leak.
2. Score likelihood (L) and impact (I):

| Risk | L | I | Level (L x I) |
|---|---|---|---|
| Double charge | 2 | 3 | 6 |
| Wrong price after coupon | 3 | 3 | 9 |
| Order lost after payment | 2 | 3 | 6 |
| Personal data leak | 1 | 3 | 3 |
| Search slow at peak | 2 | 2 | 4 |
| Typo on a product page | 3 | 1 | 3 |

3. Order of testing: wrong price (9), double charge and order lost (6), search (4), data leak and typo (3). Notice the data leak scores only 3 with likelihood 1. If the impact includes legal action, I would raise the impact or treat it as a must-do regardless of the score.
4. Map each risk to tests: wrong price gets a decision table and unit tests; double charge an idempotency API test and a failure-path E2E; the typo gets a quick visual review.
5. Review after each release or incident, and update the scores with real data (defect history, usage).

**Follow-ups:**
- *Where do likelihood and impact come from?* Likelihood from change size, complexity, new technology, team experience and defect history (defects cluster). Impact from money, users affected, legal or safety consequences, and brand.
- *Qualitative or quantitative?* Quantitative multiplies numbers. Qualitative uses a risk matrix. Mixed is common.
- *What are the options once a risk is known?* Mitigate by testing, accept it, transfer it, or plan a contingency.

**Trap:** Treating it as a one-time spreadsheet. It is a conversation that changes the testing, and it must be repeated.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Explain risk-based testing to a non-technical stakeholder.

Topic: test-risk | Standard | id: q0549

**Say:** We cannot test everything, and nobody can. So we decide together what would hurt the business most if it broke, and we test those parts first and hardest. Parts that are rarely used or easy to fix get lighter checks. It is like checking a plane: the engines get more checks than the cup holders. You help us by telling us which failures cost you most. We tell you what we did not cover, so you decide with open eyes.

**Follow-ups:**
- *What do you need from them?* Their view of impact: revenue, customers, legal duties, reputation.

**Trap:** Jargon such as "likelihood-impact matrix". Use money and customer words.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.2.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you prioritise testing when there is not enough time to test everything?

Topic: test-risk | Standard | id: q0550

**Say:** Exhaustive testing is impossible even with unlimited time, so I always prioritise. I order by risk, then by change impact, then by cost: what can fail badly, what changed, and what is cheap to check. I do smoke first, then the high-risk flows, then the areas touched by the change, then the rest as time allows. I tell stakeholders the plan and the cut line early, and I list what falls below it. If time shrinks again, I move the line, not the honesty of the report.

**Follow-ups:**
- *Several features compete for limited QA time. How do you choose?* Rank them by risk with the product owner, and test the top ones deeply and the others lightly. Ask developers to add unit tests for the low-risk ones.

**Trap:** "I work overtime and test everything."

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.3 (principle 2) and 5.1.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you identify high-risk areas when you join a project and do not know the codebase?

Topic: test-risk | Standard | id: q0551

**Say:** I use several sources. I ask people: product owner (what hurts the business), support (what customers complain about), developers (what is fragile or changes often). I read the defect history, because defects cluster. I look at code churn in the repository, the areas with the most changes and authors. I read production incidents and monitoring. And I map the architecture to find integration points and third parties. Then I run a short risk workshop to turn this into a ranked list.

**Full process:**
1. Collect: last 6 months of bugs by area; production incidents; support tags; the most-changed files (`git log --since="6 months ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head`).
2. Interview three people: product, support, development.
3. Draw the main flows and integration points.
4. Rank in a workshop, as above.

**Follow-ups:**
- *What if there is no history?* Risk by design: money, personal data, new technology, complex logic, third parties.

**Trap:** Starting with a coverage tool. It shows untested code, not risk.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.3 (principle 4, defects cluster) and 5.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you communicate what will not be tested, and who accepts the remaining risk?

Topic: test-risk | Standard | id: q0552

**Say:** In writing, before testing starts and again before release. The test plan lists the out-of-scope areas and the reason. The completion report lists the unmitigated risks and the defects not fixed. The product owner or release manager, the person who owns the business decision, accepts the residual risk by name in the release thread or ticket. I give a recommendation (go, go with conditions, no go) with the evidence. I have told risks directly to clients and pushed back when I disagreed.

**Follow-ups:**
- *What if they ignore the risk?* I make sure it is recorded, I raise it once more with the person's manager if the impact is serious, and I follow up after release.

**Trap:** Keeping the risk in your head, or treating a release sign-off as your own decision when it is the business's.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 5.1.3 and 5.3.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between a project risk and a product risk?

Topic: test-risk | Standard | id: q0553

**Say:** A product risk is about the quality of the software: wrong calculations, security holes, slow response, a poor user experience. Testing responds to these. A project risk is about running the project: late deliveries, poor estimates, lack of skills, people conflicts, tool problems, a supplier failure. They affect schedule, budget or scope. Test managers handle both, but only product risks are mitigated by tests directly.

**Follow-ups:**
- *Give an example of each and how to reduce it.* Product risk: a rounding error in payments, reduced by more tests on that area. Project risk: the only person who knows a module leaves, reduced by sharing knowledge.
- *How do you use risk to prioritise tests?* Rate each risk by likelihood and impact, and test the highest first and deepest.

**Trap:** Calling a missing test environment a product risk. It is a project risk that affects testing.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you handle being asked to cut corners on testing?

Topic: test-risk | Standard | id: q0554

**Say:** I do not refuse and I do not quietly comply. I turn it into a choice with a cost. I say what the cut removes (which risks lose coverage), what could go wrong and how bad, and what I can offer: a smaller scope with the top risks covered, a phased release behind a feature flag, a canary rollout, or extra monitoring. Then the decision owner chooses, and the decision is written down. If a demand would hide a known defect, I escalate; I do not hide bugs.

**Follow-ups:**
- *What about pressure to mark a failed test as passed or skip it?* No. A test is a contract. I would rather mark it as a known issue with a link than weaken it.

**Trap:** Saying yes to keep the peace, with no written risk.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 5.1.3 (running out of time is a valid exit if risk is accepted) and 5.2.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Manual and exploratory testing

### What is exploratory testing, and how is it different from ad hoc testing?

Topic: test-manual | Core | id: q0555

**Say:** In exploratory testing I design, run and evaluate tests at the same time, and what I learn from one test decides the next. It is a skilled activity with a goal, not random clicking. Ad hoc testing has no goal and no record. In exploratory testing I work in time-boxed sessions with a charter, take notes, log bugs, and report what I covered. It is most useful when specifications are thin, when time is short, and as a complement to scripted and automated tests, because it finds what nobody thought to write down. It works best with an experienced tester who knows the domain.

**Follow-ups:**
- *Can exploratory testing use techniques?* Yes, it can use equivalence partitioning, boundaries and the rest, whenever they help.
- *How do you show its value to a manager?* By reporting sessions: charter, time, bugs found, questions raised, and areas covered, and by showing the bugs that no scripted test would have caught.

**Trap:** "Exploratory means no documentation." Session-based testing produces notes, session sheets and debriefs.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.4.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf ; Elisabeth Hendrickson, Exploratory Testing in an Agile Context: https://www.agilealliance.org/wp-content/uploads/2016/01/ETinAgile-agile2011-final-1.pdf

### What is a test charter? Write me three.

Topic: test-manual | Core | id: q0556

**Say:** A charter is a one-sentence mission for one exploratory session. Elisabeth Hendrickson's template is: Explore a target, with some resources or constraints, to discover some information. The target says where to look, the resources say what to use or apply, and the information says what we want to learn. A charter must be focused enough to give direction and open enough that I can follow what I find. "Test the app" is too broad. "Enter 5 in field A and expect 10" is a test case, not a charter. A session usually lasts 60 to 120 minutes and ends with a short debrief.

**Full process:** three charters I would write, and what the session produces.
1. "Explore the coupon field in checkout with expired, used, mixed-case and very long codes to discover how errors are explained and whether the total ever changes wrongly."
2. "Explore the password reset flow with two browsers, an expired link and one user with two accounts on one email to discover state problems, token reuse and messages that leak whether an account exists."
3. "Explore the CSV import with 0, 1, 10,000 and 1,000,001 rows, mixed encodings and a row of only commas to discover limits, encoding failures and error messages a user cannot act on."
Session output: a short session sheet with charter, build, time, notes log, bugs, questions, and a percentage split of design and execution, bug investigation and setup. Then a debrief of 10 minutes: what happened, results, obstacles, outlook, feelings.

**Follow-ups:**
- *Where did charters come from?* Session-based test management by James and Jonathan Bach, around 2000, and Hendrickson's book Explore It! added the template.
- *Recon session?* A first session to map the territory when you know nothing: what the system connects to, the variables you can change, and obvious risks.

**Trap:** A charter that is a script in disguise.

**Source:** Elisabeth Hendrickson, Exploratory Testing in an Agile Context (charter template, recon): https://www.agilealliance.org/wp-content/uploads/2016/01/ETinAgile-agile2011-final-1.pdf ; ISTQB CTFL Syllabus v4.0.1, section 4.4.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you test an application that has no documentation?

Topic: test-manual | Core | id: q0557

**Say:** I build the picture myself and write it down as I go. First recon: click through the app, list the features, roles and data. Then I talk to people who know it: developers, support, product, long-time users, and I read old tickets and the code or API where I can. I draft a map of the main flows and risks and I confirm it with someone. Then I run exploratory sessions with charters on the riskiest flows. What I confirm becomes living documentation: acceptance criteria, a short feature note, and automated checks for stable behaviour. I record open questions, because "the app does X" is not the same as "X is correct".

**Full process:**
1. Recon session of 60 minutes with the charter "explore the whole app with a normal user account to discover its features, roles, and obvious risks". Output: a mind map.
2. Gather: support's top ten complaints, the last three production bugs, a developer's list of fragile areas.
3. Rank risks; plan 4 to 6 charters.
4. Run sessions; log bugs with a note "behaviour unclear" where there is no oracle.
5. Review the findings with a product owner to settle what is intended.
6. Write down the confirmed rules; automate the stable ones.

**Follow-ups:**
- *What if nobody knows the intended behaviour?* Compare similar screens in the same product, the competitors, or standards, and say so in the report.

**Trap:** Waiting for documentation.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.4.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you decide what to automate and what to keep manual?

Topic: test-manual | Core | id: q0558

**Say:** I decide by value and cost. A check that runs often, has an exact expected result, covers a stable feature and a real risk, and can be made deterministic is a good candidate for automation. Checks that need human judgement, run once, or sit on a feature that changes weekly stay manual or exploratory. I also pick the layer: unit and API tests first, a small number of E2E on top. I revisit the decision, because a manual check that a person repeats every release has become an automation candidate.

**Follow-ups:**
- *What is the line between them in your last job?* Regression and money-adjacent flows automated, new features explored by hand first, then automated once stable.
- *What if the team wants to automate everything?* See the "why not 100%" entry: measure value, not percentage.

**Trap:** "Everything repeatable gets automated." Repeatable and valuable are different.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 6.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### When should manual testing be preferred?

Topic: test-manual | Standard | id: q0559

**Say:** For a first look at a new feature, for usability and look-and-feel, for exploratory sessions, for one-time checks, for a feature in flux, for checks with human judgement (is this message clear), for hardware and real-device behaviour such as push notifications and camera, and for accessibility checks with real assistive technology. Automated accessibility scans find only part of the problems; Playwright's own documentation says many accessibility problems can only be found by manual testing.

**Follow-ups:**
- *Do you still do manual testing yourself?* Yes: exploratory sessions, real devices, screen readers and keyboard-only passes.

**Trap:** Presenting manual testing as inferior.

**Source:** Playwright, Accessibility testing (disclaimer on manual checks): https://playwright.dev/docs/accessibility-testing

### If an automation engineer on your team refuses to do manual testing, how do you handle it?

Topic: test-manual | Standard | id: q0560

**Say:** I find out why first. Often the reason is that they think manual work is lower value, or that it is boring repeated clicking. I explain that manual and exploratory testing is where we learn about the product and find the bugs automation misses, and that automation written without it tests the wrong things. I give them meaningful work, such as exploring a risky area with a charter, not a long script to click. And I measure results: bugs found in sessions. If it is a real conflict of role, I take it to the manager, but I try the conversation first.

**Follow-ups:**
- *What if they still refuse after the talk?* I say the expectation is part of the role, agree a small first step, and raise it with the manager if nothing changes.
- *How do you show the value of manual sessions?* I record the bugs found in sessions and show the ones the automated suite could not have caught.

**Trap:** Forcing it, or giving up and letting a silo form.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.5 (essential skills, whole team approach): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Are you mainly a manual tester or an automation engineer?

Topic: test-manual | Standard | id: q0561

**Say:** Give your real split between automation and manual work. A strong answer shows both: you own or build automated suites, and you still run exploratory sessions on new features, test on real devices and with screen readers, and write bug reports yourself. A good closing line: the best automation comes from someone who understands how to test by hand.

**Follow-ups:**
- *Would you take a manual-only role?* I prefer roles with automation. I would say that directly.

**Trap:** Hiding the manual history, or pretending to be only a developer.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.5.1 (generic skills required for testing): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Defects and root cause

### What is the difference between severity and priority? Give examples.

Topic: test-bugs | Core | id: q0562

**Say:** Severity is how bad the defect is: the degree of its impact on the system or the user. Priority is how soon we should fix it: the level of business importance. Severity is mostly the tester's assessment, and priority is decided with the product owner and the business. They are linked but not the same. The four classic examples: high severity and high priority, the checkout crashes for all users. High severity and low priority, a crash in a feature almost nobody uses, or on a very old browser. Low severity and high priority, the company name is misspelled on the home page before a launch. Low severity and low priority, a small alignment glitch in a rarely opened settings page.

**Full process:** how I set both in a ticket.
1. Severity: scale of impact, for example critical (data loss, no workaround, crash of a core flow), major (core function broken, workaround exists), minor (small function or cosmetic issue).
2. Priority: urgency of the fix: how many users, how visible, any deadline or legal need, is the workaround acceptable.
3. Write one line explaining each, so the owner can disagree with a reason.
4. Revisit priority at triage, because it changes with the release date.

**Follow-ups:**
- *Who decides?* I propose both. The product owner has the final say on priority.
- *How does Jira treat these?* The default Jira field is "Priority" (Highest to Lowest). Severity is usually a custom field, so teams without it mix the two up.

**Trap:** Using them as synonyms, or saying a high-severity bug is always a high-priority one.

**Source:** ISTQB Glossary, severity and priority: https://www.erikvanveenendaal.nl/site/wp-content/uploads/ISTQB-Glossary-Foundation-V4.1-2023.pdf ; Atlassian, Jira statuses, priorities and resolutions: https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-statuses-priorities-and-resolutions/

### Describe the bug life cycle.

Topic: test-bugs | Core | id: q0563

**Say:** There is no single official life cycle, since every tracker defines its own, but the usual flow is: a tester reports a bug, it is triaged and confirmed, assigned to a developer, fixed, then the fix is verified by a tester, and the bug is closed. Along the way it can be rejected as invalid, marked a duplicate, deferred, closed as "won't fix", closed as "cannot reproduce", or reopened if the fix fails. The Bugzilla model, used by Mozilla and WebKit, is a good reference: UNCONFIRMED, NEW, ASSIGNED, RESOLVED with a resolution (FIXED, INVALID, WONTFIX, DUPLICATE, WORKSFORME, INCOMPLETE), then VERIFIED, and REOPENED if the fix fails. WebKit adds CLOSED once a release contains the fix; the Mozilla status list has no CLOSED. ISTQB lists typical statuses: open, deferred, duplicate, waiting to be fixed, awaiting confirmation testing, re-opened, closed, rejected.

**Full process:** the path of a normal bug, with who moves it.
1. Tester finds the failure, reproduces it, and files the report (status: New or Open).
2. Triage with the product owner and developers: confirm it, set severity and priority, assign an owner (Assigned or To Do).
3. Developer fixes (In Progress), then opens a merge request, which merges into the branch (Resolved or Fixed).
4. Tester verifies on the build with the fix: the original steps no longer fail, plus nearby regression (Verified).
5. After release or when accepted, the ticket is Closed.
6. If the check fails, the tester reopens it with new evidence, and the cycle repeats.

**Follow-ups:**
- *What is the difference between status and resolution?* Status says where the work is. Resolution says how it ended (Done, Won't do, Duplicate, Cannot reproduce in Jira defaults).
- *Who should verify?* Preferably the reporter or a tester, not the developer who fixed it.

**Trap:** Reciting a seven-step list as if it were a standard.

**Source:** Mozilla BMO Bug Statuses: https://wiki.mozilla.org/BMO/UserGuide/BugStatuses ; WebKit Bug Life Cycle: https://webkit.org/bug-life-cycle/ ; ISTQB CTFL Syllabus v4.0.1, section 5.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What makes a good bug report? Show one.

Topic: test-bugs | Core | id: q0564

**Say:** A good bug report lets a developer reproduce and fix the problem without asking me anything. It has a short title that states the failure, the environment and build, exact steps to reproduce, the expected result, the actual result, evidence (screenshot, video, log, request and response, trace), and the impact, with severity and priority. I check that it reproduces more than once, and I narrow it: what is the smallest case, does it happen in other browsers, is it a regression, since when. One bug per report. I write it for a person who has never seen the feature.

**Full process:** the template I use, with an example.

```
Title: Coupon SAVE10 applies 10% twice when the cart page is refreshed after applying

Environment: staging, build 2026.11.04-3f2a1c, Chrome 130 on Windows 11, customer account (not guest)

Steps:
1. Add one item priced 100.00 to the cart.
2. Enter coupon SAVE10 and click Apply. Total shows 90.00 (correct).
3. Refresh the page (F5).

Expected: total stays 90.00.
Actual: total shows 81.00 and the discount line reads "-19.00".

Frequency: 5 of 5 attempts. Does not happen in Firefox 131 (3 of 3 attempts fine).
Regression: not present in build 2026.10.28.
Evidence: video 01-refresh-bug.webm; network log showing two POST /cart/coupon requests.
Impact: customers pay less than intended; money loss on every coupon order in Chrome.
Severity: major (wrong price). Priority proposed: high (affects all Chrome coupon orders).
Notes: server log line at 10:42:11 "coupon already applied" is not returned to the UI.
```

The numbers and names are an invented example. ISTQB lists these elements: identifier, title, date and author, test object and environment, context, description with steps and logs, expected and actual results, severity, priority, status and references.

**Follow-ups:**
- *How do you handle an intermittent bug?* Report the frequency, attach logs or a trace from a failing run, note what you tried, and say what you suspect.
- *Should you suggest a root cause?* Yes, as a hint, and say that it is a guess.

**Trap:** "It doesn't work" with a screenshot of the whole screen. Another trap: bundling three problems in one report.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.5 (defect report content): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between an error, a defect, a bug, a failure and an incident?

Topic: test-bugs | Core | id: q0565

**Say:** In ISTQB terms: a person makes an error (a mistake). The error produces a defect (also called a fault or a bug) in a work product, such as code or a requirement. When the defect is executed, the system may produce a failure: behaviour that differs from what is expected. Not every defect causes a failure, and failures can also come from the environment. "Bug" is the everyday word for a defect. "Incident" has two meanings. In ITIL and operations, an incident is an unplanned interruption of a service or a reduction in its quality. In the ISO 29119-3 test documentation, defect reports are called incident reports. So a bug is a cause in the product, and an incident is an event affecting users. One incident can come from a bug, a bad configuration, or an outage of a provider.

**Follow-ups:**
- *What is a problem in ITIL?* The cause, or potential cause, of one or more incidents. The incident is the effect.
- *Is every defect a bug to fix?* No. A report can turn out to be a false positive, a change request or a wrong test.
- *What is a root cause?* The fundamental reason for a problem. Root cause analysis tries to remove it, so similar failures do not happen again.

**Trap:** Mixing "incident" in ITSM with "incident" in test standards without saying which one.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.2.3 and 5.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf ; Atlassian, Problem management vs incident management: https://www.atlassian.com/incident-management/devops/incident-vs-problem-management

### How do you handle a defect found in production?

Topic: test-bugs | Core | id: q0566

**Say:** First, assess impact and stop the damage: how many users, any data loss, is there a workaround, should we roll back or turn off a feature flag. I confirm the report and gather evidence (logs, request, user steps, time). I set severity and priority with the product owner, and the developer fixes it. I verify the fix before release and add a regression test at the lowest useful layer. Afterwards, a short blameless review asks the real question: why did our process not catch it, and what do we change in tests, reviews or monitoring.

**Follow-ups:**
- *Who communicates to customers?* Support and the product owner. I give the facts and a safe workaround.
- *What do you measure?* Escaped defects and time to detect and fix.

**Trap:** Blaming a person, or fixing without adding a test.

**Source:** Atlassian, Incident management process: https://www.atlassian.com/incident-management/itsm

### How do you handle a disagreement with a developer over defect priority?

Topic: test-bugs | Standard | id: q0567

**Say:** I bring evidence about the impact, not opinion: how many users, which flow, what it costs, whether a workaround exists. I ask what the developer sees that I do not, since they may know it is a rare path or a cheap fix. If we still disagree, I take it to triage with the product owner, who decides priority. I accept their decision and record it, and I stay friendly. Repeated disagreements mean the severity scale is unclear, so I propose a clearer definition.

**Follow-ups:**
- *What if a developer says "works on my machine"?* I share my environment, the build, the trace or video, and I offer to reproduce it together.

**Trap:** Making it personal, or escalating before you have talked.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.5.1 (communication skills): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you handle a bug you cannot reproduce, or one that happens intermittently?

Topic: test-bugs | Standard | id: q0568

**Say:** I do not close it, and I do not guess. I collect everything: exact build, environment, account and data, time, browser, logs, and a trace or video if it is automated. I try to reproduce by repeating the run many times, changing one variable at a time (parallel load, network speed, data state, time zone). Counting matters: "failed 7 of 200 runs" is evidence. I look for a pattern, like only after a reconnect, only under load, only at a certain time. If it stays unreproducible, I report it with the frequency and the evidence collected, label it as intermittent, and keep a watch with extra logging.

**Full process:** a repeat run with Playwright to measure the failure rate.

```bash
npx playwright test tests/checkout.spec.ts --repeat-each=200 --workers=4 --trace=retain-on-failure --reporter=line
```

Output: the number of failed runs out of 200, and a trace for each failure under `test-results/`. Compare the same command on the base branch and on the fix, so the rate before and after is visible.

**Follow-ups:**
- *What changes between local and CI?* CPU speed, parallel load, data, network, time zone and browser version. I note the differences.

**Trap:** "Cannot reproduce" closure after one try.

**Source:** Playwright, Test CLI (--repeat-each): https://playwright.dev/docs/test-cli

### How do you do root cause analysis for a defect?

Topic: test-bugs | Standard | id: q0569

**Say:** I ask why, repeatedly, until I reach something the team can change. Why did the bug happen? Why was it not caught earlier? I separate the immediate cause (a missing null check) from the root cause (no test for empty responses; unclear requirement; a shared state between tests). Then I choose a fix at the right level: the code, the test, the process, or the monitoring. ISTQB says addressing the root cause can prevent similar failures or reduce their frequency. I write the findings briefly in the ticket.

**Full process:** a five-whys chain on a flaky test.
1. The test failed. Why? The assertion ran before the message list updated.
2. Why? The test did not wait for the request that adds the message.
3. Why? The click and the wait for the response were not started together.
4. Why? The helper did not return the response promise.
5. Fix: start the response wait with the click in one `Promise.all` and expose it from the helper; add a lint rule so the pattern is enforced.

**Follow-ups:**
- *When do you stop asking why?* When the answer is a decision someone can change.

**Trap:** Stopping at "human error".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.2.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Which defect metrics do you track, and which are misleading?

Topic: test-bugs | Standard | id: q0570

**Say:** Useful ones: escaped defects per release, defect detection percentage (defects found before release divided by all defects found before and after), defects by area (they cluster), time to fix, and reopen rate. Misleading ones: the raw number of bugs found per tester, which rewards noise, and the number of test cases run, which says nothing about risk. Metrics should drive questions: why did this area leak so many bugs?

**Follow-ups:**
- *What is defect density?* Defects per size unit, like per thousand lines or per feature. It points to risky areas.

**Trap:** Ranking testers by bug count.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.3.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Tell me about a time you prevented a critical defect from reaching production.

Topic: test-bugs | Standard | id: q0571

**Say:** Example: a test for an entry-redirect feature failed intermittently on the base branch. It would have been easy to add a retry. Running it 200 times on the develop branch yielded 7 failures, which traced back to a navigation race in how routes loaded. This was a product bug that real users on slow connections could also hit. The fix was applied in the product code. After the fix, 200 of 200 runs passed with no retries. The takeaway: a flaky test is sometimes the first report of a real race.

**Follow-ups:**
- *Another example?* Daylight-saving and project time zone errors in date ranges, which can be fixed in the API and UI with tests.

**Trap:** A story with no evidence. Give the numbers and what you changed.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.3 (principle 3, early testing saves time and money): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What happens in a bug triage meeting?

Topic: test-bugs | Standard | id: q0572

**Say:** Tester, developer lead and product owner review new or open bugs for 15 to 30 minutes. For each one we confirm it is real and reproducible, set or adjust severity and priority, decide the owner and the target release, and mark duplicates, invalid reports and "won't fix". A good triage keeps the backlog short and every bug with a clear next step. I prepare the list with evidence, ordered by impact.

**Follow-ups:**
- *How often?* Daily or twice a week near a release, weekly otherwise.

**Trap:** A triage that turns into a debugging session.

**Source:** WebKit, Bug Life Cycle (confirming bugs): https://webkit.org/bug-life-cycle/

## Requirements analysis

### What is your process when you receive a new requirement or user story?

Topic: requirements | Core | id: q0573

**Say:** I read it as a tester: what can be unclear, missing or contradictory? I ask what problem it solves, who the user is, what the acceptance criteria are, and what happens when things go wrong. I check testability: can I tell when it is done? I write down questions and the first set of test conditions, and I bring them to refinement before the story is committed. I look for hidden rules, edge cases, dependencies on other systems, and non-functional needs such as speed or accessibility. Reviewing the specification early often finds ambiguities, gaps and contradictions, which are the cheapest defects to fix.

**Full process:** what I produce for each story.
1. A list of questions for the product owner, ranked by risk.
2. Acceptance criteria as examples (given, when, then or a table), agreed with the team.
3. Test conditions: rules, boundaries, states, error paths.
4. Risks and the test layer for each.
5. A note on data and environment needs.
6. A testability comment, such as "need a way to set the clock" or "need an API to create the order in a given state".

**Follow-ups:**
- *What do you do when the product owner is unavailable?* Write down the assumption, continue, and flag it in the story.
- *How do you check completeness?* Walk the user journey step by step and ask "what if" at each step.

**Trap:** Starting to write test cases from the first reading, without questions.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 2.1.5 (shift left: review specs for ambiguity) and 4.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What do you do when the requirements are unclear or incomplete?

Topic: requirements | Core | id: q0574

**Say:** I ask early and I make my assumptions visible. I list the unclear points, ask the product owner or business analyst, and write the answer in the story so the next person has it. If I cannot get an answer in time, I choose the most likely reading, note it as an assumption, and test it with exploratory sessions. I compare with similar features, existing behaviour, and what users expect. I keep the automation light until the behaviour settles, since writing a detailed suite for a moving target is waste.

**Follow-ups:**
- *How would you approach test automation with incomplete requirements?* Automate stable parts first (smoke and core flows), keep the changing parts in exploratory sessions, write tests at low layers where the contract is clear, and review often. Do not freeze unclear behaviour into assertions that will need rewriting.
- *Tell me about a time you dealt with ambiguous requirements.* Use a short story: the ambiguity, who you asked, what was decided, what you documented.

**Trap:** "I wait", or "I test what the developer built", which turns the code into the spec.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.4.2 and 4.5.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What makes a requirement testable? What are acceptance criteria and INVEST?

Topic: requirements | Core | id: q0575

**Say:** A requirement is testable when I can state, before the code exists, an observable result that proves it is met. "The page loads fast" is not testable. "The product page's Largest Contentful Paint is 2.5 seconds or less at the 75th percentile" is. Acceptance criteria are the conditions a user story must meet to be accepted. They define scope, help the team agree, describe positive and negative cases, and serve as the base for acceptance tests. Two common formats are scenario-oriented (given, when, then) and rule-oriented (a bullet list or a table). INVEST is a check for a good story: Independent, Negotiable, Valuable, Estimable, Small, Testable.

**Full process:** rewriting a vague requirement.
1. Vague: "The user can reset the password easily."
2. Questions: how long is the link valid, how many requests are allowed, what does the user see if the email does not exist, what are the password rules?
3. Testable criteria: the link expires after 30 minutes; a new request invalidates the previous link; the response is the same for known and unknown emails; the new password must be 12 to 128 characters; after reset all other sessions end.
4. Each line maps to at least one test.

**Follow-ups:**
- *What are the "3 Cs"?* Card (the story), Conversation (how the software will be used) and Confirmation (acceptance criteria).
- *If nobody knows how to test a story?* The story may be unclear, lack value, or the stakeholder needs help, per ISTQB.

**Trap:** Acceptance criteria that describe the implementation ("uses a dropdown").

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.5.1 and 4.5.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the Software Testing Life Cycle (STLC)?

Topic: requirements | Core | id: q0576

**Say:** It is the sequence of test activities. The common textbook list is: requirement analysis, test planning, test case design, environment setup, test execution, and test closure. ISTQB 4.0.1 names the test activities as planning, monitoring and control, analysis, design, implementation, execution, and completion, and stresses that they overlap and repeat. They do not run as a waterfall. In an agile team all of them happen inside each iteration, in small form.

**Follow-ups:**
- *What does test analysis answer?* "What to test", in measurable coverage terms. Test design answers "how to test".

**Trap:** Reciting a six-box diagram as if every project followed it in order.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.4.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is traceability, and why does it matter?

Topic: requirements | Standard | id: q0577

**Say:** Traceability links the test basis (requirements, stories, risks) to test conditions, test cases, results and defects. It lets you answer "which requirement is covered by which test", "which tests break if this requirement changes", and "what is the status of this requirement". It is useful for impact analysis, coverage reporting, audits and regulated work. I keep it light: link tests to stories in the tracker or the test management tool, and avoid a manual matrix that rots.

**Follow-ups:**
- *Can you have too much?* Yes. Traceability at the level of every field is expensive and goes stale.

**Trap:** Counting requirement coverage as quality. A linked test can be a poor one.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.4.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What have you tested that was not in the requirements?

Topic: requirements | Standard | id: q0578

**Say:** Plenty, because requirements describe the intended path and users do not follow it. I test failure paths (network drops, timeouts, double submits), concurrency and ordering, time zones and daylight-saving changes, accessibility with keyboard and screen readers, data cleanup, and behaviour after a reconnect. If requirements rarely say what a real-time chat should do when the socket reconnects mid-message, test it, and you may find races and swallowed save errors. Unwritten requirements still count: users expect them.

**Follow-ups:**
- *How do you know the unwritten expectation is right?* Compare with other screens, standards such as WCAG, and ask the product owner.

**Trap:** Saying "nothing, I follow the spec".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.3 (principle 7, absence-of-defects fallacy): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## UAT

### What is user acceptance testing (UAT), who does it, and when?

Topic: test-uat | Standard | id: q0579

**Say:** UAT is acceptance testing by the people who will use the system, or who represent them, to confirm that it meets their business needs and is ready for deployment. It is validation: "did we build the right thing". It comes at the end, after system testing, in an environment close to production, with realistic data and real scenarios. QA helps by preparing, supporting and tracking, but the business users judge. ISTQB lists the main forms of acceptance testing: user acceptance, operational acceptance, contractual, regulatory, alpha and beta.

**Follow-ups:**
- *What is alpha and beta?* Alpha testing is done at the developer's site by internal users or testers outside the dev team. Beta testing is done by real users at their own sites. Both give feedback before release.
- *Operational acceptance?* Checks of backup, restore, monitoring, security and maintenance procedures by operations staff.

**Trap:** Treating UAT as a second round of system testing run by QA.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.2.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you run UAT with a client?

Topic: test-uat | Standard | id: q0580

**Say:** I agree entry criteria first: system testing is done, the build is deployed to a UAT environment with realistic data, and known issues are listed. I prepare scenarios from real business processes together with the client, in their words, and give simple instructions and a way to report problems. I run a kickoff session, support the testers during the window, triage what they report quickly (bug, misunderstanding, or change request), and keep a visible status. Exit criteria are agreed: scenarios run, no open critical defects, a written sign-off by the client. A change request is not a bug, and I say so politely.

**Follow-ups:**
- *What if the client finds many "bugs" that are new wishes?* Classify, and send change requests to the product owner for planning.

**Trap:** Handing the client a build with no scenarios and hoping.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 2.2.1 and 5.1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you manage testing across environments such as QA, staging and UAT?

Topic: test-uat | Standard | id: q0581

**Say:** Each environment has a purpose, an owner and a rule about data. QA or dev environments are for fast feedback with test data and fakes. Staging is close to production, used for release candidates, integration with real third-party sandboxes and non-functional checks. UAT is for the business, with stable builds and realistic data. I keep the same build artefact moving through them, I note which build and configuration each test ran on, and I watch for drift between environments, such as feature flags that differ from production. Without that, a green result may be about a configuration no customer sees.

**Follow-ups:**
- *How do you avoid environment clashes?* Reserve windows, give each team separate data, and make tests create their own data.

**Trap:** Testing in one environment and assuming another behaves the same.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 2.2.1 and 5.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between a bug and a change request found during UAT?

Topic: test-uat | Standard | id: q0582

**Say:** A bug is behaviour that differs from what was agreed or from a reasonable expectation. A change request is new or different behaviour that the business now wants. The test: does it contradict the accepted criteria or the specification? If yes, bug. If the spec was silent or the business changed its mind, change request. ISTQB notes that reported anomalies may turn out to be defects or something else, such as a change request or a false positive. I keep the tone neutral and send both to the product owner.

**Follow-ups:**
- *Who decides?* The product owner or business owner, using the agreed process. QA gives the evidence: the requirement, the actual behaviour and the gap.
- *What if the specification is ambiguous?* Ask the owner, record the answer in the ticket, and fix the specification so the question does not return.

**Trap:** Arguing about the label instead of the impact.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Test management tools: Jira, Xray, TestRail, Zephyr

### Which test management tools have you used, and how do they differ?

Topic: test-mgmt-tools | Core | id: q0583

**Say:** If you have used TestRail and Zephyr, say so and explain how they fit into the workflow, alongside Jira for defects and planning. If you have not used Xray in a project, say so, then explain that it works on the same ideas, so you can describe it. TestRail is a dedicated test management tool: projects, suites, sections, test cases, test runs, plans and milestones, with Jira integration through references. Zephyr (Squad and Scale) and Xray are Jira apps. Xray stores tests, test plans and test executions as Jira issue types, so JQL, workflows and automation apply to them. All of them give the same core: test cases, runs, results, traceability to requirements and defects, and reports.

**Full process:** how the pieces map between tools, from the vendor migration guides.
1. Test case (TestRail, Zephyr) maps to a Test (Xray).
2. Test run or test cycle (TestRail, Zephyr) maps to a Test Execution issue (Xray).
3. Test plan groups runs or cycles in all three.
4. Requirements link through a reference field (TestRail) or through issue links and the coverage panel on a story (Xray, Zephyr).
5. Automation results come in over a REST API or a CLI, so a CI job can create a run and post results.

**Follow-ups:**
- *How do you choose?* By where requirements and bugs already live. A Jira-centred team gets the least friction from a Jira app. A team with several trackers or heavy reporting needs may prefer a standalone tool.
- *Can automated tests live in them?* Yes, as results imported from CI. The test code stays in the repository.

**Trap:** Claiming Xray experience. List it with the tools that work the same way, and say you did not run a project on it.

**Source:** Xray docs, migration from Zephyr Scale (entity mapping): https://docs.getxray.app/space/XRAYCLOUD/44565677/Tips%20for%20a%20successful%20migration%20path%20from%20Zephyr%20Scale%20to%20Xray ; TestRail, test management webinar recap: https://www.testrail.com/blog/test-management-webinar-recap/

### Where do you keep test cases: Excel, a tool, or the code?

Topic: test-mgmt-tools | Core | id: q0584

**Say:** It depends on the team. Automated tests live in the repository with the product code, reviewed in pull requests, and results go to a report. Manual and exploratory tests live in a test management tool if the team needs traceability, shared runs and history, or an audit. For a small team or an early stage, a lightweight list or checklist in the wiki or tracker is fine. A spreadsheet works for a short time but has no versions, no links to bugs and no run history, so it fails when the team grows. The real question is who keeps the cases current and who reads them.

**Follow-ups:**
- *How do you keep test cases current?* Review them when a story changes, delete cases that guard nothing, and tie cases to stories so a change shows which ones to update.
- *Do you write detailed manual steps?* Only for complex logic. Otherwise a title, preconditions and expected results.

**Trap:** "A tool is always better." A tool nobody updates is worse than a short, accurate list.

**Source:** TestRail, Best Practices Guide: Test Metrics: https://support.testrail.com/hc/en-us/articles/32965382569108-Best-Practices-Guide-Test-Metrics

### How do you use Jira as a QA engineer?

Topic: test-mgmt-tools | Core | id: q0585

**Say:** For defects, test tasks and the story workflow. I file bugs with a clear template and link them to the story, set priority and a custom severity if the project has one, and move them through the workflow: To Do, In Progress, In Review, Done, with the resolution as a separate field (Done, Won't Do, Duplicate, Cannot Reproduce are the defaults). I use JQL for searches and dashboards, for example open bugs by priority for the release. I use labels or components to find regression-related tickets. And I read the board to see what is ready to test.

**Full process:** a JQL example for a release dashboard, with the field names being standard Jira ones.

```
project = SHOP AND issuetype = Bug AND fixVersion = "4.2" AND statusCategory != Done ORDER BY priority DESC, created ASC
```

`SHOP` and `4.2` are placeholders. The result is the list of open bugs for the release, highest priority first.

**Follow-ups:**
- *Status versus resolution?* Status is the position in the workflow. Resolution is how the work ended, and it is empty while the work is open.
- *Priority values?* Highest, High, Medium, Low, Lowest by default, and admins can change them.

**Trap:** Mixing up severity and priority fields.

**Source:** Atlassian, work item statuses, priorities and resolutions: https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-statuses-priorities-and-resolutions/ ; Atlassian, advanced search with JQL: https://support.atlassian.com/jira-software-cloud/docs/what-is-advanced-search-in-jira-cloud/

### How do you connect automated test results to a test management tool?

Topic: test-mgmt-tools | Core | id: q0586

**Say:** CI runs the tests, and a small step publishes the results to the tool through its API or CLI. TestRail can create a run with the case IDs and add results for each case. Xray and Zephyr accept result files (JUnit XML or their JSON) and attach them to a test execution. Each automated test carries an ID or tag that maps it to a case. I keep the report in the pipeline too, with traces and screenshots, so one click leads from a red result to the evidence.

**Full process:**
1. Name or tag each test with the case ID (for example `@C1234`).
2. Run the suite in CI with a JUnit or JSON reporter.
3. A post-step uploads the file or calls the API (TestRail documents `add_run` and `add_results_for_cases`).
4. The run appears in the plan or milestone for the release.

**Follow-ups:**
- *Is it worth it?* Only if people read it. If the tool is just a mirror of CI, skip it and use the CI report.

**Trap:** Creating a duplicate source of truth that drifts.

**Source:** TestRail, Test management webinar recap (API endpoints for automation): https://www.testrail.com/blog/test-management-webinar-recap/ ; Atlassian, Xray test types and test executions: https://www.atlassian.com/devops/testing-tutorials/jira-xray-integration-manage-test-cases

## Web application testing

### How do you approach testing a web application?

Topic: web-testing | Core | id: q0587

**Say:** I think in layers of the web stack and in quality areas. Functionality and business rules first. Then the browser side: forms and validation, navigation, state, cookies and storage, responsive layout, and cross-browser behaviour. Then the network side: API calls, error and timeout handling, caching. Then the non-functional areas: accessibility, performance (page load and responsiveness), security basics, and localisation (time zones, languages, currency). I do most checks at the cheapest layer, keep a small E2E suite for the critical flows, and use exploratory sessions for the rest. Real browsers and devices for what emulation misses.

**Full process:** my checklist, in the order I use it.
1. Functional: happy paths, rules, negatives, boundaries.
2. Forms: required, formats, length, paste, autofill, double submit, server-side validation (never trust client-only validation).
3. Navigation and state: links, Back and Forward, refresh, deep links, multiple tabs, session expiry.
4. Cookies and storage: what is stored, flags (Secure, HttpOnly, SameSite), behaviour when cookies are blocked.
5. Browsers and devices: target list by usage (see the cross-browser entry).
6. Responsive: breakpoints, orientation, touch targets.
7. Accessibility: keyboard, screen reader, contrast, labels, focus, errors.
8. Performance: Core Web Vitals on the key pages, slow-network behaviour.
9. Security basics: access control, injection, session handling.
10. Error handling: offline, 4xx and 5xx responses, timeouts, retries, empty states.
11. Localisation: languages, time zones and daylight saving, number and date formats.

**Follow-ups:**
- *What do you automate?* Critical flows in E2E, and rules in API tests.
- *Which browser tools do you use?* DevTools: network, console, application storage, throttling, device mode, and Lighthouse for a first performance view.

**Trap:** "Click through the pages in Chrome."

**Source:** MDN, Introduction to cross-browser testing: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing ; OWASP Web Security Testing Guide: https://owasp.org/www-project-web-security-testing-guide/

### How do you decide which browsers and devices to test? How do you build a device matrix?

Topic: web-testing | Core | id: q0588

**Say:** From usage data, not from taste. I take analytics for the real browsers, versions, operating systems and screen sizes, and cover the top share of users with full testing. I split browsers into tiers, the way MDN describes: A-grade modern browsers get full testing, B-grade older ones get a basic but working experience, and the rare ones are not tested but should work thanks to defensive code. Mobile gets at least one real iPhone and one Android phone, because emulation misses hardware and engine differences. Safari matters because iOS browsers must use WebKit outside the EU (the EU has allowed other engines since iOS 17.4).

**Full process:** matrix and Playwright setup.
1. Pull the last 90 days of analytics: browser, version, OS, viewport.
2. Pick the rows that cover roughly 90 to 95% of sessions, plus any contractual ones.
3. Mark tier A (full), B (core flows), C (none).
4. Map each row to a Playwright project, and run the full suite on the main project and a smoke or key-flow subset on the others.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] }, grep: /@smoke/ },
  ],
});
```

Each project runs the same tests under another browser or device profile. The `grep` on the mobile project limits it to tests tagged `@smoke`.

**Follow-ups:**
- *Emulation or real devices?* Both. Emulation for layout and viewport logic in CI. Real devices for the final pass, for touch, performance, keyboards and push.
- *Cloud device farms?* If X is new to you, say so plainly and explain that you have used BrowserStack a little.

**Trap:** Testing "all browsers". It is neither possible nor useful.

**Source:** MDN, Strategies for carrying out testing: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing/Testing_strategies ; Playwright, Projects: https://playwright.dev/docs/test-projects ; Playwright, Emulation: https://playwright.dev/docs/emulation

### How do you test responsive design and mobile web?

Topic: web-testing | Core | id: q0589

**Say:** I test at the breakpoints the design defines, plus the widths in between and just on either side of each breakpoint, since layout bugs hide at the boundary. I check orientation changes, touch target size, text zoom to 200%, no horizontal scrolling, and that menus, modals and sticky bars work with a mobile keyboard open. I use browser device mode and Playwright device profiles in CI, then real devices for the final pass. Mobile web has its own issues: the address bar changing the viewport height, 300 ms taps on old devices, slow networks, and WebKit quirks.

**Follow-ups:**
- *Where do boundaries come from?* Boundary value analysis applied to widths: if the breakpoint is 768, test 767, 768 and 769.

**Trap:** Resizing the desktop browser window once and calling it responsive testing.

**Source:** Playwright, Emulation (devices, viewport, touch): https://playwright.dev/docs/emulation

### How do you test web performance from the front end?

Topic: web-testing | Core | id: q0590

**Say:** Look at what users feel. Core Web Vitals are Google's three measures: Largest Contentful Paint for loading (good is 2.5 seconds or less), Interaction to Next Paint for responsiveness (200 milliseconds or less), and Cumulative Layout Shift for visual stability (0.1 or less), all at the 75th percentile of real page views. Check them with Lighthouse and DevTools in a lab, throttle the network and CPU, and look at real-user data when it exists. For a service under load, use a different tool, like JMeter, which has been used for baselines on GraphQL APIs. If you have not used k6, say so, and explain that you can learn it quickly.

**Follow-ups:**
- *Lab or field data?* Lab data is repeatable and good for regressions. Field data shows what real users get. You need both.
- *Can you put it in CI?* A Lighthouse run per merge request with a budget, accepting some noise, so compare trends rather than single runs.

**Trap:** Reading one Lighthouse score on a fast laptop as a result.

**Source:** web.dev, How the Core Web Vitals metrics thresholds were defined: https://web.dev/articles/defining-core-web-vitals-thresholds

### What are the security checks a QA engineer should do on a web application?

Topic: web-testing | Standard | id: q0591

**Say:** I do the basics, I am not a penetration tester. Access control is the first: can user A open user B's data by changing an ID, can a normal user call an admin endpoint. Then input handling: script and SQL characters in fields and parameters must not execute. Session handling: cookie flags, logout, expiry, no tokens in URLs. Authentication: lockout, reset flows, generic error messages. Transport: HTTPS everywhere. And data: nothing sensitive in logs, responses, or client storage. I use the OWASP Top 10 as a list of risks and the OWASP Web Security Testing Guide for test ideas.

**Full process:** an access control check as an API test.

```ts
import { test, expect } from '@playwright/test';

test('user A cannot read the order of user B', async ({ request }) => {
  const orderOfB = process.env.E2E_ORDER_ID_OF_USER_B!;
  const res = await request.get(`/api/orders/${orderOfB}`, {
    headers: { Authorization: `Bearer ${process.env.E2E_TOKEN_USER_A!}` },
  });
  expect([403, 404]).toContain(res.status());
});
```

The route and the token variables are placeholders. 403 or 404 are both safe answers, and 200 is the bug (broken access control).

**Follow-ups:**
- *What is the number one risk?* Broken access control is A01 in the OWASP Top 10:2025, followed by security misconfiguration and software supply chain failures.
- *How far does your experience go?* Basics: role permissions and access checks. If you have not done full penetration testing, say so, and explain that you would involve a security specialist for that.

**Trap:** Claiming deep security testing. An honest "basics, here is my method" is stronger.

**Source:** OWASP Top 10:2025: https://owasp.org/Top10/2025/ ; OWASP Web Security Testing Guide: https://owasp.org/www-project-web-security-testing-guide/

### How do you test accessibility on a web application?

Topic: web-testing | Standard | id: q0592

**Say:** Automated scans first, then manual passes, because automation finds only part of the problems. An axe scan in CI catches missing labels, low contrast, and duplicate IDs. Then I use only the keyboard: can I reach and operate everything, is the focus visible and in a logical order. Then a screen reader pass on key flows (NVDA, VoiceOver, TalkBack): are names, roles and states announced, are errors read out. I check zoom to 200% and the reduced-motion setting. The nice effect for test automation is that accessible names are also the best locators.

**Full process:** an axe scan in Playwright.

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login page has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

The package is `@axe-core/playwright`. The page URL is a placeholder.

**Follow-ups:**
- *Which standard?* WCAG. Cite criteria 1.3.1 (info and relationships), 2.1.1 (keyboard) and 4.1.2 (name, role, value) in changes.
- *How does it help automation?* If the product exposes roles and names, tests use `getByRole` and stop depending on XPath or copy.

**Trap:** Believing a green axe scan means accessible.

**Source:** Playwright, Accessibility testing: https://playwright.dev/docs/accessibility-testing

### What do you check in the browser DevTools when testing?

Topic: web-testing | Standard | id: q0593

**Say:** The Network tab shows requests, status codes, payloads, timing and cache headers, so I can see whether a UI problem is a front-end or a back-end one. The Console shows errors and warnings that the UI hides. The Application tab shows cookies, local and session storage. Throttling simulates slow networks and CPU. Device mode shows layouts. The Elements panel and accessibility tree show roles and names. And I copy a failing request as cURL to attach it to a bug.

**Follow-ups:**
- *How do you attach evidence?* A HAR file or the request and response copied, with secrets removed.

**Trap:** Sending a bug report with only a screenshot when the network tab shows the cause in a second.

**Source:** MDN, Introduction to cross-browser testing: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Testing

### A bug happens only in Safari. How do you approach it?

Topic: web-testing | Standard | id: q0594

**Say:** I confirm it on a real Safari, same version, and note the OS. Safari uses WebKit, and on iOS outside the EU every browser must use WebKit (the EU has allowed other engines since iOS 17.4), so it should also reproduce in Chrome on an iPhone. I reduce it to the smallest case, check the console and network for differences with Chrome, and check which feature is involved: a CSS property, a date format, storage behaviour (stricter cookie and tracking rules), an API that WebKit does not support. I report with the exact version, steps, and a minimal example, and I add a Playwright WebKit project so it is caught from then on.

**Follow-ups:**
- *Playwright's WebKit is not Safari. Is it enough?* It is the same engine family and good for most cases, but the final check is a real device.

**Trap:** "Safari is weird, skip it."

**Source:** Playwright, Projects (webkit, Mobile Safari): https://playwright.dev/docs/test-projects

### How do you test forms and validation?

Topic: web-testing | Standard | id: q0595

**Say:** I check validation in both places, because the client is only a convenience and the server is the rule. Each field gets equivalence partitions and boundaries: empty, minimum, maximum, one over, wrong format, whitespace, special characters, very long input, Unicode. I test the messages (clear, next to the field, announced to screen readers), the focus after an error, double submit, Back and refresh, autofill and paste, and what the server returns when I bypass the UI with a direct request. I keep the field-by-field checks at the API or component level and one E2E flow in the browser.

**Follow-ups:**
- *Example of a bug you found?* Example: whitespace in email validation: an address with trailing spaces was accepted by the form and rejected later. Fixed it in product code with a test.

**Trap:** Only checking that required fields show an error.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.2.1 and 4.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## Shift left and quality culture

### What does shift-left testing mean, and how do you apply it?

Topic: shift-left | Standard | id: q0596

**Say:** It means testing earlier in the life cycle, which is the "early testing saves time and money" principle. It does not mean neglecting later testing. The practical ISTQB list: review specifications from the tester's view to find ambiguities and gaps; write test cases before the code (TDD, ATDD, BDD); use CI and fast automated component tests on every commit; run static analysis early; start non-functional tests at component level. It costs some effort earlier, and saves more later. For it to work, the stakeholders must buy in.

**Full process:** what I do in practice.
1. Join refinement and ask the tester questions on each story.
2. Agree acceptance criteria with examples before development.
3. Ask for unit and API tests with each change, and review them.
4. Put lint, type checks and a fast smoke suite in the merge request pipeline.
5. Add accessibility checks early: accessible names are cheap in the component and expensive to retrofit.

**Follow-ups:**
- *What is shift right?* Testing and learning in production: monitoring, feature flags, canary releases, observability. It complements shift left.
- *How do you show it works?* Fewer defects found late, shorter cycle time.

**Trap:** Saying it means "developers do all the testing".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.1.5: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between QA, QC and testing?

Topic: shift-left | Standard | id: q0597

**Say:** Quality assurance is process-oriented and preventive: building and improving the way we work so good products come out. Quality control is product-oriented and corrective: checking the product, and testing is a major form of it. ISTQB says QA is the responsibility of everyone on the project, not only of testers. In real jobs the title "QA engineer" covers testing and some QA activities: improving the process, coaching developers, setting quality gates. I describe what I do rather than the label.

**Follow-ups:**
- *Give a QA activity that is not testing.* Defining a Definition of Done, a quality gate in CI, a review checklist, a root cause review after an incident.

**Trap:** Giving a strict textbook split and then using the words interchangeably.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.2.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you define quality, and who is responsible for it?

Topic: shift-left | Standard | id: q0598

**Say:** Quality is the product meeting the needs of its users and the business, under the constraints of time and cost. It includes correct behaviour, and also speed, usability, accessibility, security and reliability. The whole team is responsible. Developers own the quality of their code with tests and reviews, product owners own the clarity of what we build, and testers bring the testing skill, the risk view and the user's voice. ISTQB's whole team approach says anyone with the right skill can do a task, and that independent testers are useful but can create the risk that developers feel less responsible.

**Follow-ups:**
- *How do you build the culture?* Show the cost of late bugs with real examples, make quality visible in the pipeline, and pair with developers.

**Trap:** "QA owns quality."

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 1.5.2 and 1.5.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How do you advocate for testing in a developer-dominated culture?

Topic: shift-left | Standard | id: q0599

**Say:** With evidence and small wins, not arguments. I bring numbers from real incidents: what the escaped bug cost, how long the flaky pipeline blocked merges. I make testing cheap for developers: fast feedback, clear failure output, helpers, and I help them run the suite locally. I join their rituals (refinement, reviews) and review their code, which earns trust. And I put rules into tools so they do not depend on persuasion: lint rules, a merge request check, a quality gate.

**Follow-ups:**
- *What if they resist?* Find one developer who cares, make that team's results visible, and let the results spread.

**Trap:** Acting as the quality police.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.5.2 (whole team approach): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Tell me about a time you improved a testing process.

Topic: shift-left | Standard | id: q0600

**Say:** A good rule is to write down recurring review issues like fixed sleeps, brittle locators, and forced clicks, and turn them into ESLint errors, so the check runs on every merge request and the discussion moves to design. Another improvement: remove duplicated and dead tests, helpers and page-object members, and raise the standard with a native TypeScript type-check. The result is a smaller suite with fewer review comments about style.

**Follow-ups:**
- *How did you measure it?* Fewer repeated comments, a faster review, and fewer flaky failures. I do not have a single clean number for the lint rules.

**Trap:** A tooling story without an outcome.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.1.6 (retrospectives and process improvement): https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the Definition of Done and the Definition of Ready?

Topic: shift-left | Standard | id: q0601

**Say:** The Definition of Ready is the entry criterion for a story: it is clear, estimated, and has acceptance criteria, so the team can start. The Definition of Done is the exit criterion: the code is reviewed and merged, tests exist and pass at the right layers, acceptance criteria are met, no open critical bugs, documentation is updated, and it is deployable. These are the ISTQB entry and exit criteria in agile words. A good Definition of Done contains test items, which makes quality part of every story.

**Follow-ups:**
- *Who owns the Definition of Done?* The team, agreed together. In the Scrum Guide it is a commitment for the Increment, and every item must meet it.
- *Is the Definition of Ready part of Scrum?* No. The Scrum Guide has no Definition of Ready. Teams add it as a working agreement, and it should not become a gate that blocks refinement.

**Trap:** A Definition of Done that nobody checks.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 5.1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is independence of testing, with its pros and cons?

Topic: shift-left | Standard | id: q0602

**Say:** It is how separate the tester is from the author of the work: the author themselves, a peer, a tester outside the team, or an outside organisation. More independence brings different biases and finds different defects. The cost is possible isolation from the team, a blame culture, developers feeling less responsible for quality, and testers seen as a bottleneck. Most projects use several levels: developers do component tests, a test team does system testing, and the business does acceptance. I like the embedded model, where QA sits in the team and keeps an independent view.

**Follow-ups:**
- *Which level is best?* None in general. It depends on the risk: high-risk or regulated areas need more independence, low-risk ones less.
- *How do you keep independence and fast feedback?* Keep testers in the team with their own view and test design, and let developers write the unit and component tests.

**Trap:** Assuming more independence is always better, or that independent testers replace developer testing. Full separation slows feedback and loses context, and developers still catch most defects early.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.5.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## ISTQB and terminology

### What are the seven ISTQB testing principles?

Topic: istqb | Core | id: q0603

**Say:** One, testing shows the presence of defects, not their absence. Two, exhaustive testing is impossible, so use techniques, prioritisation and risk. Three, early testing saves time and money. Four, defects cluster together, an example of the Pareto principle. Five, tests wear out: repeated tests stop finding new defects, so tests and data need to change. Six, testing is context dependent. Seven, the absence-of-defects fallacy: finding and fixing all defects does not make a system useful. In the older syllabus I studied, five was called the pesticide paradox.

**Follow-ups:**
- *Which principle explains scepticism when no regression defects appear for several iterations?* Tests wear out (pesticide paradox): the same tests no longer find new defects, so review and change them. In automated regression the same repetition can be useful, because it keeps old defects away.
- *Which option shows "exhaustive testing is impossible" in practice?* Choosing tests with risk and techniques such as equivalence partitioning and prioritisation, rather than trying all inputs.

**Trap:** Giving the 2011 names as if they were current. The 4.0 names are "tests wear out" and "absence-of-defects fallacy".

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Which ISTQB syllabus version do you hold, and what has changed since?

Topic: istqb | Core | id: q0604

**Say:** The Foundation Level was passed in 2016, which was the 2011 syllabus by the revision history. ISTQB confirms older certificates stay valid and the certificate does not expire. The current syllabus is CTFL v4.0.1 (September 2024, an errata release of v4.0 from 2023). Version 4.0.1 covers the test pyramid and testing quadrants, shift left, the whole team approach, and collaboration-based techniques (user stories, acceptance criteria, ATDD) next to the classic techniques. The parts used daily match what is done.

**Trap:** Claiming the new certificate. Say you hold the older one, valid, and you know the current content.

**Follow-ups:**
- *Will you take the new exam?* Only if the role needs the current certificate. The content is what matters, and I know it.

**Source:** ISTQB, CTFL v4.0 release note: https://istqb.org/istqb-releases-certified-tester-foundation-level-v4-0-ctfl/ ; ISTQB.com CTFL page (current revision 4.0.1): https://www.istqb.com/certifications/ctfl/

### What is the difference between verification and validation?

Topic: istqb | Core | id: q0605

**Say:** Verification checks that the system meets the specified requirements: did we build it right. Validation checks that it meets the needs of users and stakeholders in its real environment: did we build the right thing. Testing includes both. Principle seven says verification alone is not enough.

**Follow-ups:**
- *Give an example.* Verification: the booking form rejects 15 nights, as the spec says. Validation: guests can actually book the stay they want, which a spec mistake could still block.
- *Who does validation?* Testers with users and stakeholders, for example in acceptance testing or a demo.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.1: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the difference between testing and debugging?

Topic: istqb | Core | id: q0606

**Say:** Testing triggers failures or finds defects. Debugging finds the cause of a failure, analyses it and removes it: reproduce, diagnose, fix. Then confirmation testing checks the fix, and regression testing checks side effects.

**Follow-ups:**
- *Do testers debug?* They can narrow it down: a minimal repro, logs, a trace, the failing request. Fixing the code is usually the developer's job, though testing can include fixing product bugs.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 1.1.2: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### Explain test basis, test condition, test case, test procedure, test suite and testware.

Topic: istqb | Core | id: q0607

**Say:** The test basis is what we derive tests from (requirements, stories, designs). A test condition is a testable aspect we identified from it. A test case is the inputs, preconditions and expected results used to check a condition. Test procedures order test cases and are grouped into test suites. Testware is every work product from the test process: plans, cases, data, scripts, results and reports.

**Follow-ups:**
- *Example of a test condition?* "A stay of the maximum length is accepted", derived from the requirement "1 to 14 nights". The test case then gives the input (14 nights) and the expected result.

**Source:** ISTQB Glossary (test condition, testware), Foundation V4.1: https://www.erikvanveenendaal.nl/site/wp-content/uploads/ISTQB-Glossary-Foundation-V4.1-2023.pdf

### What is the difference between static and dynamic testing?

Topic: istqb | Standard | id: q0608

**Say:** Dynamic testing runs the software. Static testing does not: it covers reviews and static analysis (linting, type checks) of code and documents. Static testing finds defects directly, so there is no failure to reproduce, and it can start before any code exists.

**Follow-ups:**
- *Example of static testing you do?* Code review of test merge requests, ESLint and the TypeScript type check in CI, and reviewing stories before refinement.
- *Why is it cheaper?* A defect found in a requirement or in review costs a comment. Found in production, it costs a fix, a release and user impact.

**Source:** ISTQB CTFL Syllabus v4.0.1, chapter 3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is the main purpose of equivalence partitioning, and what is the main difference between black-box and experience-based techniques?

Topic: istqb | Standard | id: q0609

**Say:** Equivalence partitioning reduces the number of tests by testing one value per group of inputs that the system treats the same, while keeping coverage of every behaviour. Black-box techniques derive tests from specifications and models. Experience-based techniques derive them from the tester's skill, intuition and knowledge of how software fails.

**Follow-ups:**
- *How does it combine with boundary values?* Partitioning picks one value per group; boundary value analysis then tests the edges of each group, where most defects are.
- *Example of an experience-based technique?* Error guessing or exploratory testing with a charter.

**Source:** ISTQB CTFL Syllabus v4.0.1, sections 4.2.1 and 4.4: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

## BDD, TDD, ATDD and Gherkin

### What is BDD, and how does it differ from TDD and ATDD?

Topic: bdd | Standard | id: q0610

**Say:** BDD, behaviour-driven development, is a way for business, developers and testers to agree on behaviour through concrete examples, and then keep those examples as automated checks. Dan North started it as a better way to teach TDD: talk about behaviour, not tests. TDD is the developer's practice of writing a failing unit test, then the code, then refactoring. ATDD writes acceptance tests from the acceptance criteria before development, with the customer, developer and tester together. BDD is close to ATDD, with a stronger focus on shared language and the Given, When, Then format. If you have used Gherkin scenarios, say so; if not, say so plainly and explain the limits of your experience with Cucumber or ATDD in a team.

**Follow-ups:**
- *What are the three BDD practices?* Discovery (conversations about examples), Formulation (writing them in a structured form), Automation (turning them into executable checks), per the Cucumber documentation.
- *Is BDD about the tool?* No. Cucumber's own docs say there is much more to BDD than using Cucumber.

**Trap:** Saying BDD means "tests written in Gherkin". The conversation is the point, and the files are a side effect.

**Source:** Cucumber, Behaviour-Driven Development: https://cucumber.io/docs/bdd/ ; Dan North, Introducing BDD: https://dannorth.net/blog/introducing-bdd/ ; ISTQB CTFL Syllabus v4.0.1, section 2.1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is Gherkin? Explain Feature, Scenario, Given/When/Then, Background and Scenario Outline.

Topic: bdd | Standard | id: q0611

**Say:** Gherkin is the plain-language format Cucumber reads. A Feature groups related scenarios (called Example or Scenario). Each scenario has steps: Given sets the context, When is the action or event, Then is the observable result, and And or But continue the previous one. Background holds Given steps repeated before every scenario in the feature. Scenario Outline runs the same scenario once per row of an Examples table. Rule (since Gherkin 6) groups scenarios under one business rule.

**Full process:** a small feature file based on the coupon decision table.

```gherkin
Feature: Coupons at checkout

  Rule: A coupon cannot be combined with the member discount

    Background:
      Given a cart with one item priced 100.00

    Scenario Outline: Discount applied for member and coupon status
      Given the customer is "<customer>"
      When they apply the coupon "<coupon>"
      Then the total is <total>
      And the coupon is "<coupon result>"

      Examples:
        | customer | coupon | total | coupon result |
        | a member | SAVE10 | 95.00 | rejected      |
        | a guest  | SAVE10 | 90.00 | accepted      |
        | a guest  | OLD10  | 100.00| rejected      |
```

Each row is one case. The step text maps to step definitions written in code.

**Follow-ups:**
- *Doc strings and data tables?* A doc string passes multiline text to a step. A data table passes pipe-delimited rows.
- *Declarative or imperative?* Declarative: "When Bob logs in", not a list of clicks. Cucumber's own guide asks: will this wording need to change if the implementation does?

**Trap:** Writing UI steps ("click the blue button") in scenarios.

**Source:** Cucumber, Gherkin Reference: https://cucumber.io/docs/gherkin/reference/ ; Cucumber, Writing better Gherkin: https://cucumber.io/docs/bdd/better-gherkin/

### What is the Three Amigos, and what is Example Mapping?

Topic: bdd | Standard | id: q0612

**Say:** The Three Amigos is a short conversation between a product owner, a developer and a tester about a story before development, to find gaps and agree on examples. Example Mapping is a way to run it with four colours of cards: a story (yellow), rules (blue), examples (green), and open questions (red). It should fit in about 25 minutes per story, and if it does not, the story is too big or unclear.

**Source:** Cucumber, Discovery workshop: https://github.com/cucumber/website/blob/main/docs/bdd/discovery-workshop.md ; Matt Wynne, Introducing Example Mapping: https://medium.com/@mattwynne/introducing-example-mapping-42ccd15f8adf

### What are the downsides and anti-patterns of BDD with Cucumber?

Topic: bdd | Standard | id: q0613

**Say:** The tool is easy to adopt and hard to use well. Common failures: only testers write the scenarios, with no business conversation, so you pay for a text layer for no gain. Scenarios become long UI scripts with imperative steps. Step definitions turn into a pile of regular expressions that are hard to reuse. Scenarios are slow, because they run through the UI. For a team of developers who read code well, plain tests are often cheaper. BDD pays off when business people really read and write examples.

**Follow-ups:**
- *Do you use it with Playwright?* If you have not used Cucumber with Playwright in production, say so, and explain that you can use Cucumber.js with Playwright in the step definitions, or Playwright-BDD, a package that runs `.feature` files with the Playwright runner. I would try it where product people want to read the scenarios, and use plain Playwright tests otherwise.
- *What is living documentation?* Examples that are checked automatically against the system, so documentation stays true. Gojko Adzic notes that this needs cheap automation to keep working.

**Trap:** Selling BDD as a way to "write tests in English" that anyone can maintain.

**Source:** Cucumber, Writing better Gherkin: https://cucumber.io/docs/bdd/better-gherkin/ ; Gojko Adzic, Specification by Example, 10 years later: https://gojko.net/2020/03/17/sbe-10-years.html ; Playwright-BDD docs: https://vitalets.github.io/playwright-bdd/

### What is ATDD, and how would you start it in a team?

Topic: bdd | Standard | id: q0614

**Say:** ATDD, acceptance test-driven development, is a test-first approach: before a story is built, the customer, developer and tester analyse it in a specification workshop, write acceptance tests as examples, and the team implements the story until those tests pass. Positive cases come first, then negative cases, then non-functional ones. State clearly if you have not run it as a team practice. I would start with one team and one story type: a short workshop per story, examples in Given, When, Then or a table, and one automated example at API level.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 4.5.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### What is TDD, and does a QA engineer need it?

Topic: bdd | Standard | id: q0615

**Say:** In test-driven development the developer writes a failing test, writes the minimum code to pass it, and refactors, in short loops. It directs the coding by tests. A QA engineer does not need to do TDD, but should understand it, because it shapes the unit tests we review and the tests we do not need to repeat at higher layers.

**Source:** ISTQB CTFL Syllabus v4.0.1, section 2.1.3: https://istqb.org/wp-content/uploads/2024/11/ISTQB_CTFL_Syllabus_v4.0.1.pdf

### How does Given-When-Then relate to Arrange-Act-Assert?

Topic: bdd | Standard | id: q0616

**Say:** They are the same idea in two vocabularies. Given is the setup (arrange), When is the exercised behaviour (act), Then is the verification (assert). Martin Fowler also links it to the Four-Phase Test pattern. I use the shape in any test, with or without Cucumber.

**Source:** Martin Fowler, Given When Then: https://martinfowler.com/bliki/GivenWhenThen.html
