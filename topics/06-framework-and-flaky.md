# Framework design, test data and flaky tests

How to study this file: read the sections in order, because the framework walkthrough at the top is the one interviewers ask most. Say the **Say** text out loud until it sounds like you, then read **Full process** once so you can draw or type it when an interviewer says "show me". Every Playwright claim was checked against the current docs (Playwright 1.64 era). The Selenium and Cypress answers are deliberately short and conceptual.

## Framework design

### Design a Playwright framework from scratch for a real product. Walk me through it.

Topic: fw-architecture | Core | id: q0617

**Say:** I start from the product risks, not from folders: what must never break, what changes often, who runs the tests and where. Then I build in layers. Config and projects at the bottom, fixtures for auth and data on top of that, thin page and component objects for shared UI, and specs that only contain actions and assertions. Test data comes from the API, not from the UI, and every test makes its own data so tests run in parallel. CI runs the suite sharded, with a blob report merged at the end and traces kept only for failures. Then I add guardrails: ESLint rules for the things reviewers keep repeating, and a flake measurement job, so the suite stays trustworthy as it grows.

**Full process:**
1. Ask first, before typing: which environments exist (local, preview per merge request, shared staging), how users log in (form, SSO, OAuth, token), which APIs I can call to create data, how long a CI run may take, and who owns the suite. The answers decide auth and data strategy.
2. Folder layout (one package next to the app, or its own repo):
```
e2e/
  playwright.config.ts
  eslint.config.mjs
  env.ts                  // reads TARGET_ENV, fails fast on missing values
  fixtures/
    index.ts              // exports the extended `test` and `expect`
    auth.setup.ts         // logs in once per role, writes storage state
  api/                    // typed API clients used for seeding and cleanup
    users.ts
    orders.ts
  data/                   // factories that build varied, valid data
    factories.ts
  pages/                  // page and component objects: Locators and user actions only
    checkout.page.ts
    components/header.ts
  tests/                  // one folder per feature, specs only
    checkout/guest-checkout.spec.ts
  reporters/flake-reporter.ts
  .auth/                  // git-ignored storage state files
```
3. Config (`playwright.config.ts`), explained line by line in the next entry. Key choices: `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `failOnFlakyTests: true`, `retries: 0`, `trace: 'retain-on-failure'`, a `setup` project that every browser project depends on, `blob` reporter on CI.
4. Fixtures: one `test.extend` file. Worker-scoped fixtures for expensive things (a logged-in storage state per worker). Test-scoped fixtures for per-test data (an account, an order) that clean up after `use()`.
5. Data: API clients create data before the test and delete it afterwards. The UI is used only for the flow under test.
6. Page and component objects hold `Locator`s and user actions. Assertions stay in the spec.
7. Specs: `test('guest can pay with a card', ...)`: arrange through fixtures, act through the UI, assert with web-first assertions.
8. CI (GitLab CI or GitHub Actions): install dependencies, `npx playwright install --with-deps`, run `npx playwright test --shard=${INDEX}/${TOTAL}` in a matrix, upload `blob-report` per shard, one final job runs `npx playwright merge-reports --reporter html ./all-blob-reports`. Pin the browser image to the Playwright version.
9. Guardrails: `eslint-plugin-playwright` plus a few custom rules (see the ESLint entry), a nightly `--repeat-each` job, and `forbidOnly`.
10. Write a short README: how to run one test locally, how to read a trace, how to add a fixture, the rules.

Over time: the suite starts at a few smoke tests, grows by feature, and the nightly flake report tells me which tests to fix first.

**Follow-ups:**
- *What would you build first?* A smoke path through login and the one revenue flow, with the CI job and the report. A suite that runs on every merge request and is green beats a big suite nobody trusts.
- *Monorepo or separate repo?* Next to the app if the same team changes both, because the test change ships in the same merge request. A separate repo only when a different team owns the tests and the product is several services.
- *How do you decide what is not E2E?* If a unit or API test can prove it, it goes there. E2E covers the journeys where the pieces meet.

**Trap:** Starting the answer with "page object model, Excel data, a base class for everything". That is a pattern list, not a design. The interviewer wants the questions you ask, the layers, and how the suite stays reliable.

**Source:** https://playwright.dev/docs/test-configuration

### Walk me through your `playwright.config.ts`. Why each option?

Topic: fw-architecture | Core | id: q0618

**Say:** I keep it short and every line has a reason. `fullyParallel` and a worker count that matches the CI machine, `forbidOnly` on CI, `failOnFlakyTests` so a flaky test fails the run, and retries off by default so failures are visible. Trace is `retain-on-failure`, because `on-first-retry` never fires when retries are off. A setup project logs in once and the browser projects depend on it. On CI the reporter is `blob`, so shards can be merged. The base URL and credentials come from environment variables, never from the config file itself.

**Full process:**
```ts
import { defineConfig, devices } from '@playwright/test';
import { env } from './env';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['blob'], ['./reporters/flake-reporter.ts']]
    : [['html', { open: 'never' }]],
  use: {
    baseURL: env.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```
1. `fullyParallel: true` runs tests inside one file in parallel as well. Without it, Playwright parallelizes between files only. It forces every test to be independent.
2. `workers`: set it from the CI machine's cores. I do not push it to the maximum, because a loaded app server causes timeouts that look like flakiness. Sharding scales further than more workers on one machine.
3. `forbidOnly` fails the run if a `test.only` is committed.
4. `failOnFlakyTests` exits with an error if any test passed only after a retry. It is also available as `--fail-on-flaky-tests`. With `retries: 0` it is a guard: if someone adds a retry and a test then passes only on the retry, the run fails.
5. `retries: 0`: a failure shows up as a failure. If a team needs a retry, I set it on one describe with `test.describe.configure({ retries: 1 })` and a comment with the reason and an owner.
6. `trace: 'retain-on-failure'` keeps a trace for every failed test. The trace is where I start every investigation.
7. The `setup` project runs `auth.setup.ts` first; projects that list it in `dependencies` start after it passes. Setup shows up in the report and in traces, unlike a global setup file.
8. A `webServer` block (with `reuseExistingServer: !process.env.CI`) is added only when the app starts from the repo.

Output: a run prints per-test results, writes `blob-report/` on CI or `playwright-report/` locally, and keeps `test-results/` with traces for failures.

**Follow-ups:**
- *Why not `retries: 2` like the Playwright template?* The template's default is a starting point. With retries on, a test that fails once then passes is reported flaky, and teams stop looking. I want the first failure to be a failure, and I measure flakiness on purpose with repeat runs.
- *Why a setup project and not `globalSetup`?* The docs recommend project dependencies: setup is a real test, so it appears in the HTML report and has traces. `globalSetup` has fewer features.
- *What about timeouts?* I keep the defaults (30 s per test, 5 s per assertion). When a test needs more, I find out why. Raising a timeout to pass is hiding a slow product.

**Trap:** Copy-pasting `retries: 2` and `workers: 1` on CI "to be safe". Both hide problems: retries hide flakiness, one worker hides isolation bugs and slows the suite down.

**Source:** https://playwright.dev/docs/api/class-testconfig

### Explain your automation framework and its architecture.

Topic: fw-architecture | Core | id: q0619

**Say:** It is Playwright with TypeScript. Specs live by feature and contain only the user's story: arrange, act, assert. Shared UI lives in thin page and component objects that hold locators and actions. Fixtures give each test its logged-in page and its own data, created through the API. Locators are role and accessible name first, because that is what a user sees and it fails loudly when accessibility breaks. CI shards the suite and merges one report. ESLint enforces the rules so review does not have to.

**Full process:**
1. Draw four boxes, top to bottom: specs, fixtures, page and component objects plus API clients, Playwright config and CI.
2. Say what crosses each arrow. Specs ask fixtures for `page`, `account`, `order`. Fixtures call API clients to create data and call page objects to build them. Page objects only wrap `Locator`s.
3. Name the rules that hold it together: web-first assertions, no fixed sleeps, no `networkidle`, no forced actions, no `nth()` or `first()` outside diagnosis, `exact: true` on every locator, assertions in specs.
4. Say how it is run: locally with `npx playwright test --ui`, in CI sharded, with traces for failures.
5. Say your role: what you built and what you reviewed.

**Follow-ups:**
- *Which design patterns?* Fixtures (dependency injection), page and component objects, factories for data, and API clients as a thin facade. I use patterns where they remove repetition and skip them where a plain function is clearer.
- *What would you change in it?* Be concrete: for me it is always the same item, more of the setup moved from the UI to the API, because UI setup is the slowest and flakiest part.
- *How do new people learn it?* A README with the five commands they need, and review comments that point at lint rules, not at taste.

**Trap:** Listing every tool and library ("Allure, Faker, Excel, Docker, Jenkins...") without saying what each does for reliability. Name fewer things and say why.

**Source:** https://playwright.dev/docs/test-fixtures

### How do you structure the tests, page objects and helpers in folders so it stays maintainable?

Topic: fw-architecture | Core | id: q0620

**Say:** By feature for specs, by role for support code. Specs sit in `tests/<feature>/`. Page and component objects sit in `pages/`, API clients in `api/`, data factories in `data/`, and fixtures in `fixtures/`. A spec imports only from `fixtures` and `pages`; it never reaches into `api` directly when a fixture can do it. The test is the unit people read, so everything else exists to keep it short and clear.

**Full process:**
1. Rule of imports: specs import `test` and `expect` from `fixtures/index.ts`, never from `@playwright/test`. One place to add a fixture or a global rule.
2. Component objects for pieces that repeat across pages (header, modal, table). Page objects only for pages with their own flows. No giant base page.
3. Name files by what they model: `checkout.page.ts`, `orders.api.ts`, `order.factory.ts`.
4. A lint rule or a code review check that bans importing a spec from another spec, and `no-export` in spec files so helpers do not hide in specs.
5. When splitting a spec file, compare `npx playwright test --list` before and after, then run each new file alone. A new file can silently depend on setup it borrowed from its neighbour.

**Follow-ups:**
- *Folder per page or per feature?* Per feature for tests, because a user journey crosses pages. Per page only for page objects.
- *Where do shared test helpers go?* If they touch the app, in a fixture or an API client. If they are pure functions (build a date string), in `support/` with unit tests.

**Trap:** `utils.ts` with 80 functions. It becomes the place where everything lands and nobody can tell what is used.

**Source:** https://playwright.dev/docs/test-fixtures

### How do you design fixtures? Give me an example.

Topic: fw-architecture | Core | id: q0621

**Say:** A fixture is setup plus teardown, handed to the test by name. I split them by lifetime. Worker-scoped for things that are expensive and read-only, like a browser login. Test-scoped for anything the test changes, like an account or an order. Teardown lives after `await use(...)`, so cleanup runs even when the test fails. And I merge small fixture files with `mergeTests`, so one file does not grow forever.

**Full process:**
```ts
// fixtures/index.ts
import { test as base, expect, mergeTests } from '@playwright/test';
import { createAccount, deleteAccount, type Account } from '../api/accounts';
import { CheckoutPage } from '../pages/checkout.page';

type Fixtures = { account: Account; checkout: CheckoutPage };

const accountTest = base.extend<Fixtures>({
  account: async ({ request }, use) => {
    const account = await createAccount(request);   // POST /api/accounts, checks the status
    await use(account);
    await deleteAccount(request, account.id);       // runs after the test, pass or fail
  },
  checkout: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
});

export const test = mergeTests(accountTest /*, otherFixtureFiles */);
export { expect };
```
```ts
// api/accounts.ts
import { expect, type APIRequestContext } from '@playwright/test';
export type Account = { id: string; email: string };

export async function createAccount(request: APIRequestContext): Promise<Account> {
  const email = `e2e-${crypto.randomUUID()}@example.test`;
  const response = await request.post('/api/accounts', { data: { email } });
  expect(response).toBeOK();            // check status before parsing the body
  return await response.json();
}
```
1. The `account` fixture is test-scoped (the default), so every test gets its own account.
2. Fixtures are lazy: a fixture runs only if a test or another fixture asks for it.
3. `{ auto: true }` makes a fixture run for every test without being named. I use it rarely, for things like attaching logs on failure.
4. Teardown runs in reverse order of setup.

**Follow-ups:**
- *Fixture or `beforeEach`?* Fixture when more than one file needs it, or when it needs teardown. `beforeEach` for a one-off in one describe. Fixtures only run when used, so unused setup costs nothing.
- *Worker fixture that changes data?* Dangerous. Other tests in that worker see the change. Worker scope is for read-only or per-worker-unique things.
- *Why check the status before `.json()`?* If the API returns an HTML 500 page, `.json()` throws a parse error and hides the real status code.

**Trap:** A worker-scoped fixture for "speed" that creates data tests then modify. The order of tests decides the result, and the suite fails only sometimes.

**Source:** https://playwright.dev/docs/test-fixtures

### How do you handle authentication in the framework?

Topic: fw-architecture | Standard | id: q0622

**Say:** I never log in through the UI in every test. I log in once and reuse the browser state. If tests only read data, one account and one `storageState` file is enough. If tests change server state, I give each parallel worker its own account, so workers do not step on each other. The login itself is a setup project, so it is a real test with a trace. For token or OAuth flows I get the token through the API and put it in the state, not through the login screen.

**Full process:**
1. Setup project in the config (`{ name: 'setup', testMatch: /.*\.setup\.ts/ }`) and `dependencies: ['setup']` on the browser projects.
2. `tests/auth.setup.ts` logs in once and saves the state:
```ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_USER!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: '.auth/user.json' });
});
```
3. Add `.auth/` to `.gitignore`: the file holds live cookies.
4. Projects use `storageState: '.auth/user.json'`.
5. For tests that change shared server state, override `storageState` with a worker-scoped fixture that uses `testInfo.parallelIndex` to pick or create one account per worker, and saves its own file per worker.
6. For several roles (admin and user), make two state files and two fixtures that open a new context with each state.
7. Tests that must start logged out use `test.use({ storageState: { cookies: [], origins: [] } })`.

What to know about the state file: it stores cookies, `localStorage` and, only when asked with `{ indexedDB: true }`, IndexedDB. It never saves `sessionStorage`. If the app keeps its session token in `sessionStorage`, the restored page is logged out.

**Follow-ups:**
- *What if the session expires during a long run?* Keep the setup fresh per run, not cached across days, and make tokens long enough for one run. For a short-lived token, a worker fixture can refresh it.
- *Why not log in by the UI in `beforeEach`?* It adds seconds to every test, hits rate limits and lockouts, and makes the login page a dependency of every test.
- *Do you still test login?* Yes, in a few dedicated tests that start logged out.

**Trap:** One shared account for tests that change settings. Two workers change the same setting and tests fail only in parallel.

**Source:** https://playwright.dev/docs/auth

### How do you manage environments: local, staging, preview, production?

Topic: fw-test-data | Core | id: q0623

**Say:** One suite, many targets, selected by one variable. The config reads `TARGET_ENV` and maps it to a base URL, an API URL and credentials, and it fails at start if a value is missing. Secrets come from the CI secret store, never from the repo. I run the full suite on a preview or staging environment that I control, and a small read-only smoke subset on production. And I check that the test environment matches production in the ways that matter, mainly feature flags and data shape.

**Full process:**
1. `env.ts`:
```ts
const targets = {
  local:   { baseURL: 'http://localhost:3000', apiURL: 'http://localhost:3001' },
  staging: { baseURL: 'https://staging.example.test', apiURL: 'https://api.staging.example.test' },
} as const;

