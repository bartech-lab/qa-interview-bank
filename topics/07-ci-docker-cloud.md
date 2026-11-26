# CI/CD, Docker, cloud, Git and Linux

How to study this file: read the sections in order, because the CI/CD answers reuse the vocabulary of the later ones. Type the Playwright pipelines (GitLab and GitHub) once by hand, since an interviewer who asks "how did you set up sharding" wants the whole sequence, not the keyword. Where an answer says "I haven't used X", say exactly that and then give the concept: the honest bounded answer scores better than a bluff. Pin the Playwright image tag to the exact `@playwright/test` version in `package-lock.json`; the tags shown are examples.

## CI/CD concepts

### Explain CI/CD and how testing fits in.

Topic: ci-cd | Core | id: q0690

**Say:** CI means every change is merged into the shared branch often and each merge triggers an automatic build and tests, so a broken change shows up in minutes. CD is the next step: the pipeline keeps the build always releasable and can push it towards an environment. Testing is what makes the pipeline trustworthy, because a green pipeline only means something if the tests behind it are fast and honest. My job as QA is to decide which checks run at which stage, keep them stable, and make failures easy to read.

**Full process:** A commit-to-release path I can describe:
1. Commit or merge request: lint, type check, unit tests, build. Fast, a few minutes.
2. Deploy to a test environment: the same build artifact or image that production will get.
3. Smoke tests on that environment: a few critical flows, to fail early if the deploy is broken.
4. Full regression E2E and API tests, sharded across jobs, with traces and reports as artifacts.
5. Quality gate: required jobs pass, no new flaky tests, coverage or risk rules met.
6. Release step: manual approval or automatic, depending on the team.

**Follow-ups:**
- *Who owns the pipeline?* Dev and platform own the build and deploy; QA owns the test stages, their stability and their reports.
- *What makes a pipeline bad?* Slow feedback, flaky red builds people ignore, and tests that need manual setup.

**Trap:** Saying CI/CD is "Jenkins" or "a tool". It is a practice; the tool only runs it.

**Source:** https://martinfowler.com/articles/continuousIntegration.html

### What is the difference between continuous integration, continuous delivery and continuous deployment?

Topic: ci-cd | Core | id: q0691

**Say:** Continuous integration is merging small changes often and verifying each with an automatic build and tests. Continuous delivery means every change that passes is ready to release, and a person decides when to press the button. Continuous deployment removes that person: every change that passes the pipeline goes to production automatically. So the difference between the last two is only the manual approval before production.

**Follow-ups:**
- *Which needs the most test confidence?* Continuous deployment, because nobody checks by hand before users get the change. It needs strong automated gates, feature flags and fast rollback.
- *Which fits a regulated or mobile product?* Continuous delivery, because release timing is a business decision and app store review adds a manual step.

**Trap:** Mixing up "delivery" and "deployment". The one-word test: is there a human approval before production.

**Source:** https://martinfowler.com/bliki/ContinuousDelivery.html

### Where do the tests sit in a pipeline?

Topic: ci-cd | Core | id: q0692

**Say:** I order them by speed and cost. Static checks and unit tests run first on every commit, because they take minutes and catch most mistakes. API and integration tests run next against a deployed test environment. A small smoke E2E set runs right after deploy, and the full E2E regression runs sharded on merge requests to the main branch, nightly, or before release, depending on how long it takes. The slower and more fragile a test, the later it runs and the fewer of them I keep, which is the test pyramid applied to the pipeline.

**Follow-ups:**
- *Where should automation run: pull request, nightly or pre-production?* Smoke on every pull request, the full suite on merge to main or nightly, and a short sanity run against pre-production after deploy. If the full suite fits in 15 to 20 minutes with sharding, run it on the pull request.
- *What do you do when E2E is too slow for each pull request?* Run only the tests tied to changed areas or tags on the pull request, and the full suite after merge. Do not drop coverage silently.

**Trap:** Putting every E2E test on every commit "for safety". The feedback gets slow, people retry instead of reading failures, and flakiness grows.

**Source:** https://martinfowler.com/articles/practical-test-pyramid.html

### What are quality gates and how do you enforce them in a pipeline?

Topic: ci-cd | Core | id: q0693

**Say:** A quality gate is a rule the pipeline checks automatically before a change can move on, such as "unit tests pass, lint is clean, the E2E smoke job is green". I make the gate enforceable: required jobs in the merge request settings, a protected main branch so nobody can push around it, and exit codes that actually fail the job. A gate that someone can bypass or that is allowed to fail is only a suggestion.

**Full process:**
1. Decide the rule with the team and write it down: which jobs are required, which are informational.
2. Make the jobs required: in GitLab, "pipelines must succeed" on merge requests plus a protected branch; in GitHub, branch protection with required status checks.
3. Make failure real: no `allow_failure: true` or `continue-on-error: true` on a gate job, and test commands must return a non-zero exit code.
4. Add thresholds only where they can be measured without noise: tests passed, no focused tests (`forbidOnly`), type check clean.
5. Review the gate when it blocks for the wrong reason. A gate people override is worse than none.

**Follow-ups:**
- *Would you gate on coverage percentage?* Only as a floor on new code, never as a target to chase. A number alone does not show that tests check anything.
- *A flaky test blocks the gate. What now?* Quarantine it with an owner and a deadline, and track it. Do not add retries to hide it.

**Trap:** Setting a gate job to `allow_failure` so it stops blocking. A check that cannot fail does not guard anything.

**Source:** https://docs.gitlab.com/ci/yaml/

### Design a CI/CD pipeline for testing. How do you fit unit, API and UI tests into the release cycle?

Topic: ci-cd | Core | id: q0694

**Say:** I would build stages in order of cost. The merge request pipeline runs lint, type check and unit tests, then builds an image and deploys it to a test environment. API tests and an E2E smoke set run against that deployment. The full E2E suite runs sharded after merge and nightly, and publishes one merged report. Failures are visible in the merge request, with traces attached, so a developer can open the failing step without asking me.

**Full process:**
1. `lint` and `unit`: no environment needed, run on every push.
2. `build`: one image, tagged with the commit SHA, pushed to a registry.
3. `deploy-test`: deploy that exact tag to the test environment, wait for readiness.
4. `api` and `smoke`: run in parallel against the environment, required for merge.
5. `e2e`: sharded Playwright jobs, `blob` report per shard, artifacts kept when the job fails.
6. `report`: runs even if shards failed, merges blob reports into one HTML report.
7. Release: promote the same image tag, never rebuild it.

**Follow-ups:**
- *Why the same image?* What you tested must be what you ship. A rebuild can differ.
- *How do you keep test environments from interfering?* One namespace or environment per branch or per run for state-changing tests, plus cleanup of test data.

**Trap:** Running tests against one shared environment that several pipelines change at once. Failures then depend on who else is running.

**Source:** https://martinfowler.com/bliki/DeploymentPipeline.html

### Walk me through your CI/CD strategy from commit to deployment.

Topic: ci-cd | Standard | id: q0695

**Say:** On commit, static checks and unit tests give an answer in minutes. On the merge request, the pipeline builds, deploys to a test environment and runs API tests and an E2E smoke set. After merge, the full regression runs sharded and a report is published. Promotion to the next environment uses the same build, and I check a short smoke set again after deploy. At each step I ask what the failure should tell the reader, and I put that in the job name, the log and the report.

**Follow-ups:**
- *What do you do after production deploy?* A very small read-only smoke check, and watching error rates in monitoring. Not the full suite against production.
- *How do you roll back?* By redeploying the previous image tag, which is why every deploy uses an immutable tag.

**Trap:** Describing tools instead of the order and the reasons for it.

**Source:** https://martinfowler.com/bliki/DeploymentPipeline.html

### Which CI/CD tools have you used, and how did you integrate the automation framework with them?

Topic: ci-cd | Standard | id: q0696

**Say:** If you have used GitLab CI, say how you ran Playwright with test stages, parallel jobs, sharding, matrices and artifacts for traces, videos and reports. Also state if you know GitHub Actions and have written Playwright workflows with a shard matrix and merged reports. If you have used Jenkins, say you mainly read run logs; if not, say so plainly. State that you have not used Azure DevOps for CI/CD. The integration is the same everywhere: one command that returns an exit code, reporters that write files, and the CI keeps those files as artifacts.

**Follow-ups:**
- *What is the one thing that differs between tools?* The syntax and how artifacts and caches work. The test command and the reporters do not change.
- *How would you move a suite from one CI to another?* Keep the test command and config in the repo, and rewrite only the thin pipeline file.

**Trap:** Listing every tool you saw once. Name the ones you can actually explain.

**Source:** https://playwright.dev/docs/ci

### How do you run Playwright tests in CI?

Topic: ci-cd | Standard | id: q0697

**Say:** I run the tests in a clean job on a Playwright image or after `npx playwright install --with-deps`, with `CI` set so the config switches to CI settings: `forbidOnly`, retries, and a reporter that writes files. I upload the report and traces as artifacts even when tests fail. For a big suite I shard across jobs and merge the reports at the end.

**Full process:**
1. Config switches by the `CI` environment variable, which most CI systems set:
```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  globalTimeout: 60 * 60 * 1000,
  reporter: process.env.CI
    ? [['blob'], ['junit', { outputFile: 'results/junit.xml' }], ['dot']]
    : 'list',
  use: { trace: 'on-first-retry', screenshot: 'only-on-failure' },
});
```
2. Install with `npm ci`, then use the official image (browsers included) or `npx playwright install --with-deps`.
3. Run `npx playwright test`. The exit code is non-zero when a test fails, so the job fails.
4. Upload `blob-report`, `results` and `test-results` as artifacts with a failure-safe condition (`when: always` in GitLab, `if: ${{ !cancelled() }}` in GitHub).
5. Over time: failing runs leave traces you open with `npx playwright show-trace`, and the merged HTML report is the page people open.

**Follow-ups:**
- *Why `forbidOnly`?* It fails the run if someone leaves `test.only` in the code, so the whole suite does not silently shrink.
- *The docs suggest `workers: 1` in CI. Do you?* The docs recommend it for stability on small runners. I keep workers modest, two or so, and add shards for speed instead of pushing workers to the maximum.

**Trap:** Forgetting to upload artifacts on failure. The failing run is exactly when you need the trace.

**Source:** https://playwright.dev/docs/ci

### How do you shard a large suite across CI machines?

Topic: ci-cd | Standard | id: q0698

