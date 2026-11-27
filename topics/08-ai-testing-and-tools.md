# AI in QA: tools, prompting, and testing AI systems

## Using AI in QA work

### How do you use AI in your QA work every day?

Topic: ai-tools | Core | id: q0776

**Say:** Claude Code is used in the terminal as the main tool, with MCP servers connected so it can read docs and drive tools. CodeRabbit has been used, which reviewed merge requests, and ChatGPT for quick questions. The agent is let write test scenarios and test code, then expected outputs are defined and the prompt is refined until the result is right. It is also used to analyse existing tests and migrate them. The rule never broken: AI output is a draft, and it is checked like code from a new colleague.

**Full process:** My normal loop with an agent on a test task:
1. Give it the context: the repo rules file (a CLAUDE.md or AGENTS.md with my conventions, for example "no `waitForTimeout`, locators by role, never weaken an assertion").
2. Ask for a plan first, read it, and correct it before any code is written.
3. Let it write the test. Run it with `npx playwright test <file> --repeat-each=10`.
4. Break the product or the test on purpose (see the mutation question) and confirm the test fails.
5. Read the diff line by line before I commit.
Output lands as a normal commit and merge request, so a human reviewer and CodeRabbit still see it.

**Follow-ups:**
- *Which part do you not give to AI?* Deciding what the expected behaviour is, and the final review. The agent can propose, but the oracle (what "correct" means) is my job.
- *Do you use Cursor or Copilot?* They were used about three to four months ago, not now. The current daily tool is Claude Code.
- *Does it make you faster?* Yes on scaffolding, migration and reading unknown code. Not on deciding what to test. I count it in finished, reviewed work, not in lines generated.

**Trap:** Answering "I just ask ChatGPT to write tests". That sounds like copy-paste with no checking. Also do not claim Codex or a current daily Cursor habit.

**Source:** https://code.claude.com/docs/en/memory

### Which AI tools have you used, and what is each one for?

Topic: ai-tools | Core | id: q0777

**Say:** Claude Code is the daily one: terminal agent, reads the repo, edits files, runs commands, uses MCP servers. CodeRabbit is an AI reviewer that comments on merge requests; it has been used. ChatGPT is for quick questions and explanations. Cursor and Copilot were used about three to four months ago, so they are known, but they would not be called current tools. Codex has not been used.

**Follow-ups:**
- *What did you like in Cursor or Copilot?* Inline completion is fast for small edits. An agent in the terminal is better for multi-file work and for running the tests itself.
- *How do you pick a tool?* By what it can check. A tool that can run my tests and read the failure is worth more than one that only suggests text.

**Trap:** Listing every tool you ever opened. Claim only what you used. A stretch on Cursor or Copilot is fine when an ad asks, but say "used about three to four months ago".

**Source:** https://docs.coderabbit.ai/

### What is Claude Code, and how do you configure it for a project?

Topic: ai-tools | Core | id: q0778

**Say:** Claude Code is an AI coding agent that runs in the terminal. It reads the repository, edits files, runs commands, and can call MCP servers. Each session starts with a fresh context, so I keep persistent instructions in a CLAUDE.md file: conventions, commands, rules like "never weaken an assertion". These are instructions, not enforcement. When I need a hard block, I use a hook.

**Full process:** Setting up for a test repository:
1. Create `CLAUDE.md` in the repo root with the commands (`npx playwright test`), the locator and waiting rules, and what is forbidden.
2. Add MCP servers with `claude mcp add` (see the MCP question). Scope `project` writes `.mcp.json`, which the team shares through git.
3. Add a `PreToolUse` hook in settings when a rule must never be broken, for example blocking `git push`. The hook runs as a script and can deny the tool call, the model cannot talk its way around it.
4. Check with `/mcp` that the servers are connected.
The memory file loads at every session start; Claude treats it as context, not as a setting.

**Follow-ups:**
- *Why not only write the rule in CLAUDE.md?* The model can ignore an instruction. A hook is deterministic code, so use it for rules where a mistake is costly.
- *What goes in a rules file for QA?* Locator strategy, waiting policy, test data rules, how to run one test, and the things the agent must ask before changing.

**Trap:** Saying the rules file "forces" the behaviour. The docs say the files are context, and a hook is the way to block an action.

**Source:** https://code.claude.com/docs/en/memory

### How do you check that a test written by AI is a good test?

Topic: ai-tools | Core | id: q0779

**Say:** First, it is read as a reviewer: does it assert the behaviour the requirement names, or just what the code happens to do. Then, it is watched to fail. A small change is made in the product or the test, for example flip a condition, and the test must go red for the right reason. A test never seen fail is a candidate, not evidence. Last, it is run many times to catch flakiness and the locators and waits are checked against the rules.

**Full process:** The check I run on every AI-written test:
1. Read it against the requirement, not against the implementation. List what it asserts. Missing negative case or boundary? Add it.
2. Run it green once: `npx playwright test tests/offer.spec.ts`.
3. Make a one-line mutation in the product code (or stub the response in the test). Examples: `>=` to `>`, remove a validation, return an empty list. Run the test again. It must fail, and the error message must point at the broken behaviour.
4. If it still passes, the test does not check that behaviour. Fix the test, not the mutation.
5. Revert the mutation. Run `npx playwright test tests/offer.spec.ts --repeat-each=20 --workers=4` to find timing flakiness. All 20 must pass.
6. Scan for banned patterns: `waitForTimeout`, `networkidle`, `isVisible()` inside a plain `expect`, assertions that were loosened.
The output is a test that failed once on purpose, passes repeatedly, and has a reason for each assertion.

**Follow-ups:**
- *Is there a tool for the mutation step?* Yes, mutation testing tools such as Stryker make many small changes automatically and report which ones no test caught. If you have used Stryker, explain how it identified untested paths; if not, state that and describe how you would validate its output. For a quick check on one test, a manual one-line change is enough.
- *What if the test fails on the first mutation for the wrong reason?* Then it is a bad test too: it fails on a timeout or setup, not on the assertion. Read the error, not only the colour.
- *Why not trust a green run?* An AI test often asserts the current output, so it is green by construction.
- *Give an example of an empty assertion.* `await expect(alert).toBeHidden()` on an alert that should appear and disappear, without first checking it was visible. It passes even when the alert never showed. Assert `toBeVisible()` first, then `toBeHidden()`.

**Trap:** "I run it and if it passes, it is good". A passing run proves nothing about whether it can fail. Also, never weaken an assertion to make a test pass.

**Source:** https://stryker-mutator.io/docs/

### What does AI usually get wrong in tests?

Topic: ai-tools | Core | id: q0780

**Say:** Five things come up again and again. It asserts what the code does instead of what it should do, so the test is green by construction. It uses weak or missing assertions, for example only checking that the page loaded. It adds sleeps or brittle locators because those pass fast. It fixes a failing test by loosening the assertion instead of finding the bug. And it invents API names, options or data that do not exist. So I review the assertions first and run the test against a deliberate break.

**Follow-ups:**
- *Give a concrete Playwright example.* An agent "fixes" a flaky test with `waitForTimeout(3000)` or by catching the error. The right fix is a web-first assertion or a wait on the real condition, such as a response.
- *How do you reduce it?* Put the rules in the project instruction file, ask for a plan before code, give it the requirement and not only the implementation, and review with a fresh context.
- *Does it test the happy path only?* Mostly. I ask explicitly for boundaries, the second item, and a state change in the middle of a flow.

**Trap:** "AI makes syntax mistakes". Syntax errors are the cheap ones, the compiler catches them. The costly ones compile, pass, and test nothing.

**Source:** https://playwright.dev/docs/best-practices

### What are the limits of AI in test automation?

Topic: ai-tools | Standard | id: q0781

**Say:** AI does not know the product's intent, so it cannot decide what correct means. It cannot see what is not in its context: a business rule, a past incident, a data quirk. It can be confidently wrong, so every output needs a check. It gives different answers on different runs, so it is a poor choice for the checking step itself. And it can leak data if I paste private material. It is strong where the answer can be checked by a machine: a compile, a test run, a diff.