const name = (process.env.TARGET_ENV ?? 'local') as keyof typeof targets;
if (!(name in targets)) throw new Error(`Unknown TARGET_ENV: ${name}`);

export const env = { ...targets[name], name };
```
2. Secrets (`E2E_USER`, `E2E_PASSWORD`, API tokens) come from environment variables set in the CI project settings or a secret manager. A missing secret throws in `env.ts`, so the run stops in a second with a clear message.
3. Tag the tests that are safe on production (`@smoke`, read-only) and run them with `npx playwright test --grep @smoke`.
4. Before diagnosing a 404 or a failing run, check that the environment is up and which commit it runs. Dev environments can be down by design or on an old baseline.
5. Reproduce with the same browser image, reporter and retry settings as CI, to remove "passes on my machine".

**Follow-ups:**
- *Test on production?* Only read-only checks with a dedicated account, and never create real orders or send real emails.
- *Environment drift?* Compare what you can compare automatically (feature flags, versions, configuration) and fail or comment when they differ.
- *Where do per-environment test data differences go?* In the factory or the fixture, not in `if (env === 'staging')` inside tests.

**Trap:** `if (process.env.ENV === 'prod')` branches inside spec files. The test no longer proves one thing, and the production branch is the one nobody runs.

**Source:** https://playwright.dev/docs/test-configuration

### How do you set up reporting and CI for the suite?

Topic: fw-architecture | Standard | id: q0624

**Say:** CI has three jobs of work: run the tests sharded, keep the evidence of failures, and give one report to people. Each shard writes a blob report. A final job merges the blobs into one HTML report and uploads it, even when some shards failed. Traces and screenshots are kept only for failures, so storage stays small. I also keep the raw logs, because artifacts expire and merged reports lose the history of what happened inside a run.

**Full process:**
1. Config: `reporter: process.env.CI ? 'blob' : 'html'`.
2. Matrix job runs `npx playwright test --shard=${INDEX}/${TOTAL}` and uploads the `blob-report` folder as an artifact. Use `if: ${{ !cancelled() }}` (GitHub Actions) or `when: always` (GitLab CI) on the upload.
3. A merge job that needs all shards downloads the blobs into one folder and runs `npx playwright merge-reports --reporter html ./all-blob-reports`. The result is `playwright-report/`, uploaded as an artifact with a retention period.
4. GitHub Actions example from the docs: `strategy: { fail-fast: false, matrix: { shardIndex: [1,2,3,4], shardTotal: [4] } }`. `fail-fast: false` lets all shards finish.
5. GitLab CI has `parallel: 4` and the variables `CI_NODE_INDEX` and `CI_NODE_TOTAL`, so the command is `npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL`.
6. Publish the JUnit or merged report where the merge request can show it, and post a link in the pipeline.
7. A quality gate: merge requests run the smoke subset or `--only-changed`; the full suite runs after merge and nightly.

**Follow-ups:**
- *Which report do you like?* HTML for people, JUnit for CI tools, and a custom reporter for flake counts. Allure works too when a team wants history and categories.
- *Why a blob report?* Shards cannot be merged from HTML reports. Blobs carry all results and attachments.
- *Do merged reports show flaky tests?* The final status only. A custom reporter or the list output must record flaky tests, or they disappear.

**Trap:** Uploading artifacts only when the job passes. The failure is the case where you need the artifact.

**Source:** https://playwright.dev/docs/test-sharding

### How do you keep test scripts maintainable and scalable?

Topic: fw-architecture | Standard | id: q0625

**Say:** Maintainable means one change in the product causes one change in the tests. So I keep the locators in one place, I locate by what the user sees, and I keep tests independent and short. Scalable means that adding the 500th test costs the same as the 5th: each test makes its own data, runs in any order, and shards cleanly. And I enforce it with lint rules and review, because conventions that live only in people's heads decay.

**Full process:**
1. Locators by role and accessible name, with `exact: true`. The name is a contract with the product, and an accessibility bug becomes a test failure.
2. Independence: each test creates its own data and cleans up. Run with `--shuffle` and `fullyParallel`; a test that depends on order fails there.
3. Size: a test proves one behavior. If you need "and" in the title twice, split it.
4. Duplication: extract an action when three tests repeat it, not before. Keep one-off checks inline in the test.
5. Types: strict TypeScript and a type check in CI.
6. Rules: ESLint on the test folder, `forbidOnly`, a review checklist.
7. Hygiene: a periodic pass that deletes duplicated tests, dead helpers and long-skipped tests.

**Follow-ups:**
- *What breaks maintainability fastest?* Copy-pasted selectors, shared mutable state, and sleeps.
- *How do you measure maintainability?* Time to fix after a product change, flake rate, and the share of failures that are test defects versus product bugs.

**Trap:** Saying "page object model" and stopping. POM is one tool. Independence and stable locators matter more.

**Source:** https://playwright.dev/docs/best-practices

### How do you scale a suite to thousands of tests?

Topic: fw-architecture | Standard | id: q0626

**Say:** Three things grow: run time, flake count and maintenance cost. For run time I use full parallelism and sharding across CI machines, and I keep the per-test cost low by creating data through the API and logging in through saved state. For flake I measure it, because at thousands of tests a 0.5% flake rate means failures on every run. For maintenance I keep the suite layered, delete what no longer earns its place, and make rules automatic. I also split what runs when: smoke on every merge request, the rest after merge and nightly.

**Full process:**
1. Parallelism inside a machine: `fullyParallel: true`, `workers` sized to the machine.
2. Across machines: `--shard=x/y` splits the tests into equal parts; only tests that can run in parallel can be sharded, and by default that means files. Use `fullyParallel` so shards split by test, not by file size.
3. Balance: if one shard is always slowest, split the large files. Do not rely on file count.
4. Merge: blob reports per shard, one merged report.
5. Selection: `--only-changed=origin/main` for merge requests, tags (`@smoke`, `@slow`) with `--grep`, `--last-failed` for re-runs.
6. Stop waste: `--max-failures` on a clearly broken run.
7. Reliability math: with 3,000 tests and a 0.2% per-test flake rate, a run has about 6 flaky failures. Without measurement nobody can tell which are real.
8. Order: `--shuffle` in a nightly run finds hidden dependencies. The seed is printed so you can reproduce the order.
9. Cost: fewer, more valuable E2E tests. Push logic checks down to unit and API tests.

**Follow-ups:**
- *Does more workers make it faster?* Until the app under test or the machine saturates. Past that, tests time out and look flaky. Add shards instead.
- *Is there a point where you stop adding E2E tests?* Yes, when the run time or flake rate breaks the feedback loop. Then I delete or move tests down the pyramid.
- *How do you keep a 3,000-test suite understandable?* Folder per feature, tags, owners per area, and a dashboard of flake rate and duration per area.

**Trap:** "Just add more machines". Parallel runs expose shared state and rate limits, and cost grows linearly while trust does not.

**Source:** https://playwright.dev/docs/test-sharding

### You are given a take-home task to build a framework. What do you ship and how do you defend it?

Topic: fw-architecture | Standard | id: q0627

**Say:** A small suite that works on a fresh clone with two commands, and a README that explains the decisions. I would ship fixtures for data, a login setup, five to eight tests across UI and API, lint and type check, and a CI file. I defend each decision with a reason and a cost, because in the interview they will change one of them and see if I can adapt. I do not over-build: a clean small framework beats a large one with ten patterns.

**Full process:**
1. Read the task and list what they will check: working install, stable tests, readable structure, reasoning.
2. `npm ci && npx playwright install && npx playwright test` must work from a clean clone.
3. Tests: one happy path, one validation or error path, one API test, one data-driven test, one test that checks a state change after a refresh.
4. README: how to run, how to add a test, what I decided and what I left out and why.
5. CI file that runs lint, type check and tests, and uploads the report.
6. Keep a list of "next steps" you would do with more time. It shows judgment.
7. In the interview, be ready to answer: why this locator, why this fixture scope, what happens when two tests run in parallel, how would you add a second environment.

**Follow-ups:**
- *They ask you to add a feature live. How do you start?* Write the test for the behavior first, run it, see it fail for the right reason, then add the page object member only if the test needs one.
- *What if they ask for Excel-driven data?* I say what I would use instead (typed arrays or JSON checked into the repo), and what the cost of Excel is, but I implement what they ask if the role needs it.

**Trap:** Showing off every pattern. Reviewers read the diff of a take-home for judgment.

**Source:** https://playwright.dev/docs/running-tests

### How do you make sure the test environment matches what customers use?

Topic: fw-architecture | Standard | id: q0628

**Say:** I treat configuration drift as a test risk. Tests that pass on a configuration no customer has prove nothing. So I compare the things that change behavior, mostly feature flags, versions and data shape, automatically in CI, and I run the suite with new flags turned on before they reach customers. The comparison must be read-only and must fail closed: if it cannot check, it reports that, it does not say all is well.

**Full process:**
1. Add a read-only endpoint in the product (or use an existing admin API) that exports the flags, protected by a token. If the token is not configured, the endpoint rejects every request.
2. CI job fetches the export from production and from the test environment and diffs them.
3. On a difference, the job comments on the merge request with the exact flags.
4. A second run turns each new flag on at 100% in a separate environment and runs the suite, so the next release is already covered.
5. Reduce false alarms: before reporting a flag, check that the code actually uses it (a code search across the repositories). If the search fails or times out, treat the flag as still in use.

**Follow-ups:**
- *Why a token and read-only?* The endpoint exposes product configuration. It must not allow writes, and it must not be open when the secret is missing.
- *Who fixes a mismatch?* The comment names the flag and owner, and the team decides whether the environment or the test changes.

**Trap:** Mirroring production data into staging. That is a privacy problem. Compare configuration, not customer data.

**Source:** https://playwright.dev/docs/test-configuration

## Page objects, fixtures and other patterns

### What is the Page Object Model and why use it?

Topic: fw-pom | Core | id: q0629

**Say:** A page object is a class that represents a page or a part of a page. It holds the locators and the actions a user can do there. The reason is change: when the UI changes, you fix one class instead of twenty tests. In Playwright I keep it thin: it stores `Locator`s, not element handles, takes `page` through the constructor or a fixture, and exposes meaningful actions like `addToCart`, not one method per click.

**Full process:**
```ts
// pages/login.page.ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email', { exact: true });
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: 'Sign in', exact: true });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```
```ts
// tests/login/login.spec.ts
import { test, expect } from '../../fixtures';

test('a user signs in and lands on the dashboard', async ({ loginPage, page }) => {
  await loginPage.goto();
  await loginPage.signIn('ann@example.test', 'correct-horse');
  await expect(page).toHaveURL('/dashboard');
});
```
1. The page object has no assertion. The spec asserts. (The Playwright docs example puts an assertion inside a page method; I keep assertions in tests, so the test shows what is being proved.)
2. `Locator` objects are lazy: they look up the element at action time and retry, so a stored locator never goes stale. An `ElementHandle` can.
3. Expose the object through a fixture (`loginPage: async ({ page }, use) => use(new LoginPage(page))`), so a test only names it.

**Follow-ups:**
- *Does Playwright need POM?* No, it is optional. For a small suite, helper functions are enough. It pays off when the same flow is used in many tests.
- *Should a method return the next page object?* I do not, because it hides the flow. The test says which page object it uses next.
- *Where do waits go?* Actions auto-wait. A `waitForReady` on a component is fine when the component has a real ready state, but not as a sleep.

**Trap:** One class per page with 60 methods, including assertions, sleeps and `if` branches. It becomes a second framework to maintain.

**Source:** https://playwright.dev/docs/pom

### Page objects vs fixtures vs Screenplay: what is the difference, and what do you prefer?

Topic: fw-pom | Core | id: q0630

**Say:** They solve different problems. Fixtures solve setup and teardown: they give a test what it needs and clean up afterwards. Page objects solve duplication of UI knowledge: where things are and how to act on them. Screenplay models tests as actors who have abilities and perform tasks, which gives very readable tests and a lot of extra structure. I use fixtures for everything about setup, thin page and component objects for shared UI, and plain functions for the rest. If you have not used Screenplay in production, say so, and explain that you would not bring it in unless a large team needed that strict vocabulary.

**Full process:**
1. Fixture: `test.extend({ account: async ({ request }, use) => { ...create; await use(a); ...delete } })`. Lifetime and cleanup are its job.
2. Page object: a class with locators and actions for one page or component.
3. Screenplay: `Actor.named('Ann').whoCan(BrowseTheWeb.using(page)).attemptsTo(Login.with(...), AddToCart.item('book'))`. Tasks and interactions are small classes composed by the actor. In TypeScript, Serenity/JS implements it.
4. How they combine in Playwright: a fixture builds the page object, so `test` only names it. Page objects do not create data. Fixtures do not click.
5. Decision rule: more than three tests share the same UI steps, make a page or component object. Setup that needs cleanup, make a fixture. A one-off, keep it in the test.

**Follow-ups:**
- *Why not Screenplay?* More classes for the same behavior. It pays off for big teams with many actors and strict conventions. For a team of three to ten, it is overhead.
- *Can fixtures replace page objects completely?* Some teams do it: a fixture exposes a few helper functions. It works when the UI is small. I still like named locators in one place.

**Trap:** Saying "fixtures replace POM" or "POM is dead". They are not the same layer.

**Source:** https://playwright.dev/docs/test-fixtures

### What are the anti-patterns of the Page Object Model?

Topic: fw-pom | Core | id: q0631

**Say:** The ones I see most: assertions inside page objects, so the test no longer shows what it proves. God classes with every action of the product. Methods that return other page objects and hide the flow. Branching on state inside a method. Fixed waits. Raw CSS or XPath locators exposed as public strings. And inheritance chains from a `BasePage` that holds helpers nobody remembers. I avoid all of them by keeping page objects thin and putting intent in the spec.

**Full process:**
1. Assertions in page objects: move them to the spec. If the same assertion is repeated, extract a helper function in the spec file or a custom matcher.
2. God class: split into component objects (header, modal, table row).
3. Hidden flow: the test calls `loginPage.signIn(...)` then `dashboardPage...` explicitly.
4. Branching: a page method that does `if (await x.isVisible())` races rendering, because `isVisible()` does not wait. Decide the branch from known state, or assert with a web-first assertion.
5. Locator strings: expose `Locator` fields, not selector strings.
6. Deep inheritance: use composition. A page object takes a component in its constructor.
7. State: a page object must not keep test data in fields that tests change, because parallel tests would share it. Create one per test through a fixture.

**Follow-ups:**
- *Is `nth()` in a page object an anti-pattern?* It is a smell: it says the locator has no meaningful relationship. Scope from a stable parent instead, with `filter({ has, hasText })`.
- *What do you do with legacy page objects like this?* Minimal diff: fix the ones that cause failures, and do not rewrite working helpers for style.

**Trap:** Saying "no anti-patterns, POM is best practice". Interviewers want to know you have seen it fail.

**Source:** https://playwright.dev/docs/pom

### Why does the Page Object Model fail at scale, and what do you do instead?

Topic: fw-pom | Core | id: q0632

**Say:** It fails when the page object becomes a mirror of the whole UI. Hundreds of methods, shared state and inheritance mean a change in one place breaks unrelated tests, and nobody dares to delete anything. The fix is smaller units. Component objects for what repeats, fixtures for setup, and plain functions or inline steps for one-offs. I also reduce the need for locators by making the product accessible, because role and name locators are short and stable, so the page object has less to hide.

**Full process:**
1. Measure: list page object members with no call sites. Delete the definition and let the compiler show every user.
2. Split by component, not by URL. A table component works on every page that has a table.
3. Remove inheritance. Use composition.
4. Move setup into fixtures, so page objects only wrap UI.
5. Move one-off checks back to the test.
6. Locators: prefer `getByRole`, `getByLabel`, `getByText`. Keep a test id only when no user-facing locator works.

**Follow-ups:**
- *What replaces it?* Component objects plus fixtures. I would not use a different big pattern unless the team asks.
- *How do you see it has gone wrong?* Merge conflicts in page object files, tests that fail together after a UI change, and members nobody uses.
- *A page object has 1,500 lines, and page objects A and B hold the same components. What do you do?* I take each repeated part of the screen out into its own component object: a class that gets its root locator and knows only what is inside it. Pages A and B each create that component. This is composition: the page has a search form.
- *Why not put the shared parts into a BasePage?* Inheritance says every page is a BasePage, so every page gets everything in it. A Cancel button in BasePage claims that every page has that same Cancel button, which is false for most pages. Then others follow, and the 1,500 lines move from the page object to BasePage, where a change now touches every page.
- *What may a BasePage hold, then?* Only what is truly outside the domain and the same for every page: the `page` reference and perhaps a `goto`. Often that is so little that no BasePage is needed.
- *How do fixtures fit in?* A fixture creates the page object and hands it to the test, so tests do not call `new` and setup stays in one place.

| | Inheritance: BasePage | Composition: component objects |
|---|---|---|
| Relation | every page is a BasePage | a page has a search form |
| A page gets | everything in the base, needed or not | only the components it creates |
| Shared code grows | in one file that every page depends on | as separate small files |
| A change to shared code | can break every page | touches the pages that use that component |
| Same part used twice on a page | hard | two instances with two root locators |

```ts
// components/search-form.ts
import { type Locator } from '@playwright/test';