**Say:** Playwright has a built-in flag: `--shard=1/4` runs the first quarter, `--shard=2/4` the second, and so on. I start one CI job per shard, using a matrix in GitHub or `parallel` in GitLab, and each job writes a blob report. A final job downloads all blob reports and runs `merge-reports` to produce one HTML report. I set `fullyParallel: true`, so shards split by individual tests and stay balanced.

**Full process:** The complete GitLab and GitHub pipelines are in their sections below. The steps are the same in both:
1. Set the reporter to `blob` on CI.
2. Start N jobs, each running `npx playwright test --shard=<index>/<total>`.
3. Each job uploads `blob-report` as an artifact, also on failure.
4. A later job, which runs even if shards failed, collects the files into one folder and runs `npx playwright merge-reports --reporter html ./all-blob-reports`.
5. The merged report is uploaded as one artifact. Blob file names include the shard number, so they do not clash.

**Follow-ups:**
- *Shards versus workers?* Workers are processes on one machine. Shards are separate machines or jobs. You use both: sharding spreads the work, workers use the cores of each job.
- *Why are my shards uneven?* Without `fullyParallel`, Playwright shards by file, so one large file skews a shard. Turn on `fullyParallel` or split big files.

**Workers and shards:** they are two separate settings. Tests running at once = shards x workers per shard.

| | Workers | Shards |
|---|---|---|
| What it is | processes on one machine | separate CI machines, each with a part of the suite |
| Set by | `workers` in the config or `--workers` | `--shard=1/4` per CI job |
| Limited by | that machine's CPU and memory | the number of runners, and the cost |
| Reports | one | one per shard, merged at the end |
| Both add | load on the backend under test | load on the backend under test |

- *Why fewer workers per machine after adding shards? Machines are independent of workers.* They are independent. The worker count per machine follows that machine's CPU and memory: when browsers starve, tests time out. The shard count follows how fast the suite must finish. The one thing that ties them is the backend, which sees shards times workers users at once. If it answers with 503 under that load, the total has to come down, whichever setting I lower.

**Powiedz:** Workery i shardy to dwie osobne rzeczy. Workery to procesy na jednej maszynie, więc ich liczbę ogranicza CPU i pamięć tej maszyny: jak przeglądarkom brakuje zasobów, testy łapią timeouty. Shardy to osobne maszyny w CI, każda dostaje część suite'u, i ich liczba wynika z tego, jak szybko suite ma się skończyć. Łączy je tylko backend, bo on widzi shardy razy workery użytkowników naraz. Jeśli pod takim obciążeniem zaczyna zwracać 503, to trzeba zejść z sumą, obojętnie którym ustawieniem. Każdy shard zapisuje blob report, a na końcu osobny job robi `merge-reports` do jednego raportu.

**Trap:** Sharding without merging reports, so people have to open four reports to find one failure.

**Source:** https://playwright.dev/docs/test-sharding

### How do you design parallel execution for a large Playwright suite in CI?

Topic: ci-cd | Standard | id: q0699

**Say:** Tests must be independent first: own data, no shared accounts, no order dependency. Then I use `fullyParallel` and a moderate worker count per job, and shard across jobs for more speed. I watch the slowest shard and the timing of tests, and I do not raise workers beyond what the runner's CPU and memory support, because that turns speed into timeouts.

**Follow-ups:**
- *Parallel run exposes a failure that serial run hides. Why?* Shared state: a shared account, a shared record, or a timing race. The fix is isolating data, not lowering workers.
- *How do you find the shard imbalance?* Compare job durations per shard in CI. Split the files that dominate, or use test-level sharding with `fullyParallel`.

**Trap:** More workers is always faster. Past the machine limit, tests time out and become flaky.

**Source:** https://playwright.dev/docs/test-parallel

### A test fails in CI but passes locally. How do you debug it?

Topic: ci-cd | Standard | id: q0700

**Say:** I first read what CI left behind: the trace, screenshot, video and error context, and I classify the failure as a race, an ambiguous locator, an overlay, an environment problem, or a product bug. Then I reproduce under CI conditions: the same image, same reporter and retry settings, and `--trace on` with one worker. I change one difference at a time between local and CI. I do not add a retry or a sleep until I know the cause.

**Full process:**
1. Download the trace artifact and open it with `npx playwright show-trace trace.zip`. Check the failing action, the call log, network and console.
2. Compare environments: Playwright version, browser version, viewport, locale, time zone, base URL, data, feature flags and the deployed commit.
3. Reproduce locally with the CI image: `docker run --rm -it --ipc=host -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble bash`, then `CI=1 npx playwright test path/to/spec.ts --trace on --workers=1`.
4. Repeat the run many times to see the failure rate: `npx playwright test spec.ts --repeat-each=50`.
5. Fix the cause. Prove it by running the same repeat count after the fix.

**Follow-ups:**
- *CI machines are slower. Is that the cause?* Slowness exposes a race; it is not the cause. The test should wait for a condition, not time.
- *What if it only fails in CI and never reproduces?* Check shared state with parallel jobs, the data left by earlier runs, and whether the environment was down or on an older commit.

**Trap:** "Add a retry". That hides product bugs and races.

**Source:** https://playwright.dev/docs/trace-viewer

### Why are retries commonly enabled in CI, and why might you disable them?

Topic: ci-cd | Standard | id: q0701

**Say:** Retries absorb rare environment noise, such as one slow network call, so one blip does not block a merge. Playwright marks a test that failed and then passed as flaky, so it stays visible. I keep retries low, one or two, and I disable them when I am hunting flakiness or proving a fix, because a retry would hide the failure I want to see.

**Follow-ups:**
- *How should CI report such a test?* Passed, flaky and failed are three different results. I count flaky tests every run and fix the top ones.
- *What do retries not fix?* Backend errors and product bugs. Retrying a 500 until it passes hides a defect.

**Trap:** Treating a retried pass as green and moving on.

**Source:** https://playwright.dev/docs/test-retries

### What reporters do you use in CI?

Topic: ci-cd | Standard | id: q0702

**Say:** Playwright's default reporter on CI is `dot`, which keeps logs short. I add `blob` when sharding so reports can be merged, `junit` so the CI system can show test results in the merge request, and `html` for the merged report people open. On GitHub I can add the `github` reporter for annotations.

**Follow-ups:**
- *Why not only HTML?* HTML is for humans; JUnit is for the CI to parse. They serve different readers.
- *Are retries visible in the report?* Yes, the HTML report shows retried attempts and marks flaky tests. Default JUnit records only the final result, so flaky-then-passed tests vanish from it. Since 1.59 `includeRetries: true`, or `PLAYWRIGHT_JUNIT_INCLUDE_RETRIES=1` on `merge-reports`, adds a `<flakyFailure>` for each failed attempt.

**Trap:** Relying on default JUnit output to count flakiness.

**Source:** https://playwright.dev/docs/test-reporters

### How do you enable traces for CI failures?

Topic: ci-cd | Standard | id: q0703

**Say:** I set `trace: 'on-first-retry'` in the config, so a trace is recorded only when a test fails once and is retried, which keeps cost low. When I debug a specific problem I run with `--trace on`. The trace zip is saved in `test-results`, and I upload that folder as an artifact on failure.

**Follow-ups:**
- *Why not trace every test?* It costs time and storage. `retain-on-failure` is another option when retries are off.
- *How do you open it?* `npx playwright show-trace trace.zip`, or from the HTML report.

**Trap:** Enabling the trace but not uploading the folder.

**Source:** https://playwright.dev/docs/trace-viewer

### How do you stop flaky tests from blocking CI?

Topic: ci-cd | Standard | id: q0704

**Say:** I fix the cause, not the symptom. First I measure with repeated runs to see the rate and read the traces. Then I fix races with proper waits on a response or state, isolate shared data, and fix product bugs where they are. For tests I cannot fix this week, I quarantine them with an owner and a date, so the main pipeline stays trusted, and I never delete them without evidence.

**Follow-ups:**
- *How do you prove it is fixed?* Run the test with `--repeat-each` at a large number, before and after. 200 of 200 is evidence, three green runs are not.
- *Who decides to skip a test?* The team, with a ticket. A silent skip is a hidden hole.

**Trap:** Raising the retry count until the build is green.

**Source:** https://playwright.dev/docs/test-retries

### Your pipeline is the slowest step in the release. How do you find where the time goes and cut it?

Topic: ci-cd | Standard | id: q0705

**Say:** I measure before I change anything: the duration of each job and each test, and where the pipeline waits in queues. Then I attack the biggest items: shard the E2E suite, run independent jobs in parallel, use the official image so browsers do not install each time, cache dependencies, and remove duplicate E2E tests that a unit test already covers. I check the result with the same measure.

**Follow-ups:**
- *Does caching browsers help?* Playwright's docs say it usually does not, because restoring the cache takes about as long as downloading and the OS dependencies cannot be cached. The official image avoids the problem.
- *What else is cheap?* Cancel redundant pipelines when a new commit arrives, and run only the needed jobs per change.

**Trap:** Adding workers first. If the machine is the limit, it gets slower.

**Source:** https://playwright.dev/docs/ci

### Pipeline tests pass on every build, but production rollouts still fail. Where do you look?

Topic: ci-cd | Standard | id: q0706

**Say:** I look at what differs between the tested environment and production: configuration, feature flags, data, infrastructure, secrets and versions. Passing tests only prove the tested setup works. I check whether the deployed artifact is the one tested, whether the tests cover the deploy and migration step, and whether monitoring caught the failure.

**Follow-ups:**
- *Example of such a gap?* Feature flags that differ between test and production, so tests pass on a configuration customers never see.
- *How do you close it?* Compare configuration automatically, run the suite with the production flag state, and add a short post-deploy smoke check.

**Trap:** Blaming the tests. The question is what the tests could not see.

**Source:** https://martinfowler.com/bliki/DeploymentPipeline.html

### How do you integrate security testing into CI/CD?

Topic: ci-cd | Standard | id: q0707

**Say:** I would add cheap automatic checks to the pipeline: dependency audit, secret scanning, and static analysis, which fail the build on high severity. A dynamic scan against the test environment can run nightly. A good rule for security testing is basic: role and permission checks, which I automate as API tests. I do not claim penetration testing.

**Follow-ups:**
- *Where does it sit?* Dependency and secret scans on every merge request, dynamic scans on a schedule.
- *What do you do with findings?* Triage by severity and exploitability, fix or accept with a reason.

