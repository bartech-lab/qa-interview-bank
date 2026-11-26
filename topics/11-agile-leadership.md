# Agile, leadership, release management, metrics and communication

How to study this file: read each Say out loud until it sounds like you, then close the file and answer the follow-ups without it. Learn the Scrum and Kanban sections word for word first, because interviewers use them to check that you do not mix the two. Facts about Scrum follow the November 2020 Scrum Guide, and facts about Kanban follow the May 2025 Kanban Guide. Both guides are short, and quoting them correctly is a seniority signal. Where a question asks for a story, use your own and never invent one.

## Scrum: framework, events, accountabilities and artifacts

### What is Scrum, in one minute?

Topic: agile | Core | id: q0940

**Say:** Scrum is a lightweight framework for complex work. The Product Owner orders the work in a Product Backlog. The team takes a slice of it into a Sprint, a fixed length of one month or less, and turns it into a usable Increment. At the end the team and its stakeholders inspect the result and adjust. It rests on empiricism: you decide from what you observe, using transparency, inspection and adaptation. In my own words, it is short feedback loops with fixed rhythm, not a list of meetings.

**Follow-ups:**
- *What are the five Scrum values?* Commitment, Focus, Openness, Respect, Courage.
- *Is Scrum a methodology?* The Guide calls it a framework, and says it is deliberately incomplete: it names only the parts needed for the theory. Techniques like story points or user stories are not part of it.

**Trap:** Describing Scrum as "a set of ceremonies" or "a project management method". The Guide does not use the word ceremonies, calls the meetings events, and says only the whole of Scrum is Scrum: using some parts is possible, but "the result is not Scrum".

**Source:** https://scrumguides.org/scrum-guide.html

### What are the Scrum events, and how long is each one?

Topic: agile | Core | id: q0941

**Say:** There are five events, and the Sprint contains the other four. The Sprint is one month or less. Sprint Planning is at most 8 hours for a one-month Sprint. The Daily Scrum is 15 minutes, every working day. The Sprint Review is at most 4 hours, and the Sprint Retrospective at most 3 hours, both for a one-month Sprint. For shorter Sprints the events are usually shorter. A new Sprint starts right after the last one ends, so there is no gap.

**Full process:** Order inside one Sprint:
1. Sprint Planning: why is this Sprint valuable (Sprint Goal), what can be Done, how will the work get done.
2. Daily Scrum, every day: the Developers inspect progress toward the Sprint Goal and adapt the Sprint Backlog.
3. Work, with Product Backlog refinement as needed (refinement is an activity, not one of the five events).
4. Sprint Review, the second to last event: the team shows the Increment to key stakeholders and talks about the Product Backlog.
5. Sprint Retrospective, the last event: the team plans ways to raise quality and effectiveness.

**Follow-ups:**
- *Is Backlog Refinement an event?* No. It is an ongoing activity. Many teams hold a meeting for it, but the Guide does not make it a formal event.
- *Who attends the Daily Scrum?* The Developers. The Scrum Master and Product Owner join as Developers only if they work on Sprint Backlog items.
- *Is the Sprint Review a demo?* No, it is a working session: stakeholders and the team review what was done, what changed in the environment, and what to do next.

**Trap:** Saying "four ceremonies: planning, daily, review, retro" and leaving out the Sprint itself, or saying the Daily Scrum is a status report to the Scrum Master. It is the Developers' own planning meeting for the next day of work.

**Source:** https://scrumguides.org/scrum-guide.html

### Who is in a Scrum Team, and what is each person accountable for?

Topic: agile | Core | id: q0942

**Say:** A Scrum Team is one Scrum Master, one Product Owner and the Developers, with no sub-teams and no hierarchy. Typically it is ten people or fewer. The Developers create the Sprint Backlog, instil quality by adhering to the Definition of Done and adapt the plan daily. The Product Owner is one person, accountable for maximising the value of the product and for managing the Product Backlog. The Scrum Master is accountable for establishing Scrum and for the team's effectiveness. The Guide calls these accountabilities, not job titles.

**Follow-ups:**
- *Where does the tester sit?* There is no tester role in Scrum. "Developers" means anyone who creates any part of a usable Increment, so QA is part of the Developers.
- *Is the Scrum Master the team's manager?* No. The Guide calls Scrum Masters "true leaders who serve the Scrum Team and the larger organization", and says they help remove impediments, they do not assign work.
- *Can the Product Owner be a committee?* No: one person, not a committee. Stakeholders convince that one person.

**Trap:** Saying "a QA is a member who is not a developer", or that the Scrum Master is the project manager. Both break the Guide.

**Source:** https://scrumguides.org/scrum-guide.html

### What are the Scrum artifacts, and what is the commitment behind each?

Topic: agile | Core | id: q0943

**Say:** There are three artifacts: the Product Backlog, the Sprint Backlog and the Increment. Each has one commitment that gives it focus. The Product Backlog has the Product Goal. The Sprint Backlog has the Sprint Goal. The Increment has the Definition of Done. This is why Definition of Done is part of Scrum itself, and a team cannot skip it. Work that does not meet the Definition of Done is not part of the Increment and goes back to the Product Backlog.

**Follow-ups:**
- *What is the Sprint Backlog made of?* The Sprint Goal (why), the selected Product Backlog items (what) and an actionable plan (how). It is a plan by and for the Developers.
- *Can the Increment be released before the Sprint Review?* Yes. The Guide says the Sprint Review should never be a gate to releasing value.

**Trap:** Saying "burndown chart" or "user stories" are artifacts. They are techniques some teams use, not Scrum artifacts.

**Source:** https://scrumguides.org/scrum-guide.html

### What is the Sprint Goal, and what happens when the scope changes mid-Sprint?

Topic: agile | Core | id: q0944

**Say:** The Sprint Goal is the single objective of the Sprint, and the Developers commit to it. It gives flexibility in the exact work. If the work turns out different from what the team expected, the Developers talk to the Product Owner and renegotiate scope without hurting the Sprint Goal. Nothing should change that endangers the Goal, and quality does not drop. Only the Product Owner can cancel a Sprint, and only if the Goal becomes obsolete.

**Follow-ups:**
- *An urgent item arrives on day 5. What now?* In Scrum, the Product Owner and Developers decide whether it endangers the Sprint Goal. If it does not, they swap scope. If the Goal is now meaningless, the Product Owner may cancel the Sprint. Kanban simply pulls it in under its own policy.
- *What if the team cannot finish everything?* Scope is renegotiated with the Product Owner. The Sprint is not extended, because Sprints are fixed length.

**Trap:** Saying the Sprint commitment is "all the stories". The commitment is the Sprint Goal, not every item.

**Source:** https://scrumguides.org/scrum-guide.html

### What does a tester do in Sprint Planning, refinement and the Daily Scrum?

Topic: agile | Standard | id: q0945

**Say:** In refinement I read each item as a tester: are the acceptance criteria testable, what are the edge cases, what data and environment do I need. In Sprint Planning I add testing and automation work to the plan, because the Developers plan the work to reach the Definition of Done, and that includes testing. In the Daily Scrum I say what blocks the Sprint Goal, for example an environment or a bug that stops a story. I do not wait for "done" code: I test as parts land.

**Follow-ups:**
- *Who owns quality?* The whole team. The Guide says Developers instil quality by adhering to the Definition of Done, so QA helps, but does not own it alone.
- *What do you bring to refinement that others miss?* Questions about failure paths, permissions, data states and what "works" means, which turn into acceptance criteria.

**Trap:** Describing QA as a phase after development inside the Sprint. That is a mini waterfall, and it produces a pile of untested items on the last day.

**Source:** https://scrumguides.org/scrum-guide.html

### How does testing fit into a Scrum sprint, from day one to the last day?

Topic: agile | Standard | id: q0946

**Say:** Day one, in Planning, I make sure every item has testable acceptance criteria and a test plan, and I raise risks early. During the Sprint I test each item as soon as a developer has something running, on a branch or a test environment, and I write the automated checks in the same Sprint. Near the end I run the regression suite on the integrated build and check the Definition of Done. I do not save testing for the last two days. If many items arrive late, I say so in the Daily Scrum, because that risks the Sprint Goal.