// One part of the screen. It knows only its own root element.
export class SearchForm {
  private readonly destination: Locator;
  private readonly searchButton: Locator;

  constructor(private readonly root: Locator) {
    this.destination = root.getByLabel('Kierunek');
    this.searchButton = root.getByRole('button', { name: 'Szukaj' });
  }

  async searchFor(destination: string) {
    await this.destination.fill(destination);
    await this.searchButton.click();
  }
}
```

```ts
// pages/offers-page.ts
import { type Locator, type Page } from '@playwright/test';
import { SearchForm } from '../components/search-form';

// The page has a search form. It does not inherit one.
export class OffersPage {
  readonly search: SearchForm;
  readonly results: Locator;

  constructor(page: Page) {
    this.search = new SearchForm(page.getByRole('search'));
    this.results = page.getByRole('list', { name: 'Oferty' }).getByRole('listitem');
  }
}
```

```ts
// pages/favourites-page.ts
import { type Locator, type Page } from '@playwright/test';
import { SearchForm } from '../components/search-form';

// A different page, the same component, no shared parent class.
export class FavouritesPage {
  readonly search: SearchForm;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.search = new SearchForm(page.getByRole('search'));
    this.emptyMessage = page.getByText('Brak ulubionych dla tego kierunku');
  }
}
```

```ts
// tests/search.spec.ts
import { test as base, expect } from '@playwright/test';
import { OffersPage } from '../pages/offers-page';
import { FavouritesPage } from '../pages/favourites-page';

// Fixtures hand each test the page object it asks for.
const test = base.extend<{ offersPage: OffersPage; favouritesPage: FavouritesPage }>({
  offersPage: async ({ page }, use) => {
    await page.goto('/oferty');
    await use(new OffersPage(page));
  },
  favouritesPage: async ({ page }, use) => {
    await page.goto('/ulubione');
    await use(new FavouritesPage(page));
  },
});

test('offers page: search lists the offers for the destination', async ({ offersPage }) => {
  await offersPage.search.searchFor('Majorka');

  await expect(offersPage.results).toHaveText(['Majorka, 7 nocy', 'Majorka, 10 nocy']);
});

test('favourites page: the same search form shows the empty message', async ({ favouritesPage }) => {
  await favouritesPage.search.searchFor('Kreta');

  await expect(favouritesPage.emptyMessage).toBeVisible();
});
```

Each class has three parts: the fields (locators and components), the constructor that fills them, and the methods that act. Run on Playwright 1.65.1 with two local pages in place of `/oferty` and `/ulubione`: both tests pass, and both fail when the button name inside `SearchForm` is changed, which shows the one component serves both pages.

**Trap:** Throwing POM away completely. Then the same locator appears in 30 files.

**Source:** https://playwright.dev/docs/pom

### Should assertions be inside page objects?

Topic: fw-pom | Core | id: q0633

**Say:** No, I keep them in the test. A test is a contract: when someone reads it, the assertion says what behavior is guaranteed. If it is hidden in a page object, the reader cannot see it, and a change to the page object can weaken the test without a visible diff. The cost is a few repeated lines in specs. If the repeated lines hurt, I extract a function in the spec that takes a locator and asserts, or a custom matcher.

**Full process:**
1. Page object exposes `readonly total: Locator`.
2. The test says `await expect(cart.total).toHaveText('$25.00')`.
3. For repeated checks, `expect.extend` custom matcher or a helper in the spec file.
4. Two identical assertions around a state change are a pair, not duplication: they prove the change happened.

**Follow-ups:**
- *The Playwright docs put `expect` in a page method.* True, and it is a style choice there. My rule is about readability of the contract.
- *What about `waitForReady`?* A page object may wait for its own ready state, because that is synchronization, not a claim about the product.

**Trap:** Saying "both are fine". Pick one and give the reason.

**Source:** https://playwright.dev/docs/pom

### Why store `Locator` objects in page objects and not element handles?

Topic: fw-pom | Standard | id: q0634

**Say:** A `Locator` is a recipe, not a found element. Every action or assertion looks the element up again and retries until it works. An `ElementHandle` points to one DOM node. If the page re-renders, the handle is stale and the next action fails. Playwright recommends locators and treats handles as discouraged. So a page object holding locators survives re-renders, which are normal in React apps.

**Full process:**
1. Build locators in the constructor: `this.save = page.getByRole('button', { name: 'Save', exact: true });`. No lookup happens yet.
2. At `await this.save.click()`, Playwright finds the element, waits for it to be actionable, clicks.
3. If the element is replaced between two steps, the next step finds the new one.
4. ESLint rule `playwright/no-element-handle` flags handle use.

**Follow-ups:**
- *Strictness?* A locator that matches more than one element throws on actions. That is a feature: it shows ambiguity. Do not fix it with `.first()`, fix the scope.
- *Does `locator.elementHandle()` still have uses?* Rarely, for interop with code that needs a handle.

**Trap:** Calling `page.$('...')` in helpers because old Selenium habits do it.

**Source:** https://playwright.dev/docs/best-practices

### How do you prevent state leaking between page objects in parallel tests?

Topic: fw-pom | Standard | id: q0635

**Say:** A page object holds a `page`, and each test has its own `page` and context. So if I create the page object per test, through a fixture, state cannot leak. Leaks come from module-level variables, static fields, singleton page objects, and data kept in fields. I keep page objects free of data and I create them inside fixtures, never at import time.

**Full process:**
1. Create in a fixture: `checkout: async ({ page }, use) => use(new CheckoutPage(page))`. One instance per test.
2. No `static` members and no `export const checkoutPage = new CheckoutPage(...)` at module level.
3. Test data lives in fixtures and local variables, not in page object fields.
4. Run `--fully-parallel` and `--shuffle` in CI nightly. State leaks show up as order-dependent failures.

**Follow-ups:**
- *Are worker-scoped fixtures a leak risk?* Yes, they are shared by all tests in one worker. Use them only for read-only or per-worker-unique things.

**Trap:** Thinking the page object is safe because tests run in different files. Workers reuse module state for tests in the same worker process.

**Source:** https://playwright.dev/docs/test-parallel

### How do you handle data-driven tests with page objects?

Topic: fw-pom | Standard | id: q0636

**Say:** The data sits outside the page object, and the test loops over it. In Playwright you generate tests in a loop, one test per row, with the data in the title so the report shows which row failed. The data is typed TypeScript or JSON in the repo. I keep the cases varied on purpose (different locales, lengths, special characters), not one sample repeated.

**Full process:**
```ts
const cases = [
  { name: 'empty email', email: '', error: 'Email is required' },
  { name: 'no at sign', email: 'ann.example.test', error: 'Enter a valid email' },
  { name: 'trailing space', email: 'ann@example.test ', error: 'Enter a valid email' },
];

for (const { name, email, error } of cases) {
  test(`sign-up rejects ${name}`, async ({ signUpPage }) => {
    await signUpPage.goto();
    await signUpPage.submitEmail(email);
    await expect(signUpPage.emailError).toHaveText(error);
  });
}
```
1. Each case becomes its own test, so retries, traces and parallelism work per case.
2. Keep the data next to the test when it is short. Move to `data/` when many tests share it.
3. Do not read Excel at runtime unless the business owns the sheet. Typed data gets compile checks.

**Follow-ups:**
- *Would you generate hundreds of cases?* Only if each adds a different risk. Otherwise it is slow and tells nothing new. Lower levels (unit tests) are better for large input tables.

**Trap:** One test with a `for` loop inside it. The first failing row stops the rest and the report shows one test.

**Source:** https://playwright.dev/docs/test-parameterize

## Test data and environments

### How do you manage test data in automation? What is your strategy?

Topic: fw-test-data | Core | id: q0637

**Say:** Every test makes the data it needs, through the API, and removes it afterwards. The UI is only used for the flow I am testing, not to prepare it. Data is unique per test, so parallel tests never touch the same record, and it is varied, not one fixed sample. Long-lived shared accounts are the thing I avoid most, because they collect state until something breaks. For read-only reference data (a product catalogue, a plan list) I rely on a seeded baseline that tests never modify.

**Full process:**
1. Split data into three kinds: baseline (read-only, seeded once per environment), per-test (created and deleted by the test), and per-worker (an account pool, one per parallel worker).
2. Build per-test data with an API client inside a fixture, with cleanup after `await use(...)`.
3. Make names unique: `e2e-${crypto.randomUUID()}`. Never use real customer names, emails or domains. Use a reserved test domain such as `example.test`.
4. Vary the inputs: a factory returns valid but different data each call (different lengths, locales, special characters). Print the seed or the generated values in the test attachments, so a failure can be reproduced.
5. Check the response status before parsing the body (`expect(response).toBeOK()`).
6. Pace bulk writes to respect rate limits, and use internal message types that do not send real email when seeding.
7. Clean up after the run, even when a test failed. Fixtures do this. A nightly sweep deletes anything with the `e2e-` prefix older than a day, as a safety net.

**Follow-ups:**
- *Why not a database dump restored before each test?* It is slow, it serialises tests, and in a shared environment it deletes other people's data. It fits only with a private database per runner.
- *Random or fixed data?* Deterministic where the test needs to know the answer, varied where the product must handle any input. Always log the generated value, so a random failure can be reproduced.
- *UI or API for setup?* API. UI setup is the slowest and flakiest part of a test.

**Trap:** Saying "Excel or JSON files". That describes where data is stored, not how tests stay independent.

**Source:** https://playwright.dev/docs/best-practices

### How do you seed test data through the API? Show me.

Topic: fw-test-data | Core | id: q0638

**Say:** Playwright has an API client built in: the `request` fixture. A fixture creates the record with `request.post`, checks that the status is OK, hands the data to the test, and deletes it after. The test then opens the UI directly on the thing it needs. It is fast, it is stable, and the API call has its own entry in the trace, so a failure in setup is easy to tell from a failure in the flow.

**Full process:**
```ts
// fixtures/index.ts
import { test as base, expect } from '@playwright/test';

type Order = { id: string; number: string };