**Trap:** Claiming a full security practice when it is permission checks.

**Source:** https://docs.gitlab.com/ci/yaml/

### How do you control CI versus local execution?

Topic: ci-cd | Standard | id: q0708

**Say:** I use the `CI` environment variable, which most CI systems set to true. The Playwright config reads it to choose retries, workers, reporters and `forbidOnly`. Everything else, such as the base URL and credentials, comes from environment variables, so the same command runs the same way everywhere.

**Follow-ups:**
- *Why the same command?* So "it works on my machine" has fewer causes.
- *Where do secrets come from?* From CI variables, never from files in the repository.

**Trap:** Separate test code for CI. Only configuration should differ.

**Source:** https://playwright.dev/docs/ci

### What should a CI pipeline do with test data?

Topic: ci-cd | Standard | id: q0709

**Say:** Each run creates the data it needs, with unique names, and removes it afterwards, so runs do not depend on each other and parallel jobs do not collide. Long-lived shared accounts collect state until something breaks. I use API calls for setup instead of UI clicks, and I make cleanup safe when a test fails halfway.

**Follow-ups:**
- *Seeding or fixtures?* Seed stable reference data once per environment; create test-specific data per test.
- *What about real customer data?* Never in fixtures. Use synthetic data.

**Trap:** A shared "test user" used by every shard.

**Source:** https://playwright.dev/docs/test-parallel

### How do you manage secrets in CI?

Topic: ci-cd | Standard | id: q0710

**Say:** Secrets live in the CI system's secret store as variables, not in the repository, and they are masked in logs. I limit them: protected variables only for protected branches, scoped per environment, and the least permission a token needs. For cloud access I prefer short-lived credentials over long-lived keys. I rotate anything that leaks, and I do not print secrets in test output or attach them to traces.

**Full process:**
1. Store the value as a CI/CD variable: GitLab Settings, CI/CD, Variables, mark it masked and protected; GitHub Settings, Secrets and variables, Actions.
2. Reference it as an environment variable in the job: `$API_TOKEN` in GitLab, `${{ secrets.API_TOKEN }}` in GitHub. The test reads `process.env.API_TOKEN`.
3. For cloud, use OIDC: GitLab `id_tokens` or GitHub `permissions: id-token: write` lets the job exchange a short-lived token for cloud credentials, with no stored key.
4. Keep secrets away from pull requests from forks, which should not get them.
5. Rotate on a schedule, and check the job logs for leaks.

**Follow-ups:**
- *Is masking enough?* No. Masking hides exact matches in logs only. A secret in an artifact, a trace or a base64 string can still leak.
- *Why attach credentials only to some tests?* If third-party credentials are set globally, every test and trace carries them. I attach them in the tests that need them.

**Trap:** Committing a `.env` file "for tests" or echoing the variable to debug.

**Source:** https://docs.gitlab.com/ci/variables/

### What is pipeline as code and why does it matter?

Topic: ci-cd | Standard | id: q0711

**Say:** The pipeline is defined in a file in the repository, such as `.gitlab-ci.yml`, a workflow in `.github/workflows`, or a `Jenkinsfile`. It is reviewed like code, versioned with the change it tests, and rebuilt from scratch on any machine. Clicking a pipeline together in a UI cannot be reviewed or reproduced.

**Follow-ups:**
- *How do you reuse parts?* `include` and `extends` in GitLab, reusable workflows in GitHub, shared libraries in Jenkins.

**Trap:** Thinking it only means "YAML".

**Source:** https://docs.gitlab.com/ci/yaml/

### Smoke tests versus regression tests in a pipeline: how do you split them?

Topic: ci-cd | Standard | id: q0712

**Say:** Smoke is a small set of critical flows that tells in a few minutes whether the build is worth testing further, such as login, one core action, and the main page. It runs on every merge request and after every deploy. Regression is the broad set that checks nothing else broke, runs sharded after merge or nightly. I mark smoke with a tag and select it with `--grep @smoke`.

**Follow-ups:**
- *How big is smoke?* Few enough to finish in under five minutes, and so stable that a failure always means a real problem.
- *Is running the whole E2E suite on every merge request good practice?* For a large suite, no. Feedback takes too long, the runners queue up, and one flaky test blocks every merge. On a merge request I run a small stable set: the smoke tests plus the tests for the changed area, picked by tag. The full regression runs after merge or nightly, sharded. For a small suite that finishes in a few minutes, running all of it on the merge request is fine. The limit is time and stability, not a rule.

| When | What runs | Why |
|---|---|---|
| Every merge request | smoke (`--grep @smoke`) and the tests tagged for the changed area | an answer in minutes; a failure blocks the merge |
| After merge to main | full regression, sharded | catches what the small set missed, before release |
| Nightly | full regression on all browsers, slow tests | cost does not slow anyone down |

**Powiedz:** Całe E2E na każdym MR-ze przy dużym suite'cie to zła praktyka: feedback trwa długo, runnery się kolejkują, a jeden flaky test blokuje merge wszystkim. Na MR-ze puszczam mały, stabilny zestaw: smoke oznaczony tagiem `@smoke` plus testy z obszaru, który się zmienił. Pełna regresja idzie po merge'u albo w nocy, na shardach. Jeśli suite jest mały i kończy się w kilka minut, może iść cały na MR-ze. Granicą jest czas i stabilność, a nie sama zasada.

**Trap:** A smoke suite that grows into the whole regression suite.

**Source:** https://playwright.dev/docs/test-annotations

### Describe an improvement you made to continuous testing in a pipeline. What was the result?

Topic: ci-cd | Standard | id: q0713

**Say:** Example: environments used for E2E drifted from production feature flags, so tests passed on a configuration customers did not have. A guard was built: a read-only export of production flags, a CI job that compares them to the test environment and comments on the merge request when they differ, and a run with each new flag turned on at 100% on a second environment. The result was that drift became visible during review, and false alarms were later removed by checking flag usage through code search.

**Follow-ups:**
- *Why a token-protected endpoint?* It exposes configuration, so an unset token rejects every request.
- *What did you learn?* A check that searches other repositories must fail closed: on a search error, treat the flag as still in use.

**Trap:** Telling only what you built. The interviewer wants the problem and the measured effect.

**Source:** https://docs.gitlab.com/ci/yaml/

### How would you run a large parallel UI suite fast and cheap?

Topic: ci-cd | Standard | id: q0714

**Say:** Shard across short-lived jobs on right-sized runners, use the prebuilt image so no time goes to installs, cancel redundant pipelines, and run the full suite only where it pays off: after merge and nightly. Remove duplicate tests, since each E2E test costs on every run. If using spot or autoscaling runners, keep the tests independent so a lost runner only reruns one shard.

**Follow-ups:**
- *Biggest cost lever?* Not running tests that add no coverage.
- *Tens of thousands of tests?* Many shards plus a test-level split, with per-shard artifacts and a merge job. The limit becomes environment capacity, not runners.

**Trap:** Buying bigger machines before measuring.

**Source:** https://playwright.dev/docs/test-sharding

## GitLab CI

### Show me a complete GitLab CI pipeline for Playwright with sharding, merged reports, artifacts and the official image.

Topic: ci-gitlab | Standard | id: q0715

**Say:** I use the official Playwright image so browsers and OS dependencies are already there. A test job with `parallel: 4` creates four jobs, and each runs `--shard=$CI_NODE_INDEX/$CI_NODE_TOTAL` and uploads its blob report, also on failure. A later `report` job runs with `when: always`, merges the blob reports into one HTML report, and publishes it as an artifact. A JUnit file in each shard job shows results inside the merge request.

**Full process:** Playwright config for CI (blob for merging, JUnit for GitLab, dot for readable logs):
```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  globalTimeout: 60 * 60 * 1000,
  reporter: process.env.CI
    ? [['dot'], ['blob'], ['junit', { outputFile: `results/junit-${process.env.CI_NODE_INDEX ?? 1}.xml` }]]
    : 'list',
  use: { baseURL: process.env.BASE_URL, trace: 'on-first-retry' },
});
```
`.gitlab-ci.yml`:
```yaml
stages:
  - test
  - report

workflow:
  auto_cancel:
    on_new_commit: interruptible
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "schedule"

variables:
  NPM_CONFIG_CACHE: $CI_PROJECT_DIR/.npm

e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.65.0-noble
  interruptible: true
  parallel: 4
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
    policy: pull-push
  script:
    - npm ci
    - npx playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
  artifacts:
    when: always
    expire_in: 7 days
    paths:
      - blob-report/
      - test-results/
    reports:
      junit: results/junit-*.xml

report:
  stage: report
  image: mcr.microsoft.com/playwright:v1.65.0-noble
  when: always
  script:
    - npm ci
    - npx playwright merge-reports --reporter html ./blob-report
  artifacts:
    when: always
    expire_in: 14 days
    paths:
      - playwright-report/
```
What each part does:
1. `workflow:rules` runs pipelines for merge requests, the default branch and schedules, which prevents duplicate branch and merge request pipelines. `auto_cancel: on_new_commit: interruptible` cancels older runs of jobs marked `interruptible: true`.
2. `parallel: 4` makes jobs `e2e 1/4` to `e2e 4/4`; GitLab sets `CI_NODE_INDEX` and `CI_NODE_TOTAL` in each.
3. `artifacts:when: always` keeps the blob report and traces even when tests fail. Without it, a failed job uploads nothing.
4. The `report` job is in a later stage with `when: always`, so it runs after failed shards. By default a job fetches the artifacts of all jobs in earlier stages, so `blob-report/` from every shard lands in one folder; blob file names contain the shard number, so they do not overwrite each other.
5. `reports:junit` feeds the test summary in the merge request. It accepts files and patterns, not directories.
6. The cache holds the npm download cache, keyed on `package-lock.json` through `cache:key:files`.
7. Behaviour over time: artifacts are deleted after `expire_in`; the newest pipeline's artifacts can be kept by project settings.

**Follow-ups:**
- *`parallel` or `parallel:matrix`?* `parallel: N` for plain shards; `parallel:matrix` when you also vary a project or browser, for example `PROJECT: [chromium, webkit]` with `SHARD: ['1/4', '2/4', ...]`, and pass `--project=$PROJECT --shard=$SHARD`.
- *Do you cache the browsers?* No. The image already has them. The Playwright docs say browser caches usually save no time, and the OS dependencies cannot be cached.
- *Why a separate `report` job?* Only one place can hold all shards' blobs. It also gives one link to share.