**Full process:** A working rhythm:
1. Before the Sprint: refinement, acceptance criteria, risks, test data needs.
2. Planning: testing and automation tasks sit in the Sprint Backlog next to development tasks.
3. Days 1 to 7: test small slices as they land, pair with the developer on risky parts, add automated tests with the change.
4. Days 8 to 9: regression on the integrated build, exploratory sessions on the riskiest areas, fix verification.
5. Last day: confirm the Definition of Done, prepare what to show at the Review, note what to improve for the Retrospective.

**Follow-ups:**
- *What if a blocker bug appears late?* Tell the team at once, in the channel and the Daily Scrum, with steps to reproduce and impact. The Product Owner decides about scope, and the team decides how to fix it. Do not hold it until the Review.
- *Regression: daily, per sprint, or before release?* Automated regression on every merge or nightly, and a full run before release. Manual regression only where automation does not pay off.

**Trap:** "Testing happens at the end of the Sprint." Testing is continuous in the Sprint, and a Sprint that tests only on the last days will miss its goal.

**Source:** https://scrumguides.org/scrum-guide.html

### What is the Definition of Done, and who owns it?

Topic: agile | Standard | id: q0947

**Say:** The Definition of Done is a formal description of the state of the Increment when it meets the quality measures required for the product. It is a commitment inside Scrum, and the Developers must follow it. If an item does not meet it, it cannot be released, or even shown at the Review. If the organisation has a standard Definition of Done, every team follows it as a minimum. Otherwise the team writes its own. For QA, the useful DoD says what testing counts: for example, acceptance criteria verified, automated tests merged, no open critical bugs, regression green.

**Follow-ups:**
- *Does the DoD apply to a ticket or to the Increment?* The Guide defines it for the Increment. Teams often also use it per backlog item, which works, because the moment an item meets it an Increment is born.
- *When should the DoD change?* In the Retrospective, when the team sees quality problems that a new criterion would prevent, for example "no new flaky tests".

**Trap:** Confusing the DoD with acceptance criteria. Acceptance criteria are specific to one story. The DoD applies to every item.

**Source:** https://scrumguides.org/scrum-guide.html

### Definition of Done, Definition of Ready and acceptance criteria: what is the difference?

Topic: agile | Standard | id: q0948

**Say:** Acceptance criteria are specific to one story: the testable conditions that story must meet. Definition of Done is the same list of quality conditions for every item, such as code reviewed, tests passing, deployed to staging. Definition of Ready is a team agreement about when a backlog item is clear enough to start, for example it has criteria, a size and no open dependency. Done and acceptance criteria are checked at the end. Ready is checked at the start. The important point is that the Scrum Guide has Done, but it does not have Ready.

**Follow-ups:**
- *Is Definition of Ready part of Scrum?* No. The Guide says items are "ready for selection" if the team can do them within one Sprint, and does not name a Definition of Ready. It is a popular team tool. Used as a gate it can slow the flow, so I keep it light.
- *How do you use acceptance criteria as a tester?* Each criterion maps to at least one check, manual or automated. If I cannot test a criterion, I send it back to refinement.
- *Give a bad acceptance criterion.* "The search is fast." A good one states a measurable condition: "results show within 2 seconds for 10,000 products."

**Trap:** Treating a long Definition of Ready as a gate that stops all work. Atlassian describes DoD as high-level criteria for increments and DoR as low-level criteria for backlog items. Use DoR to prevent unclear items, not to block the team.

**Source:** https://www.atlassian.com/agile/project-management/definition-of-done

### What makes a good acceptance criterion, and how do you write one?

Topic: agile | Standard | id: q0949

**Say:** A good criterion is clear, short, testable and about the outcome, not the implementation. I can map each one to a check that passes or fails with no opinion involved. I write them as examples with Given, When, Then when behaviour depends on state, or as a short checklist when it is simple. I also push for the negative cases: invalid input, no permission, slow dependency. Words like fast, easy, user friendly are a flag, because nobody can test them.

**Follow-ups:**
- *Who writes them?* The Product Owner or analyst owns the content, but QA, the developers and the PO shape them together in refinement, often in a short Three Amigos talk.
- *Do acceptance criteria replace test cases?* No. They are the minimum that must be true. Test design adds the edge cases, combinations and risks the criteria do not mention.

**Trap:** Writing criteria that describe the implementation ("uses a Redis cache"). Criteria say what the user or the system must do, so the team can pick the solution.

**Source:** https://www.atlassian.com/work-management/project-management/acceptance-criteria

### How do you estimate testing effort in a sprint or for a feature?

Topic: agile | Standard | id: q0950

**Say:** In Scrum the Developers size items, and testing is part of the item, so I do not give a separate "QA estimate" that hides in a queue. Before I estimate I break the item into test tasks: test design, data setup, environment, automation, exploratory sessions, regression and fixes. For a bigger piece I use three numbers: best case, likely and worst case, then weigh them as (best + 4 times likely + worst) divided by 6. I add time for bug fixing and retesting, because first-pass testing alone is never the whole cost. I compare to a similar past item, because past data beats gut feeling.

**Follow-ups:**
- *Do you use story points?* The Scrum Guide does not require them. They are a relative size for the whole item. I use them when the team does, and I make sure the size includes the testing effort.
- *How do you estimate a regression pass?* From the last run: number of checks, time per check, number of failures that needed triage. For automated suites the cost is mostly triage and maintenance, not run time.
- *What if the estimate is too big for the Sprint?* Split the item, cut the scope with the Product Owner, or automate less now and say clearly what the risk is.

**Trap:** Estimating only the "execution" time. Retests, data and environment problems usually decide the real cost.

**Source:** https://scrumguides.org/scrum-guide.html

### How many tests, or automation stories, do you automate per sprint?

Topic: agile | Standard | id: q0951

**Say:** I do not set a number, because a count tells nothing about value. I automate by risk and cost: what breaks users, what changes often, what is slow to check by hand, and what is stable enough to automate. Each Sprint, new behaviour gets automated checks as part of the Definition of Done, and a share of capacity goes to maintenance: fixing flaky tests and removing duplicates. I report what the checks protect, not how many exist.

**Follow-ups:**
- *What if management wants a number?* Offer a better measure: time-to-feedback, flake rate, or which risky flows have automated checks.
- *Do you ever delete tests?* Yes, duplicated or no-longer-valuable tests, if I can show evidence. A smaller trusted suite beats a big noisy one.

**Trap:** Answering with a figure such as "ten tests per sprint". It shows you optimise for count.

**Source:** https://scrumguides.org/scrum-guide.html

### What is the Sprint Retrospective for, and how do you make it useful?

Topic: agile | Standard | id: q0952

**Say:** It is the event where the team plans ways to improve quality and effectiveness. It covers people, interactions, processes, tools and the Definition of Done. It is useful only when it ends with a small number of changes that someone owns and that show up in the next Sprint, even in the Sprint Backlog. A retro that repeats the same complaints is a symptom. As QA I bring evidence, for example the flaky tests that blocked three merges, instead of opinions.

**Follow-ups:**
- *What if the retro becomes a complaint session?* Limit the topics, pick one improvement with an owner, and check it first thing in the next retro.
- *Who attends?* The Scrum Team.

**Trap:** Saying the retro is for "what went well and badly" only. The output is the changes, not the list.

**Source:** https://scrumguides.org/scrum-guide.html

### What is the Product Backlog and what is refinement?

Topic: agile | Standard | id: q0953

**Say:** The Product Backlog is an emergent, ordered list of what is needed to improve the product, and the single source of work for the Scrum Team. Refinement is the ongoing activity of breaking items down and adding detail such as a description, order and size. The Developers who do the work size the items, and the Product Owner helps them understand trade-offs. Items that can be done within a Sprint are ready for selection. Good refinement prevents Planning from turning into a requirements meeting.

**Follow-ups:**
- *Who orders it?* The Product Owner is accountable, and may delegate the work.
- *What is the Product Goal?* A future state of the product, the long-term objective. It sits in the Product Backlog. The team fulfils or abandons one goal before taking the next.

**Trap:** Saying the Product Backlog is fixed. The Guide calls it emergent.

**Source:** https://scrumguides.org/scrum-guide.html

### How do you deal with bugs in an agile team?

Topic: agile | Standard | id: q0954

**Say:** A bug found inside the Sprint on an item in progress is not a new item: it is part of finishing that item to the Definition of Done. A bug that escapes, or a bug on old work, goes to the Product Backlog with severity, impact and steps to reproduce, and the Product Owner orders it. Critical bugs get handled at once, even if that means swapping Sprint scope. I keep the bug report self-contained: expected, actual, steps, environment, evidence, and a guess at the cause if I have one. I do not let a bug backlog grow quietly, because each old bug loses context.