**Follow-ups:**
- *Where is it strongest?* Scaffolding, migrating tests between formats, explaining unfamiliar code, writing first drafts of data and scenarios, summarising a failure log.
- *Where would you never use it alone?* Release decisions, security-sensitive review, and choosing what to cover by risk.

**Trap:** "AI will replace testers" or "AI is useless". Both are lazy. The honest answer is a division of labour: AI drafts, a person owns the oracle and the decision.

**Source:** https://owasp.org/www-project-top-10-for-large-language-model-applications/ (see LLM09 Misinformation: overreliance on unverified output)

### How do you use AI to analyse and migrate existing tests?

Topic: ai-tools | Standard | id: q0782

**Say:** I give the agent a small slice of the old suite and ask it to explain what each test really checks, then I compare that with what the test name claims. For migration, I move one file at a time, with the old and new test running side by side. A migrated test only counts after it passes, and after it fails on a deliberate break, like any new test. I keep the diff small and never let it rewrite working locators that did not need touching.

**Full process:**
1. Pick one spec file. Ask the agent: "List each test, what it asserts, what it does not assert, and any wait or locator that looks fragile." Read the answer against the file.
2. Ask for the migration of that one file only, with the rules from the instruction file.
3. Run old and new: `npx playwright test old.spec.ts new.spec.ts`. Compare the coverage by listing assertions on both sides.
4. Mutate the product once and confirm the new test fails.
5. Commit one file per commit so a wrong migration is easy to revert.

**Follow-ups:**
- *What goes wrong in migration?* Silent loss of an assertion, or a changed wait that hides a race. That is why I diff the assertions, not only the pass result.
- *Why one file at a time?* It keeps each change reviewable and each mistake revertable.

**Trap:** Migrating the whole suite in one agent run. A wall of changes is skimmed, and a lost assertion goes unseen.

**Source:** https://playwright.dev/docs/best-practices

### How do you use AI to find out why a test failed?

Topic: ai-tools | Standard | id: q0783

**Say:** I use it as a second pair of eyes, not as the judge. I give it the trace, the error and the test code, and ask it to sort the failure into a race, an ambiguous locator, an overlay, a test-data or environment problem, or a product bug. Then I reproduce it myself with a trace on and one worker before I change anything. The classification is a hypothesis. A wrong "it is the test" label can hide a real product bug.

**Full process:**
1. Collect evidence: `npx playwright test failing.spec.ts --trace on -j 1`, then `npx playwright show-trace test-results/<run>/trace.zip`.
2. Paste the error, the failing step and the relevant code to the agent. Ask for a ranked list of causes with the evidence for each.
3. Test the top hypothesis: repeat the run `--repeat-each=50` on the unchanged code to get a failure rate, then apply the fix and repeat again.
4. A fix counts when the repeat run goes from some failures to none. A fix that only "looks right" does not count.

**Follow-ups:**
- *Can AI auto-fix flaky tests?* It can propose, and a product team may use a healer-style agent, but I check that it did not just loosen the check or add a sleep.
- *What do you do when the cause is the product?* Report it with the evidence, or fix it if it is small. Example: a test failing 7 of 200 runs passed 200 of 200 after a fix in the product navigation code.

**Trap:** Auto-accepting "the locator is wrong" and editing the test. Triage before change.

**Source:** https://playwright.dev/docs/trace-viewer

### Generate a test strategy with an AI tool. Where does the AI's answer fail at scale?

Topic: ai-tools | Standard | id: q0784

**Say:** The AI strategy looks complete and is generic. It lists every test type but does not rank by risk, because it does not know the customer data, the incidents or the release cadence. At scale it ignores cost: it proposes end-to-end tests for things a unit or API test covers faster. It does not know the team's constraints, like CI time or flaky environments. So I use it to list candidates, then I cut and rank by risk and by cost, and I attach an owner and an exit criterion to each item.

**Follow-ups:**
- *What would you add?* Risk ranking, the test level for each risk, the data strategy, what runs on every merge request versus nightly, and what we deliberately do not test.
- *How do you check the strategy?* By asking what bug each line would catch. A line with no bug in mind is padding.

**Trap:** Handing in the AI strategy unchanged. A strategy is a set of choices, and an AI draft makes none.

**Source:** https://owasp.org/www-project-top-10-for-large-language-model-applications/

### What does a QA engineer do when AI writes most of the code?

Topic: ai-tools | Standard | id: q0785

**Say:** The job moves toward the parts a model cannot do: deciding what correct means, finding what the code and the tests both miss, and checking the evidence. AI-written code arrives faster and in bigger diffs, so review and tests matter more. I check the requirements first, then tests that can fail, then the risky areas: boundaries, state changes, error paths, data. I also check that the agent's tests are not just mirroring its own code. A human still owns the release decision.

**Follow-ups:**
- *Does that change when you test?* Earlier. With fast code generation, a clear acceptance criterion and a failing test first give the agent a target, and give me an oracle written before the code.
- *What is the biggest new risk?* Volume. Large generated changes get skimmed. I ask for smaller changes and for the reason of each.
- *Who tests the AI's tests?* Mutation-style checks and a different reviewer context.

**Trap:** "QA becomes unnecessary" or "QA just reviews prompts". The honest shift is more verification, not less.

**Source:** https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM09 Misinformation, LLM06 Excessive Agency)

### How do you work with an AI code reviewer such as CodeRabbit?

Topic: ai-tools | Standard | id: q0786

**Say:** When an AI reviewer such as CodeRabbit comments on merge requests, treat each finding as a suggestion from a fast but context-poor reviewer: judge it on merit, nitpicks included. Some are real, like a missed edge case or a wrong type. Some are noise or ignore the team's conventions. Never apply one blindly and never dismiss one by category. It adds a first pass; it does not replace the human review.

**Follow-ups:**
- *How did you decide?* Does it name a concrete failing case? Does the fix match our conventions? Does it change behaviour? If I could not tell, I tested it.
- *Can a bot approve an MR?* No. It can raise a flag. A person still decides.

**Trap:** Counting bot comments as quality. The number of findings measures the bot, not the code.

**Source:** https://docs.coderabbit.ai/

### What should you never paste into an AI tool?

Topic: ai-tools | Standard | id: q0787

**Say:** Secrets, customer data and anything not allowed to be shared: API keys, tokens, personal data, private tickets. For test data, use synthetic or scrubbed data. When working from real support data, ensure the pipeline scrubs it first: a rule-based pass, then a model-based detector, then review samples by hand. Also, an agent reads the files it is pointed at, so keep credentials out of the project folder and read config through a filtering tool.

**Follow-ups:**
- *Is a model-based detector enough?* No. It misses things, so I combine it with rules and a manual sample check, and I treat any leak as an incident.
- *What about the agent reading `.env`?* Keep secrets out of reach with permission rules, and give the agent only the variables it needs.

**Trap:** "The vendor says it does not train on my data, so it is fine". Policy is not a control. Do not send what should not leave the machine.

**Source:** https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM02 Sensitive Information Disclosure)

### What is your honest experience with Cursor and Copilot?

Topic: ai-tools | Standard | id: q0788

**Say:** If you have used both tools, clarify your recency and context. For example, having used them a few months ago provides working knowledge, but they may not be daily tools. Copilot provides quick inline completion; Cursor offers an agent inside an editor. Moving to Claude Code may be motivated by a preference for a terminal agent that runs tests and reads failures itself. If a team uses Cursor or Copilot, note the ability to work in them without a long ramp-up.

**Follow-ups:**
- *Would you switch?* Yes, the principle does not change: context, a plan, a check that can fail, and a diff review.

**Trap:** Saying Cursor is your daily driver. It is not, and the interviewer may ask a follow-up that exposes it.

**Source:** https://docs.github.com/en/copilot

### How do you measure whether AI actually helps your testing work?