**Trap:** A report job without `when: always`. Then the report appears only when everything passed, which is when you need it least.

**Source:** https://playwright.dev/docs/ci#gitlab-ci

### What is the difference between cache and artifacts in GitLab CI?

Topic: ci-gitlab | Standard | id: q0716

**Say:** Artifacts are job outputs that I want to keep or pass on: reports, traces, build output. They are uploaded to GitLab, shown in the UI and passed to later jobs. A cache is a speed-up for repeated inputs like downloaded dependencies; it is best effort, may be missing, and is not guaranteed to be shared between runners. So the report goes into artifacts and the npm download folder goes into the cache.

**Follow-ups:**
- *What goes wrong if a job relies on cache?* It fails or slows on a cold runner. A cache miss must only cost time.
- *How do you key the cache?* `cache:key:files: [package-lock.json]`, so it refreshes when dependencies change.

**Trap:** Using cache to pass results between jobs.

**Source:** https://docs.gitlab.com/ci/caching/

### What are runners and executors in GitLab?

Topic: ci-gitlab | Standard | id: q0717

**Say:** A runner is the agent that picks up jobs and runs them. The executor is how it runs them: shell on the host, Docker containers, Kubernetes pods, and others. With the Docker executor, each job runs in the image given by `image:`, which is why the Playwright image works well. Shared runners are offered by the instance; project runners are self-managed.

**Follow-ups:**
- *Job waits as pending. Why?* No free runner with the right tags, or the concurrency limit is reached. Many `parallel` jobs queue behind the limit.
- *Why does Chromium crash in the Docker executor?* Often shared memory or sandbox limits. The Playwright docs recommend `--ipc=host` and `--init` for Docker; on GitLab that is set in the runner configuration, so ask whoever owns the runner.

**Trap:** Thinking `image:` works with any executor. The shell executor ignores it.

**Source:** https://docs.gitlab.com/ci/runners/

### How do `rules`, `needs` and `stages` control the order and conditions of jobs?

Topic: ci-gitlab | Standard | id: q0718

**Say:** Stages give a simple order: all jobs in a stage run in parallel, the next stage waits for the previous one. `needs` builds a graph instead: a job starts as soon as the jobs it needs are done, which can shorten the pipeline. `rules` decide whether a job exists in a pipeline at all, for example only on merge requests, only when certain files changed, or only for schedules.

**Full process:**
```yaml
smoke:
  stage: test
  script: npx playwright test --grep @smoke
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

nightly-regression:
  stage: test
  script: npx playwright test
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"

lint:
  stage: test
  needs: []
  script: npm run lint
```
`needs: []` makes `lint` start at once, without waiting for earlier stages.

**Follow-ups:**
- *What changes with `needs` and artifacts?* A job with `needs` only downloads artifacts from the jobs it lists, controlled by `needs:artifacts`.
- *How do you run a nightly suite?* Create a pipeline schedule in the project and use a `rules` condition on `$CI_PIPELINE_SOURCE == "schedule"`.

**Trap:** Mixing `dependencies` and `needs` in one job. The docs say not to.

**Source:** https://docs.gitlab.com/ci/yaml/#needs

### How do you store and protect variables in GitLab CI?

Topic: ci-gitlab | Standard | id: q0719

**Say:** I add them in project settings under CI/CD variables. Secrets are masked, so values are hidden in job logs, and protected, so only protected branches and tags can use them. I can scope a variable to an environment. For cloud access I prefer `id_tokens`, which gives the job a short-lived identity token instead of a stored key.

**Follow-ups:**
- *Is a masked variable safe from a malicious merge request?* No. A changed pipeline file on an unprotected branch can try to print it, which is why protected variables exist.
- *Where do non-secret settings go?* In the `variables:` block in the YAML, such as the base URL.

**Trap:** Storing a token in the repository because the variable "is only for tests".

**Source:** https://docs.gitlab.com/ci/variables/

### What is the difference between branch pipelines and merge request pipelines?

Topic: ci-gitlab | Standard | id: q0720

**Say:** A branch pipeline runs on a push to a branch. A merge request pipeline runs for the merge request and can use merge-request-specific variables. If a job has no rules limiting it, both can run for the same commit, which gives duplicate pipelines. I avoid that with `workflow:rules` that pick one source.

**Follow-ups:**
- *Why does it matter for QA?* A duplicate pipeline doubles the load on test environments and shows two results for the same change.

**Trap:** Not noticing two pipelines on one commit.

**Source:** https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/

### How do you reuse pipeline configuration in GitLab CI?

Topic: ci-gitlab | Standard | id: q0721

**Say:** I use `extends` for a shared job template inside a file, `include` to pull in YAML from other files or projects, and hidden jobs that start with a dot as templates. That keeps shard jobs for different projects, such as chromium and webkit, in one definition.

**Full process:**
```yaml
.e2e-base:
  image: mcr.microsoft.com/playwright:v1.65.0-noble
  before_script:
    - npm ci

e2e-chromium:
  extends: .e2e-base
  script: npx playwright test --project=chromium
```

**Follow-ups:**
- *Risk of a shared include?* A change there affects every project using it, so it needs review and versioning by tag.

**Source:** https://docs.gitlab.com/ci/yaml/includes/

### How do you publish a test report and see results inside a merge request in GitLab?

Topic: ci-gitlab | Standard | id: q0722

**Say:** The job writes a JUnit XML file and declares it under `artifacts:reports:junit`. GitLab then shows a test summary in the merge request with failed tests. For the rich HTML report and traces I keep those folders as normal artifacts that people can browse or download. Both need `artifacts:when: always`, or a failed run uploads nothing.

**Follow-ups:**
- *Does `reports:junit` accept a directory?* No. It accepts a filename, a pattern or a list.

**Source:** https://docs.gitlab.com/ci/testing/unit_test_reports/

### How do you handle a manual approval, scheduled run or environment in GitLab CI?

Topic: ci-gitlab | Standard | id: q0723

**Say:** `when: manual` makes a job wait for a click, which suits a production promotion. Pipeline schedules run a pipeline on a cron time, which I use for the nightly full regression. The `environment:` keyword names a deployment target so GitLab tracks deployments and shows which commit is where.

**Follow-ups:**
- *Why does environment tracking help QA?* It answers "which commit is deployed there", which is the first question when a test fails on an environment.

**Source:** https://docs.gitlab.com/ci/environments/

## GitHub Actions

### Show me a complete GitHub Actions workflow for Playwright with sharding, merged reports and artifacts.

Topic: ci-github | Standard | id: q0724

**Say:** A matrix creates one job per shard, and each runs `--shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}` with the blob reporter. Each shard uploads its blob report as an artifact with a unique name. A second job depends on the first with `needs`, runs even when shards fail, downloads all blob reports into one folder, merges them into an HTML report and uploads that. I use the official Playwright container so browsers are already installed.

**Full process:** `.github/workflows/playwright.yml`:
```yaml
name: Playwright Tests
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  playwright-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    container:
      image: mcr.microsoft.com/playwright:v1.65.0-noble
      options: --user 1001
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
        env:
          BASE_URL: ${{ vars.BASE_URL }}
          API_TOKEN: ${{ secrets.API_TOKEN }}
      - uses: actions/upload-artifact@v7
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1

  merge-reports:
    if: ${{ !cancelled() }}
    needs: [playwright-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - uses: actions/download-artifact@v8
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v7
        with:
          name: html-report--attempt-${{ github.run_attempt }}
          path: playwright-report
          retention-days: 14
```
With `playwright.config.ts` set to `reporter: process.env.CI ? 'blob' : 'html'`, as in the GitLab section.
What each part does:
1. `matrix` with `fail-fast: false` runs all four shards even if one fails, so the merged report is complete.
2. `container` runs the job in the official image; `--user 1001` is the option shown in the Playwright docs for this setup.
3. `if: ${{ !cancelled() }}` uploads blobs after failures too, and keeps the merge job running after failed shards.
4. Artifact names must be unique per upload, so each shard has its own name. `download-artifact` with `pattern` and `merge-multiple: true` puts all files in one folder.
5. `retention-days: 1` for blobs keeps storage small; the final report is kept 14 days.
6. `concurrency` cancels an older run on the same ref when a new commit arrives.
7. `permissions: contents: read` keeps the workflow token minimal.
8. The setup-node `cache: npm` caches the npm download cache keyed on the lock file.

**Follow-ups:**
- *Where do you cache browsers?* I do not, in this setup, because the container has them. Without the container I would cache `~/.cache/ms-playwright` with `actions/cache` keyed on the Playwright version, and still run `npx playwright install-deps` for OS packages, since the docs say those cannot be cached and browser caching usually saves little.
- *Without the container, what is the install line?* `npx playwright install --with-deps`.
- *Why is the merge job on a plain runner?* It only needs Node and the `merge-reports` command, not browsers.

**Trap:** Uploading every shard with the same artifact name. In current versions of the artifact actions, names must be unique, so uploads clash.

**Source:** https://playwright.dev/docs/test-sharding#github-actions-example

### What are workflows, jobs, steps and runners in GitHub Actions?

Topic: ci-github | Standard | id: q0725

**Say:** A workflow is a YAML file in `.github/workflows` triggered by events like `push` or `pull_request`. It has jobs, which run on separate runners in parallel unless `needs` orders them. A job has steps, which run in sequence on the same runner and can be shell commands or reusable actions. A runner is the machine, hosted by GitHub or self-hosted.

**Follow-ups:**
- *How do jobs share files?* Not by disk. They pass them as artifacts, or small values as job outputs.

**Source:** https://docs.github.com/en/actions/get-started/understanding-github-actions

### How do secrets and OIDC work in GitHub Actions?

Topic: ci-github | Standard | id: q0726

**Say:** Repository or environment secrets are read with `${{ secrets.NAME }}` and are masked in logs. They are not passed to workflows triggered from forks by default. For cloud access I use OpenID Connect: the job asks for `id-token: write` permission, and the cloud provider trusts the token, so there is no long-lived key stored.

**Follow-ups:**
- *What is the risk of `pull_request_target`?* It runs with secrets in the context of the base repository; running untrusted pull request code there is a known way to leak them.
- *What does `GITHUB_TOKEN` have?* Only the permissions the workflow gives it through `permissions:`; I set the minimum.

**Trap:** Giving the workflow write access to everything by default.