**Follow-ups:**
- *Who decides priority?* The Product Owner decides the order, QA provides severity and risk. They are not the same: severity is the technical impact, priority is the business order.
- *Do you fix bugs yourself?* When the cause is clear and I can fix it with tests, yes, then it goes through normal review.

**Trap:** Saying QA decides what gets fixed. QA informs. The Product Owner orders.

**Source:** https://scrumguides.org/scrum-guide.html

## Kanban, and Scrum versus Kanban

Keep Kanban clearly apart from Scrum. Learn the contrast table in the last entry of this section and be able to draw it.

### What is Kanban?

Topic: agile | Standard | id: q0955

**Say:** Kanban is a strategy for optimising the flow of value through a process. It has three practices that work together: define and visualise the workflow, actively manage the items in it, and improve it. The board shows the workflow, a limit on work in progress keeps it from overloading, and the team pulls new work only when there is capacity. There are no fixed iterations, no required roles and no required meetings. Flow means the movement of potential value through the system, and Kanban tries to balance effectiveness, efficiency and predictability.

**Follow-ups:**
- *Where does it come from?* The Toyota Production System. The knowledge-work version took shape on a team at Corbis in 2006, per the Kanban Guide.
- *Is a board with columns Kanban?* Not by itself. Without WIP control, a policy for each state and flow metrics, it is a task board.

**Trap:** Saying "Kanban is a board with To Do, Doing, Done". The board visualises the workflow, but the control of work in progress is the core.

**Source:** https://kanbanguides.org/english/

### What is a WIP limit, and why use one?

Topic: agile | Standard | id: q0956

**Say:** A WIP limit is a cap on how many items can be in progress at once, for the whole workflow or for one column. It forces the team to finish before starting. It makes bottlenecks visible: when a column hits its limit, the people upstream cannot push more work in, so they help clear the blocker. It also cuts context switching. WIP control creates a pull system: you start new work only when there is a signal that capacity is free.

**Follow-ups:**
- *What number should the limit be?* Start from the current average number of items per state, then adjust from the data. Do not change it at the first breach. If it is breached all the time, the limit is too tight or the process is weak.
- *Can you break a WIP limit?* The Kanban Guide says acceptable exceptions should be explicit in the Definition of Workflow, for example an expedite item for an urgent bug.

**Trap:** Saying the limit is a target to fill. It is a ceiling. Staying below it is fine.

**Source:** https://www.atlassian.com/agile/kanban/wip-limits

### The Testing column has a WIP limit of 3 and holds 3 items. What should happen, and what happens to cycle time if the team raises the limit to clear the queue faster?

Topic: agile | Standard | id: q0957

**Say:** With three items already in Testing, nothing new enters. The team should swarm: testers finish an item, developers help with testing or fix a blocker, and nobody pushes a fourth item. If the team raises the limit to clear the queue faster, the cycle time goes up, not down. By Little's Law, average cycle time is average WIP divided by throughput. More items in progress with the same throughput means each item waits longer. The queue was a sign of a bottleneck, and a bigger limit hides it.

**Full process:** A worked example for Little's Law:
1. Throughput: 5 items finished per week.
2. WIP 10 items: average cycle time = 10 / 5 = 2 weeks.
3. Raise WIP to 20 with the same throughput: 20 / 5 = 4 weeks. Same output, twice the waiting.

**Follow-ups:**
- *What fixes the bottleneck?* Look at why testing is slow: too few testers, slow environments, large items, late bugs. Fix the cause, then re-check the limit.
- *Does the formula need steady flow?* Little's Law gives long-run averages, and it assumes a stable system. Use it as a way to reason, not as an exact forecast.

**Trap:** Raising the limit when a column is full. That is the opposite of what the limit is for.

**Source:** https://kanbanguides.org/english/

### What are lead time, cycle time, throughput and work item age?

Topic: agile | Standard | id: q0958

**Say:** Cycle time is the elapsed time from when a work item starts to when it finishes. Lead time, in common usage, runs from when the request arrives to when it is delivered, so it includes the waiting before work starts. Throughput is the count of items finished in a period. Work item age is how long an unfinished item has been in progress so far. The May 2025 Kanban Guide makes four metrics mandatory: WIP, throughput, work item age and cycle time. It does not define lead time, so I say which definition I mean.

**Follow-ups:**
- *What is a Service Level Expectation?* A forecast of how long an item should take, with a probability, for example "85% of items finish in 8 days or less". It comes from historical cycle time.
- *How do you use work item age?* It shows items that are stuck right now, before they finish late. Compare each age with the SLE.
- *Why a percentile and not an average?* Cycle times are skewed: a few long items distort the mean, so a percentile is a better promise.

**Trap:** Using lead time and cycle time as the same word. Say where each starts and stops.

**Source:** https://kanbanguides.org/english/

### What is a Definition of Workflow, and what is a Kanban board?

Topic: agile | Standard | id: q0959

**Say:** The Definition of Workflow is the team's explicit, shared understanding of its flow. The Guide says it needs six parts: what a work item is, when work is started and finished, the states between, how WIP is controlled, policies for how items move through each state, and a service level expectation. The Kanban board is the visualisation of it. It makes at least those elements visible, so the team can see them and improve them.

**Follow-ups:**
- *What is a policy?* An explicit rule, for example "an item moves to Testing only when its code review is approved."
- *Is the Definition of Workflow the same as the Definition of Done?* No. Done is a quality bar for an item. The workflow defines the whole path and its rules, and it can include a done state.

**Trap:** Mixing "Definition of Workflow" with "Definition of Done". They are different concepts.

**Source:** https://kanbanguides.org/english/

### How does testing work in Kanban compared with Scrum?

Topic: agile | Standard | id: q0960

**Say:** Testing is part of the flow, not part of a Sprint. An item is pulled into a Testing state when there is capacity, and it leaves when it meets the team's policy for done. There is no Sprint end to rush toward, so the risk moves from "a pile on the last day" to "a growing queue before Testing". The WIP limit on that state controls the queue. I watch work item age and cycle time to see stuck items. Quality criteria still need to be explicit, as a policy for done.

**Follow-ups:**
- *How do you handle a release?* Items can be released as soon as they are done. Regression and release checks run per change or on a schedule.
- *How do you handle an urgent bug?* Follow the team policy, usually an expedite lane with its own limit, which the Kanban Guide allows if the exception is explicit.

**Trap:** Saying Kanban has no testing discipline because it has no events. Policies, not events, hold the quality bar.

**Source:** https://kanbanguides.org/english/

### What is the difference between Scrum and Kanban? (the clear comparison)

Topic: agile | Standard | id: q0961

**Say:** Scrum works in fixed-length Sprints, with a Sprint Goal and three accountabilities: Product Owner, Scrum Master and Developers. It has five events and three artifacts. Kanban is continuous flow with no iterations and no required roles. It controls WIP and manages flow with metrics like cycle time and throughput. Scrum asks "what do we commit to this Sprint", and Kanban asks "how do we get items through the system faster and more predictably". Changes in Scrum are judged against the Sprint Goal. In Kanban a priority can change when an item is pulled, as long as WIP rules hold.

**Full process:** Comparison to learn, and to draw on a whiteboard:

| | Scrum | Kanban |
|---|---|---|
| Cadence | Fixed Sprints, one month or less | Continuous flow, no iterations |
| Accountabilities | Product Owner, Scrum Master, Developers | None required |
| Events | Sprint, Planning, Daily Scrum, Review, Retrospective | None required |
| Planning | Sprint Planning picks the work | Replenish when capacity frees up (pull) |
| Limit | The Sprint Goal and capacity | WIP limit on the workflow or states |
| Change | Judged against the Sprint Goal | Priorities can change as items are pulled |
| Metrics | Not mandatory (teams use burndown, velocity) | WIP, throughput, work item age, cycle time are mandatory |
| Release | Increment may be released any time in the Sprint | Release when an item is done |

**Follow-ups:**
- *Can a team use both?* Yes, often called Scrumban: Sprints with a WIP limit and flow metrics. The Kanban Guide says Kanban can be used to augment other approaches. Name the hybrid honestly. It is not "pure" either one.
- *When do you choose Kanban?* For ongoing work with unpredictable priorities, like support, maintenance or a test automation backlog. Choose Scrum when work fits into planned increments with a clear goal.
- *Which one has a Daily Scrum?* Only Scrum. A Kanban team may hold a daily meeting to review the board, but it is not defined.