export const test = base.extend<{ order: Order }>({
  order: async ({ request }, use) => {
    const create = await request.post('/api/orders', {
      data: { sku: 'BOOK-001', quantity: 1, buyer: `e2e-${crypto.randomUUID()}@example.test` },
    });
    expect(create).toBeOK();
    const order: Order = await create.json();

    await use(order);

    const remove = await request.delete(`/api/orders/${order.id}`);
    expect(remove).toBeOK();
  },
});
export { expect };
```
```ts
test('support can cancel an order', async ({ page, order }) => {
  await page.goto(`/orders/${order.id}`);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Order cancelled');
});
```
1. `request` uses `baseURL` from the config. For a separate API host, create a context with `playwright.request.newContext({ baseURL })` (the `playwright` fixture).
2. Authentication for the API: pass a header in `use.extraHTTPHeaders` or log in through the API and reuse the cookie.
3. If the view only loads once on mount, the backend write may not be there yet when the page opens. Poll the endpoint the view calls with `expect.poll(...)` until the record exists, then open the view.
4. Cleanup in the fixture runs after failure too.

**Follow-ups:**
- *What if the API has no delete?* Use a test-only cleanup endpoint, or unique data plus a nightly sweep. Say that this is a risk and track it.
- *Eventual consistency?* A write that returns 202 is not done. Poll for the final state with `expect.poll`.
- *Should seeding call the same code as production?* Prefer the public API. A shortcut that writes to the database directly can create states the product cannot reach.

**Trap:** Seeding with a long UI script "because it also tests the UI". Then every test fails when the sign-up page changes.

**Source:** https://playwright.dev/docs/test-fixtures

### A result appears about once in 40 calls, and you cannot seed the environment or mock. How do you test it, and on which level?

Topic: fw-test-data | Core | id: q0639

**Say:** I split it in two. The rule itself, "when the price has changed, show the message", is logic. It is cheapest to test on a lower level, where the input can be forced: a unit or integration test in the service's repository. That part is a suggestion to developers, and I check that the test exists. On my level, an E2E test with no mock and no seeding, I cannot force the case, so I find it. Before the UI steps, the test asks the backend through the API which offer has a changed price right now. Then it opens exactly that offer in the browser and asserts the message. The search has a cap. When no case is found, the test fails with a message that says so, which is a different failure from "the message is broken".

| Level | How the rare case is produced | What it proves |
|---|---|---|
| Unit or integration, in the service | forced by the test (a stubbed price source) | the rule is right |
| E2E with a mocked response | forced by `page.route` | the UI shows the message |
| E2E with no mock | found through the API, then opened in the UI | the real backend and the real UI work together |

**Full process:**
1. Ask whether the case can be made on purpose: a seed, a test endpoint, a feature flag. If not, say what that costs.
2. Find the case through the API, in batches inside the rate limit, with a cap on calls.
3. Use the found item in the UI steps: open that offer, go to the next page, assert the message.
4. Keep one such test, because it is slow and depends on live data. The rule's variants go to the lower level.

**Follow-ups:**
- *The business says it is critical and must be tested on your level. What then?* Then one real E2E test finds the case through the API and checks the message, and I say openly that its run time depends on how soon the case turns up.
- *What would you ask the developers for?* A way to produce the case on a test environment: a test-only endpoint or a flag that marks one offer as changed. That turns a search into a setup step.
- *Why not only the lower level?* It proves the rule. It does not prove that the real page shows the real message for a real offer.

**Trap:** Clicking through 40 offers in the UI until the message shows up. The search belongs in the API, where one call takes milliseconds.

**Source:** https://playwright.dev/docs/api-testing

### How do you keep test data safe when tests run in parallel?

Topic: fw-test-data | Core | id: q0640

**Say:** Parallel safety means no two tests can touch the same record. So every test creates its own uniquely named data, and nothing relies on global counts, such as "the list has 3 items". Accounts that tests modify are one per worker or one per test. If something truly cannot be isolated, like a single global setting, I lock it: tests that change it share a named lock or a serial describe, kept as small as possible. And I run `--shuffle` to find hidden order dependencies.

**Full process:**
1. Unique naming per test (`crypto.randomUUID()`), not timestamps alone: two workers can get the same millisecond.
2. Scope assertions to your own data: find your row by its unique name, do not assert the table has 5 rows.
3. For per-worker accounts, use `testInfo.parallelIndex` in a worker-scoped fixture. The Playwright auth guide uses exactly this for tests that change server state.
4. For the unavoidable shared resource: `test.describe.configure({ lock: 'user-settings' })` serialises only the tests that use that lock. (Serial mode, `mode: 'serial'`, is discouraged because one failure skips the rest and a retry re-runs the whole group.)
5. Run a nightly `npx playwright test --shuffle`. The seed is printed; pass it again to reproduce an order.
6. Rate limits: a login or write storm from many workers can trigger throttling. Cap workers for that area rather than adding retries.

**Follow-ups:**
- *What if the app has a global singleton, like one "current campaign"?* Isolate by environment (a separate test tenant per worker), or serialise those tests behind a lock and keep them few.
- *Can you fix flakiness by running serially?* It hides the dependency. I prefer sharding and shuffle over serial blocks.

**Trap:** `workers: 1` as the cure for data collisions. The suite becomes slow, and the first time someone raises the workers, it breaks.

**Source:** https://playwright.dev/docs/test-parallel

### How do you clean up test data?

Topic: fw-test-data | Standard | id: q0641

**Say:** Cleanup is part of the fixture, after `await use(...)`, so it runs whether the test passed or failed. It deletes through the same API that created the data. As a safety net, a scheduled job deletes anything with the test prefix that is older than a day, because a crashed worker or a killed CI job never reaches teardown. And I design the data so that leftovers are harmless: unique names, a test-only domain, no emails that really send.

**Full process:**
1. Fixture teardown deletes what the fixture created, in reverse order.
2. Teardown must not hide the test failure: if cleanup fails, the report shows that as its own error and the original failure is still visible.
3. Prefix everything (`e2e-`), so a sweep script can find it. The sweep calls the list API with the prefix and deletes items older than a day.
4. Count at the end: a check (in a nightly job) that the number of test-prefixed records is near zero. A growing number means the cleanup is broken.
5. For a shared account that cannot be deleted, remove the child records (conversations, events), so the account is back to a known state.
6. Use `afterAll` only for things made in `beforeAll`. Worker-level cleanup runs when a worker ends, including after a failure.

**Follow-ups:**
- *Should cleanup be before or after the test?* Both have uses. Cleanup after keeps the environment tidy. A "clean before" step makes the test robust to leftovers from a crash. I prefer unique data, so neither is critical.
- *What if cleanup is slow?* Run it through the API in the fixture; if it still costs seconds, delete in bulk by prefix in a nightly job instead.

**Trap:** Cleanup in the test body at the last line. An early assertion failure skips it and leaves data behind.

**Source:** https://playwright.dev/docs/test-fixtures

### Why is deterministic test data preferred over fully random data?

Topic: fw-test-data | Standard | id: q0642

**Say:** A test needs to know the expected answer. If the input is random, the expected value must be computed, and the computation can copy a bug from the product. A failure with random input may also not reproduce. So I use fixed values where the result matters (a price, a date) and generated values where uniqueness is the point (an email, a name). When I do generate values with variety, I print the seed or the values so any failure can be replayed.

**Full process:**
1. Deterministic: amounts, dates, quantities, the exact text of expected messages. The expected string is typed or built independently.
2. Generated: identifiers, names, emails, so tests do not collide.
3. Varied: a list of different samples (languages, lengths, special characters), each case its own test, so a failure names the input.
4. Log: attach the generated values with `testInfo.attach('data', { body: JSON.stringify(data), contentType: 'application/json' })`.
5. Locale-formatted values: do not type `12 500,00 zł`. In pl-PL the thousands separator is a non-breaking space (U+00A0), and a four-digit number has no grouping. Build the expected string with `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`.
6. Time: compare timestamps at the same precision. A system that stores seconds and another that stores milliseconds give false mismatches.

**Follow-ups:**
- *Property-based testing?* Good for pure logic at unit level. In E2E it is slow and hard to debug; I use varied lists instead.
- *Faker?* Fine for names and emails. Fix the seed when you need replay.

**Trap:** "Random is better because it finds more bugs." It also finds bugs nobody can reproduce.

**Source:** https://playwright.dev/docs/api/class-testinfo

### How do you handle test data privacy and PII? What about data masking?

Topic: fw-test-data | Standard | id: q0643

**Say:** Tests use synthetic data. I do not copy production customer data into test environments. If a bug only reproduces with a customer's data shape, I recreate the shape with placeholders, never the real names or domains. If an environment must be seeded from production, the copy has to be masked first, which means replacing real values with fake but realistic ones, keeping formats and relations so the application still works. Test credentials live in the CI secret store and are never printed in logs.

**Full process:**
1. Synthetic first: factories generate people, addresses and emails on a reserved test domain.
2. Masking when needed: replace names, emails, phone numbers and free text with generated values; keep the same format and keep foreign keys consistent (the same customer gets the same fake name everywhere). A deterministic hash with a secret salt gives consistent but irreversible values.
3. Never mask only in the UI. Mask in the data pipeline before the copy lands.
4. Logs and traces can contain data: do not record trace and video for tests that show real data, and keep artifact retention short.
5. Secrets: environment variables from the CI secret store. Never print a credential in a log; check a key by its length, not its value.
6. Seeding that sends email: use internal message types that do not send real mail.

**Follow-ups:**
- *Tests against production?* Only read-only, with a dedicated account.
- *What do you do when a developer pastes a customer name into a test?* Replace it in the same review, and tell them why.

**Trap:** "We just anonymise the names". Emails, free text and combinations of fields identify people too.

**Source:** https://playwright.dev/docs/best-practices

### How do you test a data migration? Tell me about a tool you built for it.

Topic: fw-test-data | Standard | id: q0644

**Say:** For a migration the test must link what went in to what came out. Make the input deterministic and write a manifest of what was sent and where it should land. Then verification queries read the manifest and check the target tables. Also keep evidence honest: scenarios that go through the real legacy bridge count as migration evidence, and scenarios that write straight to the new tables only check rendering, and are marked as not evidence.

**Full process:**
1. Inputs: one visitor sends every message type once, in a fixed order, through three paths: the widget socket, the operator socket and the new API.
2. Pacing: 400 ms between frames, because the server's spam detector permanently bans a connection after 20 frames under 250 ms.
3. Manifest: each run writes `manifest.json` with what was sent and what should land in the new `tickets_v2` tables.
4. Verification: SQL checks read the manifest, join on the ids, and compare counts and field values for each message type. Typical checks: row count per type, no orphan messages, timestamps with matching precision, content equality.
5. Separate scenarios: those exercising the live legacy bridge are evidence; those that write directly to the new tables only check rendering.
6. Document limits: a visitor socket cannot produce bot-generated cards, buttons or forms, so the README says how to cover those another way.

**Follow-ups:**
- *Why not random load?* Random input cannot prove every type landed. A deterministic run can be repeated after a fix and compared.
- *Which database checks?* Counts per type, referential integrity, null checks on required fields, and sampling of content. PostgreSQL and MySQL both support the join queries; the differences are in tooling, not in the idea.

**Trap:** Reporting "migrated 100%" from a row count. Counts match even when content is wrong.

**Source:** https://playwright.dev/docs/best-practices

### How do you handle test environments and configuration across them (a test environment management strategy)?

Topic: fw-test-data | Standard | id: q0645

**Say:** I want few environments, each with a clear purpose, all created from code. Local for development, an ephemeral preview per merge request when possible, a shared staging for integration, and production for read-only smoke checks. Configuration is data selected by one variable, secrets come from the secret store, and every environment reports its version, so a failure can be matched to a commit. The most important rule is that a test environment must behave like production in the things that matter, which I check automatically.

**Full process:**
1. List the environments and the owner of each. Say what runs where: merge request gets smoke or changed tests, after merge gets the full suite, production gets read-only smoke.
2. One config layer (`env.ts`), one variable (`TARGET_ENV`). Fail on missing values.
3. Infrastructure from code (Kubernetes manifests, Terraform or Ansible), so an environment can be rebuilt.
4. Health and version: a check before the run that the environment answers and prints the deployed commit.
5. Schedules: dev environments can be off by design; know the schedule before calling a 404 a bug.
6. Drift guard on feature flags and versions (see the drift guard entry).
7. Data: each environment has a baseline, and tests create the rest.

**Follow-ups:**
- *Shared staging for many teams?* Expect instability: use unique data, and report environment failures separately from test failures.
- *Ephemeral environments?* Best for isolation, cost is startup time and seed data.

**Trap:** Treating a failing run on a broken environment as a flaky test. Classify first: environment, test, or product.

**Source:** https://playwright.dev/docs/test-configuration

### How do you test with third-party integrations and credentials (webhooks, Shopify, email)?

Topic: fw-test-data | Standard | id: q0646

**Say:** I separate what I own from what I do not. For my own integration code I test the receiving side: the webhook endpoint, the signature check, and what the user sees. For the third party's behaviour I either use their sandbox, or a mock for the cases I cannot trigger. Credentials are attached only in the tests that need them. And for anything that expires, I automate renewal, so a test fails with a clear message and not with a mystery.

**Full process:**
1. Webhooks: assert the receiver's log and response codes, not just that an event was configured. Counting configured events proves configuration, not delivery. A passing UI can hide a 406.
2. Mock for unreachable states: `page.route` returns canned responses for errors and edge cases.
3. Sandbox for the happy path where it exists.
4. Credentials: environment variables from the secret store; `use` them inside the test or fixture that needs them. Never global setup.
5. Expiring credentials: a scheduled job renews before expiry and a test fails fast with the exact reason if the credential is missing or old.
6. Idempotency: send the same webhook twice and assert one effect.

**Follow-ups:**
- *Contract testing?* If you have used OpenAPI-based contract tests, say how; if not, say so plainly. Explain the concept: the consumer publishes expectations, the provider verifies them in its pipeline.

**Trap:** Mocking everything. Then the test proves your mock, and the real integration can fail unseen.

**Source:** https://playwright.dev/docs/api/class-testconfig

## Flaky tests

### How do you handle flaky tests?

Topic: fw-flaky | Core | id: q0647

**Say:** First I define it: a flaky test passes and fails on the same code. Then I do not guess, I measure: I run it many times, read the trace of a failure, and put it in one class: a race, a locator that is ambiguous, an overlay, shared state, the environment, or a real product bug. I fix the cause. Retries are not a fix, because they only turn a visible problem into an invisible one. And I prove the fix with the same repeat run that showed the failure.

**Full process:**
1. Reproduce at volume, not once: `npx playwright test path/to/spec.ts --repeat-each=100 --workers=4`. One run proves nothing.
2. Reproduce as CI does: same browser image, same reporter, same worker count.
3. Collect evidence: `--trace on -j 1` for a clean single-worker trace, or the `retain-on-failure` trace from CI. Read the trace, screenshot, video and error context.
4. Classify (see the root-cause entry).
5. Check the base branch: does the same test fail there in the same window? If yes, it is not caused by this branch.
6. Fix the cause, with a minimal diff.
7. Prove it: repeat the same command and compare the numbers before and after.
8. Record it: what the class was, the numbers, and the fix, in the ticket (not in the merge request description, which keeps only lasting facts).

**Follow-ups:**
- *And if you cannot find the cause?* I quarantine it visibly with an owner and a date (see quarantine entry), not silently skip.
- *What if it is the product?* Then the test is right. Report the product bug with the trace, and do not weaken the test.

**Trap:** "I add retries" or "I add a wait". Both are the answer interviewers expect you to avoid.

**Source:** https://playwright.dev/docs/test-retries

### How do you detect flaky tests in the first place?

Topic: fw-flaky | Core | id: q0648

**Say:** Four ways. A repeat run: the same test many times on the same commit. A nightly burn-in of new and changed tests. A history: record each test result per run and look for tests that both pass and fail on the same commit. And shuffle: run in random order, because order-dependent tests show up there. The key is to collect it automatically, because people forget a test that failed once last Tuesday.

**Full process:**
1. Repeat run: `npx playwright test --repeat-each=50 -j 4 tests/orders/`. Playwright runs each test N times, and each run is a separate result.
2. Burn-in on merge requests: run only the changed specs many times. `npx playwright test --only-changed=origin/main --repeat-each=20`.
3. Nightly shuffle: `npx playwright test --shuffle`. The seed prints at the start; save it in the job log.
4. History: a custom reporter records every result.
```ts
// reporters/flake-reporter.ts
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { writeFileSync } from 'node:fs';

type Tally = { runs: number; failures: number };