**Source:** https://docs.github.com/en/actions/concepts/security/openid-connect

### How do you cache dependencies in GitHub Actions?

Topic: ci-github | Standard | id: q0727

**Say:** With `actions/cache`, or the built-in `cache: npm` option of `setup-node`. The key includes the hash of the lock file, so the cache refreshes when dependencies change. Cache is best effort: a miss only makes the job slower.

**Full process:**
```yaml
- uses: actions/cache@v6
  with:
    path: ~/.cache/ms-playwright
    key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```
Use this only without the Playwright container. The official docs say caching browsers usually does not pay off.

**Follow-ups:**
- *Cache versus artifact?* The same as GitLab: cache speeds repeated inputs, artifacts carry outputs.

**Source:** https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching

### How do you reuse workflows or limit parallel runs in GitHub Actions?

Topic: ci-github | Standard | id: q0728

**Say:** A reusable workflow is a workflow with `on: workflow_call` that other workflows call with `uses:`, so shard and report logic exists once. `concurrency` with a group name makes runs queue or cancel each other, which prevents two runs from changing the same test environment together.

**Follow-ups:**
- *Matrix size limit?* A matrix can run many jobs at once, so I watch runner minutes and the environment capacity.

**Source:** https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows

## Jenkins

### What is Jenkins and how does a Jenkins pipeline run Playwright tests?

Topic: ci-jenkins | Standard | id: q0729

**Say:** Jenkins is a self-hosted automation server with a controller that schedules and agents that run the work. A pipeline is a `Jenkinsfile` in the repository with stages and steps. If you have used Jenkins to read runs and logs, mention it; if you have not built production Jenkins pipelines, say so plainly and describe how you would write one.

**Full process:** A declarative `Jenkinsfile` I would write:
```groovy
pipeline {
  agent { docker { image 'mcr.microsoft.com/playwright:v1.65.0-noble' } }
  environment {
    CI = 'true'
    API_TOKEN = credentials('e2e-api-token')
  }
  stages {
    stage('Install') { steps { sh 'npm ci' } }
    stage('Test')    { steps { sh 'npx playwright test' } }
  }
  post {
    always {
      junit 'results/junit.xml'
      archiveArtifacts artifacts: 'playwright-report/**,test-results/**', allowEmptyArchive: true
    }
  }
}
```
1. `agent` selects where it runs; a Docker agent uses the Playwright image.
2. `credentials()` injects a secret from the Jenkins credentials store as an environment variable, masked in logs.
3. `post { always }` runs whatever the result, so reports and artifacts are kept when tests fail.
4. `junit` shows the test results trend; `archiveArtifacts` stores the report.

**Follow-ups:**
- *Declarative or scripted?* Declarative: simpler structure with `post` and `stages`. Scripted Groovy only when I need loops or logic the declarative form cannot express.
- *Tests pass locally but fail on Jenkins. What do you check first?* The environment difference: node and browser versions, display and shared memory in the container, environment variables, time zone, and the data on the target environment. Then the trace.

**Trap:** Claiming deep Jenkins administration. Know the controller and agent model and the Jenkinsfile.

**Source:** https://www.jenkins.io/doc/book/pipeline/syntax/

### What is the difference between a controller and an agent, and between freestyle jobs and pipelines in Jenkins?

Topic: ci-jenkins | Standard | id: q0730

**Say:** The controller holds configuration and schedules builds; agents are the machines that execute them, so heavy test work runs off the controller. A freestyle job is configured in the UI and is hard to review; a pipeline is code in a Jenkinsfile in the repository.

**Follow-ups:**
- *Why not run builds on the controller?* A build there can read the controller's files and slow it down for everyone. Jenkins advises setting the built-in node to 0 executors.
- *How does a job pick an agent?* By label: `agent { label 'linux-playwright' }` runs only on agents with that label.
- *Would you keep freestyle jobs?* No. Move them to a Jenkinsfile, so changes go through review and history.

**Source:** https://www.jenkins.io/doc/book/managing/nodes/

### How do you manage credentials in Jenkins and reuse pipeline code?

Topic: ci-jenkins | Standard | id: q0731

**Say:** Secrets go into the Jenkins credentials store and are injected with `credentials()` or `withCredentials`, which masks them in logs. Reusable steps live in a shared library that pipelines import.

**Follow-ups:**
- *Can a secret still leak?* Yes. Masking hides only the exact value, so a changed form, such as base64, shows in the log. Groovy double quotes also put the secret into the command text; use single quotes: `sh 'curl -H "Authorization: Bearer $TOKEN" ...'`.
- *How does a pipeline use a shared library?* `@Library('qa-steps') _` at the top of the Jenkinsfile. Custom steps live in the library's `vars/` folder, for example `runPlaywright()`.

**Source:** https://www.jenkins.io/doc/book/using/using-credentials/ ; https://www.jenkins.io/doc/book/pipeline/shared-libraries/ ; https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#string-interpolation

## Azure DevOps

### Have you used Azure DevOps Pipelines?

Topic: ci-azure | Standard | id: q0732

**Say:** If you have not used Azure DevOps for CI/CD, say so plainly. The concepts carry over: a YAML pipeline with stages, jobs and steps, a matrix or parallel strategy, and published test results. Map the GitLab setup to it and read the Azure docs for the syntax.

**Follow-ups:**
- *How does sharding look there?* The Playwright docs show an Azure Pipelines matrix where each entry passes `--shard`. The docs example has no merge job; I would add one that runs `merge-reports`, as in GitHub.

**Source:** https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines

### How would you integrate automated tests with cloud platforms such as AWS or Azure?

Topic: ci-azure | Standard | id: q0733

**Say:** If you have run tests from CI against an environment in the cloud, use the cloud's services for supporting parts: a registry for the test image, object storage for reports, a secret store for credentials. If you have used AWS, mention it. For Azure, follow the same pattern with its equivalent services, but state if you have not used them.

**Follow-ups:**
- *How does CI authenticate to AWS without long-lived keys?* By assuming an IAM role through OIDC, so the job gets short-lived credentials and no access key is stored.
- *What are the Azure equivalents of a registry, a secret store and object storage?* Azure Container Registry, Key Vault and Blob Storage. State if you have not used them.

**Source:** https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines

## Docker and Kubernetes

### What is the difference between a Docker image and a container?

Topic: docker-k8s | Standard | id: q0734

**Say:** An image is a read-only package: the files, tools and settings to run something. A container is a running instance of an image, with a thin writable layer and its own process and network. One image can start many containers, like one class and many objects. For tests it means the same image gives the same environment every time.

**Follow-ups:**
- *Are containers lightweight virtual machines?* No. Containers share the host kernel and isolate processes; a VM has its own kernel on virtual hardware.
- *Where does data go when the container is removed?* It is lost unless stored in a volume.

**Trap:** Saying a container "contains" an operating system. It has a filesystem and libraries but uses the host kernel.

**Source:** https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/

### What happens when `docker run` starts a test container?

Topic: docker-k8s | Standard | id: q0735

**Say:** Docker finds the image locally or pulls it from the registry, creates a container with its own filesystem layer and network, applies options like ports, volumes and environment variables, and starts the image's command as process 1. When that process exits, the container stops, and its exit code becomes the result.

**Follow-ups:**
- *Why does the exit code matter for CI?* A test command that exits non-zero makes `docker run` return non-zero, and the job fails.
- *Why `--init`?* Process 1 gets special signal handling, so zombie processes can pile up. Playwright's docs recommend `--init` for that reason.

**Source:** https://docs.docker.com/reference/cli/docker/container/run/

### Write a Dockerfile to run a Playwright suite.

Topic: docker-k8s | Standard | id: q0736

**Say:** I start from the official Playwright image, which already includes browsers and OS dependencies. The `@playwright/test` package is not in the image, so I install it with `npm ci`. I copy `package*.json` first so the install layer is cached until dependencies change, then copy the tests. The image version must match the Playwright version in `package.json`.

**Full process:**
```dockerfile
FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npx", "playwright", "test"]
```
1. Build: `docker build -t e2e:local .`
2. Run: `docker run --rm --init --ipc=host -e BASE_URL=https://test.example.com -v "$PWD/playwright-report":/work/playwright-report e2e:local npx playwright test --reporter=html`
3. The mounted volume brings the report from the container to the host. The exit code of `docker run` equals the test result.
4. Behaviour over time: layers are cached, so a rebuild after a test change is fast. A change in `package-lock.json` reinstalls dependencies.

**Follow-ups:**
- *Why `--ipc=host`?* Without it Chromium can run out of shared memory and crash, according to the Playwright docs.
- *The browser fails to start as root?* The image runs browsers as root without the Chromium sandbox. For trusted test code this is fine. For untrusted sites the docs recommend a separate user and a seccomp profile.
- *Why not `latest`?* A moving tag changes the browser under your tests. Pin the version.

**Trap:** Copying the whole repository before `npm ci`, which invalidates the install cache on every change.

**Source:** https://playwright.dev/docs/docker

### How do you use Docker Compose for a test environment?

Topic: docker-k8s | Standard | id: q0737

**Say:** Compose describes several containers in one YAML file, such as the app, a database, and the test runner, and starts them together on a private network where services reach each other by name. I use `depends_on` with a health check so tests start only when the app is ready, and `docker compose up --abort-on-container-exit` to get the test result as the exit code.

**Full process:**
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10
  app:
    image: my-app:test
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 5s
      retries: 20
  e2e:
    image: e2e:local
    depends_on:
      app:
        condition: service_healthy
    environment:
      BASE_URL: http://app:3000