Topic: ai-tools | Standard | id: q0789

**Say:** I measure outcomes that I can count, not impressions. Time from a requirement to a reviewed and passing test. Defects found in review that came from AI output. The repeat-run pass rate of AI-written tests. How many AI tests survive a mutation check. If the number of tests grows but mutation survivors grow too, the AI added volume and no safety. I would not use lines of code generated as a measure.

**Follow-ups:**
- *How would you run the comparison fairly?* Same task type, same reviewer, a control group without AI, and enough tasks to see past one lucky case.

**Trap:** Quoting a productivity percentage from a vendor. I would only quote a number I measured and can describe the method of.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

## AI agents and MCP

### What is an AI agent, in plain words?

Topic: ai-tools | Standard | id: q0790

**Say:** A chatbot answers a message. An agent is a model in a loop: it gets a goal, picks a tool, such as reading a file, running a command or calling an API, looks at the result, and decides the next step until it is done or stuck. The model does not run the tool itself. The program around it does, and sends the result back. So an agent's power is exactly the tools and permissions it has, which is also where its risk is.

**Full process:** The loop, in the form the vendor documents for tool use:
1. The app sends the model the goal and a list of tools, each with a name, a description and an input schema.
2. The model replies with a structured tool call (in Claude's API a `tool_use` block, with `stop_reason: "tool_use"`).
3. The app runs the tool (client tools run in your app) and sends the output back as a `tool_result`.
4. The model reads it and either calls another tool or writes the final answer.
Over time the context grows with each result, so long runs get slower and costlier, and the model can lose track of early instructions.

**Follow-ups:**
- *Agent versus workflow?* A workflow has a fixed path written by a developer. An agent chooses its own path. For testing, a workflow is easier to make repeatable.
- *Why does a QA care?* Every extra tool is more reachable damage, so I check permissions, approvals and what happens on a tool error.

**Trap:** "An agent is a smarter chatbot". The difference is tools plus a loop, and with them side effects.

**Source:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview

### How would you bring agentic AI flows into our test automation?

Topic: ai-tools | Standard | id: q0791

**Say:** One area first, not everything. I write down what a good result looks like, so a machine can check it, and take a baseline: time per test, bugs found, false alarms. Then agents do the repetitive part: scenarios from requirements, writing the test, running it, first triage of failures. Every agent change goes through the same review and CI as human work, and a new test must fail once before I trust it. People stay on risk decisions and exploratory testing of checkout. If the numbers do not improve after a few weeks, we drop it.

**Example:** the cart case: a test copied from the app was green and missed the bug; a test whose expected value comes from the requirement caught 6 of 6 planted bugs, the simple one 2 of 6. That is the rule agents follow: the expected result comes from the requirement, not from the app.

**Follow-ups:**
- *What does the agent never decide?* Whether a failure is a product bug, and whether we release.
- *How do you stop it weakening tests?* Repo rules file ("never weaken an assertion"), ESLint rules for Playwright, and mutation checks.

**Trap:** promising "AI runs all testing". Say where it stops and how you measure it.

**Source:** https://playwright.dev/docs/test-agents

### How would you audit our current QA process and decide where AI helps?

Topic: test-strategy | Core | id: q0792

**Say:** First two weeks, I measure before I change anything: where bugs come from (production incidents, support tickets), flaky rate, pipeline time, how long a test takes to write, and what the QAs spend their week on. Then I map that against the booking funnel and the six brands. AI goes first where the work is repetitive and the check is cheap: scenarios from acceptance criteria, triage of failing runs, test maintenance. Not into risk calls. I bring you a short list: problem, cost, proposed change, how we will know it worked.

**Follow-ups:**
- *What if the team resists?* Show it working on one small piece with numbers, for example a few role-based locator changes in the product, so the team sees the result before it follows.

**Trap:** proposing tools in week one. Measure first, or the "improvement" cannot be shown.

**Source:** none

### What is MCP (Model Context Protocol), and what is an MCP server?

Topic: ai-prompting | Niche | id: q0793

**Say:** MCP is an open standard for connecting AI applications to outside systems, like files, databases, search or a browser. The docs compare it to USB-C: one plug shape, many devices. An MCP server exposes tools (and data or prompts) in that standard shape. The AI app, such as Claude Code, is the client side and calls them. So I can add a server once and any MCP-aware client can use it. I use Claude Code with MCP servers every day.

**Follow-ups:**
- *Tool, resource and prompt?* A tool is an action the model can call. A resource is data it can read. A prompt is a reusable template the server offers.
- *How is that different from a plain API?* An API is built for developers to call. An MCP server describes its tools so a model can discover and pick them itself.

**Trap:** Describing MCP as a plugin for one vendor. It is an open protocol supported by many clients.

**Source:** https://modelcontextprotocol.io/docs/getting-started/intro

### How do you add an MCP server to Claude Code?

Topic: ai-prompting | Niche | id: q0794

**Say:** One command: `claude mcp add`. For a remote server, pass `--transport http` and the URL. For a local server, put the command after two dashes. Choose a scope: local for the current project, project to write a `.mcp.json` the team shares in git, or user for all projects. Then check it with `/mcp` or `claude mcp list`. Only add servers that are trusted, because their content can carry prompt injection.

**Full process:**
1. Remote server: `claude mcp add --transport http <name> <url>`.
2. Local stdio server: `claude mcp add <name> -- npx -y <package>`. For Playwright: `claude mcp add playwright npx @playwright/mcp@latest`.
3. Add `--scope project` to write `.mcp.json` in the repo root, so the team gets the same config. Claude Code asks each person to approve project servers before use.
4. Put secrets in environment variables and reference them as `${API_KEY}` in the config, never in the file.
5. Verify: `claude mcp list`, then `/mcp` inside a session.
Precedence when the same name exists twice is local, then project, then user.

**Follow-ups:**
- *Where are secrets kept?* In environment variables referenced from the config, not committed.
- *How do you remove one?* `claude mcp remove <name>`.

**Trap:** Committing a token into `.mcp.json`.

**Source:** https://code.claude.com/docs/en/mcp

### What is Playwright MCP, and how is it different from Playwright tests?

Topic: ai-prompting | Niche | id: q0795

**Say:** Playwright MCP is a server that lets an AI agent drive a browser through Playwright. It works on the page's accessibility tree, a structured snapshot with roles, names and element references, so it does not need screenshots or a vision model. It is good for exploring an app and drafting a test. It is not a test: a Playwright test is deterministic code in the repo that runs in CI, while an agent session is exploratory and varies per run. Treat what the agent finds as a draft to turn into a normal test. Do not use it as the basis of a suite unless explicitly validated.

**Follow-ups:**
- *Why the accessibility tree?* It is compact and exact, and it matches how I already write locators by role and name.
- *Where would it fit in your work?* Exploring an unknown page and proposing locators, then I write and verify the test by hand rules.

**Trap:** Saying the agent runs your regression instead of Playwright. Regression must be repeatable.

**Source:** https://playwright.dev/docs/getting-started-mcp

### What are Playwright Test Agents (planner, generator, healer)?

Topic: ai-prompting | Niche | id: q0796

**Say:** They are three agent definitions that ship with Playwright. The planner explores the app and writes a Markdown test plan in `specs/`. The generator turns that plan into test files in `tests/`, checking selectors and assertions live. The healer runs the suite, replays failing steps, proposes a fix and reruns. If you have not run them in production, state that. Use them for a first draft and treat the healer's fixes with suspicion, since a healer can make a test pass by weakening it.

**Full process:** Initialise with `npx playwright init-agents --loop=claude` (the loop can also be `vscode`, `codex` or `opencode`). Playwright writes the agent definitions, a `specs/` folder for plans and a `seed.spec.ts` that sets up the environment. Regenerate the definitions after updating Playwright. Review each plan before the generator runs, and review every healer diff.

**Follow-ups:**
- *How do you check the healer?* Compare the assertions before and after, and run the mutation check.

**Trap:** Claiming experience with them. Say "concept, not used".

**Source:** https://playwright.dev/docs/test-agents

### What are the security risks of MCP servers and agent tools?

Topic: ai-prompting | Niche | id: q0797

**Say:** Two main ones. A server that fetches outside content can carry prompt injection, where text in a web page or document tells the model to do something. And an agent with broad tools can do real damage if it is manipulated or just wrong; OWASP calls that excessive agency, caused by too many functions, too many permissions, or too much autonomy. My controls: only trusted servers, least privilege, narrow tools instead of an open shell, a human approval for high-impact actions, and a hook that blocks the dangerous ones.

**Follow-ups:**
- *How do you test it?* Give the agent a document with a hidden instruction and check that no tool call happens. Check that a tool refuses beyond its permission.
- *Hooks versus instructions?* A hook is deterministic and can deny a tool call. A rule in a prompt can be ignored.

**Trap:** Believing a system prompt rule is a security control.

**Source:** https://genai.owasp.org/llmrisk/llm062025-excessive-agency/

### What is context, and why does context engineering matter?

Topic: ai-prompting | Niche | id: q0798

**Say:** The context window is everything the model sees in one go: instructions, files, tool results, the chat so far. The model knows only that. Context engineering means choosing what goes in: the rules file, the right files, short tool outputs, a clear task. Too little and it guesses. Too much and it loses the point or costs more. Each Claude Code session starts empty, so I keep the durable rules in CLAUDE.md.

**Follow-ups:**
- *What do you do on a long task?* Split it, start fresh sessions with a short brief, and keep notes in a file.

**Trap:** Pasting the whole repo and hoping.

**Source:** https://code.claude.com/docs/en/memory

## Prompting

### How do you prompt an AI to generate good tests?

Topic: ai-prompting | Niche | id: q0799

**Say:** I give it the requirement and the context, not "write tests for this". I state the format, the framework rules, the cases I want, and what it must not do. I ask for a plan first and for expected results taken from the requirement, not from the code. Then I run it, break the product on purpose, and refine the prompt from what failed. The prompt is a draft that I improve with evidence.

**Full process:** A prompt I would use:
```text
Role: you write Playwright tests in TypeScript for our web app.
Requirement: <paste acceptance criteria, not code>.
Context: page object <path>, test data helper <path>.
Rules: locators by role or label; web-first assertions only; no waitForTimeout or networkidle; one behaviour per test; never weaken an assertion.
Cases: happy path, empty input, boundary (max length), server error 500, second item in the list.
Expected results come from the requirement above. If the requirement is unclear, ask me before writing code.
Output: first a plan as a list of test names, wait for my OK, then the code.
```
Steps: (1) run the plan past the requirement, (2) generate, (3) `npx playwright test --repeat-each=10`, (4) mutate once, (5) update the prompt or the rules file with each mistake found, so it does not repeat.

**Follow-ups:**
- *Why put expected results in the prompt?* Otherwise the model derives them from the code and the test confirms the bug.
- *Why a plan first?* It is cheaper to correct a list than a generated suite.
- *Few-shot?* One good existing test as an example makes style and structure match.

**Trap:** "Write tests for this file". That yields tests that mirror the code.

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview

### What prompt engineering techniques do you use?

Topic: ai-prompting | Niche | id: q0800

**Say:** Be clear and specific about the task and the output format. Give examples when the style matters. Separate parts of the prompt with tags or headings, so instructions are not mixed with data. Give the model a role and let it say "I don't know". Break big tasks into steps, with each step checked. And before any of that, define what success means and have a way to test it. The vendor's own guide starts the same way: success criteria and an empirical test come before prompt tuning.

**Follow-ups:**
- *Chain of thought?* Asking for reasoning can help on logic tasks and lets me read where it went wrong, but I do not trust the explanation as proof.
- *When is a prompt the wrong fix?* When the problem is cost or latency, another model can be easier than rewording.

**Trap:** Collecting tricks with no eval. Without a test set you cannot tell whether a prompt change helped.

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview

### How do you test a prompt, so you know a change did not make things worse?

Topic: ai-prompting | Niche | id: q0801

**Say:** I treat a prompt like code with a regression suite. I keep a fixed set of cases with expected results or properties, run the old and the new prompt over the same set, and compare the scores and the list of cases that flipped. A prompt change is accepted when the score does not drop and the key cases still pass. I keep the prompt in version control so I can diff and revert.

**Full process:**
1. Build a case file (JSON or YAML): input, expected value or property, tags.
2. Write a runner that sends each input to the model with prompt version A and version B, scores each output with code, and stores both results.
3. Print the pass rate for each, plus the cases that passed on A and fail on B (regressions) and the reverse.
4. For non-deterministic output, run each case several times and score the pass rate per case.
5. Fail the CI job when a protected case regresses or the pass rate falls under the threshold.

**Follow-ups:**
- *Why list the flipped cases?* A flat average can hide a new failure behind an improvement elsewhere.
- *How big must the set be?* Big enough that one case does not move the score much, and covering edge cases, not only typical input.

**Trap:** Trying the new prompt on two inputs and calling it better.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How do you measure robustness to prompt variations?

Topic: ai-prompting | Niche | id: q0802

**Say:** I take each test case and write several versions of the same request: a paraphrase, a typo, a different order, extra politeness, another language where it matters. The expected result is the same. Then I check that the answer class stays stable. If a harmless reword flips the result, the prompt or the model is fragile, and that shows up as a drop in the pass rate across variants.

**Follow-ups:**
- *Is that the same as prompt injection testing?* No. Variants test harmless wording. Injection tests hostile instructions.

**Trap:** Testing one phrasing.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How do you get structured output from a model, and how do you test it?

Topic: ai-prompting | Niche | id: q0803

**Say:** I ask for a fixed format, such as JSON with named fields, and I validate it in code, not by eye. A schema check catches a missing field, a wrong type or an invalid value before anything downstream sees it. A valid format does not mean a right value, so I add a second check on the content. The injection guidance from OWASP says the same: define the expected output format and validate it with deterministic code.

**Full process:**
```ts
import { z } from 'zod';

const Verdict = z.object({
  label: z.enum(['keep', 'drop']),
  confidence: z.number().min(0).max(1),
});

export function parseVerdict(raw: string) {
  return Verdict.parse(JSON.parse(raw)); // throws on bad shape
}
```
Test cases: valid output, extra text around the JSON, an unknown label, a missing field, a number as a string, and an empty reply. The parser must reject each bad one with a clear error.

**Follow-ups:**
- *Why not trust "return JSON only"?* Models sometimes add prose or break the shape.

**Trap:** Checking only that JSON parses.

**Source:** https://genai.owasp.org/llmrisk/llm01-prompt-injection/

### What is a system prompt versus a user prompt, and why does it matter for testing?

Topic: ai-prompting | Niche | id: q0804

**Say:** The system prompt holds the application's standing rules: role, limits, tone. The user prompt is the person's request. For testing, the system prompt is part of the product and gets versioned and regression-tested. It is also not a secret and not a security boundary. A user can try to override it, and OWASP lists system prompt leakage as its own risk, so I never put credentials in it.

**Follow-ups:**
- *What do you test?* That a normal request follows the rules, and that attempts to override or reveal the prompt do not work.

**Trap:** Storing secrets or access rules in the system prompt.

**Source:** https://genai.owasp.org/llm-top-10/

### What is a good golden set of prompts to run after any prompt or model change?

Topic: ai-prompting | Niche | id: q0805

**Say:** About ten to fifty cases chosen to cover what matters, each with a clear check. Typical cases: the most common user requests, a known past failure, a boundary (very long or empty input), an ambiguous request, an out-of-scope request, a request that must be refused, a prompt injection attempt, a personal data case, a format-sensitive case, and a case in another language if the product supports it. Each case states what it validates, so a failure points to a reason.

**Follow-ups:**
- *How do you keep it useful?* Add every real production failure as a new case, and retire cases that no longer matter.
- *The risk?* Tuning the prompt until the golden set passes while real use gets worse. Keep a held-out set.

**Trap:** A golden set of easy cases only, so it always passes.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

## Testing non-deterministic output

### Our chatbot gives a different answer every time. How do you test it?

Topic: ai-testing | Niche | id: q0806

**Say:** I stop comparing exact text. I split the checks by what can be fixed. The UI and the flow are deterministic, so I test them normally: the message appears, the typing indicator goes away, the handoff button works. The content gets checks on properties, not on words: it is in the right language, it is under a length, it does not contain forbidden text, it has valid JSON, it cites a source. For quality I use a fixed set of cases, a score and a threshold, and repeated runs. The pass rate over the set is the result.

**Follow-ups:**
- *What goes in an E2E suite and what in an eval?* The E2E suite asserts UI that always renders. Answer quality belongs in a separate eval harness with scores.
- *Mock the model?* For UI and flow tests, yes: stub the reply to get a deterministic test. For quality, use the real model.

**Trap:** `expect(reply).toBe('Hello, how can I help?')`. It fails on the first rephrase, and loosening it to a keyword hides real regressions.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### What is a good test oracle for a non-deterministic LLM response?

Topic: ai-testing | Niche | id: q0807

**Say:** There are four kinds, from strongest to weakest. An exact oracle where one right answer exists, like a class label or an extracted number. A property oracle: a rule the answer must satisfy, such as valid JSON, a value inside a set, no personal data, under 200 words. A reference oracle: compare with a known good answer by similarity score. And a judge oracle, where another model grades it against a rubric. I use the strongest one the task allows, and add human review for a sample.

**Follow-ups:**
- *Why prefer code-scored?* It is fast, free, repeatable and not biased.

**Trap:** Using a model judge for everything because it is easy.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### What are property assertions and semantic assertions? Show an example.

Topic: ai-testing | Niche | id: q0808

**Say:** A property assertion checks a rule about the output, not its exact words. Valid JSON, required fields, a length limit, a label from an allowed list, no email address in the text. A semantic assertion checks meaning: the answer says the same as a reference, by embedding similarity, or a judge model decides if it satisfies a criterion. Properties first, because they are cheap and exact. Semantic checks only where meaning is the point, and with a threshold chosen from data.

**Full process:** An eval-harness helper in TypeScript (not an E2E assertion on a product page):
```ts
export function checkReply(reply: string) {
  const problems: string[] = [];
  if (reply.length === 0) problems.push('empty');
  if (reply.length > 800) problems.push('too long');
  if (/\b[\w.+-]+@[\w-]+\.[\w.]+\b/.test(reply)) problems.push('contains an email address');
  if (/ignore (all|previous) instructions/i.test(reply)) problems.push('echoes an injection');
  return problems; // empty array means pass
}
```
Run it over every case. The result is a list of failing cases with a reason, which is readable in CI output.

**Follow-ups:**
- *Threshold for similarity?* Take answers a human labelled good and bad, compute the scores, and pick the cut-off that separates them. Check the false pass and false fail rates.

**Trap:** A similarity threshold picked by feel.

**Source:** https://www.promptfoo.dev/docs/configuration/guide/

### How do you handle flaky failures in LLM tests, and what do repeated runs and thresholds do?

Topic: ai-testing | Niche | id: q0809

**Say:** I separate flaky infrastructure from variable output. For variable output, one run is a sample, not a result. I run each case several times and set a pass-rate rule: for example a critical case must pass 10 of 10, a quality case 8 of 10 or better. I track the rate over time. I do not retry until green, because that hides the very variation I want to see. If a case passes sometimes, I look at the failing outputs and tighten the prompt or the check.

**Full process:**
```ts
const RUNS = 10;
const results = await Promise.all(
  Array.from({ length: RUNS }, () => callModel(testCase.input)),
);
const passed = results.filter((r) => checkReply(r).length === 0).length;
console.log(`${testCase.id}: ${passed}/${RUNS}`);
if (passed / RUNS < testCase.minPassRate) process.exitCode = 1;
```
Output: one line per case with its pass rate, and a non-zero exit code when a rule is broken. Store the lines per run to see drift over time.

**Follow-ups:**
- *How many runs?* Enough to separate a 100 percent case from a 70 percent case; ten is a start, more for borderline ones.
- *Playwright `retries`?* Not for this. Retries in the E2E suite hide flaky tests; repeat-run statistics expose them.

**Trap:** `retries: 3` on an LLM test.

**Source:** https://playwright.dev/docs/test-retries

### Does temperature 0 make an LLM deterministic?

Topic: ai-testing | Niche | id: q0810

**Say:** No. Temperature controls how random the next-token choice is. At 0 the model picks the most likely token, which makes repeats much more likely, but the vendor docs say the results are still not fully deterministic. Hosted inference batches requests and floating-point sums can change order, so a near tie can flip. Also, some newer hosted models no longer let you set temperature at all. So I design tests that tolerate variation, and I report which settings I used.

**Follow-ups:**
- *What did you use?* If you have used local benchmarking, say how you cut noise (e.g., running at temperature 0 on a dedicated server) and how you compare across runs; if not, explain that local server setups reduce hosted variability but require managing the infrastructure yourself.
- *Seed?* Some APIs offer a seed on a best-effort basis. Still not a guarantee.

**Trap:** Saying "set temperature to 0 and the test is stable".

**Source:** https://platform.claude.com/docs/en/api/messages (temperature parameter description)

### What is a golden set, and how do you build and maintain one?

Topic: ai-testing | Niche | id: q0811

**Say:** A golden set is a fixed list of inputs with the expected result or the properties the answer must have. It is the regression suite of an AI feature. I build it from real inputs, including past failures and edge cases, and I label it carefully, ideally by two people. I version it and never change expected values just to make a run pass. I keep a second held-out set I do not tune against, so I can see overfitting.

**Full process:**
1. Sample real inputs (scrubbed of personal data). Add edge cases: empty, long, ambiguous, adversarial.
2. Label each with an expected value or a list of property checks. Store as `golden.jsonl`, one JSON object per line: `{"id":"c-017","input":"...","expect":{"label":"refund"}}`.
3. Split off a held-out part.
4. Run after every prompt, model or threshold change and store the results with the version.
5. Review the failures: a wrong label in the set is a defect in the set.

**Follow-ups:**
- *Size?* Start small and meaningful, grow with each real failure.
- *Risk?* Data leakage: if golden cases leak into prompts or examples, the score is inflated.

**Trap:** Treating the golden set as finished.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How do you catch a regression between two model or prompt versions?

Topic: ai-testing | Niche | id: q0812

**Say:** Run both versions over the same fixed set, with the same settings, and compare per case, not just the average. I report the score of each, the cases that got worse, the cases that got better, and whether the difference is bigger than the run-to-run noise. A new model can raise the average and break a case that matters, so protected cases have their own rule. I save every run with the model name, version, prompt version and threshold.

**Full process:**
```ts
type Run = Record<string, boolean>; // case id -> passed
function diff(a: Run, b: Run) {
  const worse = Object.keys(a).filter((id) => a[id] && !b[id]);
  const better = Object.keys(a).filter((id) => !a[id] && b[id]);
  return { worse, better };
}
```
Output: two lists. The job fails if `worse` contains a protected id. Repeat the baseline run a few times first to learn the noise level.

**Follow-ups:**
- *Why measure noise?* If two runs of the same version differ by 3 points, a 2 point change means nothing.

**Trap:** Comparing one run of each and announcing a winner.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### When is an LLM used as a judge appropriate, and what are its risks?

Topic: ai-testing | Niche | id: q0813

**Say:** It is appropriate for qualities code cannot score, such as tone, helpfulness or whether a summary keeps the meaning, and when a rubric is clear. Risks: the judge is also non-deterministic, can prefer longer or its own style of answers, and can be wrong with confidence. So I use a different model from the one being graded where I can, give a narrow yes/no rubric, and check the judge against human labels on a sample. I measure its agreement before I trust it.

**Follow-ups:**
- *What first?* Use code checks wherever possible, a judge only for the rest.
- *Cost?* Every judged case is another model call, so it adds cost and time to the pipeline.

**Trap:** Using a model to grade its own output without checking the grader.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How would you test a chatbot you have never seen? Give me your plan.

Topic: ai-testing | Niche | id: q0814

**Say:** First I learn what it is for, what it must never do, and who the users are. Then I test in layers. Flow and UI, deterministic: it loads, sends, shows replies, hands off to a human. Then content with a golden set: common questions, out-of-scope questions, ambiguous input, long and empty input, other languages. Then safety: prompt injection, personal data, forbidden actions. Then non-functional: latency, cost per conversation, behaviour when the model service is down or slow. Each area gets a pass rule before I start.

**Follow-ups:**
- *First question to the team?* What is a wrong answer here, and what is the worst that can happen?
- *Failure of the model API?* Test timeouts, error messages the user sees, and that the conversation can continue or hand off.

**Trap:** Starting with clever adversarial prompts before knowing the purpose.

**Source:** https://genai.owasp.org/llm-top-10/

### You tested the UI of an AI agent. What did that cover, and what did it not?

Topic: ai-testing | Niche | id: q0815

**Say:** Be exact about what you tested. UI tests around an AI agent (waiting for replies, the handoff to a human, isolated test state) are E2E tests of a product with non-deterministic replies: you wait on the typing indicator instead of text and assert UI that always renders. That is not evaluating answer quality, completeness or source consistency, and it is not RAG testing. Say which of these you did and which you did not.

**Follow-ups:**
- *What was the hard part?* A handoff test failed 100 percent of the time because of shared test state and router redirects. Isolating the state and fixing the redirect made it pass.
- *How did you harden the reply wait?* The wait follows the typing indicator, not a timer. It passed 34 of 35 local runs, and the one failure was in an untouched step.

**Trap:** Presenting this as LLM evaluation. It was end-to-end UI testing of a product that contains an AI agent.

**Source:** https://playwright.dev/docs/best-practices

### What are the risks of using real customer data to test an AI feature, and how do you reduce them?

Topic: ai-testing | Niche | id: q0816

**Say:** Real data brings privacy risk and also leaks into logs, prompts and reports. So I scrub first. A rule-based pass catches patterns like emails and phone numbers. A model-based detector catches names and context the rules miss. Then a person reviews samples, because both can miss. The scrubbed set goes into a non-production project only. I keep the scrubbing step itself tested with known examples.

**Follow-ups:**
- *Why not synthetic only?* Synthetic data misses real wording and mess. A mix works.

**Trap:** Trusting one automatic scrubber.

**Source:** https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/

## Evaluation concepts and metrics

### What are precision, recall and F1? Explain with a test example.

Topic: ai-testing | Niche | id: q0817

**Say:** Take a classifier that marks messages as "attack" or "normal". Precision answers: of everything it flagged as attack, how many really were. Recall answers: of all real attacks, how many did it find. F1 is the harmonic mean of the two, one number that is low if either is low. Precision is about false alarms, recall is about misses. Which one matters depends on the cost of each mistake.

**Full process:**
```ts
export function metrics(tp: number, fp: number, fn: number) {
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const f1 = (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}
// 40 attacks found, 10 false alarms, 20 attacks missed
// precision 40/50 = 0.80, recall 40/60 = 0.667, F1 = 0.727
```
Check by hand with the formulas: precision = tp / (tp + fp); recall = tp / (tp + fn).

**Follow-ups:**
- *Division by zero?* If nothing is flagged, precision is undefined; state your rule, for example report 0 and say so.

**Trap:** Swapping the two definitions.

**Source:** https://scikit-learn.org/stable/modules/model_evaluation.html

### What is a confusion matrix, and how do you read it?

Topic: ai-testing | Niche | id: q0818

**Say:** A table of predicted classes against true classes. For two classes it has four cells: true positives, false positives, false negatives and true negatives. Each cell is a count of cases. I read it before any single score, because the score hides which mistake is happening. Rows are the true class in scikit-learn's convention, so a count in the "true A, predicted B" cell is a real A that was called B.

**Follow-ups:**
- *Example?* 2 true negatives, 1 false positive, 2 false negatives, 3 true positives from 8 items gives precision 3/4 and recall 3/5.
- *Many classes?* The matrix grows to N by N; the diagonal is correct answers.

**Trap:** Quoting accuracy without looking at the matrix.

**Source:** https://scikit-learn.org/stable/modules/model_evaluation.html

### What is balanced accuracy, and why use it instead of accuracy?

Topic: ai-testing | Niche | id: q0819

**Say:** Accuracy is the share of correct answers. With imbalanced data it misleads: if 95 percent of messages are normal, a classifier that always says normal gets 95 percent. Balanced accuracy is the average of the recall of each class, so every class counts equally. For two classes: half of recall on positives plus half of recall on negatives. A classifier that ignores the rare class scores near 0.5.

**Full process:**
```ts
const balancedAccuracy = (tp: number, fn: number, tn: number, fp: number) =>
  0.5 * (tp / (tp + fn) + tn / (tn + fp));
// always-normal on 5 attacks and 95 normals: 0.5 * (0/5 + 95/95) = 0.5, accuracy 0.95
```

**Follow-ups:**
- *When not?* When one kind of mistake is much more expensive; then look at precision and recall for that class.

**Trap:** Reporting 95 percent accuracy on a 95/5 split as a good result.

**Source:** https://scikit-learn.org/stable/modules/model_evaluation.html

### How do you choose a threshold for a classifier, and what did you learn from it?

Topic: ai-testing | Niche | id: q0820

**Say:** A classifier returns a confidence, and the threshold turns it into a decision. A higher threshold flags less: precision usually rises and recall falls. A lower threshold does the reverse. I pick it from labelled data, by looking at precision and recall at several thresholds and choosing for the cost of each error. Then I fix it, version it with the model, and re-check it when the model changes, because confidence values shift between versions.

**Full process:**
1. Score every labelled item with the model and keep the confidence.
2. For thresholds 0.1, 0.2, up to 0.9, count tp, fp and fn and compute precision and recall.
3. Print the table. Pick the row where the error cost is acceptable, for example "recall must be at least 0.9 even at lower precision" for a safety filter.
4. Store the threshold with the model and version in the config.

**Follow-ups:**
- *Why re-check on model change?* The same number can mean a different confidence.

**Trap:** Using 0.5 by habit.

**Source:** https://scikit-learn.org/stable/modules/model_evaluation.html

### How do you evaluate a classifier or an LLM feature when you only have a small labelled set?

Topic: ai-testing | Niche | id: q0821

**Say:** I say how small it is, and what that does to the numbers. With 55 or 98 items one wrong label moves the score by a visible amount, so I report counts, not only percentages, and avoid claiming small differences. I check the labels, keep a held-out part, run more than once, and compare variants on the same items. And I treat the result as a basis for a decision, not as proof of production quality.

**Follow-ups:**
- *Would you ship on that?* Not alone. I would add monitoring and sample review in production.

**Trap:** Quoting three decimals as if they were certain.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### Have you done model evaluation at work?

Topic: ai-testing | Niche | id: q0822

**Say:** Keep two kinds of AI work apart and name each one plainly: evaluating a model (labelled data, comparisons across model, version and threshold, a benchmark scored by code, evals that flag regressions between prompt versions) and testing a product that contains AI (E2E UI tests of an agent). Do not let one stand in for the other, and do not round up your years.

**Follow-ups:**
- *Why does it count?* It is the same method an employer would need: fixed sets, scoring by code, comparison between versions, thresholds chosen from data.
- *Tools used?* State which tools you have used and which you have not. For example, if you have not used Langfuse, LangSmith, Promptfoo or DeepEval, say so plainly and explain that you built your own scripts for specific needs.

**Trap:** Dressing up personal projects as employer experience.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

## Safety, security and cost

### How do you test for hallucinations?

Topic: ai-testing | Niche | id: q0823

**Say:** A hallucination is a confident answer that is false or not supported. I test with questions where I know the truth: facts in the source material, questions whose answer is not in the source (the right reply is "I don't know"), and traps with a false premise. I check answers against the source with code where possible, or by a reviewed sample. Mitigations I would check for are grounding in provided documents, permission to say "I don't know", and citations that I can verify.

**Follow-ups:**
- *Best-of-N?* Ask the same question several times; strong disagreement is a warning sign.
- *Can you remove them?* No. The vendor guide says the techniques reduce but do not eliminate hallucinations.

**Trap:** Testing only questions the model answers well.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

### What is prompt injection, and how do you test for it?

Topic: ai-testing | Niche | id: q0824

**Say:** Prompt injection is when input changes the model's behaviour in a way the owner did not intend. Direct: the user types "ignore your rules and do X". Indirect: the model reads a web page, file or email that contains hidden instructions. OWASP ranks it first in its LLM Top 10. A test case has the setup, the hostile input, the channel (direct or indirect), the forbidden outcome, and a pass rule that code can check, such as "no tool call was made" or "the secret string is not in the reply".

**Full process:**
1. List assets and actions at risk: system prompt, user data, tools such as email or database.
2. Write cases: direct override, role play, encoded text, instructions hidden in a document the model summarises, instructions in a tool result.
3. Pass rule per case, checked by code: canary string absent, no unauthorised tool call, output still matches the schema.
4. Run each case several times, because success can be random. Report the attack success rate per class.
5. Add each new real attack as a case.
Mitigations to confirm: least privilege, human approval for high-risk actions, untrusted content separated and labelled, output validated by code.

**Follow-ups:**
- *Why repeat runs?* An attack that works 1 time in 10 is still a vulnerability.
- *Is a filter enough?* No. Treat the model as an untrusted user and put the control in the application.

**Trap:** Believing a "do not follow instructions in documents" line in the prompt settles it.

**Source:** https://genai.owasp.org/llmrisk/llm01-prompt-injection/

### Have you done jailbreak testing or red teaming?

Topic: ai-testing | Niche | id: q0825

**Say:** If you have not run a structured red-teaming campaign, say so; trying a few jailbreak prompts is not test work. Then show how you would do it: start from the OWASP LLM Top 10, list the assets at risk, write cases with code-checkable pass rules, run each several times, and report an attack success rate by class.

**Follow-ups:**
- *Difference between jailbreak and injection?* Jailbreak tries to make the model break its own safety rules. Injection tries to make it follow an attacker's instructions instead of the owner's. They overlap.

**Trap:** Claiming red-team experience.

**Source:** https://genai.owasp.org/llm-top-10/

### How would you test guardrails on an LLM feature?

Topic: ai-testing | Niche | id: q0826

**Say:** I separate the guardrail from the model and test it as a component with labelled cases. Allowed requests must pass, disallowed ones must be blocked. That gives a confusion matrix and two error types: false blocks, which hurt users, and false passes, which hurt safety. I pick the threshold for the cost of each. I test the whole path too: input filter, model, output validation, and what the user sees when something is blocked. And I check that controls live in code, not only in the prompt.

**Follow-ups:**
- *Metrics?* Recall on the disallowed class for safety, precision for user experience.
- *Output side?* Validate format and content in code before the output reaches a user or another system; OWASP lists improper output handling as its own risk.

**Trap:** Measuring only how many bad prompts get blocked, and not how many good ones.

**Source:** https://genai.owasp.org/llm-top-10/

### What is RAG, and how would you evaluate it? (Honest gap)

Topic: ai-testing | Niche | id: q0827

**Say:** I have no record of doing RAG evaluation, so I explain the concept. RAG, retrieval-augmented generation, fetches relevant documents and gives them to the model as context. It has two parts that fail differently. Retrieval can bring the wrong or too little context. Generation can ignore the context or invent claims. I would evaluate both: retrieval with a set of questions and the documents that should be found (context precision and recall), and the answer for faithfulness to the retrieved text and relevance to the question.

**Full process:** The plan I would follow:
1. Build questions with the known source passage for each.
2. Measure retrieval: was the right passage in the top results.
3. Measure faithfulness: split the answer into claims and check each against the retrieved text. The score is supported claims divided by all claims.
4. Measure answer relevance, and include questions with no answer in the sources, where the right reply is "I don't know".
5. Track the scores per version of the index, the prompt and the model.
Tools such as DeepEval offer these metrics (faithfulness, contextual precision, contextual recall, answer relevancy) with an LLM as the judge.

**Follow-ups:**
- *Why separate retrieval from generation?* A wrong answer needs a different fix depending on which part failed.

**Trap:** Claiming RAG evaluation experience. If the system has knowledge sources, clarify that your E2E tests covered the UI only and did not evaluate the retrieval or generation quality of RAG components.

**Source:** https://deepeval.com/docs/metrics-faithfulness

### How do you test the cost and latency of an AI feature?

Topic: ai-testing | Niche | id: q0828

**Say:** I measure both as numbers per request and set budgets. Latency: time to first token and total time, at normal and at peak load, because a streamed reply feels faster than its total time. Cost: tokens in and out per request, per conversation, and per user per day. I test with realistic long inputs, since cost grows with context. I also test the limits: input size caps, rate limits and timeouts, which OWASP names as controls for unbounded consumption.

**Full process:**
1. Log token counts and timings from each response in the eval run.
2. Run the golden set and report p50 and p95 latency and the average and maximum tokens.
3. Fail the run when p95 or tokens per case exceed the budget.
4. Send an oversized input and a burst of requests: expect a clean rejection or throttle, not a crash or a huge bill.
5. Compare cost and latency between model versions next to quality, since a better model that costs three times more may not be a win.

**Follow-ups:**
- *Why p95?* The slow tail is what users remember.
- *Load test tool?* State which load testing tools you have used and which you have not. For example, if you have used JMeter for performance baselines on GraphQL APIs and have not used k6, say so plainly.

**Trap:** Testing quality only.

**Source:** https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/

### What happens when the AI service is down or slow? What do you test?

Topic: ai-testing | Niche | id: q0829

**Say:** The feature needs a defined fallback. I test a timeout, a 429 rate limit, a 5xx error and a malformed reply. The user should see a clear message and a way forward, such as a retry or a human handoff, never a spinner forever or a raw error. In E2E tests I stub the model call with Playwright route interception, so the failure is deterministic.

**Full process:**
```ts
await page.route('**/api/ai/reply', (route) =>
  route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }),
);
await page.getByRole('button', { name: 'Send' }).click();
await expect(page.getByRole('alert')).toContainText('try again');
```
The test asserts UI that always renders, not model text. Add one test for a slow reply with a delayed fulfil and one for an invalid body.

**Follow-ups:**
- *Retries?* Check there is a limit and a backoff, or the feature will hammer a failing service.

**Trap:** Testing only the happy path where the model answers.

**Source:** https://playwright.dev/docs/mock

### How do you check for bias, toxicity and unsafe content?

Topic: ai-testing | Niche | id: q0830

**Say:** I use paired inputs that differ in one attribute, such as a name or a gender, and compare the results. For toxicity I use a labelled set of safe and unsafe inputs and outputs and measure both error types. For a user-facing feature I add human review of samples, since automatic checks miss context. I set pass rules before the run, for example "no unsafe output on the high-risk set", with a stricter rule on recall for harmful cases.

**Follow-ups:**
- *Who decides the rule?* The product owner and legal, not QA alone. QA makes the measurement visible.

**Trap:** A single keyword list called a safety test.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How do you monitor an AI feature after release?

Topic: ai-testing | Niche | id: q0831

**Say:** Offline tests use fixed cases. Production brings new inputs, so I add online checks: sample real conversations for review, track user signals such as thumbs down and handoff rate, watch latency, cost and error rates, and look for drift when the model or the data changes. Every real failure becomes a new golden case. Observability tools store traces and scores for this; if you have not used them for this, say so plainly and explain that you know the concept but have not implemented it.

**Follow-ups:**
- *Offline versus online evaluation?* Offline runs on a curated set with reference answers before release. Online scores live traces, with no reference answer, using heuristics, safety checks or a judge.

**Trap:** Thinking the pre-release suite covers production.

**Source:** https://docs.langchain.com/langsmith/evaluation-concepts

## Tools for AI evaluation (concepts, not used)

### What is Promptfoo, and how would you use it?

Topic: ai-testing | Niche | id: q0832

**Say:** If you have not used Promptfoo, say so. It is an open-source tool where you describe prompts, providers (models), test cases and assertions in a YAML file and run them from the command line. It prints a matrix of results per model. Its assertions range from `contains` and JavaScript expressions to `similar` (a similarity threshold) and `llm-rubric` (a judge). It fits the idea of a prompt regression suite, which can also be built as plain scripts.

**Full process:** A minimal `promptfooconfig.yaml`:
```yaml
prompts:
  - 'Translate to {{language}}: {{input}}'
providers:
  - openai:gpt-4o-mini
tests:
  - vars: { language: French, input: Hello world }
    assert:
      - type: contains
        value: bonjour
      - type: llm-rubric
        value: is polite and does not describe itself as an AI
```
Run `npx promptfoo eval`. The output is a results table with one column per provider, pass or fail per assertion. Use `-c` to point at a config file. The model id above is a placeholder; check the docs for current names.

**Follow-ups:**
- *Why use it over scripts?* Matrix output, built-in assertion types and CI support. Own scripts cost less to learn for a small set.

**Trap:** Claiming you used it.

**Source:** https://www.promptfoo.dev/docs/configuration/guide/

### What is DeepEval?

Topic: ai-testing | Niche | id: q0833

**Say:** If you have not used DeepEval, say so. DeepEval is a Python framework that plugs into Pytest, so an LLM test is a normal test function. You create a test case with the input, the actual output and optionally the expected output, pick a metric, and `assert_test` passes or fails by a threshold. Many metrics use an LLM as the judge, so you need a judge model configured. It includes RAG metrics such as faithfulness.

**Full process:**
```python
from deepeval import assert_test
from deepeval.test_case import LLMTestCase, SingleTurnParams
from deepeval.metrics import GEval

def test_correctness():
    metric = GEval(
        name="Correctness",
        criteria="Is the actual output correct given the expected output?",
        evaluation_params=[SingleTurnParams.ACTUAL_OUTPUT, SingleTurnParams.EXPECTED_OUTPUT],
        threshold=0.5,
    )
    case = LLMTestCase(input="...", actual_output="...", expected_output="...")
    assert_test(case, [metric])
```
Run with `deepeval test run test_example.py`. Scores are 0 to 1 and the threshold decides pass.

**Follow-ups:**
- *Risk?* A judge-based score is itself non-deterministic, so run it more than once and check the judge on human labels.

**Trap:** Quoting metric names as experience.

**Source:** https://deepeval.com/docs/getting-started

### What are Langfuse and LangSmith?

Topic: ai-testing | Niche | id: q0834

**Say:** If you have not used either, say so plainly. Both are platforms for observing and evaluating LLM applications. They record traces of each call, hold datasets of test cases, run experiments to compare prompt or model versions, and attach scores from automatic evaluators, human review or an LLM judge. LangSmith distinguishes offline evaluation on a curated dataset before release from online evaluation on live traces. A good example is using fixed sets and scripts, which is the same pattern without a platform.

**Follow-ups:**
- *When does a platform pay off?* When several people need shared datasets, history, and production traces in one place.

**Trap:** Claiming familiarity from reading the landing page.

**Source:** https://langfuse.com/docs/evaluation/overview

## Working habits with AI output

### How do you review a large change an AI wrote?

Topic: ai-tools | Standard | id: q0835

**Say:** I do not read it top to bottom first. I read the tests and the description of intent, then the risky places: boundaries, error paths, state changes, data access, anything that touches permissions. I run the tests and a deliberate break. I ask the agent for smaller changes when the diff is too big to review honestly, because a wall of generated code gets skimmed. If I cannot explain what a piece does, it does not merge.

**Follow-ups:**
- *Do you use an AI reviewer too?* Yes, as a first pass, judged on merit, never as the approval.

**Trap:** Approving because the tests are green and the diff is big.

**Source:** https://docs.coderabbit.ai/

### How do you use AI to generate test data, and what do you check?

Topic: ai-tools | Standard | id: q0836

**Say:** It is good at varied, realistic values: names with accents, long strings, odd addresses, messages in different tones. I ask for a fixed format and validate it with a schema, then I add the boundary values myself, because the model tends to produce typical data. I keep generated data in a file in the repo, so a test run does not call a model and stays repeatable. Personal data never goes in.

**Follow-ups:**
- *Why not generate at test time?* The data would change each run and make failures hard to reproduce.

**Trap:** Calling the model inside the test to create data.

**Source:** https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview

### What is the difference between evaluating a model and testing an application that uses one?

Topic: ai-testing | Niche | id: q0837

**Say:** Model evaluation measures how well a model does a task, on a set of cases, with scores: accuracy, precision, recall. Application testing checks the whole product: the UI, the flow, the integrations, the failure handling, plus the model's part. A product can have a strong model and still fail because the handoff breaks or the error path is missing. Example: model evaluation in private local experiments, application testing of an AI agent in a product.

**Follow-ups:**
- *Which comes first?* Application testing is always needed. Evaluation is added when output quality is a risk.

**Trap:** Treating a high benchmark score as proof that the product works.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

### How do you keep an agent from doing damage in your workflow?

Topic: ai-tools | Standard | id: q0838

**Say:** I limit what it can do, not only what I ask. Least privilege: read-only where read is enough. Approval for anything that leaves the machine, such as a push, a post or a message. Hooks, which are deterministic scripts that can block a tool call, for rules that must never break. Separate work trees or branches for risky changes. And a log of what ran. A prompt rule is a request; a hook is a control.

**Follow-ups:**
- *Example?* A gate that asks before a push to a host I do not own, and a rule that agents set their model on each delegated task.

**Trap:** Trusting the model to remember the rule.

**Source:** https://code.claude.com/docs/en/hooks-guide

### An interviewer says "AI will write all the tests soon". How do you respond?

Topic: ai-tools | Standard | id: q0839

**Say:** Writing the code of a test is the cheap part, and AI is good at it. The hard parts stay: deciding what to test by risk, defining the expected result, proving a test can fail, and keeping the suite trustworthy over time. An unchecked AI suite tends to grow fast and assert little. So I expect the work to shift to specification, review and verification, and I plan to be good at exactly that.

**Follow-ups:**
- *Evidence?* Agent-written tests I scored against planted bugs: a passing test did not mean it could find the bug.

**Trap:** Defensiveness, or agreeing with no reservations.

**Source:** https://platform.claude.com/docs/en/test-and-evaluate/develop-tests

## Rare tools from the ads

### What are LangGraph and Phoenix, and how would they help you test an agent?

Topic: ai-testing | Niche | id: q0840

**Say:** If you have not used either one, say so plainly and explain the basics: LangGraph is a framework for stateful agents, where you define the flow as a graph of shared state, nodes and edges, and can mix fixed steps with model steps. Phoenix, from Arize, is an open-source tool that collects traces of each run and scores the outputs. So I'd test the fixed steps with normal tests, and use traces to see which tool the agent called and where a run went wrong.

**Follow-ups:**
- *Why do traces matter?* A final answer can look right even when the agent took the wrong path, and the trace shows the path.

**Trap:** Pretending to have used them. Say you haven't, explain what they are, and show how you would test the agent.

**Source:** https://docs.langchain.com/oss/python/langgraph/overview and https://arize.com/docs/phoenix