class FlakeReporter implements Reporter {
  private tally = new Map<string, Tally>();

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'skipped') return;
    const key = test.titlePath().join(' > ');
    const t = this.tally.get(key) ?? { runs: 0, failures: 0 };
    t.runs += 1;
    if (result.status !== 'passed') t.failures += 1;
    this.tally.set(key, t);
  }

  onEnd(_result: FullResult) {
    const rows = [...this.tally].map(([test, t]) => ({ test, ...t, rate: t.failures / t.runs }));
    writeFileSync('flake-report.json', JSON.stringify(rows, null, 2));
  }
}
export default FlakeReporter;
```
5. A test is flaky when `0 < failures < runs` on one commit. All failures on one commit means failing, not flaky.
6. If retries are on, the library reports an outcome `'flaky'` per test case (`testCase.outcome()`), and `failOnFlakyTests` fails the run on it.
7. By default JUnit keeps only the final result, so flaky-then-passed tests vanish there. Since 1.59 `includeRetries: true`, or `PLAYWRIGHT_JUNIT_INCLUDE_RETRIES=1` on `merge-reports`, adds a `<flakyFailure>` for each failed attempt. Otherwise keep the raw list output, or use the reporter above.

**Follow-ups:**
- *Why not just use retries to find them?* With retries on, a test that passes on retry is labelled flaky, which is useful as a measurement. I use that in a one-off diagnostic run (`--retries=2`) to label tests, not as a standing config.
- *How many repeats?* A 1% flake needs about 100 runs to show most of the time, and 300 for confidence. Rare flakes need more volume, so run it in shards.

**Trap:** Looking at one failed pipeline. A single failure is an anecdote.

**Source:** https://playwright.dev/docs/test-cli

### How do you measure a flake rate and report it?

Topic: fw-flaky | Core | id: q0649

**Say:** Flake rate is failures divided by runs for one test on unchanged code. I report it per test and per area, with the number of runs, and I show the trend, not a single number. For leadership, one line: how many tests flaked this week, which area has the most, and how many we fixed. I always give the denominator, because 7 failures means different things in 20 runs and in 2,000.

**Full process:**
1. Collect per-run results (the reporter in the detection entry).
2. Per test: `rate = failures / runs`. Report the count of runs next to it.
3. Per area: tests with `rate > 0` divided by tests in the area.
4. Weekly view: new flaky tests, fixed, quarantined, still open. Rank by pipeline impact (how many merge requests each blocked).
5. Share one table: test, area, runs, failures, class of cause, owner, status.
6. Keep raw logs: CI artifacts expire.
7. State the environment: "measured on CI, Chromium, 4 workers", because a local number is not a CI number.

**Follow-ups:**
- *What is a good target?* Zero flaky tests in the required gate. A flaky test is either fixed or out of the gate within a set time.
- *Per test or per run?* Both. A suite-level "pass rate on first try" shows the cost to developers: a run with 1,000 tests at 0.1% flake each fails about 63% of runs.

**Trap:** Reporting "we have 12 flaky tests" without runs, dates or which fail most.

**Source:** https://playwright.dev/docs/api/class-testcase

### What are the root causes of flaky tests? How do you classify them?

Topic: fw-flaky | Core | id: q0650

**Say:** I use six classes. Race: the test acts or asserts before the app is ready, like an unawaited request. Ambiguity: a locator can match the wrong element. Overlay: a modal, toast or animation covers the target. Shared state: tests or workers affect each other. Environment: slow or down services, rate limits, different data. And product: the app really is inconsistent. Each class has a different fix, so classifying first saves time.

**Full process:**
1. Race: the symptom is a pass when slow and a fail when fast. Fix by waiting for the real condition: a web-first assertion, `waitForURL`, or `waitForResponse` started in the same `Promise.all` as the click.
2. Ambiguity: strict mode errors or the wrong element clicked. Fix with a better locator: role and name, scoped to a stable parent.
3. Overlay: the call log says "intercepts pointer events". Wait for the cover to go (assert it is hidden); do not force the click.
4. Shared state: passes alone, fails in the suite or in parallel. Create data per test; run `--shuffle`.
5. Environment: failures cluster in time or on one shard. Check the service, rate limits and the deployed commit.
6. Product: the failure has a pattern a user could hit (a route race, a reconnect, a DST edge). The fix is in the product.
7. Evidence for each: trace actions, network tab, console, and the error context.

**Follow-ups:**
- *Examples of races?* A view that fetches once on mount while the backend still writes. A navigation that is still pending when the test types. A modal closing and giving focus back to the opener, so the next keys land on the wrong element.
- *Why do tests flake if Playwright auto-waits?* See the next entry.

**Trap:** One bucket called "timing". It blocks diagnosis.

**Source:** https://playwright.dev/docs/best-practices

### If Playwright has auto-waiting, why do flaky tests still happen?

Topic: fw-flaky | Core | id: q0651

**Say:** Auto-waiting covers the action: before a click, Playwright waits until the element is attached, visible, stable, enabled and receives events. It does not know what your test needs next. It does not wait for a request you triggered, for data to be saved, for a toast, or for a page that is still navigating. It also does not protect you from a locator that matches the wrong thing, from shared data, or from a slow environment. So the flake moves from "element not found" to "the app was not in the state the next step needs".

**Full process:**
1. Action passes, state is wrong: click Save, then immediately assert something that needs the response. Start `waitForResponse` in the same `Promise.all` as the click, then assert the toast.
```ts
const [response] = await Promise.all([
  page.waitForResponse(r => r.url().includes('/api/settings') && r.request().method() === 'PUT'),
  page.getByRole('button', { name: 'Save', exact: true }).click(),
]);
expect(response.ok()).toBeTruthy();
await expect(page.getByRole('status')).toHaveText('Saved');
```
2. Pending navigation: typing or asserting while the old page is still there. Wait for a stable URL or element first.
3. `isVisible()` does not wait, so branching on it races rendering.
4. `click()` waits for a disabled button to be enabled, so a test can pass while the block is the bug. Assert `toBeEnabled()` or `toBeDisabled()` at the moment it matters.
5. A lone `toBeHidden()` also passes when the dialog never opened. Assert it was visible first.
6. Do not add `waitFor({ state: 'visible' })` before every click: the action already waits.

**Follow-ups:**
- *`networkidle`?* No. Background polling can keep it waiting for ever, and it says nothing about your element. Wait for the specific result.
- *What does an explicit wait look like in your suite?* It observes an effect the action does not guarantee: a response, a URL, a row, a disappearance.

**Trap:** "Add `waitForTimeout`". A sleep is too short on slow CI and wasted time on fast CI.

**Source:** https://playwright.dev/docs/best-practices

### Should retries be used to fix flaky tests?

Topic: fw-flaky | Standard | id: q0652

**Say:** No. Retries are a way to keep a pipeline green while you work on the cause, not a fix. They hide the failure rate, they hide real product bugs that show up sometimes, and they make a pipeline longer. If a test needs a retry, it gets it on that one test, with a reason and an owner, and with `failOnFlakyTests` the run still reports it. I never use a retry for an infrastructure or backend error.

**Full process:**
1. Config: `retries: 0`. Failures show as failures.
2. A named exception:
```ts
test.describe('bulk ticket merge', () => {
  // Reconnect race tracked in the ticket. Remove when fixed.
  test.describe.configure({ retries: 1 });
  ...
});
```
3. With retries on, a test that fails then passes is `flaky` in the report and in `testCase.outcome()`. `failOnFlakyTests` (or `--fail-on-flaky-tests`) makes that exit non-zero.
4. `retryStrategy: 'isolated'` (added in Playwright 1.62) runs retries at the end, one by one in a single worker, to reduce interference with the rest of the suite. It costs total run time. It reduces interference, but it does not fix the cause.
5. Retries cannot rescue a locator that matches nothing: after one accessible-name change, 17 failure reports came from 5 tests and their retries.
6. Trace mode `on-first-retry` records only on a retry, so with retries off use `retain-on-failure`.

**Follow-ups:**
- *Many teams run `retries: 2` on CI. Is that wrong?* It is a choice with a price: the flake rate disappears from view. If a team does it, it must also count flaky tests and fix them on a schedule.
- *A release is blocked by a flaky test. Do you disable it?* See the next entry.

**Trap:** Presenting retries as "resilience". Resilience is the product's trait. The test's job is to tell the truth.

**Source:** https://playwright.dev/docs/test-retries

### A flaky test is blocking a release. Do you disable it?

Topic: fw-flaky | Standard | id: q0653

**Say:** First I check whether it is flaky or whether it found a real bug, because a failing test that fails sometimes may be showing a race users can hit. If it is a test problem and the release cannot wait, I quarantine it, not delete it: skipped with a reason, an owner, a ticket and a date, and a visible counter. The release goes on a decision by a person who knows the risk, and I name what the test protected, so we know what we run without. Then I fix it in the next days.

**Full process:**
1. Triage in 15 minutes: open the trace, run the test 50 times on the base branch. Does it fail there too?
2. If a product risk is plausible, tell the people who decide. Do not hide a product bug by any means: not by a skip, retry or weaker assertion.
3. If it is a test defect: quarantine.
```ts
test.fixme('guest can pay with a saved card', async ({ page }) => {
  // Quarantined: reconnect race, owner, ticket link, review by: 2026-12-01
});
```
or tag it `@quarantine` and run the tag in a separate non-blocking job with `--grep @quarantine`, and exclude it from the gate with `--grep-invert @quarantine`.
4. Every quarantined test gets a ticket, an owner and an expiry. A weekly review lists them.
5. Do not delete a skipped test without strong evidence; fix its types and logic.
6. After the fix, repeat run, then un-quarantine.

**Follow-ups:**
- *Skip or run non-blocking?* Non-blocking run is better, because you still see data. A plain skip hides it.
- *Who decides?* Risk is a team decision. QA gives the evidence and the proposal.

**Trap:** `test.skip` with no comment. In six months nobody knows why.

**Source:** https://playwright.dev/docs/test-annotations

### How do you prove a flaky test is really fixed?

Topic: fw-flaky | Standard | id: q0654

**Say:** With the same measurement that showed the failure, before and after, on the same environment. If it failed 7 times in 200 runs on the base branch, I run 200 again after the fix with no retries, and I want 200 of 200. I also say the limit: 200 clean runs bound a rare flake, they do not prove it away. And I check that the fix addresses the cause I found in the trace, not just the symptom.

**Full process:**
1. Before: `npx playwright test tests/entry.spec.ts --repeat-each=200 -j 4` on the base branch. Record failures.
2. Read a failing trace. Write down the cause in one sentence.
3. Fix it.
4. After: the same command on the fixed branch, same machine type, retries off. Expect 0 failures.
5. Mutation check: when possible, show that the test fails again if the fix is reverted. A test that never fails is not evidence.
6. Statistics: with 200 clean runs, the rule of three says the true failure rate is below about 1.5% with 95% confidence (3 divided by 200). For a rarer flake, run more, in shards.
7. Watch for a week: the flake report should show the test at zero.

**Follow-ups:**
- *What if it fails 1 in 1,000?* Then volume is the tool: run in CI shards, overnight. And look for a rare condition in the trace: a reconnect, a slow first request, DST.
- *Is a green CI run proof?* No, one run proves nothing.

**Trap:** "I ran it five times and it passed."

**Source:** https://playwright.dev/docs/test-cli

### Tell me about the last flaky test you fixed. Walk me through the process.

Topic: fw-flaky | Standard | id: q0655

**Say:** Example: the entry-redirect test. It failed intermittently, so first decide whether it was the test or the product. Running it 200 times on the base branch resulted in 7 failures. Then trace the failures to a navigation race in lazy route loading. Any user on a slow network could hit that, so the fix belonged in the product routing code, not in the test. After the fix it passed 200 of 200 with zero retries. That is why waiting longer in the test would have been the wrong answer.

**Full process:**
1. Measure: `npx playwright test tests/entry.spec.ts --repeat-each=200 -j 4` on the base branch. Result: 7 failures.
2. Read the trace of a failed run and compare it with a passing one, step by step. Look at navigations and the order of requests.
3. Make the race reproducible on demand: delay the lazy route chunk with `page.route`, so a slow load happens every time.
4. Decide test or product: if a real user can reach the state, it is a product bug.
5. Fix the product code; leave the test's assertions as they were.
6. Prove: the same command on the fixed branch, retries off, 200 of 200.
7. Share the evidence in the ticket; the merge request keeps only the lasting facts.

**Follow-ups:**
- *Why not just add a wait?* It would turn the test green and keep the user-facing bug.
- *What did you learn?* Delaying network responses with `page.route` is the fastest way to make a race fail on purpose.

**Trap:** A story where the fix was a longer timeout or a retry.

**Source:** https://playwright.dev/docs/test-cli

### How do you debug a flaky test with Playwright traces?

Topic: fw-flaky | Standard | id: q0656

**Say:** I open the trace of a failed run and read it as a timeline. The action list shows each step with a before and after snapshot, the Network tab shows which requests were in flight, the Console shows errors, and the call log of the failing action says why it waited or timed out. Then I compare with a passing trace of the same test. The difference between the two is usually the cause.

**Full process:**
1. Get a trace: CI artifact from `retain-on-failure`, or locally `npx playwright test path/to/spec.ts --trace on -j 1`.
2. Open it: `npx playwright show-trace test-results/<test>/trace.zip` (or from the HTML report).
3. Find the failing action. Read the error and its call log. "Intercepts pointer events" names the covering element. "Strict mode violation" shows the matches.
4. Click the action, and use the before and after snapshots. Is the page what you expected at that moment?
5. Network tab: was the response still pending? Which status? Which order?
6. Console tab: errors in the page, failed requests.
7. Compare to a passing trace (`--repeat-each` gives you both).
8. Classify, reproduce deterministically (for example delay a route with `page.route`), fix, prove.
9. Reproduce in CI conditions: same image, `-j 1` first, then the CI worker count.

**Follow-ups:**
- *Local passes, CI fails?* Slower machine, different viewport or locale, shared state, parallelism. Run with the CI image and worker count.
- *No trace available?* Re-run with `--trace on`. Do not guess.

**Trap:** Looking only at the screenshot at the end. The cause is earlier.

**Source:** https://playwright.dev/docs/test-cli

### What is wrong with a fixed sleep, and what do you do instead?

Topic: fw-flaky | Standard | id: q0657

**Say:** A fixed sleep guesses how long the app needs. Too short, and the test fails on a slow machine. Too long, and every run pays for it. It also does not say what you are waiting for. Instead I find the state the test really needs and assert it with a web-first assertion, which retries until it is true or times out. For a request, `waitForResponse`. For navigation, `waitForURL`.

**Full process:**
1. Ask: what happens in the app that I am waiting for? A request, a render, a route change, an animation end.
2. Replace the sleep:
   - UI text or state: `await expect(locator).toHaveText(...)`.
   - Request: `Promise.all([page.waitForResponse(...), click])`.
   - Navigation: `await page.waitForURL(...)`.
   - Loader gone: `await expect(spinner).toBeHidden()` or `waitFor({ state: 'detached' })` when the contract is that the node is gone.
   - Background data that no locator shows: `await expect.poll(() => api.count()).toBe(3)`.
3. Lint: `playwright/no-wait-for-timeout` and `no-networkidle` as errors.
4. Never `toPass()` or try/catch retry loops: they hide the same problem in a different shape.

**Follow-ups:**
- *Is `expect.poll` a sleep?* No. It re-evaluates a function until a condition holds; it is for state with no stable locator, like an API value.
- *When is a delay acceptable?* In a unit test of debounce code with a fake clock. In E2E, I use `page.clock` to control time.

**Trap:** Replacing `waitForTimeout(3000)` with `waitForTimeout(5000)`.

**Source:** https://playwright.dev/docs/best-practices

### How do you tell a flaky test from a real product bug?

Topic: fw-flaky | Standard | id: q0658

**Say:** I look for a pattern a user could hit. If the failure is tied to a condition (slow network, reconnect, a certain time zone, a double click), then it is probably a product bug that the test found by chance. If the failure disappears when I make the test deterministic and the app behaves correctly, it was the test. The practical check is to reproduce on demand: delay a response, drop a connection, set the clock. If I can make it fail every time, I understand it, and I can say whose bug it is.

**Full process:**
1. Read the trace: does the product end in a wrong state, or did the test look too early?
2. Make the condition deterministic: `page.route` to delay a response, `context.setOffline(true)` for a reconnect, `page.clock` for time.
3. Try the same steps manually with a throttled network.
4. If the product is wrong, report the defect with the trace and stop; do not attach a fix to a comment on someone else's merge request. If you own the code, fix it with a test.
5. Do not weaken the assertion. A failing integration test is evidence that behaviour changed.

**Follow-ups:**
- *Examples where the product was wrong?* A redirect race in lazy routes; a save error that was swallowed; DST handling in a time slider.
- *Who owns the bug?* Whoever owns the code. I can fix it when I am able to, with tests.

**Trap:** Assuming every intermittent failure is a test problem.

**Source:** https://playwright.dev/docs/best-practices

### How do you handle a test that passes locally but fails in CI?

Topic: fw-flaky | Standard | id: q0659

**Say:** I remove differences until I can reproduce it. CI is slower, has fewer cores, a different browser image, a different locale and time zone, shared environments and parallel shards. So I run the same container image, the same reporter and retry settings, the same worker count, and the same command. Then I compare traces. I check the environment first: is it up, and which commit does it run? I do not pin the time zone, locale or clock in the config to make it pass, because that hides real bugs.

**Full process:**
1. Same image: run the CI Playwright Docker image locally, with the same version as the lockfile.
2. Same command and workers: `npx playwright test ... -j <CI value>` and then `-j 1`.
3. Slow it down: throttle CPU through CDP or run with fewer cores.
4. Delay the responses you suspect with `page.route`.
5. Compare the CI trace and the local trace side by side.
6. Check shared data: does CI run shards against one account?
7. Check the same failure on the base branch, in the same window.
8. If it is a time problem, test with a browser clock set to the date that fails, in a zone that observes DST.

**Follow-ups:**
- *When is a config pin acceptable?* When the feature depends on it by design and the spec is explicit, in that spec's `test.use`. Never suite-wide to turn red green.
- *Failure only on one shard?* Look for a shared resource or a heavy file in that shard.

**Trap:** "CI is just slow." Slow CI is where races show.

**Source:** https://playwright.dev/docs/test-cli

### Tests are flaky with 4 workers on one machine. Someone fixed it with 1 worker and 4 shards. What do you do?

Topic: fw-flaky | Standard | id: q0660

**Say:** I treat it as a workaround, not a fix. Workers are processes on one machine, so with 4 workers the tests share that machine's CPU, memory and files, and they hit the backend at the same time. With 1 worker and 4 shards, each machine runs its tests one after another. What changed is that tests no longer run side by side on the same machine. So the flakiness came from something the tests share. The suite is green, the cause is still there, we pay for 4 machines to get the speed of 4 workers, and it comes back the day someone raises the worker count. I would find what is shared. Because the move to separate machines helped, I look first at what lives on the machine: a file the tests write, a port, CPU or memory, or an environment that each shard now has to itself. Then at data in the backend, such as one account used by every test. Each test gets its own data, and the suite goes back to 4 workers.

| | 4 workers, 1 machine | 1 worker, 4 shards |
|---|---|---|
| Tests running at once | 4 | 4 |
| Share CPU, memory, files | yes | no |
| Share the backend and its data | yes | yes, when the shards use one environment |
| Cost | 1 machine | 4 machines |

What the runs showed, on Playwright 1.65.1, with four tests that use one account:

| Setup | Shared account | Own account per test |
|---|---|---|
| 4 workers, 1 machine | 3 of 4 failed | 4 passed |
| 1 worker, 4 shards at once, same backend | 4 of 4 failed | 4 passed |
| 1 worker, no shards | 4 passed | not run |

The same four tests, sharing one local file instead of an account:

| Setup | Result |
|---|---|
| 4 workers, one folder | 3 of 4 failed, in 3 runs of 3 |
| 1 worker, 4 shards at once, same folder | 3 of 4 failed |
| 1 worker, 4 shards at once, a separate folder per shard, as on 4 CI machines | 4 passed, in 3 runs of 3 |
| 1 worker, no shards | 4 passed |

So shards do not hide a state that lives in the backend: the four shards still collide there. They do hide a state that lives on the machine, because each shard has its own files. When the move to shards made the suite green, the shared thing is on the machine (a file, a port), or each shard got its own environment. That tells where to look. CPU and memory pressure is the third candidate; it was not measured.

The fix: each test gets its own account from a fixture.

```ts
import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Each test gets its own account and cleans it up afterwards.
const test = base.extend<{ user: string }>({
  user: async ({ request }, use) => {
    const user = `qa-${randomUUID()}`;
    await use(user);
    await request.delete(`/favourites/${user}`);
  },
});