```
Run: `docker compose up --abort-on-container-exit --exit-code-from e2e`, then `docker compose down -v` to remove data.

**Follow-ups:**
- *Why not `localhost`?* Inside a container `localhost` is itself. Use the service name.
- *When do you leave Compose?* When you need many parallel isolated environments, shared team environments, or scaling beyond one host.

**Trap:** `depends_on` without a health condition only waits for the container to start, not for the service to be ready.

**Source:** https://docs.docker.com/reference/compose-file/services/

### Explain Docker networking and volumes for test setups.

Topic: docker-k8s | Standard | id: q0738

**Say:** Containers on the same user-defined network resolve each other by service name, and only ports I publish with `-p` are reachable from the host. Volumes keep data outside the container's life; bind mounts map a host folder. For tests I use a bind mount to get reports out, and I avoid volumes for the database in throwaway runs so each run starts clean.

**Follow-ups:**
- *Container needs the host's service?* Use `host.docker.internal`, or add `--add-host` with `host-gateway` on Linux.

**Source:** https://docs.docker.com/engine/storage/volumes/

### How do you get logs from a crashed container?

Topic: docker-k8s | Standard | id: q0739

**Say:** `docker logs <container>` works on stopped containers too, as long as it was not run with `--rm`. `docker ps -a` lists exited ones, and `docker inspect` shows the exit code and whether the process was killed for memory. For a live problem, use `docker exec -it <container> sh`. In Kubernetes the same is `kubectl logs --previous`.

**Follow-ups:**
- *Exit code 137?* The process was killed, often out of memory.

**Source:** https://docs.docker.com/reference/cli/docker/container/logs/

### What is the difference between Docker and Kubernetes?

Topic: docker-k8s | Standard | id: q0740

**Say:** Docker builds images and runs containers on one machine. Kubernetes runs containers across a cluster of machines: it schedules them, restarts failures, exposes them through Services and manages configuration and scaling. As QA I use Docker to make a repeatable test runner and Kubernetes when the application under test lives in a cluster.

**Follow-ups:**
- *When to graduate from Compose to Kubernetes?* When you need per-branch isolated environments, resource limits, or the product itself runs on Kubernetes so test environments should match it.

**Source:** https://kubernetes.io/docs/concepts/overview/

### What is a Pod, a Deployment and a Service in Kubernetes?

Topic: docker-k8s | Standard | id: q0741

**Say:** A Pod is the smallest unit: one or more containers sharing a network and storage. A Deployment keeps a set number of identical Pods running and handles rolling updates. A Service gives Pods a stable name and address and sends traffic to the healthy ones that match its label selector. A Namespace separates groups of resources, for example one environment per branch.

**Follow-ups:**
- *Why might a Service have no endpoints?* Its selector does not match the Pod labels, or the Pods are not ready.
- *Pod pending or crash-looping?* `kubectl describe pod` shows events, such as unschedulable resources or an image pull error; `kubectl logs --previous` shows why it crashed.

**Source:** https://kubernetes.io/docs/concepts/workloads/pods/

### How did you use Kubernetes as a QA engineer?

Topic: docker-k8s | Standard | id: q0742

**Say:** Example: test environments ran on Kubernetes, on AWS EKS. The E2E suite ran against them from CI, and a second environment was added where the suite ran with new feature flags at 100%. Checked what was deployed and read logs when a failure looked like an environment problem. Did not write the manifests or Helm charts, so cannot claim cluster administration, only working in these environments as the test owner.

**Full process:** The commands a QA person needs:
1. `kubectl config get-contexts` and `kubectl config use-context <name>`: check which cluster you point at, before anything else.
2. `kubectl get pods -n <namespace>`: are all Pods running and ready.
3. `kubectl describe pod <pod> -n <namespace>`: events, image tag, restarts.
4. `kubectl logs <pod> -n <namespace> --tail=200` and `--previous` for the crashed instance.
5. `kubectl get deployment <name> -n <namespace> -o wide`: the image tag shows which build is deployed.
6. `kubectl port-forward svc/<service> 8080:80 -n <namespace>`: reach an internal service locally to reproduce.

**Follow-ups:**
- *A test fails with 404 or 502. What do you check?* Whether the environment is up, which commit is deployed, and whether Pods restarted. Dev environments may be off by design or on an older baseline.
- *How do you keep runs from affecting each other?* Separate namespaces or accounts, and test data cleaned up per run.

**Trap:** Claiming Helm or cluster operations you did not do.

**Source:** https://kubernetes.io/docs/reference/kubectl/quick-reference/

### Show a minimal Kubernetes Job that runs a containerised test suite.

Topic: docker-k8s | Standard | id: q0743

**Say:** A Job runs a Pod to completion. Set the test image and command, `restartPolicy: Never` so a failed test is not endlessly restarted inside the Pod, a low `backoffLimit`, and `ttlSecondsAfterFinished` so finished Jobs clean themselves up. Read the result with `kubectl wait` and `kubectl logs`. Many teams run the same suite from CI instead; say which you have done.

**Full process:**
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: e2e-smoke
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: e2e
          image: registry.example.com/e2e:1.0.0
          env:
            - name: BASE_URL
              value: http://app.test.svc.cluster.local
```
1. `kubectl apply -f job.yaml -n test`
2. `kubectl wait --for=condition=complete job/e2e-smoke --timeout=600s -n test` (a failed Job never completes, so this times out; also check `condition=failed`).
3. `kubectl logs job/e2e-smoke -n test`

**Follow-ups:**
- *Where do secrets come from?* Kubernetes Secrets mounted as environment variables, not values in the manifest.

**Source:** https://kubernetes.io/docs/concepts/workloads/controllers/job/

### Why are containers useful for parallel and repeatable test execution?

Topic: docker-k8s | Standard | id: q0744

**Say:** Each shard starts from the same image, with the same browser and dependencies, so differences between machines disappear. Containers start fast and are thrown away after, so there is no leftover state. I can run many at once on a runner or cluster.

**Follow-ups:**
- *Limits?* Memory and shared memory per container; too many browsers in one container crash it.

**Source:** https://playwright.dev/docs/docker

### How do you create an isolated test environment per pull request?

Topic: docker-k8s | Standard | id: q0745

**Say:** Deploy the branch's image into its own Kubernetes namespace or its own Compose project, with its own database, run the tests against it, then delete the namespace in a cleanup job. The cost is time and resources, so I do it for the changes that need isolation, and keep shared environments for light checks.

**Follow-ups:**
- *What breaks it?* Leaked environments from failed cleanups. A scheduled job that removes old namespaces helps.

**Source:** https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/

### How do you run load tests against a Kubernetes application?

Topic: docker-k8s | Standard | id: q0746

**Say:** Run against a dedicated environment with resource limits close to production, never the shared test environment, and with monitoring on during the run. If you have used JMeter for baselines, mention it. If you have not used k6, say so plainly.

**Follow-ups:**
- *What do you watch during the run?* Response time percentiles (p95, p99), the error rate, CPU and memory per pod, and whether the autoscaler adds pods in time.
- *Why not the shared test environment?* The load disturbs other teams' tests, and their traffic disturbs your numbers.

**Source:** https://kubernetes.io/docs/concepts/workloads/pods/

## AWS and cloud

### What AWS services have you used as a QA engineer?

Topic: cloud-aws | Standard | id: q0747

**Say:** If you have used AWS in tests and CI, mention specific services: test environments on EKS, Docker images in ECR including a custom Playwright CI image, AWS Secrets Manager for secrets, and S3 for storing files. If you have not used LocalStack, say so plainly. If you have not used GCP, state that and do not pretend; the concepts map across clouds, but state your actual experience.

**Follow-ups:**
- *Did you manage the infrastructure?* No. Mention if you used it as the test owner and worked with the people who managed it.
- *Have you used Lambda or Terraform?* No, not in your work. State that you know what they are.

**Trap:** Claiming GCP because a CV mentioned it. Say plainly that it was an error and that you have not used it.

**Source:** https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html

### How do you build and publish a Docker image to ECR for CI?

Topic: cloud-aws | Standard | id: q0748

**Say:** I authenticate Docker to the registry with a short-lived token from the AWS CLI, build the image tagged with the commit SHA, and push it. CI then pulls that exact tag. The tag is immutable by convention, so the same tag means the same image.

**Full process:**
1. Log in: `aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.eu-west-1.amazonaws.com`
2. Build: `docker build -t <account>.dkr.ecr.eu-west-1.amazonaws.com/playwright-ci:$SHA .`
3. Push: `docker push <account>.dkr.ecr.eu-west-1.amazonaws.com/playwright-ci:$SHA`
4. In CI, set `image:` to that tag. The runner needs permission to pull from ECR.
5. The login token expires after a period, so each job logs in again.

**Follow-ups:**
- *Why not `latest`?* A moving tag changes under running tests and makes failures hard to reproduce.

**Trap:** Pushing to a repository that does not exist. By default ECR does not create it on push (only a matching repository creation template with create-on-push does), so create it first (`aws ecr create-repository` or infrastructure code). Also, a tag is overwritable unless the repository has tag immutability turned on, so "immutable by convention" is not enforced.

**Source:** https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html

### How do you read a secret from AWS Secrets Manager in a test run?

Topic: cloud-aws | Standard | id: q0749

**Say:** The job's role is allowed to read that one secret. The pipeline reads it with the CLI at job start and exports it as an environment variable, so tests read `process.env`. The value is never committed or printed. Access is by role, so I rotate secrets in Secrets Manager rather than in code.

**Full process:**
```bash
export API_TOKEN="$(aws secretsmanager get-secret-value \
  --secret-id e2e/api-token \
  --query SecretString --output text)"
```
Then run `npx playwright test`. If the secret holds JSON, parse a field with `jq -r .token`.

**Follow-ups:**
- *Secrets Manager versus CI variables?* A CI variable is simple and tied to the CI project. Secrets Manager centralises access and rotation, and several systems read from it.

**Trap:** Letting the value reach the log. `set -x` or an `echo` in the job prints it, and a secret passed as a command-line argument shows in the process list. Pass it through the environment and keep tracing off around that line.

**Source:** https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/get-secret-value.html

### What roles does S3 play in a tester's work?

Topic: cloud-aws | Standard | id: q0750

**Say:** First, it stores test artifacts such as reports, traces and videos with a retention rule, when CI artifact storage is not enough. Second, it can be a test input or output location, because the application may read or write files there, and a test verifies the object. Third, it is a part of the system under test, such as uploads, so check permissions and that files land where expected. If you used S3 for stored files, mention that you did not manage it.

**Follow-ups:**
- *Command to upload a report?* `aws s3 cp playwright-report s3://<bucket>/<run-id>/ --recursive`.

**Trap:** Making the report bucket public so the team can open it. Traces and HAR files can hold tokens, cookies and customer data. Keep the bucket private and share a time-limited presigned URL.

**Source:** https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html

### How do you reach an EKS cluster to check a test environment?

Topic: cloud-aws | Standard | id: q0751

**Say:** I configure `kubectl` with the AWS CLI, which writes the cluster entry to my kubeconfig, then check the context before running anything. Access depends on my AWS identity being allowed in that cluster.