**Trap:** Saying Kanban has no rules. It has three practices, a mandatory WIP control, policies and four flow metrics. It simply has no roles or timeboxed events. Another trap is saying "burndown" or "velocity" are Scrum requirements: the Scrum Guide does not mention velocity.

**Source:** https://www.atlassian.com/agile/kanban/kanban-vs-scrum

### Can a team work in Scrum and Kanban at once, and what is Scrumban?

Topic: agile | Standard | id: q0962

**Say:** Yes, teams combine them, and it is commonly called Scrumban. A typical form keeps Sprints, planning and a retro, and adds a WIP limit and flow metrics. The Kanban Guide says Kanban works with other approaches. The Scrum Guide says that only the whole of Scrum is Scrum, so a mix is not Scrum, and I would not call it that. I would say "we use Sprints with a WIP limit on testing" and name exactly what we do.

**Follow-ups:**
- *Why might a QA team prefer it?* Testing gets its own WIP limit, which protects against a last-day pile, while Sprint Goals keep the focus.

**Trap:** Calling any mix "Scrum". The Guide says the result of using only parts is not Scrum.

**Source:** https://kanbanguides.org/english/

## Scaling and SAFe at a concept level

### What is SAFe, and what did you see of it?

Topic: agile | Standard | id: q0963