for (const offer of ['Majorka', 'Kreta', 'Rodos', 'Zanzibar']) {
  test(`adding ${offer} shows one favourite`, async ({ request, user }) => {
    await request.post(`/favourites/${user}`, { data: { offer } });

    const favourites = await (await request.get(`/favourites/${user}`)).json();
    expect(favourites).toEqual([offer]);
  });
}
```

**Full process:**
1. Reproduce: 4 workers, `--repeat-each=20`, `--retries=0`. Count the failures.
2. Read the trace of a failed run and look for data the test did not create.
3. Name the shared thing: an account, a record, a file, a port, or the machine's CPU.
4. Fix the cause: own data per test through a fixture. For CPU: fewer workers or a bigger runner, said openly as a resource limit.
5. Run the same command again and compare the count.

**Follow-ups:**
- *Is 1 worker and 4 shards ever a right setup?* Yes, when the runners are small and one browser is all a runner can carry. Then it is a resource decision and it is written down as one.
- *What if the cause is the backend failing under 4 parallel users?* Then it is a product or environment finding, not a test problem. I report it with the numbers.

**Trap:** Saying "it works now, so it is fixed". Also the opposite mistake: saying shards always hide shared state. They hide only what lives on the machine.

**Source:** https://playwright.dev/docs/test-parallel

### How do you stop flaky tests from coming back?

Topic: fw-flaky | Standard | id: q0661

**Say:** By making the common causes impossible to merge. ESLint rules ban sleeps, `networkidle`, forced actions, `nth()` and `first()`, focused tests and skipped tests without a reason. CI burns in new and changed tests with repeat runs. A weekly flake report ranks the worst tests. And every flake fix writes down the class of cause, so I can add a rule if a class repeats. Review comments that repeat three times become a lint rule.

**Full process:**
1. Lint rules (`eslint-plugin-playwright`): `no-wait-for-timeout`, `no-networkidle`, `no-force-option`, `no-nth-methods`, `no-focused-test`, `no-skipped-test`, `require-annotation-reason`, `missing-playwright-await`, `prefer-web-first-assertions`, `no-element-handle`, `no-conditional-in-test`, `no-conditional-expect`, `no-raw-locators`.
2. Burn-in: `npx playwright test --only-changed=origin/main --repeat-each=10` in the merge request pipeline.
3. Nightly: full suite with `--shuffle`, flake report published.
4. `failOnFlakyTests` and `forbidOnly` on CI.
5. Quarantine with expiry.
6. Review checklist (see the code review entry).

**Follow-ups:**
- *Do lint rules slow the team down?* The first week, yes. Then they replace review arguments with a red line.
- *What about false positives?* Use a narrow disable with a reason, and treat every new `eslint-disable` as a smell to be questioned.

**Trap:** A document of "best practices" nobody checks.

**Source:** https://github.com/playwright-community/eslint-plugin-playwright

## Test automation strategy and suite maintenance

### How do you decide what to automate, and what not?

Topic: fw-automation | Core | id: q0662

**Say:** I automate what is repeated, stable and costly if broken: the main user journeys, regressions of bugs that already hurt us, and checks that need many data combinations. I do not automate what changes every week, what a person sees better (look and feel, exploratory work), or what a lower-level test can prove faster. The question I ask is: what is the cheapest test that would catch this failure? Often it is a unit or API test, and E2E is left for the paths where the pieces meet.

**Full process:**
1. List the risks: which failure would cost most (money, trust, legal)? Rank.
2. For each risk, pick the lowest layer that can catch it: unit, API/contract, component, then E2E.
3. Score candidates: frequency of use, cost of failure, stability of the feature, effort to automate, effort to maintain. Automate high, high, stable, cheap.
4. Before adding an E2E test, check whether a unit test already covers the same flow. A duplicate E2E adds flake and CI cost only.
5. Leave to humans: exploratory testing, usability, new unstable features.
6. Re-check every quarter: delete what no longer earns its place.

**Follow-ups:**
- *What is the pyramid?* Many fast unit tests, fewer API tests, few E2E. A trophy or a diamond is a variation; the point is cost per defect found.
- *Automate bug regressions?* Yes. A bug that happened once is the best test case.

**Trap:** "Automate everything." That is a cost, not a goal.

**Source:** https://playwright.dev/docs/best-practices

### Coverage versus value: how do you judge a test suite?

Topic: fw-automation | Core | id: q0663

**Say:** Coverage tells you what code ran, not what was checked. A test with no useful assertion adds coverage and no value. So I judge a suite by what it would catch: for each important risk, is there a test, and does it fail when the behaviour breaks? I use mutation testing to find tests that never fail, flake rate to find tests that lie, and time to find tests that cost too much for what they check.

**Full process:**
1. Map tests to risks, not to files.
2. Mutation check: change the code in a small way (flip a condition) and see if a test fails. Stryker automates this for JavaScript and TypeScript. A mutation that survives means no test notices that change.
3. Assertion check: each test must assert something about behaviour a user cares about. Lint `expect-expect`.
4. Cost check: per test duration and flake count. Slow, flaky and low-value tests go first.
5. Gaps: write a coverage plan, a list of gaps per component, phased.

**Follow-ups:**
- *Is 100% coverage a goal?* No, a signal. High coverage with weak assertions is a false comfort.
- *Mutation testing in E2E?* Too slow. It works on unit and component level. For E2E, check one test with one deliberate break.

**Trap:** Quoting a coverage percentage as quality.

**Source:** https://playwright.dev/docs/test-annotations

### How do you enforce test code rules? Tell me about ESLint for Playwright.

Topic: fw-automation | Core | id: q0664

**Say:** If a rule is only in a document, people will break it by accident. So put the rules in ESLint, scoped to the test folder, and make them errors. The `eslint-plugin-playwright` package covers many: no `waitForTimeout`, no `networkidle`, no `{ force: true }`, no focused or skipped tests, awaited Playwright calls, web-first assertions. For rules that are specific to the team, add small custom rules or the `no-restricted-syntax` built-in. The effect is that review stops arguing about style and looks at the test's intent.

**Full process:**
1. Install: `npm install -D eslint-plugin-playwright`.
2. Flat config, scoped to the tests:
```js
// eslint.config.mjs
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';