**Full process:**
1. `aws eks update-kubeconfig --region eu-west-1 --name <cluster-name>`
2. `kubectl config current-context` to confirm the cluster.
3. `kubectl get pods -n <namespace>`

**Follow-ups:**
- *Why do I get "Unauthorized" after `update-kubeconfig`?* AWS identity is not mapped to a role in the cluster. The cluster owner has to grant it.
- *How do I avoid running a command against the wrong cluster?* Check `kubectl config current-context` first, and pass `-n <namespace>` explicitly.

**Trap:** Believing `update-kubeconfig` grants access. It only writes the cluster entry. Access comes from the IAM identity being allowed inside the cluster, and a command run in the wrong context can hit another cluster.

**Source:** https://docs.aws.amazon.com/eks/latest/userguide/create-kubeconfig.html

### How do you keep cloud test infrastructure cost under control?

Topic: cloud-aws | Standard | id: q0752

**Say:** Run what is needed when it is needed: environments off at night and weekends, short retention for artifacts, right-sized runners, and removing duplicate tests. I also check that old per-branch environments are deleted.

**Follow-ups:**
- *How do you find unused environments?* Tag each one with an owner and a branch or expiry date, and list the ones whose branch is gone or whose date passed.
- *What usually costs the most?* Compute that runs while idle, such as environments left on overnight. I would check with a cost report by tag and not guess.

**Trap:** Cutting cost by removing test coverage or parallel workers without measuring. The pipeline gets slower and the cost may not change. Find the spend first, per tag or per environment, and fix the largest part.

**Source:** https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html

### Have you used Google Cloud?

Topic: cloud-aws | Standard | id: q0753

**Say:** If you have not used GCP, say so plainly. State your actual cloud experience (e.g., AWS). The ideas used there, such as a registry, a secret store, object storage and a managed Kubernetes service, exist in Google Cloud too, but state that you would need to learn its names and tools.

**Follow-ups:**
- *What is the Google Cloud name for a container registry and a secret store?* Artifact Registry and Secret Manager. Object storage is Cloud Storage and managed Kubernetes is GKE.
- *How would you start on it?* Use the same pattern: image in a registry, secrets from the secret store, reports in object storage, and learn the CLI names.

**Trap:** Bluffing. If a CV said otherwise, say that was an error.

**Source:** https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html

### How do you use cloud device farms or cloud browsers?

Topic: cloud-aws | Standard | id: q0754

**Say:** If you have used BrowserStack a little for browser and device coverage that cannot be run locally, mention it. Use it for specific gaps, not as the main run, because cloud sessions are slower and cost money per minute.

**Follow-ups:**
- *How does a cloud browser reach an app that is not public?* Through a tunnel from the provider, such as BrowserStack Local, or by testing a deployed preview environment.
- *Why is it not the main run?* Sessions are slower and cost money per minute, so local and CI runs stay the fast feedback loop.

**Trap:** Running the whole suite on every browser and device on every commit. It is slow and costly. Choose the matrix by traffic and risk, run a small set per merge, and the full set nightly.

**Source:** https://playwright.dev/docs/browsers

## Git

### What is the difference between merge and rebase?

Topic: git | Standard | id: q0755

**Say:** Merge joins two branches with a merge commit, so history shows exactly how the work came together, and no commit changes. Rebase takes my commits and replays them on top of the target branch, giving a straight line but new commit hashes. I rebase my own unpublished branch onto the latest main before a merge request, and I never rewrite history that others already pulled. I never merge main into my branch to resolve conflicts.

**Full process:**
1. Update the target: `git fetch origin main`.
2. Rebase: `git rebase origin/main`.
3. On a conflict, Git stops. Fix the files, `git add <file>`, then `git rebase --continue`. To give up: `git rebase --abort`.
4. The branch is now rewritten. If it was pushed before, push with a lease pinned to what the remote had: `git push --force-with-lease=<branch>:<old-sha> origin <new-sha>:refs/heads/<branch>`.
5. After a force-push, review comments anchored to line numbers may point to old lines. Check them again.

**Follow-ups:**
- *Why `--force-with-lease` and not `--force`?* It refuses if someone else pushed in the meantime. A bare `--force-with-lease` can pass silently after a background fetch refreshed the remote ref, so pin the expected SHA.
- *When merge?* On a shared branch, where rewriting would disrupt others.
- *Rebase of published commits with review comments?* I add review fixes as new commits and do not squash commits that are already pushed, but rebasing onto the latest target is normal.

**Trap:** Saying "rebase is better" or "merge is better". It depends on whether the commits are shared.

**Source:** https://git-scm.com/docs/git-rebase

### How do you resolve a merge conflict?

Topic: git | Standard | id: q0756

**Say:** I read both sides and find out what each change wanted, instead of picking one blindly. I edit the file to the correct combined result, remove the markers, and run the tests, because Git only checks text, not behaviour. Then I `git add` and continue. If the conflict is in code someone else wrote, I ask them.

**Full process:**
1. `git status` lists files with conflicts.
2. Open each; markers `<<<<<<<`, `=======`, `>>>>>>>` show the two versions.
3. Edit to the final content and delete the markers.
4. `git add <file>`, then `git rebase --continue` or `git commit` for a merge.
5. After a rebase, grep for removed symbols and run the type check and tests, even if there was no conflict, because a rebase can drop shared locators or narrow types silently.

**Follow-ups:**
- *Which tools?* `git diff --diff-filter=U`, an IDE merge view, or `git checkout --theirs/--ours` for a whole file when I'm sure.
- *How do you avoid conflicts?* Small short-lived branches, frequent rebases, and not reformatting files in feature work.

**Trap:** Accepting "ours" for every conflict to be fast.

**Source:** https://git-scm.com/docs/git-merge

### What does cherry-pick do and when do you use it?

Topic: git | Standard | id: q0757

**Say:** `git cherry-pick <sha>` copies one commit onto the current branch as a new commit. I use it to bring a single fix to a release branch without merging everything else. The copy has a different hash, so if the original branch later merges, the same change can appear twice or conflict.

**Full process:**
1. `git switch release/1.4`
2. `git cherry-pick -x <sha>`; `-x` appends the original hash to the message.
3. On a conflict: fix, `git add`, `git cherry-pick --continue`; or `git cherry-pick --abort`.
4. Run the tests on the release branch.

**Follow-ups:**
- *A range?* `git cherry-pick A..B` copies commits after A up to B.

**Trap:** Using cherry-pick as the normal way to move work between branches. It loses the link between commits.

**Source:** https://git-scm.com/docs/git-cherry-pick

### How do you use git bisect to find the commit that introduced a regression?

Topic: git | Standard | id: q0758

**Say:** Bisect does a binary search over history. I mark one commit as bad and one older commit as good, and Git checks out the middle one; I test it and tell Git good or bad, and after a few steps it names the first bad commit. With a script that returns 0 for good and 1 to 127 (not 125) for bad, `git bisect run` does it without me. A failing test is the ideal script.

**Full process:**
1. `git bisect start`
2. `git bisect bad` (the current commit is broken).
3. `git bisect good <known-good-sha>`.
4. Either test by hand and run `git bisect good` or `git bisect bad` each step, or automate: `git bisect run npx playwright test tests/checkout.spec.ts`.
5. Git prints the first bad commit. Read it with `git show <sha>`.
6. `git bisect reset` returns to your branch. 1000 commits need about 10 steps.

**Follow-ups:**
- *A commit that cannot be built or tested?* `git bisect skip`. Exit code 125 in a script means skip.
- *A flaky test as the script?* It misleads the search. Repeat the test several times inside the script, or bisect only with a reliable test.

**Trap:** Bisecting with a flaky test, which blames a random commit.

**Source:** https://git-scm.com/docs/git-bisect

### What branching strategies do you know?

Topic: git | Standard | id: q0759

**Say:** Trunk-based development: short-lived branches merged into main many times a day, supported by feature flags and good CI. GitHub flow: a branch per change, a pull request, review, merge to main. GitFlow: develop, feature, release and hotfix branches, heavier, used where releases are scheduled. If you have used pull requests, code review, protected main branches, tags and release branches, say how; if not, say so plainly. The more a team deploys, the shorter its branches should be.

**Follow-ups:**
- *What does the strategy mean for QA?* The more branches live in parallel, the more environments and merges to test, and trunk-based work needs feature flags and strong automated gates.
- *Release branches?* They hold a version while main moves on; fixes are cherry-picked from main.

**Trap:** Describing GitFlow as the one correct strategy.

**Source:** https://trunkbaseddevelopment.com/

### What is the difference between `git fetch` and `git pull`?

Topic: git | Standard | id: q0760

**Say:** `git fetch` downloads new commits and updates remote-tracking branches like `origin/main`, without touching the working copy. `git pull` is fetch plus an integration step, merge by default, or rebase with `--rebase`. Fetch first and look, then rebase or merge on purpose.

**Follow-ups:**
- *How do you see what a fetch brought?* `git log HEAD..origin/main` lists the new commits, and `git diff HEAD...origin/main` shows their changes.
- *What does `git pull --rebase` do?* It fetches, then replays my local commits on top of the upstream ones instead of merging.

**Trap:** Thinking `git pull` only downloads. It also merges, and that can create a merge commit or stop on a conflict. `git pull --ff-only` refuses anything that is not a fast-forward.

**Source:** https://git-scm.com/docs/git-fetch

### What is the difference between `git reset` and `git revert`?

Topic: git | Standard | id: q0761

**Say:** `git revert <sha>` makes a new commit that undoes an earlier one, so it is safe on shared history. `git reset` moves the branch pointer back: `--soft` keeps changes staged, `--mixed` keeps them unstaged, `--hard` throws them away. I use reset only on local, unpublished commits and revert on anything pushed.

**Follow-ups:**
- *Reverting a merge commit?* Needs `-m 1` to say which parent is the mainline. Re-merging the branch later needs the revert reverted first.
- *I reset hard by mistake.* `git reflog` lists where HEAD was, and `git reset --hard <sha>` returns to it.

**Trap:** Using reset on pushed commits and then force-pushing over colleagues.

**Source:** https://git-scm.com/docs/git-revert

### How do you inspect history and find who changed something?

Topic: git | Standard | id: q0762

**Say:** `git log --oneline --graph` for the shape, `git log -p -- <file>` for changes to a file, `git blame <file>` for who last changed each line, and `git log -S"text"` to find when a string appeared. `git diff main...HEAD` shows what my branch adds. `git status` first, always.