**Say:** SAFe is the Scaled Agile Framework, a way to coordinate many agile teams on large products. The core unit is the Agile Release Train, a long-lived team of teams, usually 50 to 125 people, with a shared vision and backlog. Every 8 to 12 weeks the train holds PI Planning, a two-day event led by the Release Train Engineer, where teams plan the next Planning Interval and commit to objectives. If you worked inside a SAFe program, say so and from which seat (for example QA on one team's app); if you are not SAFe-certified, say that too.

**Follow-ups:**
- *What does QA do in an ART?* Test within the team's iterations, take part in PI Planning to flag testing dependencies and environment needs, and support the system-level integration across teams.
- *What is the Innovation and Planning iteration?* The iteration where PI Planning takes place, with time for innovation and planning without hurting delivery.
- *Do you like SAFe?* It helps when many teams depend on each other. It adds overhead for one small team. I would say what it gives (alignment, dependency visibility) and what it costs (planning time, rigid cadence).

**Trap:** Claiming SAFe expertise or certification. The record is: worked inside one SAFe program as QA. Another trap is calling PI "Program Increment": the current term on the SAFe site is Planning Interval.

**Source:** https://framework.scaledagile.com/agile-release-train

### What is PI Planning, and what does it produce?

Topic: agile | Standard | id: q0964

**Say:** PI Planning is a cadence-based event for the whole Agile Release Train. It aligns teams and stakeholders on a shared mission and vision. It usually lasts two days, every 8 to 12 weeks, and the Release Train Engineer leads it. It produces committed PI objectives from each team and an ART planning board that shows feature delivery dates and dependencies. As a tester I use it to raise dependencies early, for example a shared test environment, test data, or another team's API.

**Follow-ups:**
- *Why plan face to face?* Direct communication, fast decisions and a visible view of dependencies. Virtual works if everyone takes part.

**Trap:** Describing it as a status meeting. It is a planning event where teams commit.

**Source:** https://framework.scaledagile.com/pi-planning

### How do you test in a large multi-team program, where teams depend on each other?

Topic: agile | Standard | id: q0965

**Say:** I separate what a team can check alone from what needs the other teams. Each team tests its own part, with mocks or stubs for dependencies it does not control. For integration I look for an agreed integrated environment, shared test data and a regular integrated build, because the problems that matter appear at the seams. Contract between teams has to be explicit: what the API promises, what the app sends. I raise dependency and environment risk during the program planning, not on the last day.

**Follow-ups:**
- *Who owns the end-to-end check?* The program needs one place where the integrated build gets tested. In SAFe terms it is the system-level integration, shared by the teams on the train.

**Trap:** Assuming that every team passing its own tests means the product works.

**Source:** https://framework.scaledagile.com/agile-release-train

## Release management, go/no-go, feature flags and rollback

### How do you make a go/no-go call on a release?

Topic: release | Standard | id: q0966

**Say:** Decide from evidence agreed before the release, not from a feeling on release day. Check the exit criteria: no open critical or high bugs without an accepted workaround, the regression suite green on the release build, the riskiest changes tested, and the rollback path known. Then state the remaining risk in plain words: what is not tested, what could break, how we would notice, how fast we can undo it. Give a recommendation, and the person accountable for the release decides.

**Full process:** A repeatable go/no-go:
1. Agree the exit criteria at the start of the release, not at the end.
2. List the changes in the release and rank them by risk (user impact times chance of failure).
3. Check each exit criterion against evidence: test run on the release build, open defects, performance and migration checks.
4. List the known gaps: untested areas, flaky areas, known bugs with workarounds.
5. Check the safety net: rollback or feature flag, monitoring and alerts, who is on call.
6. State go, go with conditions (for example "ship with the flag off"), or no-go, with the reasons and the residual risk.
7. Record the decision and who made it.

**Follow-ups:**
- *Who has the final say?* The release owner or Product Owner decides, because the business owns the risk. QA owns an honest, evidence-based recommendation and the right to say no-go loudly.
- *What if you are pressured to ship?* Show the risk with evidence, offer options (smaller scope, flag off, staged rollout), and put the decision on record.

**Trap:** Saying "QA approves the release". QA reports the quality and the risk. The business accepts the risk.

**Source:** https://sre.google/sre-book/postmortem-culture/

### Could a failing test block a release, and who can override it?

Topic: release | Standard | id: q0967

**Say:** A failing test on the release build blocks until someone has triaged it. Triage has three outcomes: a real product bug, a test problem, or an environment problem. A real bug in a high-risk flow blocks. A flaky or broken test needs fixing, but it should not be waved through silently. An override is allowed only by the release owner, with the reason written down and a ticket for the follow-up. I never hide a product bug with a retry, a skip or a weakened assertion.

**Follow-ups:**
- *What if the suite is often red for flaky reasons?* Then the team no longer trusts it, and a real failure will be ignored. Fix or quarantine flaky tests with a deadline, and track the flake rate.

**Trap:** "We re-run until green". That teaches the team to ignore red.

**Source:** https://dora.dev/guides/dora-metrics/

### A developer wants to skip a failing test and release. What do you do?

Topic: release | Standard | id: q0968

**Say:** I do not say yes or no straight away. I find out two things: why the test fails, and how urgent the release is. For the first, I look at the trace and ask where it fails. If it fails only on the dev or test environment and passes on staging, the cause is usually the environment: test data, config, a third-party sandbox, a feature flag. If it also fails on a production-like build, it is probably a real bug, and I check whether production already has it. For urgency, a hotfix for a live incident is different from a feature with a date nobody would miss. Then I give the release owner options, not only yes or no: release with the feature behind a flag switched off, a manual check of that one flow, or a quarantine with a ticket and an owner. The owner decides, the decision is written down, and the test is fixed right after.

**Full process:** where it fails decides the next step.
1. Open the trace and the error. Is the failure in the test, the environment, or the product?
2. Fails only on dev or test, passes on staging: environment problem. Release can go with the owner's yes; fix the environment and keep a ticket.
3. Fails on staging or a production-like build too: probably a real bug. Block, unless the owner accepts the risk with a fallback: flag off, rollback plan, monitoring.
4. The same bug is already in production: this release does not make it worse. If the release fixes something else urgent, ship it, and raise the bug separately.
5. Test problem (a broken locator, a flaky wait): quarantine it with a reason, an owner and a date, then fix it.
6. Urgency: a live incident hotfix can go with a manual check of the affected flow; a normal release can wait a few hours for the fix.
7. Record who decided, why, and what we release without.

**Follow-ups:**
- *What if it fails on dev only?* Compare the environments: data, config, versions, flags, third-party sandboxes. Prove it by running the test against staging.
- *What if it fails in production too?* Then it is a known live bug. Rate its impact on users and money; the release decision and the bug fix become two separate decisions.
- *What if the developer insists and you disagree?* I give my evidence and my recommendation to the release owner. If the owner accepts the risk, I accept it, and it is written down. I escalate only for serious harm, such as data loss, money or security.
- *Who decides?* The release owner. QA gives the evidence, the risk and the options.

**Trap:** Two extremes. "The test failed, so no release" ignores urgency and the cause. "OK, skip it" without triage may ship a real bug. The other trap is a silent `test.skip` with no ticket.

**Source:** DORA metrics guide: https://dora.dev/guides/dora-metrics/ ; Martin Fowler, Feature Toggles: https://martinfowler.com/articles/feature-toggles.html

### A feature lands on Friday for a Monday release. How do you decide what to test first?

Topic: release | Standard | id: q0969

**Say:** Start with risk. First, what the change touches and what breaks users or money if it fails. Second, the core flows that must work whatever else happens, as a smoke check. Third, the new feature's main path, then its edges. Use the developer's description and the diff to see the blast radius, and ask what can be switched off or rolled back. Then tell the owner clearly what is covered and what is not, so the decision on Monday is informed.

**Follow-ups:**
- *You have 3 days and 200 untested cases?* Rank them by risk and by failure history, run the high-risk ones first, drop duplicates, and automate nothing new that week. Report the coverage by risk level, not as a pass percentage.
- *What do you cut?* Low-risk, low-usage, stable areas with a recent clean run.

**Trap:** Running all cases in a fixed order. With limited time, order is the strategy.

**Source:** https://sre.google/sre-book/embracing-risk/

### What is a feature flag, and how do you test with flags?

Topic: release | Standard | id: q0970

**Say:** A feature flag, or toggle, changes system behaviour without changing code, so a feature can be deployed switched off and released later. There are several kinds: release toggles for unfinished work, experiment toggles for A/B tests, ops toggles to turn off a risky part, and permission toggles for certain users. For testing, I test both states of the flag, the combinations that matter, and the switch itself, on and off. I also check that flags do not pile up, because each flag adds paths to test.

**Full process:** How to test a flagged feature:
1. List the flag, its default and where it is read (frontend, API).
2. Test the flag off: the old behaviour is unchanged. This protects existing users.
3. Test the flag on: the new behaviour, with the data and user types it applies to.
4. Test the switch: turn on during a session and off again, and check nothing breaks and data written under the flag is still valid.
5. Test targeting if the flag is per user or per percentage.
6. After the release, remove the flag and its dead branch, or it becomes debt.

**Follow-ups:**
- *Where do flag bugs hide?* Tests running on a configuration that differs from production. A flag on in test and off in production gives green tests on a path customers never see.
- *Long-lived or short-lived flags?* Release toggles should be transient. Ops and permission toggles can live long.

**Trap:** Testing only flag on. The off state is what current users keep using.

**Source:** https://martinfowler.com/articles/feature-toggles.html

### What is a canary release, and how is it different from blue-green and from A/B testing?

Topic: release | Standard | id: q0971

**Say:** A canary release sends the new version to a small share of users or servers first, watches the metrics, and ramps up if it looks healthy. The rollback is to route users back to the old version. Blue-green keeps two production environments: the new one is tested, then the router switches all traffic at once, and switching back is the rollback. A/B testing is different: it compares variants to test a business hypothesis, and it needs time to reach statistical significance. A canary is a rollout step that ends when the new version takes all traffic. It is not an experiment on user preference.

**Follow-ups:**
- *What do you watch in a canary?* Error rate, latency, key business events, crash rate for mobile, and support signals. Set the rollback thresholds before the rollout.
- *What is hard about blue-green?* The database. Both versions must work with the same schema, or you need a staged migration.
- *Can you use a canary for A/B?* Technically yes, but mixing them hurts both: monitoring for regressions and measuring a hypothesis need different data.

**Trap:** Using canary and A/B as the same thing. One looks for breakage, the other measures preference.

**Source:** https://martinfowler.com/bliki/CanaryRelease.html

### How do you test an A/B test, and what do you check as QA?

Topic: release | Standard | id: q0972

**Say:** I check four things. Assignment: a user lands in one variant and stays there across sessions and devices. Tracking: each variant sends the right events, once. Isolation: variant behaviour does not leak into the other group. And the test itself: tests and visual checks must know which variant they see, or they become flaky. I also check that every variant works on its own, because the losing variant is a real product for part of the users until the test ends.

**Follow-ups:**
- *How does an A/B test affect automation?* Tests need a deterministic variant: force it by a cookie or parameter, or normalise the difference, instead of letting random assignment decide.
- *Who decides the winner?* Product and analytics, with enough sample for significance. QA verifies the measurement is correct.

**Trap:** Assuming the test is correct because the page looks right. A silent tracking bug invalidates the whole result.

**Source:** https://martinfowler.com/articles/feature-toggles.html

### What is your rollback plan, and what makes a release safe to undo?

Topic: release | Standard | id: q0973

**Say:** Before release I ask how we undo it and how long that takes. The fastest options are a feature flag switched off, a router switch back to the old version, or a redeploy of the previous build. The hard part is data: a migration that cannot be reversed makes rollback unsafe, so the plan may be "fix forward" instead. I want monitoring that tells us quickly, and a named person who can press the button. I test the rollback path at least once, not just assume it works.

**Follow-ups:**
- *Rollback or fix forward?* Rollback if the previous version is known good and data is compatible. Fix forward if the change is small and clear, or the data change is not reversible.
- *How do you verify a deployment finished?* A smoke check on the live environment, the version endpoint, health checks, error rate and key flows.

**Trap:** Assuming rollback is always free. Schema and data changes break it.

**Source:** https://martinfowler.com/bliki/BlueGreenDeployment.html

### How does a hotfix process work, and what does QA do in it?

Topic: release | Standard | id: q0974

**Say:** A hotfix is a fast fix for a serious production problem. In a branch-based flow, it branches from the released code, not from the work in progress, and is merged back into the release line and the development line so the fix is not lost. QA does a focused check: the bug is fixed, the neighbouring behaviour still works, and a short smoke test of core flows passes. The speed must not skip review or the pipeline. After the fix, we find the root cause and add a test so it cannot come back.

**Full process:** A hotfix, step by step:
1. Confirm severity and impact, and decide that a hotfix is needed instead of waiting for the next release.
2. Branch from the released tag or the production branch.
3. Fix, with a test that fails without the fix. Code review is still required.
4. Run the pipeline and a small targeted regression plus smoke.
5. Deploy, with the usual monitoring and a named owner.
6. Merge the fix back to all active lines, and tag it.
7. Write a short post-mortem and add the missing check to the suite.

**Follow-ups:**
- *Does your team use Gitflow?* Atlassian describes Gitflow as a legacy model with hotfix branches, now less common than trunk-based flows with feature flags. If you have worked with release branches, tags and protected main branches, describe the experience and the outcome; if not, say so plainly and explain why trunk-based is preferred.

**Trap:** Skipping the pipeline "because it is urgent". Urgent changes cause many second incidents.

**Source:** https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow

### Tell me about a time you found a critical bug late in the release cycle.

Topic: release | Standard | id: q0975

**Say:** The pattern I follow is the same each time: report immediately, with evidence, and do not hold it for a meeting. I describe impact in business terms, give steps to reproduce, say what I know and do not know, and give the options: fix now, ship with the feature off, delay, or ship with a known workaround. Then the owner decides. Afterwards I ask why we found it late, and whether an earlier check could have caught it. I do not have a recorded specific story to tell here, so I tell the principle and then a real adjacent case.

**Follow-ups:**
- *How do you tell the team without blame?* State the facts and the impact, and ask how to fix it. Review the process later, not the person.

**Trap:** Telling a heroic story where QA alone saves the release. Seniors describe the team process.

**Source:** https://sre.google/sre-book/postmortem-culture/

### Tell me about prioritising testing for a large release with many components and not enough time.

Topic: release | Standard | id: q0976

**Say:** I list components, rank them by change size, customer impact and past defects, and test in that order. Core flows get a smoke check first. I use automation for the stable, repeated parts so my manual time goes to what is new or risky. I keep a visible list of what is not tested. Every day I report coverage by risk and the open risks, so the owner sees the trade-off before the deadline, not on it.

**Follow-ups:**
- *How do you get more coverage without more time?* Parallelise runs, share exploratory sessions with developers, and cut duplicates.

**Trap:** Giving a percentage of test cases passed as the status. It hides which risks remain.

**Source:** https://sre.google/sre-book/embracing-risk/

### How do you alert the team about release and daily test runs?

Topic: release | Standard | id: q0977

**Say:** Results must reach the team where they already look. Example: release and daily test runs post to Slack, and the reports showed flaky tests separately from real failures, in ReportPortal and Allure dashboards. An alert is useful only if it is rare and trusted: a red run should mean something. I keep the signal clean by separating flaky from failing, and by fixing or quarantining noisy tests quickly.

**Follow-ups:**
- *What goes in the alert?* The run, the environment, the count of failed tests, a link to the report, and who looks.

**Trap:** Posting every result to a channel until nobody reads it.

**Source:** https://dora.dev/guides/dora-metrics/

### What do you do when a release goes wrong in production?

Topic: release | Standard | id: q0978

**Say:** First stop the damage: roll back, switch the flag off, or reduce traffic, whichever is fastest and safe. Then communicate: who is affected, what we know, when the next update comes. Then fix and verify. After that, a blameless post-mortem: timeline, impact, root causes, and follow-up actions with owners. The goal is to fix the system and process that let it happen, not to find a person to blame.

**Follow-ups:**
- *What does QA add to the post-mortem?* Why our checks missed it, and the specific test or monitor we add so it is caught next time.

**Trap:** Naming the developer who wrote the bug as the cause.

**Source:** https://sre.google/sre-book/postmortem-culture/

## Quality metrics, DORA and OKRs

### Which test metrics do you trust, and which do you distrust?

Topic: metrics | Standard | id: q0979

**Say:** I trust metrics that measure outcomes and that I can verify. Flake rate per test, backed by repeat runs. Time to feedback, meaning how long a change waits for a test result. Escaped defects, meaning bugs found in production, by severity and by area, with the cause. Change failure rate and recovery time. Mutation score on important logic, because it shows whether tests can fail at all. I distrust raw code coverage as a goal, the number of test cases, pass rate alone, bugs per tester, and velocity as a productivity measure. Each is easy to inflate without improving quality.

**Follow-ups:**
- *Why distrust a pass rate?* A 100% pass rate includes skipped tests and tests that cannot fail. Report pass rate together with skipped and flaky counts.
- *Why mutation score?* It injects small bugs and checks that a test fails. A test never seen failing is a candidate, not evidence. Stryker is a common tool used for this purpose on projects.
- *What happens when a metric becomes a target?* People optimise it, not quality (Goodhart's law). DORA lists "setting metrics as a goal" as a pitfall.

**Trap:** Answering "test coverage and number of passed tests". It signals reporting by habit.

**Source:** https://dora.dev/guides/dora-metrics/

### What QA metrics would you report to management, and how do you present them?

Topic: metrics | Standard | id: q0980

**Say:** I report a small set that links to decisions: escaped defects and their causes, time to feedback from CI, flake rate, and the risk status of the coming release. I show the trend, not one number, with a sentence about what it means and what we do next. Managers do not need test counts. They need to know if it is safe to ship, whether we are getting faster or slower, and where the risk is. If a number can be gamed, I pair it with a counter-metric, for example speed with change failure rate.

**Follow-ups:**
- *How do you discuss metrics effectively?* One chart, one message, one action. Say what the number cannot tell.
- *What if the manager asks for a coverage target?* Ask what decision the number should support, then offer a better measure of risk coverage.

**Trap:** Sending a dashboard with twenty numbers and no conclusion.

**Source:** https://dora.dev/guides/dora-metrics/

### What are DORA metrics?

Topic: metrics | Standard | id: q0981

**Say:** DORA is a research programme that identified five software delivery performance metrics. Three measure throughput: change lead time (commit to production), deployment frequency, and failed deployment recovery time. Two measure instability: change fail rate and deployment rework rate. The older "four keys" used mean time to restore instead of recovery time and had no rework rate. DORA's finding is that speed and stability are not a trade-off: top teams are good on both. I use them as a concept to talk about delivery health. I do not claim to have run them as a programme.

**Follow-ups:**
- *Which does QA influence most?* Change fail rate and recovery time, through test quality, release checks and fast detection. Lead time too, through a fast, trusted pipeline.
- *What are the pitfalls?* Setting them as goals, comparing different applications, one metric to rule them all, and siloed ownership.

**Trap:** Quoting the four keys as the current list. The current model has five metrics.

**Source:** https://dora.dev/guides/dora-metrics/

### What is an escaped defect, and how do you use the number?

Topic: metrics | Standard | id: q0982

**Say:** An escaped defect is a bug that reaches production, or a later stage than it should have been found. I count them by severity and by area, and for each one I ask why our checks missed it: no test, wrong layer, flaky test ignored, unclear requirement. The number alone does not say much, because it depends on release size. The causes tell me what to fix. A rising trend in one area shows where to invest in tests.

**Follow-ups:**
- *Defect detection percentage?* Defects found before release divided by all defects found before and after. It is useful, but it is slow, because the after count grows over time.
- *Do you blame QA for escapes?* No. Escapes are a team process signal.

**Trap:** Using escaped defects to rank testers.

**Source:** https://dora.dev/guides/dora-metrics/

### What is flake rate, and how do you measure it?

Topic: metrics | Standard | id: q0983

**Say:** Flake rate is the share of runs where a test fails and then passes with no code change. I measure it per test over many runs, not only from CI history, because CI mixes in real failures. For a suspect test I repeat it many times under the same conditions, for example 200 runs on several workers, and record failures and retries. A fix counts only if the repeat run is clean. I keep a list of the worst tests, because a few cause most of the noise.

**Follow-ups:**
- *Retries?* Not global ones. A retry only on a named test with a reason, otherwise retries hide the signal.
- *What do you do with a test you cannot fix?* Quarantine it with an owner and a deadline, not an infinite skip.

**Trap:** Counting a test as fixed because it passed once.

**Source:** https://dora.dev/guides/dora-metrics/

### Is code coverage a good metric?

Topic: metrics | Standard | id: q0984

**Say:** It is a useful hint and a poor goal. Low coverage in a risky area tells me where tests are missing. High coverage does not tell me the tests are good: a test can run a line and assert nothing. When coverage becomes a target, people write tests to move the number. I prefer risk coverage (which important flows are protected), and mutation testing to check that tests can fail.

**Follow-ups:**
- *Legacy system with little testing, where do you start?* Map the critical flows, add a few high-value checks around them, fix what breaks most, and grow from there with each change.

**Trap:** Defending a target such as 80%.

**Source:** https://dora.dev/guides/dora-metrics/

### Have you worked with OKRs, and what do you think of them?

Topic: metrics | Standard | id: q0985

**Say:** Yes, work with OKRs. Be honest if you are not a fan of how they are usually applied. The idea is fine: an ambitious objective and measurable key results. In practice, key results often measure output, like "automate 200 tests", and not outcome, and people optimise the number. That is the same problem as any metric used as a target. When using them, write key results as outcomes, such as flake rate or time to feedback, and keep them out of personal evaluation.

**Follow-ups:**
- *How should OKRs be graded?* Google's guide: a 0 to 1.0 scale, with 0.6 to 0.7 the sweet spot, and says OKRs are not employee evaluation.
- *Give a good QA key result.* "Reduce CI feedback time on the main branch from 40 to 20 minutes" or "cut the flake rate of the checkout suite below 1%".

**Trap:** Criticising OKRs with no alternative, or complaining about the team. Give the reason and what works.

**Source:** https://rework.withgoogle.com/en/guides/set-goals-with-okrs

### The suite takes six hours and leadership wants it in thirty minutes. What do you do?

Topic: metrics | Standard | id: q0986

**Say:** First measure where the time goes: per test duration, setup cost, queueing, retries. Then cut in order of cost. Run in parallel and shard across machines. Remove duplicated coverage and move checks to a cheaper layer. Fix slow setup by using API or seeded data in place of UI steps. Split the suite: a fast set on every merge, the full suite nightly. Tell leadership what each change risks and what 30 minutes can and cannot cover.

**Follow-ups:**
- *Is it always possible?* Not for all tests. A smaller set that gives fast signal plus a nightly full run is the realistic answer.

**Trap:** Promising 30 minutes before measuring.

**Source:** https://dora.dev/guides/dora-metrics/

## Leading and mentoring

### Tell me about your experience leading a QA team.

Topic: lead-mentor | Core | id: q0987

**Say:** State your real years of leadership and the form it took; do not round up. Lead duties often sit next to hands-on testing: test planning, risk analysis, defect prioritisation with other teams, mentoring juniors, interviewing QA candidates, owning a suite and reviewing merge requests. Name the ones you really did. Lead by example and by standards, and say whether you want a formal lead role.

**Follow-ups:**
- *Did you manage people formally?* Not as a line manager. Lead work, set standards and mentor.

**Trap:** Claiming seven years of leading. Name the real form: for example part-time lead duties plus code ownership.

**Source:** None official: this is practice, not a documented standard.

### How do you mentor junior and mid-level QA engineers?

Topic: lead-mentor | Core | id: q0988

**Say:** I start with where the person is and what they want to learn, then give small real tasks with a clear definition of done. I pair on the first one, review the next ones with explanations, then let them work alone. I explain the why, not only the fix, and I point to docs, not only my opinion. I let people make small safe mistakes. Review comments are the main teaching tool, and I mark what is optional so learners do not feel everything is blocking.

**Full process:** A mentoring cycle:
1. Agree on a goal and a short list of skills (test design, bug reports, automation, API).
2. Give a task of a size they can finish, with a clear definition of done.
3. Pair on the first one, so they see how I think.
4. Review the next one with reasons, and mark nits as optional.
5. Let them own a task end to end and present it.
6. Check progress every few weeks, and change the plan.

**Follow-ups:**
- *What do you do with someone who does not improve?* Check expectations and tasks first, give specific feedback, set a short plan, then tell their manager.

**Trap:** Taking over the task. The learner learns nothing.

**Source:** https://google.github.io/eng-practices/review/reviewer/standard.html

### How do you review other people's tests?

Topic: lead-mentor | Core | id: q0989

**Say:** I check what the test proves, then how it is built. Does it fail for the right reason: have I seen it fail? Does the assertion state the real contract, not a weakened one? Are locators user-facing (role, label, text), with no sleeps, no forced actions and no XPath? Is data isolated and cleaned up? Is it the right layer, or would an API or unit test do? Is it a duplicate? Is the name clear? I leave small points marked as optional and block only on real problems, as in the Google review guide: approve when the change improves code health, even if it is not perfect.

**Follow-ups:**
- *How do you keep reviews fast?* Small merge requests, automatic checks for the repeated comments, and quick turnaround.
- *Do you suggest a fix?* Yes, with a snippet the author can adapt.

**Trap:** Reviewing style only. A pretty test that cannot fail is the worst case.

**Source:** https://google.github.io/eng-practices/review/reviewer/standard.html

### How do you interview and hire QA engineers?

Topic: lead-mentor | Core | id: q0990

**Say:** Interviewing QA candidates often involves checking three things: how they think about testing (risk, test design, a bug they found), whether they can do the hands-on work (a small exercise, reading a bug report, an API call or a test), and how they communicate. A realistic task is preferred over trivia. Ask for the reasoning, not only the answer, and give every candidate a short chance to ask questions. Write down evidence for each point so the decision does not rest on a feeling.

**Follow-ups:**
- *Red flags?* Only listing tools, blaming others for every failure, no examples of their own work.
- *How do you judge a junior?* Curiosity, structure, and how fast they learn from a hint.

**Trap:** Asking trivia from memory and rating confidence.

**Source:** None official: this is practice, not a documented standard.

### How do you onboard a new QA engineer into your framework?

Topic: lead-mentor | Core | id: q0991

**Say:** Day one they run the suite locally and see a test pass. First week they fix a small known problem and get a first review. I give a short written guide: how the project is laid out, the locator and data rules, how to debug with the trace viewer. Then a real small task. The goal is a first merged change in the first week, because it teaches the whole flow.

**Follow-ups:**
- *What goes in the guide?* Setup, rules and why, how to run and debug, where results go, who to ask.

**Trap:** Handing over a wiki link and no first task.

**Source:** None official: this is practice, not a documented standard.

### Tell me about leading a cross-functional effort to improve product quality. What changed?

Topic: lead-mentor | Standard | id: q0992

**Say:** Use a real case of your own. The shape of a strong one, for example accessibility work: tests relied on test ids, XPath and copy text, and the product lacked accessible names and roles. You proposed making the product accessible, then moving the tests onto roles and names, across frontend, design and QA. The result: tests locate by role and name, XPath and parent hops are gone from the touched specs, and real users of assistive technology got the same names the tests use.

**Follow-ups:**
- *How did you get buy-in?* It fixed a team pain (flaky locators) and a product gap (WCAG) in one move.

**Trap:** Telling only your own part. Say who else had to change.

**Source:** None official: this is practice, not a documented standard.

### Tell me about leading a post-mortem after a significant quality issue.

Topic: lead-mentor | Standard | id: q0993

**Say:** I would run it blameless, soon after the incident. Preparation: a timeline from logs and chat. In the meeting: what happened, impact, how we found it, root causes (plural), what worked, and actions with owners and dates. Keep the focus on systems and process, not people. Follow the actions up in the next retro. If there is no recorded post-mortem, describe how one would be run.

**Follow-ups:**
- *Which technique for causes?* Five whys, or a timeline with contributing factors. Stop at actions the team can change.

**Trap:** Ending with "be more careful". That is not an action.

**Source:** https://sre.google/sre-book/postmortem-culture/

### What do you do when a team member disagrees with your technical decision?

Topic: lead-mentor | Standard | id: q0994

**Say:** I ask for their reasoning and the evidence behind it. If data decides, I follow the data, even when it proves me wrong. If it is a judgement call, I explain mine and the trade-off, and the owner of the area decides. I say what would make me change my mind. Once decided, we commit, and we review the result later.

**Follow-ups:**
- *What if they were right?* Say so plainly and change the plan.

**Trap:** Winning the argument. The goal is the best decision.

**Source:** https://google.github.io/eng-practices/review/reviewer/standard.html

## Stakeholders, managers, clients and pushing back

### How do you talk about risk to managers and clients?

Topic: stakeholders | Core | id: q0995

**Say:** I use their language: impact, likelihood and what we can do about it. Not "the locator is flaky", but "checkout may fail for users on slow connections, about one in twenty, and we can ship with the new flow switched off". I give a recommendation with options and costs, a plain statement of what I do not know, and a date by which the decision is needed. I say it directly and early, in writing, so it is on record. I have told risks directly to clients in the past.

**Follow-ups:**
- *How do you avoid sounding alarmist?* Use evidence, size the impact, and give a way forward with each risk.
- *What if they ignore the risk?* Record the decision and who accepted it, then help make the release as safe as possible (flag, monitoring, rollback).

**Trap:** Handing over a list of bugs with no ranking. A manager cannot act on it.

**Source:** https://sre.google/sre-book/embracing-risk/

### Tell me about a time you pushed back on a decision. How did you do it?

Topic: stakeholders | Core | id: q0996

**Say:** I push back on the decision with evidence, not on the person. I state the concern, the data behind it, the consequence, and an alternative that meets their goal. I do it privately first if I can, and in writing so it is clear. If they still decide the other way, I accept it when the risk is theirs to accept, and I make sure the risk is written down. I escalate only when the harm is serious, such as security or data loss.

**Follow-ups:**
- *When do you escalate?* Data loss, security, legal exposure, or a safety risk. Otherwise the owner decides.
- *What if you were wrong?* Say so and thank them for the correction.

**Trap:** "I always win". Or "I never push back". Both sound false.

**Source:** https://scrumguides.org/scrum-guide.html

### Tell me about a time you disagreed with a peer or stakeholder on a quality approach.

Topic: stakeholders | Core | id: q0997

**Say:** My approach is to turn an opinion into a test. If we disagree about whether a test is flaky or a product bug, I repeat it many times and show the result. That settles most cases without anyone losing face. For judgement disagreements, I write down both options with their costs, and the owner decides. Example: a test failed 7 times in 200, and it was shown to be a product race, then fixed.

**Follow-ups:**
- *And if evidence does not settle it?* The owner of the area decides, and we revisit after a set time with data.

**Trap:** Presenting a made-up conflict. Interviewers ask follow-up questions that expose it.

**Source:** https://sre.google/sre-book/postmortem-culture/

### Tell me about a time you presented technical information to non-technical people.

Topic: stakeholders | Core | id: q0998

**Say:** I start with what it means for them, then the minimum detail. Example: for the migration of legacy conversations, tables were not explained. Instead, it was stated which message types are proven to land correctly and which are only rendering checks and not evidence. For a Mailgun problem, a short deliverability report covered the cause and the effect on customers. Use one picture or table, avoid jargon, and finish with the decision needed.

**Follow-ups:**
- *How do you check they understood?* Ask them to say the decision in their own words.

**Trap:** Showing the tooling. They care about the outcome.

**Source:** https://scrumguides.org/scrum-guide.html

### How do you work with product managers and business analysts?

Topic: stakeholders | Core | id: q0999

**Say:** Work with them early. Read requirements as a tester and ask about edge cases, permissions and what "done" means, so the acceptance criteria are testable before work starts. Turn business rules into examples and checks. Tell them what is seen in test results in terms of product impact. Keep one shared source of truth for requirements, and raise gaps the moment they are found.

**Follow-ups:**
- *What if requirements are unclear?* Write down my assumption, ask, and test against the answer. Do not test against a guess.
- *What do you give them back?* Questions, examples and a clear risk view.

**Trap:** Waiting for finished requirements. By then change is expensive.

**Source:** https://www.atlassian.com/work-management/project-management/acceptance-criteria

### How do you work with clients directly, including UAT?

Topic: stakeholders | Standard | id: q1000

**Say:** Agree on scope and acceptance with the client before UAT, give them clear test scenarios and an environment with stable data, and explain how to report issues. During UAT triage what they find: defect, change request or misunderstanding, and answer quickly. Report status with facts.

**Follow-ups:**
- *What is hardest in UAT?* Clients test different things than the plan, so I give scenarios and also watch what they try.

**Trap:** Treating every client remark as a bug.

**Source:** https://scrumguides.org/scrum-guide.html

### How do you keep a distributed, international team aligned?

Topic: stakeholders | Standard | id: q1001

**Say:** Write things down and be explicit. Decisions go in a shared place, not only in a call. Overlap on a few hours a day, record the context in tickets and merge requests, and use short async updates. Avoid idioms and check understanding.

**Follow-ups:**
- *Time zones?* Afternoon meetings with US teams work well for me from Central European time.

**Trap:** Relying on hallway talk that remote people miss.

**Source:** https://scrumguides.org/scrum-guide.html

### How do you handle conflicting priorities from several stakeholders?

Topic: stakeholders | Standard | id: q1002

**Say:** I do not decide between them. I make the conflict visible and send it to the person who owns priority, the Product Owner or the manager. I bring the facts: effort, risk and deadline for each request. In Scrum, stakeholders convince the Product Owner, who orders the backlog. I then keep everyone informed of the result.

**Follow-ups:**
- *What if you are the one overloaded?* Show the list, ask which item should wait, and agree.

**Trap:** Saying yes to everyone and missing every date.

**Source:** https://scrumguides.org/scrum-guide.html

## Analytical thinking, independence and problem solving

### How do you approach a hard problem you have never seen before?

Topic: soft-skills | Core | id: q1003

**Say:** I define the problem and what "fixed" means. Then I gather facts and reproduce it, and change one thing at a time. I make hypotheses, test the cheapest ones first, and write down what I ruled out. I measure, not guess: when a test failed 7 times in 200, I ran it 200 times to confirm before and after. If I am stuck for a set time, I ask with a short summary of what I tried.

**Full process:** A debugging routine:
1. Reproduce the failure and record the exact conditions.
2. Read the evidence: trace, logs, network, screenshots.
3. Classify: race, ambiguity, overlay, environment or product bug.
4. Form a hypothesis, then a test that could prove it wrong.
5. Change one variable, repeat many times, compare counts.
6. Fix the cause, not the symptom, and keep proof (the numbers) in the merge request.

**Follow-ups:**
- *When do you ask for help?* After a short time-boxed attempt, with what was tried and what is thought.

**Trap:** Trying random changes until it passes.

**Source:** https://sre.google/sre-book/postmortem-culture/

### How do you work independently, and how do you manage automation work with no one directing it?

Topic: soft-skills | Core | id: q1004

**Say:** I turn a vague goal into a short plan with priorities and a first deliverable, and I share it so people can correct me early. I pick work by value: what blocks the team, what fails often, what protects the riskiest flows. I keep a visible list and update it. I ask for review early, and I report outcomes with numbers.

**Follow-ups:**
- *How do you avoid working on the wrong thing?* Check priorities with the owner regularly, and drop work that no longer matters.

**Trap:** Working alone for weeks without review.

**Source:** None official: this is practice, not a documented standard.

### Describe your role and responsibilities at your last job.

Topic: soft-skills | Core | id: q1005

**Say:** Example: owning large parts of the Playwright and TypeScript end-to-end suite as code owner. Fixed flaky tests at the root and proved it with repeat runs, made accessibility the locator contract, built a feature flag drift guard, and reviewed 321 merge requests. When the cause was in product code, fixed it there, across React, a PHP API and CI. The role ended on 30 October 2026.

**Follow-ups:**
- *What are you proudest of?* The 7 of 200 to 200 of 200 redirect fix, because it was a product bug found through a test.

**Trap:** A list of tools instead of outcomes.

**Source:** None official: this is practice, not a documented standard.

### How do you decide what to do first when everything seems urgent?

Topic: soft-skills | Core | id: q1006

**Say:** I sort by impact on users and on the team's ability to ship, then by cost. Things that block others come first. Then the risky changes, then the improvements. I say what I will not do and who agreed. I re-check when something changes.

**Follow-ups:**
- *What if your manager disagrees?* Show the list and impact, and follow their decision after saying my concern.

**Trap:** Doing the loudest request first.

**Source:** https://scrumguides.org/scrum-guide.html

### What do you do when you realise you made a mistake?

Topic: soft-skills | Core | id: q1007

**Say:** I say it early, state what happened and the impact, fix it, and say what I changed so it cannot repeat. I do not hide it and I do not over-apologise. A mistake caught early is cheap. The same holds for a test I wrote: if it never fails, I say so and fix it.

**Follow-ups:**

**Trap:** Saying "I never make mistakes", or a fake weakness.

**Source:** https://sre.google/sre-book/postmortem-culture/

### How do you keep quality high in a fast-paced agile environment?

Topic: soft-skills | Standard | id: q1008

**Say:** Put checks where they are cheap. Small changes, automated checks in the pipeline on every merge, and a clear Definition of Done. Standards enforced by tools, not by memory: Playwright rules were made into ESLint errors so reviewers do not repeat comments. Fix flaky tests fast so red means something. Test risky changes more, and trivial ones less.

**Follow-ups:**
- *What slows teams down most?* Big batches and untrusted tests.

**Trap:** Saying "more manual testing".

**Source:** https://dora.dev/guides/dora-metrics/

## Documentation

### What documentation do you write as a QA engineer?

Topic: docs | Standard | id: q1009

**Say:** Documentation that people use and that is kept current: how to run and debug the test suite, the rules and why, test strategy and risk areas, release checklist, and bug reports. It is kept close to the code where possible, in a README beside the tool.

**Follow-ups:**
- *How do you keep it current?* Update docs in the same change as the code and delete what is stale.

**Trap:** Writing long documents nobody reads.

**Source:** https://diataxis.fr/

### How do you structure documentation so it is useful?

Topic: docs | Standard | id: q1010

**Say:** I separate four needs: a tutorial to learn, a how-to for a task, reference for facts, and explanation for the why. Mixing them makes docs hard to use. Diátaxis names these four forms. I put the how-to steps first for engineers on a deadline.

**Follow-ups:**
- *Test documentation in agile?* Light and living: acceptance criteria, risk list, test charter and results, not heavy plans.

**Trap:** One giant page with everything.

**Source:** https://diataxis.fr/

### How do you document a bug so a developer can act on it?

Topic: docs | Standard | id: q1011

**Say:** Title with the symptom and place. Steps to reproduce, expected and actual result, environment and version, evidence such as a screenshot, trace or log, and my best guess at the cause if I have one. A developer should reproduce it in minutes with no questions.

**Follow-ups:**
- *Severity or priority?* I set severity from impact. The Product Owner sets priority.

**Trap:** "It does not work" with no steps.

**Source:** https://scrumguides.org/scrum-guide.html

### How do you document the test strategy for a new feature or product?

Topic: docs | Standard | id: q1012

**Say:** One to two pages. Scope, risks ranked, which layer tests what (unit, API, E2E), data and environments, what is automated and what is manual, entry and exit criteria, and what is out of scope. I write it with the team, so it is shared. It changes when risk changes.

**Follow-ups:**
- *Who reads it?* Developers, the Product Owner and new QA.

**Trap:** A 40-page template filled out once and never opened.

**Source:** https://sre.google/sre-book/embracing-risk/