export default defineConfig([
  {
    files: ['tests/**'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-force-option': 'error',
      'playwright/no-nth-methods': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/require-annotation-reason': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-conditional-in-test': 'error',
    },
  },
]);
```
3. Run `npx eslint tests` in CI as a required job and as a pre-push hook.
4. A new rule starts as `warn` with a count, becomes `error` when the count is zero, so adoption does not block the team.
5. Team-specific rules: `no-restricted-syntax` can ban a selector pattern, for example a call to `page.locator('xpath=...')`. The `no-restricted-locators` rule in the plugin bans chosen locator methods such as `getByTestId` if you want to.
6. Treat a new `eslint-disable` as a smell; fix the code instead.

**Follow-ups:**
- *Does lint replace review?* No. It handles the mechanical cases so reviewers have time for design.
- *Existing violations?* Fix the files you touch, or add a baseline, and ratchet it down.

**Trap:** Turning on every rule at once with 800 errors, and then disabling the lot.

**Source:** https://github.com/playwright-community/eslint-plugin-playwright

### What do you look for when you review test code?

Topic: fw-automation | Core | id: q0665

**Say:** Is it a contract? Does the test assert the behaviour a user cares about, and would it fail if that behaviour broke? Then reliability: locators by role and name, no sleeps, no forced actions, waits that observe a real condition, independent data. Then scope: one behaviour per test, no duplicate of a unit test. Then maintenance: no copy-paste, no hidden assertions in helpers. I give each finding a severity and say whether it blocks, and I give a fix someone can paste.

**Full process:**
1. Read the test title and the PR description. What behaviour is promised?
2. Read the assertions first. Do they prove it? Would a wrong implementation pass?
3. Locators: user-facing (`getByRole`, `getByLabel`, `getByText`), `exact: true`, scoped from a stable parent; no `nth()`, `first()`, XPath, class or id.
4. Synchronization: web-first assertions; `waitForResponse` in the same `Promise.all` as the click; no `waitForTimeout`, no `networkidle`, no `toPass()`.
5. Data: created per test, unique, cleaned up; no shared account that tests change.
6. Async hygiene: no `forEach` with an async callback (it awaits nothing); `for...of` with `await`.
7. Assertions on loading states: assert visible before asserting hidden; `toBeEnabled` when a click passes through a blocked control.
8. Forms: `toHaveValue` for input values, not `getByText`.
9. Checks the diff does not show: an accessible name that changed breaks other specs, so grep the old name across the test tree.
10. Comment format: severity P1 to P4, blocking or not, the problem, the consequence, a paste-ready fix.
11. Judge bot findings (for example CodeRabbit) on merit, nitpicks included.

**Follow-ups:**
- *Do you run the test?* Yes, repeated, for new tests: `--repeat-each=20`.
- *Tests you disagree with?* I say what behaviour is unprotected and propose the change. I do not argue style.

**Trap:** Reviewing only for naming and formatting.

**Source:** https://playwright.dev/docs/best-practices

### You take over a broken, flaky suite. What do you do in the first 30 days?

Topic: fw-automation | Core | id: q0666

**Say:** First week: listen and measure, change nothing. Who uses the suite, what blocks releases, how long a run takes, and which tests fail most. Second week: stop the bleeding, meaning quarantine the worst offenders visibly and make the gate trustworthy. Weeks three and four: fix root causes in order of pipeline impact and add guardrails so it does not decay again. At the end I show numbers: first-time pass rate, flake count, run time. I do not rewrite the suite in the first month.

**Full process:**
1. Days 1 to 5, learn: read the config and the CI jobs, run the suite locally and in CI, collect the last 30 days of results, interview the people who wait on it. Ask what they ignore.
2. Measure: run the nightly `--repeat-each` with a one-off diagnostic `--retries=2` to label flaky tests, and write the table: test, failure rate, area, impact.
3. Days 6 to 12, triage: classify each failing test (race, ambiguity, overlay, shared state, environment, product). Report real product bugs separately.
4. Quarantine the top offenders with an owner and an expiry date, so the gate is green only when it is true. Run them non-blocking.
5. Days 13 to 25, fix by impact: the five tests that block the most pipelines. Prove each fix with a repeat run.
6. Add guardrails: ESLint, `forbidOnly`, `failOnFlakyTests`, a flake report, shuffle nightly.
7. Day 26 to 30, report: before and after numbers, what is left, a roadmap for the next quarter.
8. Agree rules with the team, in the README, and CODEOWNERS for the test code.

**Follow-ups:**
- *What if there are 400 skipped tests?* Triage: delete duplicates and tests for removed features with evidence; fix the rest in order of value. Do not delete without strong evidence.
- *What if management wants it all green now?* I show what green would hide. A green gate that lies is worse than a red one that tells the truth.

**Trap:** Proposing a rewrite on day one.

**Source:** https://playwright.dev/docs/test-retries

### How do you decide to remove or rewrite a test?

Topic: fw-automation | Standard | id: q0667

**Say:** I remove a test when I can show it protects nothing: it duplicates another test, covers a removed feature, or has no meaningful assertion. I rewrite it when the behaviour matters but the test is brittle. I do not remove a test because it is flaky or hard to fix, because that deletes the protection and the evidence. And I never weaken an assertion to make it pass: a test is a contract, so if its intent must change, I explain the change first.

**Full process:**
1. Find candidates: tests with no assertion (lint `expect-expect`), long-skipped tests, tests that never failed in a year (mutation check on a sample), duplicates (same flow in unit and E2E).
2. Evidence for removal: the other test that covers it, the feature flag removed, or a mutation that no test notices.
3. Dead code: delete the definition of a helper or page object member, let the type check list every call site, and grep the repository and any string key.
4. When splitting or deleting spec files, compare `npx playwright test --list` before and after.
5. Explain in the merge request: what was removed, which test covers the behaviour, the check that proves it.
6. Record: one line per removed item.

**Follow-ups:**
- *A test is skipped for two years?* Either fix it or delete it with evidence; a permanent skip is dishonest coverage.
- *Who approves removal?* The code owner of the area, plus the person who wrote it if reachable.

**Trap:** Deleting a flaky test to improve the pass rate.

**Source:** https://playwright.dev/docs/test-annotations

### How do you govern a skip list so skipped tests do not rot?

Topic: fw-automation | Standard | id: q0668

**Say:** A skip is a debt, so it needs a reason, an owner, a ticket and a date, and a place where everyone can see the count. Skips with no reason fail lint. A weekly or monthly review shows how many are skipped, how old they are, and which ones can come back. I prefer to quarantine by tag and run them in a non-blocking job, because then I still get data. When a test comes back, I prove it with a repeat run.

**Full process:**
1. Lint: `playwright/no-skipped-test` and `playwright/require-annotation-reason` as errors (the second rule requires a reason on `.skip()` and `.fixme()`).
2. Convention: `test.fixme(title, body)` for "broken, will fix", with a description with ticket and owner:
```ts
test.fixme(
  'bulk merge keeps the newest ticket',
  { annotation: { type: 'issue', description: 'ticket link, owner, review by 2026-12-01' } },
  async () => {},
);
```
3. Report: a script lists skipped tests with `npx playwright test --list --reporter=json` and reads their annotations; publish count and age. Put the annotation in the test details, because the body of a `fixme` test never runs.
4. Review cadence: monthly, in the team meeting, five minutes.
5. Un-skip: fix, run `--repeat-each=100`, merge.
6. Do not delete a skipped test. Fix its types and logic. Delete only with strong evidence.

**Follow-ups:**
- *Conditional skips (`test.skip(browserName === 'webkit')`)?* Fine when the reason is a real platform limit, stated in the message.
- *A skip by a developer in a rush?* Review catches it; lint requires the reason.

**Trap:** `test.skip()` as a hiding place for product bugs. Never hide a product bug by any means.

**Source:** https://playwright.dev/docs/test-annotations

### How do you use tags and projects to split a suite (smoke, regression, slow)?

Topic: fw-automation | Standard | id: q0669

**Say:** Tags describe the purpose of a test, and projects describe where and how it runs. I tag `@smoke` for the few paths that must work, `@slow` for long flows, and `@quarantine` for known problems. A merge request runs smoke or changed files, the full suite runs after merge, and nightly adds shuffle and burn-in. Projects cover browsers, viewport and setup dependencies. Tags and selection live in config and CI, not in comments.

**Full process:**
1. Tag in the test details:
```ts
test('guest can pay with a card', { tag: ['@smoke', '@checkout'] }, async ({ page }) => { /* ... */ });
```
2. Run by tag: `npx playwright test --grep @smoke`, exclude: `--grep-invert @quarantine`.
3. Changed only: `npx playwright test --only-changed=origin/main`.
4. Last failed: `npx playwright test --last-failed`.
5. Projects in config: a `setup` project, desktop and mobile viewports, and browsers (Chromium, Firefox, WebKit). `grep` can be set per project, so a project runs only its tag.
6. Pipeline: merge request job (smoke plus changed), main job (full, sharded), nightly job (full, shuffle, repeat on changed).

**Follow-ups:**
- *How many browsers?* Whatever customers use: run the full suite on the main one and a smoke subset on the others.
- *Mobile?* Playwright emulates devices (viewport, user agent, touch). It is not a real device.

**Trap:** Tagging by team ("@teamA") only. It tells you who, not what the test is for.

**Source:** https://playwright.dev/docs/test-annotations

### What is a quality gate in CI, and how do you design one?

Topic: fw-automation | Standard | id: q0670

**Say:** A quality gate is a check that must pass before code can merge or deploy. I want gates to be fast, stable and meaningful, because a slow or unreliable gate trains people to bypass it. For a merge request: lint, type check, unit tests, and a smoke or changed-only E2E run. After merge: the full suite. Before release: smoke on the release candidate. The gate is required, not `allow_failure`, and a flaky test does not stay in it.

**Full process:**
1. List gates by stage: pre-commit (lint), merge request (lint, types, unit, changed or smoke E2E), main (full E2E, sharded), release (smoke on the candidate, accessibility and visual checks if used).
2. Make each gate required in the branch protection settings.
3. Time budget: merge request gate under ten minutes, so people wait for it.
4. A flaky test leaves the gate (quarantine), and returns when proven stable.
5. Test the tooling: CI scripts are tested against a throwaway git repository with a fake network. A check that searches other repositories must fail closed: on a search error or timeout, treat the item as still in use.
6. The job that tests CI tooling must also be required.

**Follow-ups:**
- *Gate fails, deadline close?* The person who owns the risk decides with evidence. No silent bypass.
- *GitLab or GitHub?* Used both: GitLab CI and GitHub Actions. The ideas are the same: stages, matrices, artifacts, required checks.

**Trap:** Making a long suite required, then adding retries to keep it passing.

**Source:** https://playwright.dev/docs/test-sharding

### How do you make accessibility the contract of your locators? Tell me the story.

Topic: fw-automation | Standard | id: q0671

**Say:** Tests that locate by test id, XPath or copy break whenever markup changes, and they say nothing about users. So make the product expose what a user, and assistive technology, perceives: roles, accessible names, landmarks and keyboard support. Then the tests locate by `getByRole` with the name. A missing name becomes a test failure, and a real accessibility bug. It fixes flakiness at the source and improves the product in one move.

**Full process:**
1. Find the gaps: elements with no accessible name, wrong roles, no landmarks. Check against WCAG criteria, for example 1.3.1 (info and relationships), 2.1.1 (keyboard) and 4.1.2 (name, role, value).
2. Fix in the product: names on controls, roles on custom widgets, landmarks on the app shell, keyboard handling.
3. Retarget the tests: `page.getByRole('button', { name: 'Save', exact: true })`.
4. Dynamic names: use an anchored regex, for example `/^New Flow .+ \d{2}:\d{2}:\d{2}$/`, instead of dropping `exact: true`.
5. Before adding a label that contains a shorter existing one, grep the test tree for the shorter string.
6. After changing a name, grep the old name across the whole test tree and page objects. Retries cannot rescue a locator that matches nothing.
7. Check every state after the switch: open overlays, read-only modes, nested navigation.
8. Remove test ids that nobody uses.
9. Locate the control itself, not its label text.

**Follow-ups:**
- *Why `exact: true`?* Without it, `name: 'Save'` also matches 'Save as draft'. Exact makes the contract precise.
- *Test ids?* A fallback for elements with no user-facing locator, and I do not add new ones.
- *Do the tests find accessibility bugs?* Yes: a wrapper with `role="button"` around a real control makes two tab stops; this shows up when you try to locate by role.

**Trap:** Doing it as a test id sprint. It moves the problem, and tells you nothing about users.

**Source:** https://playwright.dev/docs/best-practices

### Tell me about migrating an E2E suite to a product redesign.

Topic: fw-automation | Standard | id: q0672

**Say:** Example: In a previous context the inbox got a new design. The risk was that some tests or CI lanes would keep running on the old one and miss the new one. So the new design was made the default for every project the suite creates, in the setup code, instead of toggling it per test. No lane could miss it. Then regression guards were added for a bug that had been reverted, and new coverage was built for the merged inbox: composer, header and system log.

**Full process:**
1. Inventory what is affected: suites, lanes (daily Shopify and reply-assistant suites), page objects.
2. Choose one switch: set the new design in project creation, so every test starts there.
3. Migrate suites lane by lane, run each lane repeated before moving on.
4. Guard regression: tests for the reverted bug first.
5. Add new coverage for new screens.
6. Remove old-design branches when the old design is gone, with the compiler listing the dead code.

**Follow-ups:**
- *Why not a flag per test?* Per-test toggles drift, and a test can pass on the old design while customers see the new one.
- *Old and new at the same time?* Keep a small, named set on the old design while it is still supported, and remove it on a date.

**Trap:** Rewriting all the tests at once in one merge request.

**Source:** https://playwright.dev/docs/test-configuration

### How do you use AI in test automation, and how do you stay in control?

Topic: fw-automation | Standard | id: q0673

**Say:** I use AI as a fast junior pair: it writes drafts of tests, scenarios and boilerplate, and I review its output like any other code. I give it the rules and the framework conventions, I define the expected outputs, and I run the tests repeatedly before I trust a draft. I do not assert on AI-generated text in the product's own tests; I assert on UI that always renders, or on a stable fragment. And a test written by the same agent that wrote the code tends to assert what the code does, so I derive tests from a list of failure modes.

**Full process:**
1. Give context: the repo conventions (locator rules, fixtures), Playwright docs through a documentation tool, and the spec.
2. Ask for a failure-mode list first (inputs, states, boundaries, dependency failures), then tests from that list.
3. Review: apply the review checklist; remove forced actions and sleeps.
4. Watch every new test fail once: against unfixed code, a revert or a one-line mutation.
5. Repeat run: `--repeat-each=20`.
6. For product features with AI output: do not assert exact wording; match a stable fragment with a regex, or assert structure. Use semantic waits like a typing indicator.
7. Keep a human in the loop for decisions.

**Follow-ups:**
- *Which tools?* Claude Code with MCP servers daily, CodeRabbit for review on merge requests, ChatGPT for quick questions.
- *Risk?* Plausible but wrong code, and tests that pass for the wrong reason. The repeat run and the mutation check are my guard.

**Trap:** Pasting generated tests into the suite unread.

**Source:** https://playwright.dev/docs/best-practices

### How do you keep a visual regression suite stable?

Topic: fw-automation | Standard | id: q0674

**Say:** Visual tests fail on anything that changes pixels: fonts, animations, dynamic data, hover states. So I control the environment (the same Docker image everywhere), freeze or remove what changes (data, dates, animations), and exclude third-party noise like trackers. Before a screenshot I move the mouse away and blur the focused element, so hover and focus borders do not create false differences. And I keep the snapshots reviewed in the merge request, like code.

**Full process:**
1. One runner image, pinned to the Playwright version, locally and in CI. Snapshots made on a different OS differ.
2. Compare: `await expect(page).toHaveScreenshot('pricing.png')`. Update with `npx playwright test --update-snapshots`.
3. Stabilise: disable animations, mask dynamic regions with the `mask` option, use fixed data.
4. Move the mouse away, blur focus.
5. Exclude tracker and remarketing requests from page-load waits; set cookies by URL so the consent banner does not move the layout.
6. Currency-agnostic checks for pricing: do not snapshot a number that changes with geo.
7. Review snapshot diffs as part of the merge request.

**Follow-ups:**
- *Percy or native Playwright screenshots?* Hosted tools give review UI and cross-browser rendering; native screenshots are free and run in your CI but you manage the baselines. Example: moving a widget suite from Percy to native screenshots.

**Trap:** Updating snapshots blindly to turn the run green.

**Source:** https://playwright.dev/docs/best-practices

## Other tools: Selenium, Cypress, WebdriverIO

### How does Playwright differ from Selenium? When would you choose one?

Topic: tools-other-e2e | Core | id: q0675

**Say:** Say which of the two you have used in production; for the other, say plainly that your knowledge is from the docs. Selenium is the long-standing standard: it drives a browser through the WebDriver protocol, has bindings in many languages, and a huge ecosystem and Grid for running on many machines. Playwright is newer, ships its own test runner, assertions with auto-retry, auto-waiting actions, tracing, network mocking and parallelism built in. For a new web project in TypeScript I would pick Playwright. I would pick Selenium when the team is already invested in Java or C# suites, or needs a setup it supports, like an existing Grid or real-device clouds.

**Full process:**
1. Waiting: Selenium leaves synchronization to you (implicit, explicit and fluent waits). Playwright actions wait for actionability, and its assertions retry.
2. Tooling: Playwright includes a runner, fixtures, reporters, trace viewer, codegen. Selenium is a browser-driving library; the runner, assertions and reports come from other tools (JUnit, TestNG, pytest, and so on).
3. Languages: Selenium has the broadest language support. Playwright supports TypeScript/JavaScript, Python, Java and .NET.
4. Isolation: Playwright creates a fresh browser context per test, which is cheap. In Selenium you manage sessions and cleanup yourself.
5. Network control: Playwright intercepts and mocks requests. Selenium 4 added some capabilities through BiDi, but it is less central to the workflow.
6. Scale: both can run in parallel. Selenium Grid distributes sessions across nodes. Playwright shards a suite across CI machines.
7. Decision: new project, JS/TS team: Playwright. Large existing Selenium investment, other languages, or a vendor grid you rely on: stay, and improve waits and structure first.

**Follow-ups:**
- *Is Playwright always better?* No. Migration costs time, and a stable Selenium suite should not be rewritten for fashion.
- *What carries over from Selenium to Playwright?* The principles: independent tests, stable locators, synchronization on state, and page objects.

**Trap:** Claiming experience you do not have, or bashing Selenium. Be honest about the boundary and show you understand the concepts.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

### How do waits work in Selenium? Implicit, explicit and fluent.

Topic: tools-other-e2e | Core | id: q0676

**Say:** I know this from the docs. Selenium does not auto-wait the way Playwright does. An implicit wait is a global timeout for finding elements: the driver polls until the element is found or the time ends. An explicit wait waits for a condition you name, such as an element being clickable. A fluent wait is an explicit wait where you also set the polling interval and which exceptions to ignore. The docs warn not to mix implicit and explicit waits, because the total wait time becomes unpredictable. Sleeps are the thing to avoid.

**Full process:**
1. Navigation commands wait for the page `readyState` (by default `complete`), which does not include content added later by JavaScript.
2. Implicit wait, set once per session (default 0), for example in Java: `driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(2));`. It applies to every element lookup.
3. Explicit wait, per condition:
```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement button = wait.until(ExpectedConditions.elementToBeClickable(By.id("save")));
button.click();
```
4. Fluent wait: `new FluentWait<>(driver).withTimeout(...).pollingEvery(...).ignoring(NoSuchElementException.class)`.
5. Do not mix implicit and explicit: for example, an implicit 10 s and an explicit 15 s could time out after 20 s.
6. Compare with Playwright: actions wait automatically for actionability and web-first assertions retry. In Selenium, the explicit wait plays the role of the assertion.

**Follow-ups:**
- *Why not `Thread.sleep`?* Same reason as in any tool: too short on a slow run, wasted time on a fast one, and it does not say what you wait for.
- *Which would you use?* Explicit waits on a named condition, and no implicit wait.

**Trap:** Saying "implicit waits are fine, I set 30 seconds". It slows failure detection and interacts badly with explicit waits.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

### Playwright versus Cypress: how do they differ?

Topic: tools-other-e2e | Core | id: q0677

**Say:** If you have not used Cypress in production, say so, and explain that this is from the docs. Cypress runs inside the browser alongside the app, with its own command queue and strong retry-ability: queries and assertions are retried together until they pass or time out. It has a very good interactive runner. Playwright controls the browser from outside, supports Chromium, Firefox and WebKit, multiple tabs and contexts, and its tests are plain async/await. For a team that wants a friendly runner and a single-page app, Cypress works well. For multi-tab, multi-user and cross-browser work, I prefer Playwright.

**Full process:**
1. Retry-ability in Cypress: queries link up and retry as one chain; assertions are queries; non-query commands, like clicks, run once. If an assertion fails, Cypress re-runs the whole chain of queries from the top. Playwright's locators plus web-first assertions give a similar result with different syntax.
2. Syntax: Cypress commands are chained and queued, they are not promises, so you do not `await` them like normal code. Playwright uses ordinary async/await.
3. Architecture: Cypress runs in the browser process; Playwright drives the browser through a protocol from a Node process. This is why multiple tabs and multiple browser contexts are natural in Playwright.
4. Browsers: check the current docs; the supported list and the experimental ones change.
5. Test retries: Cypress has configurable test retries too; the same argument applies: they hide flakiness.
6. Parallelism and dashboards: Playwright shards and merges reports in the open-source tool; Cypress offers parallel runs through its cloud service. Check current pricing before relying on this.

**Follow-ups:**
- *Do the same locator rules apply?* Yes. Roles, labels and visible text are better than class names, in any tool.
- *Which do you prefer?* Playwright, because it suits multi-user flows; I would learn Cypress quickly because the ideas carry over.

**Trap:** Repeating marketing: "Cypress cannot do X". Features change; say what you checked.

**Source:** https://docs.cypress.io/app/core-concepts/retry-ability

### How does Selenium's architecture work, and what is Selenium Grid?

Topic: tools-other-e2e | Core | id: q0678

**Say:** From documentation, not from a job. Selenium sends commands as HTTP requests, following the W3C WebDriver protocol, to a browser-specific driver such as chromedriver, which controls the real browser. Grid runs many such sessions across machines: a hub-like entry point receives a session request and routes it to a node that has the requested browser. It is used to run tests in parallel on many browsers and operating systems. Playwright has no driver binary per browser; it downloads its own browser builds and talks to them over a persistent connection.

**Full process:**
1. Test code calls a language binding (Java, Python, C#, JavaScript).
2. The binding sends a WebDriver command over HTTP to the driver.
3. The driver translates it into browser actions and returns a result.
4. Grid sits in front: a request for a session with chosen capabilities goes to a node with a matching browser. Grid 4 splits this into components (router, distributor, session map, session queue, nodes and an event bus) so it can scale.
5. Because every command is a request-response round trip, Selenium suites are usually slower per step than a persistent connection, and synchronization is the user's job.

**Follow-ups:**
- *Why did Selenium Manager matter?* It downloads the right driver automatically, which removed a classic setup problem.
- *Have you run a Grid?* No. If you have used BrowserStack a little, say so, and explain that this is a hosted grid of browsers and devices.

**Trap:** Describing details you are not sure of. Keep it at the level you know and say so.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

### What are common Selenium exceptions and what do they tell you?

Topic: tools-other-e2e | Core | id: q0679

**Say:** If you have not debugged these daily, say so, then give the names and meanings. `NoSuchElementException`: the locator found nothing, often a timing problem or a wrong locator. `StaleElementReferenceException`: the element was found but the page replaced it, so the reference is dead; look it up again. `ElementClickInterceptedException`: something covers the element. `TimeoutException`: an explicit wait ran out. `ElementNotInteractableException`: the element exists but cannot be used, for instance hidden. The stale-element case is exactly what Playwright's `Locator` avoids, because it looks up the element at every action.

**Full process:**
1. NoSuchElement: check the locator and the wait. Is the element in an iframe?
2. StaleElementReference: re-find, or wait for the new element; avoid storing `WebElement` across re-renders.
3. ElementClickIntercepted: wait for the cover to go (a modal, animation), do not use a JavaScript click as a shortcut.
4. Timeout: read which condition failed; the page may be in a state you did not expect.
5. ElementNotInteractable: the element is hidden or disabled; check the state a user sees.
6. Mapping to Playwright: stale reference is avoided by locators; "intercepts pointer events" appears in the call log of a click; strict mode violations show ambiguity.

**Follow-ups:**
- *How do you handle a stale element?* Re-find the element, ideally with a wait on the new state.

**Trap:** Catching these exceptions in a retry loop. It hides the cause.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

### What is WebdriverIO and where does it sit?

Topic: tools-other-e2e | Standard | id: q0680

**Say:** If you have not used WebdriverIO, say so plainly. It is a Node.js test framework built on WebDriver (and also supports other protocols), with its own runner and many plugins, and is common in teams that also test mobile with Appium. The concepts you use in Playwright still apply: stable locators, waits tied to state, isolated tests. Check the current docs and read an existing suite before changing anything.

**Full process:**
1. Read the config file (capabilities, framework, reporters, services).
2. Find how waits and selectors are done and apply the same review checklist.
3. Run the suite repeated to find flaky tests.

**Follow-ups:**
- *Would you move it to Playwright?* Only for a reason: instability, tooling gaps or hiring. See the migration entries.

**Trap:** Inventing details. A short honest answer is better.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

### How would you handle the Selenium tasks people ask about: iframes, dropdowns, file downloads, screenshots?

Topic: tools-other-e2e | Standard | id: q0681

**Say:** If you have not done these in Selenium daily, map them from Playwright and the concept. Iframes: switch the driver's context into the frame, act, switch back; Playwright instead narrows with `frameLocator()`. Dropdowns: Selenium has a `Select` helper for native selects; Playwright uses `selectOption`. Downloads: set the browser's download directory through options; in Playwright you wait for the `download` event started with the click. Screenshots: `TakesScreenshot`; in Playwright `page.screenshot()` and automatic screenshots on failure. For each check the current docs before writing code.

**Full process:**
1. iframe (Selenium): `driver.switchTo().frame(...)`, work, then `driver.switchTo().defaultContent()`. Playwright: `page.frameLocator('...').getByRole('button', { name: 'Pay', exact: true })`.
2. Download (Playwright): `const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);` Start the wait in the same `Promise.all` as the click, otherwise the event can be missed.
3. Dropdown (Playwright): `await page.getByLabel('Country', { exact: true }).selectOption('Poland');`.
4. Hidden elements: a user cannot use them; I would ask why the test needs them.

**Follow-ups:**
- *Captcha and bot detection?* Do not automate around them in tests. Ask for a test environment with them off, or a signed test header agreed with the owner.

**Trap:** Using a JavaScript click or `executeScript` to get around a hidden or covered element. It skips what a user would hit.

**Source:** https://www.selenium.dev/documentation/webdriver/waits/

## Migrating between tools

### How would you migrate a suite from Selenium or Cypress to Playwright?

Topic: migration-frameworks | Niche | id: q0682

**Say:** If you have not run that migration, this is how you would approach it. You would not rewrite everything in one go. First measure the current suite: run time, flake rate, which tests earn their place. Then migrate by value: the smoke path first, running both suites in parallel for a period, and compare results. Delete tests that are duplicates or dead instead of porting them. Port the structure that is worth keeping (locators, page objects), and replace the waits with Playwright's assertions. The old suite is turned off only when the new one has covered its risks.

**Full process:**
1. Decide whether to migrate at all: what is the pain (flakiness, speed, tooling, hiring)? A rewrite costs months.
2. Baseline: run time, flake rate, failures per month, coverage by risk.
3. Set up the Playwright project with config, fixtures, auth, CI, lint rules. Prove the foundation with five tests.
4. Migrate in slices, by feature or risk. One slice per merge request. Each slice: port, run `--repeat-each=50`, compare with the old suite on the same build.
5. Do not port blindly: replace sleeps and explicit waits with web-first assertions, replace CSS/XPath with role and name locators, drop duplicates.
6. Run both suites in CI for a transition period. The old one is non-blocking after a slice is covered.
7. Retire the old tests slice by slice; remove the dependencies when the last one goes.
8. Report: before and after numbers.

**Follow-ups:**
- *Tools to help?* Codegen and AI assistants can draft ports, but the draft needs review for waits, locators and data. Automated converters port the mistakes too.
- *How long?* Depends on size. Big-bang rewrites tend to stall; slices keep value flowing.
- *How do you keep the team's trust?* Show the old and new results side by side, and never switch off a gate before the replacement exists.

**Trap:** A line-by-line translation. You get a Playwright suite with the old flaws.

**Source:** https://playwright.dev/docs/test-projects

### How do you run old and new suites side by side during a migration?

Topic: migration-frameworks | Niche | id: q0683

**Say:** I use CI to run both on the same build and compare the results. The old suite stays as the gate until a slice is covered in the new one, then it becomes non-blocking for that slice. In Playwright I can use projects and tags to select the migrated slice and run it separately. The goal is that nobody loses protection while the new suite earns trust.

**Full process:**
1. CI: two jobs on the same commit, `legacy-e2e` and `playwright-e2e`.
2. Mapping table: old test name to new test name, status (not started, ported, verified, old retired).
3. Verification per slice: repeat run 50 to 200 times, retries off.
4. Mutation check: break the feature on purpose and see that the new test fails like the old one.
5. When verified, mark the old tests as retired and remove them in the same merge request that closes the slice.
6. Keep the gate required for whichever suite is the current source of truth.

**Follow-ups:**
- *What if the results disagree?* Investigate every disagreement. It is either a flaw in the old test, a flaw in the new one, or a real bug.

**Trap:** Turning off the old suite before the new one is trusted.

**Source:** https://playwright.dev/docs/test-projects

### How do you convince a team to change test tools or frameworks?

Topic: migration-frameworks | Niche | id: q0684

**Say:** With numbers and a small pilot, not opinions. I write down the problem in measurable terms: flake rate, time to green, hours lost per month. I propose the smallest experiment: migrate one flow, or run one suite in the new tool, and compare. I include the cost honestly: learning time, a period of two suites, and what we give up. Then the team decides. I do not push my favourite, and if the numbers do not show a gain, I say so.

**Full process:**
1. Problem statement with numbers.
2. Options, including "improve what we have". Often fixing waits and locators removes most of the pain.
3. Pilot: one feature, two weeks, same acceptance criteria.
4. Compare: stability (repeat runs), run time, readability, effort to write and to fix.
5. Decision record: what we chose, why, what would make us revisit.
6. Plan the rollout in slices.

**Follow-ups:**
- *What if the team disagrees?* Treat opinions as input. Offer to run the pilot on their worst tests.

**Trap:** "Tool X is modern." Fashion is not a reason.

**Source:** https://playwright.dev/docs/best-practices

### What do you keep when you move from one tool to another, and what do you throw away?

Topic: migration-frameworks | Niche | id: q0685

**Say:** I keep knowledge: which flows matter, the test cases that found real bugs, the data model, and the locator contract with the product. I throw away mechanics: explicit waits, sleeps, tool-specific helpers, and tests that duplicate others. The tool is a detail; the risk map is the asset. If the product has accessible names, locators survive a tool change almost unchanged, because roles and names mean the same thing in any tool.

**Full process:**
1. Export a test inventory: title, area, risk, last failure, last time it found a bug.
2. Mark: keep, rewrite, delete.
3. Port the keepers with fresh synchronization.
4. Re-run for stability.

**Follow-ups:**
- *Do page objects transfer?* The structure does; the code needs rewriting for the new API. Keep the names and the intent.

**Trap:** Porting tests whose value nobody can state.

**Source:** https://playwright.dev/docs/best-practices

## General automation questions

### What is test automation, and what are its limits?

Topic: fw-automation | Standard | id: q0686

**Say:** Test automation is code that runs checks for you, repeatedly and quickly, on every change. It is good for regression, for many data combinations, and for fast feedback in CI. It does not replace exploratory testing, because a script only checks what someone thought of. It also has a cost: tests must be written, kept up to date and trusted. An automated test that fails randomly is worse than none, because people stop believing it. So I automate selectively and keep what I automate reliable.

**Full process:**
1. Strengths: speed, repeatability, coverage of boring paths, a record in CI.
2. Limits: it checks the expected, not the surprising; maintenance cost; brittle if built on UI details; false confidence from weak assertions.
3. Balance: automated checks for regression, exploratory testing for discovery, and unit/API tests for the cheap layers.
4. Measure value: bugs caught before release, time saved, flake rate, maintenance hours.

**Follow-ups:**
- *Exploratory testing?* I do it on undocumented apps. Time-boxed sessions with a charter, notes, and bugs with evidence.

**Trap:** "Automation finds more bugs." Mostly it prevents old ones from coming back.

**Source:** https://playwright.dev/docs/best-practices

### What types of automation frameworks exist (data-driven, keyword-driven, hybrid, BDD)? Which do you use?

Topic: fw-automation | Standard | id: q0687

**Say:** Data-driven separates test logic from data, so one test runs over many inputs. Keyword-driven describes tests as readable keywords that map to code, so non-programmers can write them. Hybrid mixes these. BDD (Cucumber-style) writes scenarios in Given-When-Then plain language that maps to step code. I use a code-first approach: Playwright tests in TypeScript, with data-driven loops where inputs vary, and fixtures and page objects for structure. I would use BDD only if the business actually reads and writes the scenarios, because otherwise it adds a layer of text to maintain.

**Full process:**
1. Data-driven in Playwright: loop over an array and create one test per row (see the data-driven entry).
2. Keyword-driven: a table of keywords mapped to functions. In TypeScript, simply named functions do the job.
3. BDD: Gherkin files plus step definitions (Cucumber, or playwright-bdd). The cost is keeping steps and text in sync.
4. Choose by who reads the tests and who writes them.

**Follow-ups:**
- *Pros of BDD?* A shared language with product people. Cons: step sprawl and slower writing.

**Trap:** Naming a framework type as an achievement. Say what problem it solved.

**Source:** https://playwright.dev/docs/test-parameterize

### How do you mock APIs in tests, and when should you not?

Topic: fw-automation | Standard | id: q0688

**Say:** I mock to control what I cannot control: error responses, slow responses, third-party services, and data I cannot create. In Playwright I use `page.route` to fulfil a request with a canned response or to delay it. I do not mock when the point of the test is the integration, because then the test proves my mock. A common split: real backend for the main journeys, mocks for edge cases and failure modes.

**Full process:**
```ts
await page.route('**/api/orders', route =>
  route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) }),
);
await page.goto('/orders');
await expect(page.getByRole('alert')).toHaveText('Orders are unavailable. Try again later.');
```
1. Register the route before the action that triggers the request.
2. Delay a response to reproduce a race: wait, then `route.continue()`.
3. HAR replay is possible for recorded traffic (`routeFromHAR`), useful for fixed third-party data.
4. Keep the mock close to the real contract; an OpenAPI contract test helps catch drift.

**Follow-ups:**
- *Mocking everything?* Fast but blind to integration bugs.

**Trap:** Mocks that return data the real API could never return.

**Source:** https://playwright.dev/docs/best-practices

### How do you test AI features (for example an AI support agent) in an automated suite?

Topic: fw-automation | Standard | id: q0689

**Say:** I never assert the exact wording of generated text, because it changes between runs. I assert on things that always render: that a reply appeared, a typing indicator came and went, a handoff to a human happened, a card or button exists. If I must check content, I match a stable fragment with a regex or check structure. Test state is isolated, because shared conversations make AI flows fail in confusing ways. Quality of the answers is a different job, done with a fixed set of cases and a scoring method, not with E2E.

**Full process:**
1. Wait on a semantic signal: the typing indicator appears and disappears, then the reply exists.
2. Assert structure: the message list has one new bot message, the handoff button is enabled.
3. Isolated state: each test creates its own conversation.
4. Content: a regex for a stable fragment only.
5. Quality evaluation: a golden set of fixed tasks, scored by code, run at temperature 0, compared to earlier runs to flag regressions.

**Follow-ups:**
- *Prompt injection?* I test that instructions hidden in user content do not change behaviour; I check the output for forbidden actions, not for wording.

**Trap:** Asserting `toHaveText('Sure, I can help you with that!')` on a model reply.

**Source:** https://playwright.dev/docs/best-practices