**Follow-ups:**
- *How do you find the commit that broke something?* `git bisect`: mark one bad and one good commit, then test each step it checks out.
- *How do you follow one function through history?* `git log -L :functionName:path/to/file`.

**Trap:** Reading `git blame` as "who introduced this". It shows who touched the line last, which may be a reformat or a move. Use `git log -S` or `git log -L` for the origin, or ignore the formatting commit with `--ignore-revs-file`.

**Source:** https://git-scm.com/docs/git-log

### How do you save unfinished work, or work on two branches at once?

Topic: git | Standard | id: q0763

**Say:** `git stash` shelves uncommitted changes and `git stash pop` brings them back. I commit instead of stashing when the work matters, because a conflict mid-rebase can leave a stash unapplied. For two branches at once I use `git worktree add`, which gives a second folder on another branch.

**Follow-ups:**
- *How do you remove a worktree?* `git worktree remove <path>`, and `git worktree list` shows what exists.
- *What if `git stash pop` conflicts?* The stash is kept, not dropped. Resolve the conflict, then drop it by hand.

**Trap:** Assuming `git stash` shelves new files. It leaves untracked files behind unless you add `-u`, and they can conflict later.

**Source:** https://git-scm.com/docs/git-stash

### What are the basic Git commands you use every day?

Topic: git | Standard | id: q0764

**Say:** `status`, `add`, `commit`, `diff`, `log`, `switch -c` for a branch, `fetch`, `rebase`, `push`. Before a commit I check the staged diff, and the commit title starts with the ticket id from the branch name.

**Follow-ups:**
- *How do you undo the last commit that is not pushed?* `git reset --soft HEAD~1` keeps the changes staged.
- *How do you undo a pushed commit?* `git revert <sha>` adds a new commit that reverses it. History stays intact.

**Trap:** Running `git add .` without looking, or force-pushing a shared branch. Check the staged diff first. Use `--force-with-lease` and only on a branch that is mine.

**Source:** https://git-scm.com/docs/git-diff

### How do you review a merge request as QA?

Topic: git | Standard | id: q0765

**Say:** I read the diff for behaviour, not style: edge cases, error paths, missing tests, and risky changes to shared code. I run the change when it affects user behaviour. Every comment states the problem, why it matters and a suggested fix. When I test someone else's merge request I report the defect with evidence and stop, instead of attaching my own fix.

**Follow-ups:**
- *What if the merge request has no tests?* I name the behaviour that is uncovered and ask for a test, or say the risk if the author skips it.
- *Do you block the merge?* Each finding gets a severity, and I say whether it blocks. A defect that breaks user behaviour blocks, a nit does not.

**Trap:** Approving because CI is green. A green pipeline shows that the tests that exist passed, not that the change is covered. Another miss is spending the review on style that a linter already checks.

**Source:** https://git-scm.com/docs/gitworkflows

## Linux, logs and observability

### Which Linux commands do you use to read log files?

Topic: linux-observability | Core | id: q0766

**Say:** `tail -f` to follow a log live, `less` to page through a big one with search, `grep` to filter, and `journalctl` for systemd services. I combine them: filter by a request id or time window so I read ten relevant lines and not ten thousand. For JSON logs I use `jq`.

**Full process:**
1. Follow live: `tail -f app.log`, with a filter: `tail -f app.log | grep --line-buffered ERROR`.
2. Search a window: `grep -n "req-8f3a" app.log`, with context `grep -C 5 "Exception" app.log`.
3. Page: `less +F app.log` (follow mode, Ctrl-C to scroll, `F` to follow again).
4. JSON: `jq 'select(.level=="error") | {time, msg}' app.log`.
5. Service logs: `journalctl -u myservice --since "10 min ago" -f`.
6. Count: `grep -c ERROR app.log`; top repeated errors: `grep ERROR app.log | sort | uniq -c | sort -rn | head`.

**Follow-ups:**
- *Why `--line-buffered`?* Without it `grep` buffers output in a pipe and shows nothing for a while.
- *Compressed logs?* `zgrep` and `zcat`.

**Trap:** Opening a huge log in an editor.

**Source:** https://www.gnu.org/software/grep/manual/grep.html

### A test failed. How do you use logs to find the cause?

Topic: linux-observability | Core | id: q0767

**Say:** I start from the test failure: the time, the user or request id, and the failing step. Then I follow that one request through the layers: the browser console and network in the trace, the API response, the server log in Kibana for that request, and errors in Sentry for the same time. The first layer where the story changes is where the cause is. I save the evidence at once, with a timestamp and the source, because logs rotate.

**Follow-ups:**
- *A passing UI hides a 406?* Check the receiver's log and response codes, not just that the configuration exists.
- *Timestamps differ?* Check time zones and precision before concluding anything.

**Trap:** Reading logs from "around the failure" without a request id.

**Source:** https://www.elastic.co/docs/explore-analyze/discover

### How do you use Sentry as a QA engineer?

Topic: linux-observability | Core | id: q0768

**Say:** Sentry groups production and test errors into issues, with stack trace, release, environment and breadcrumbs. I use it to check whether a bug I found has a matching error, how often it happens, which release introduced it, and whether a fix worked after deploy. In a release check I look for new issues in the release.

**Follow-ups:**
- *What goes in a bug report from Sentry?* The issue link, release, environment, count and the steps from the breadcrumbs.

**Trap:** Reading "no Sentry issue" as "no bug". Sentry sees only errors that were thrown and captured (and sampled). A wrong total or a broken layout produces no event.

**Source:** https://docs.sentry.io/product/issues/

### How do you use Kibana?

Topic: linux-observability | Core | id: q0769

**Say:** Kibana is the search interface for logs stored in Elasticsearch. In Discover I filter by time, service, level, and a request id, and add columns for the fields I read. I use it to find the server-side half of a failing test and to check whether an error is new or recurring.

**Follow-ups:**
- *Narrow the time range first?* Yes, a wide range is slow and noisy.
- *What is the ELK stack?* Elasticsearch to store and search, Logstash or shippers to collect and parse, Kibana to look.

**Trap:** Reading "no results" as "no error" with the wrong time range or index pattern. Check the range, the time zone and the index before concluding anything.

**Source:** https://www.elastic.co/docs/explore-analyze/discover

### Have you used Grafana or monitoring dashboards?

Topic: linux-observability | Core | id: q0770

**Say:** If you have used Grafana only in a previous role, say so, then explain what you looked at. For example: reading dashboards such as error rates and latency around a deploy is not the same as building dashboards or alerts, so say which one you did. The idea: metrics over time, with alerts on thresholds, so a regression after a release shows as a change in the graph.

**Follow-ups:**
- *Monitoring versus logging?* Metrics tell you that something changed; logs tell you why.

**Trap:** Reading a dashboard without checking the aggregation and time range. An averaged graph hides short spikes, so look at a high percentile such as p95, and compare with the deploy time.

**Source:** https://grafana.com/docs/grafana/latest/fundamentals/

### Do you use OpenTelemetry?

Topic: linux-observability | Standard | id: q0771

**Say:** OpenTelemetry has not been used. It is known as a vendor-neutral standard for traces, metrics and logs, with SDKs that instrument the application and a collector that sends data to a backend. For QA, the value would be a trace id that can be followed from a test request through services. Sentry, Kibana and Grafana have been used instead.

**Follow-ups:**
- *What are a trace and a span?* A trace is one request's path through the system. It is made of spans, and each span is one unit of work with a start, a duration and a parent.
- *What does the collector do?* It receives telemetry from the applications, processes it, and exports it to one or more backends.

**Trap:** Claiming it because you know the name.

**Source:** https://opentelemetry.io/docs/what-is-opentelemetry/

### What is observability, and how does it help testing?

Topic: linux-observability | Standard | id: q0772

**Say:** Observability means being able to understand what the system is doing from outside, through logs, metrics and traces. For testing it shortens diagnosis, and it lets me verify behaviour that the UI does not show, such as a message delivered or a job run. In production it catches what tests missed.

**Follow-ups:**
- *Monitoring and alerting?* Alerts should fire on symptoms users feel, with a threshold that does not page on noise.

**Trap:** Saying observability is just monitoring or dashboards. Monitoring watches for failures you predicted. Observability is being able to ask new questions of the data when something unexpected happens.

**Source:** https://opentelemetry.io/docs/what-is-opentelemetry/

### What basic Linux skills does a QA engineer need?

Topic: linux-observability | Standard | id: q0773

**Say:** Navigate and search files (`ls`, `find`, `grep`), read logs, check processes and ports (`ps`, `ss -ltnp`), disk and memory (`df -h`, `free -h`), file permissions (`chmod`, `ls -l`), environment variables, and `curl` to call an API. Plus shell exit codes, since CI decides pass or fail from them.

**Full process:**
1. A port is in use: `ss -ltnp | grep 3000`.
2. Disk full on the runner: `df -h`.
3. Check the status code only: `curl -s -o /dev/null -w "%{http_code}\n" https://host/health`.
4. Last command's result: `echo $?`.

**Follow-ups:**
- *Exit code in a pipe?* Only the last command's status counts unless `set -o pipefail` is on.

**Trap:** Not knowing that `grep` exits with 1 when nothing matches. In a script with `set -e` that stops the job, even though "no match" can be the expected result.

**Source:** https://man7.org/linux/man-pages/man1/tail.1.html

## Rare tools from the ads

### How would you use AWS CloudWatch or New Relic as a tester?

Topic: ops-monitoring | Niche | id: q0774

**Say:** These two have not been used directly. CloudWatch is AWS's service for logs, metrics and alarms, and New Relic is a commercial observability platform. As a tester, they would be used the same way as any monitoring: when a test fails, find the request in the logs by its ID and time. After a release, error rates and response times would be watched, and it would be checked that an alarm really fires.

**Source:** https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html and https://docs.newrelic.com/docs/new-relic-solutions/get-started/intro-new-relic/

### What is AWS AppConfig, and how do you test a feature behind it?

Topic: ops-monitoring | Niche | id: q0775

**Say:** AppConfig has not been used. It is an AWS service for feature flags and configuration, so behaviour can change in production without a new deployment, including a gradual rollout. Both flag states would be tested, plus the moment the flag changes while a user is mid-flow. What happens if the configuration can't be fetched would also be checked. The tests must set the flag themselves and not depend on what the environment happens to hold.

**Source:** https://docs.aws.amazon.com/appconfig/latest/userguide/what-is-appconfig.html
