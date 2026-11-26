# Performance, security, accessibility, compatibility and multi-tenant SaaS

How to study this file: the order is most-asked first. Performance and security are usually asked as "do you know the concepts", so learn the Say lines and the one-sentence definitions. The accessibility entries go deep, so practise the full process on a real page.

## Performance and load testing

### What is the difference between load, stress, soak and spike testing?

Topic: performance | Core | id: q0885

**Say:** They are the same kind of test with a different load shape and a different question. Load testing applies the expected normal traffic and asks: does the system meet its targets? Stress testing goes above the expected load and asks: where does it break, and how does it fail and recover? Soak testing, also called endurance, runs a normal load for many hours and asks: does anything degrade over time, for example a memory leak? Spike testing adds a sudden, short, huge jump in traffic and asks: does the system survive and recover? There is also a smoke test, a tiny run to prove the script works, and a breakpoint test that keeps raising load until it breaks.

**Full process:** How I turn the types into load shapes.
1. Smoke: 1 to a few virtual users for a minute. It proves the script and the environment work.
2. Load: ramp up to the expected peak, hold for 15 to 60 minutes, ramp down. Compare against the target numbers.
3. Stress: ramp past the expected peak in steps, for example 150% and 200%, and watch error rate and latency.
4. Spike: go from low load to a very high load in seconds, hold briefly, drop. Watch recovery time after the drop.
5. Soak: normal load for several hours. Watch memory, connections and disk on the server over time.
6. Breakpoint: keep raising the load until it fails, to find the capacity limit.
7. In every type: a simple ramp-up, plateau, ramp-down is enough. Avoid up-and-down rollercoaster patterns that make the results hard to read.

**Follow-ups:**
- *Which one do you run first?* Smoke, then load. Stress and soak come after you know the normal behaviour.
- *Are the names standard?* No. Teams use different names, so I confirm the meaning of the word before I plan.

**Trap:** Saying stress testing and load testing are the same. The difference is the question: meeting targets versus finding the breaking point.

**Source:** https://grafana.com/docs/k6/latest/testing-guides/test-types/

### Which performance metrics do you look at, and what are p95 and throughput?

Topic: performance | Core | id: q0886

**Say:** I look at response time, throughput, error rate and resource use. Response time is reported as percentiles, not as an average. The p95 is the value that 95% of requests are faster than, so it shows what the slow tail looks like, and the average hides it. Throughput is how many requests or transactions the system handles per second. Error rate is the share of failed requests. Resource use is CPU, memory, connections and disk on the servers. A good result needs all four together: fast but full of errors is not a pass.

**Full process:** Reading a result.
1. State the target first, for example "p95 under 500 ms for this query at 50 requests per second, with an error rate below 1%".
2. Run the test and collect samples with timestamps, status and response time.
3. Compute p50, p95 and p99 per request type. The JMeter HTML report has a statistics table with configurable percentiles.
4. Plot response time against active users and against throughput. A healthy system keeps response time flat while throughput grows, until a knee point where response time rises and throughput stops growing. That knee is the capacity limit.
5. Check the error table. Errors under load (timeouts, 5xx, 429) matter more than a slow success.
6. Compare with the previous baseline, not only with the target.

**Follow-ups:**
- *Why not the average?* One slow request in twenty barely moves the average, but the user who waits sees it. Percentiles show that.
- *What is latency versus response time?* Latency is the time to the first byte. Response time includes the full response. JMeter reports both.

**Trap:** Reporting only the average response time.

**Source:** https://jmeter.apache.org/usermanual/generating-dashboard.html

### What is JMeter, and how do you run a load test with it?

Topic: performance | Core | id: q0887

**Say:** JMeter is an open-source Java tool for load testing. It is not a browser, it sends protocol-level requests such as HTTP, so it does not run JavaScript or render pages. A test plan holds a thread group (the virtual users), samplers (the requests), timers (think time), assertions, and listeners for results. I build and debug the plan in the GUI, but I run the real load test in command-line mode, because the GUI uses too many resources and gives wrong numbers. A common use is a performance baseline for an API.

**Full process:** From plan to report.
1. Build the plan in the GUI: Test Plan, Thread Group (users, ramp-up, loop or duration), an HTTP Request sampler per call, a header manager for content type and auth, and assertions on status and body.
2. For GraphQL, send a POST with a JSON body that holds the `query` and `variables`, and assert on the data and on the absence of an `errors` field, because GraphQL often returns HTTP 200 with errors inside.
3. Parameterise users and ids from a CSV Data Set Config, and extract tokens or ids with a JSON Extractor so each virtual user has its own data.
4. Add timers so the load models real users and not a tight loop.
5. Debug with one thread and the View Results Tree. Then remove heavy listeners.
6. Run in command-line mode and generate the HTML report: `jmeter -n -t plan.jmx -l results.jtl -e -o report/`. The output folder must be empty or not exist. The `.jtl` file holds the raw samples.
7. Open `report/index.html`: statistics, percentiles, throughput, errors and graphs over time.
8. For large load, size the machine and the Java heap (the default is 1 GB), or run several command-line instances in distributed mode.

**Follow-ups:**
- *Why not run in the GUI?* The docs say not to run load tests in GUI mode, because it consumes resources and distorts the measurement.
- *What if JMeter itself is the bottleneck?* Then the numbers are wrong. Watch the load generator's CPU and network, and add machines.

**Trap:** Saying JMeter tests the browser or front-end rendering. It tests the server's response to requests.

**Source:** https://jmeter.apache.org/usermanual/get-started.html

### How would you find a performance bottleneck?

Topic: performance | Core | id: q0888

**Full process:** The approach, step by step.
1. Reproduce with a load test and note the load level where the response time starts to rise (the knee).
2. Split the response time per transaction. Which request type is slow?
3. Check the server side during the run: CPU, memory, garbage collection, thread pools, connection pools, and error logs.
4. Check dependencies: database queries (slow query log, `EXPLAIN`), external APIs, queues.
5. Compare client-side and server-side timing. If the server answers fast but the client sees it slow, look at the network or the load generator.
6. Form one hypothesis, change one thing (add an index, raise a pool, cache a call), rerun the same test, compare the percentiles.
7. Report with the before and after numbers and the evidence.

**Follow-ups:**
- *What is the most common cause?* Database queries without an index, and connection or thread pool limits. Check those first.
- *Who fixes it?* The developers or operations. QA finds, narrows and proves.

**Trap:** Claiming you found bottlenecks when you built baselines. The honest bounded answer plus a clear method is stronger.

**Source:** https://jmeter.apache.org/usermanual/best-practices.html

### What is k6, and how is it different from JMeter?

Topic: performance | Core | id: q0889

**Say:** If you have not used k6, say so plainly and explain the concept. k6 is an open-source load testing tool where tests are code, in JavaScript, and it fits well in a TypeScript or JavaScript team and in a CI pipeline. JMeter is Java-based and mostly configured through a GUI and XML test plans. k6 defines pass/fail rules in the script itself using thresholds, and it uses scenarios to describe the load shape. Choose k6 for tests that live in the repository and run in CI. JMeter has a large plugin ecosystem and a GUI that helps people who do not code.

**Full process:** What a small k6 test looks like (concept).

```ts
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get('https://staging.example.com/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```
1. Run it with `k6 run script.js`.
2. A `check` records a pass or fail but does not stop the test. A `threshold` is the rule for the whole run, and a failed threshold makes k6 exit with a non-zero code, which fails the CI job.
3. The `stages` ramp up to 20 users, hold, ramp down.

**Follow-ups:**
- *JMeter equivalents?* An assertion is close to a check. For a threshold there is no direct built-in equivalent, you add a gate on the report values in CI.

**Trap:** Saying you have used k6. Use the honest line: "not in production, here is how it works".

**Source:** https://grafana.com/docs/k6/latest/testing-guides/test-types/

### What are Core Web Vitals, and what are the good thresholds?

Topic: performance | Standard | id: q0890

**Say:** Core Web Vitals are three metrics from Google that describe the real user experience of a page. Largest Contentful Paint measures loading, and should be 2.5 seconds or less. Interaction to Next Paint measures how fast the page responds to input, and should be 200 milliseconds or less. Cumulative Layout Shift measures visual stability, the jumping of content, and should be 0.1 or less. A page passes when it meets the targets at the 75th percentile of real page loads, for mobile and desktop separately. INP replaced the older First Input Delay.

**Full process:** Measuring them.
1. Lab: open Chrome DevTools, the Lighthouse panel, and run an audit. This is a controlled run on one machine.
2. Field: use real user data, for example the PageSpeed Insights report with field data, or real user monitoring in the product.
3. Compare at the 75th percentile, split by mobile and desktop.
4. For a regression check in CI, use Lighthouse CI or a Playwright test that collects metrics, with budgets (for example LCP under 2.5 s on staging).
5. When a metric is bad, find the cause: a large hero image for LCP, long JavaScript tasks for INP, images without size for CLS.

**Follow-ups:**
- *Lab data or field data?* Lab data is repeatable and good for debugging. Field data is the truth about real users. I need both.
- *Why the 75th percentile?* So that most users, not only the best ones, get the good experience.

**Trap:** Naming First Input Delay as a current Core Web Vital.

**Source:** https://web.dev/articles/vitals

### What is Lighthouse, and what are its limits?

Topic: performance | Standard | id: q0891

**Say:** Lighthouse is an open-source tool from Google that audits a page for performance, accessibility, SEO and best practices. You run it in Chrome DevTools, from the command line or as a Node module, and it gives a score with a list of failed audits and how to fix them. Its limits: it is a lab run on one page in one state, so the score changes between runs and it does not show real user experience. And its accessibility score covers only the automatic checks, so a score of 100 does not mean the page is accessible.

**Full process:**
1. In Chrome, open DevTools, the Lighthouse tab, leave the categories on, and run the audit. It takes 30 to 60 seconds.
2. From the command line: `npm install -g lighthouse`, then `lighthouse https://staging.example.com --view`.
3. Run it several times and compare the median, because lab results vary.
4. Read the failed audits, each with an explanation and a fix.
5. For regressions, use Lighthouse CI to compare against a budget on every merge request.
6. Authenticated pages: use the DevTools workflow, which can audit logged-in pages.

**Follow-ups:**
- *Is a performance score of 90 enough?* It is a lab number for one device profile. I check the field data too.

**Trap:** Treating the Lighthouse accessibility score as a compliance statement.

**Source:** https://developer.chrome.com/docs/lighthouse/overview

### How do you handle dynamic values such as tokens and test data in a load test?

Topic: performance | Standard | id: q0892

**Say:** A load test must behave like many different real users, not like one user repeated. So take values that change out of the script: a login token, a session id, a csrf value, a record id. Log in as part of the flow and extract the token from the response, then send it in the next requests. For test data, give each virtual user its own account and its own records from a data file, so users do not conflict and the cache does not make the result too good.

**Full process:** In JMeter.
1. Put the usernames and passwords in a CSV file and read them with a CSV Data Set Config. Each thread takes the next line.
2. Add the login request. Add a JSON Extractor with the JSON path of the token, for example `$.data.login.token`, and save it in a variable such as `token`.
3. In a header manager for the next requests, set `Authorization: Bearer ${token}`.
4. For ids created during the test (an order id), extract them in the same way and use them in the next request.
5. Check with the View Results Tree in a one-thread debug run that each request used a different value.
6. Clean up: delete created data, or use a test environment that is reset.

**Follow-ups:**
- *Why not one shared token?* It does not reflect real sessions, and a rate limit or a single session can block the run.
- *What about data that expires?* Generate it before the run, or log in at the start of each iteration.

**Trap:** Replaying a recorded request with a hard-coded token. It works once and then fails with 401.

**Source:** https://jmeter.apache.org/usermanual/get-started.html

### How do you set up performance testing in a team that has none?

Topic: performance | Standard | id: q0893

**Say:** I would start small and make it routine. First agree the targets with the product owner and developers: the critical user flows, the expected load, and the response time and error limits. Then build a smoke-level script for the most important API calls, run it on a stable environment, and record a baseline. Then add a load test that runs on a schedule or before releases, and a threshold gate so a regression is visible. Only later add stress and soak. A baseline first, because without a reference nobody can say a result is bad.

**Full process:**
1. Choose the top 3 to 5 flows by business risk and usage.
2. Write the non-functional targets with the team (p95 and error rate per flow, expected requests per second).
3. Pick the tool the team can maintain. JMeter if QA is comfortable with it. A code-based tool if the team prefers code in the repository.
4. Use a dedicated environment that looks like production, with realistic data volume. A tiny dev database gives a false result.
5. Run a smoke test, then a baseline load test three times, and store the numbers.
6. Automate: a scheduled pipeline job that runs the test and fails when the threshold is crossed. Publish the report as an artifact.
7. Review the trend monthly and after each big change.

**Follow-ups:**
- *Where do you run it, production or staging?* Staging that mirrors production. Production only with care, with synthetic users, off-peak and agreement from operations.

**Trap:** Running a big test on a tiny dev environment and drawing conclusions about production.

**Source:** https://grafana.com/docs/k6/latest/testing-guides/test-types/

### How do you test the performance of the front end in an E2E suite?

Topic: performance | Standard | id: q0894

**Say:** I separate it from load testing. Load tests stress the server. Front-end performance is about what one user feels: load time, interaction speed and layout stability. In an E2E suite I can collect the page timings and fail on a budget, and I run Lighthouse on key pages. I keep these checks few and tolerant, because timing in CI is noisy, so I use budgets with margins and compare trends instead of failing on a single slow run.

**Full process:**
1. Choose key pages (landing, dashboard, checkout).
2. In Playwright, read navigation timing from the page after load, for example `await page.evaluate(() => JSON.stringify(performance.getEntriesByType('navigation')[0]))`, and assert that `domContentLoadedEventEnd` is under a generous budget.
3. Run Lighthouse separately for the full metric set and compare with the previous run.
4. Run on a stable runner with the same size each time, so results are comparable.
5. Keep the budgets loose (for example 20% above the baseline) and review them when they drift.
6. Store the numbers over time and look at the trend.

**Follow-ups:**
- *Why not fail a test on every slow run?* CI machines vary, so a hard limit creates flaky tests. A budget with margin and a trend is more reliable.

**Trap:** Putting precise timing assertions on a shared CI runner.

**Source:** https://developer.chrome.com/docs/lighthouse/overview

### Why do tests that pass in headed mode fail in headless mode, and what does it say about performance?

Topic: performance | Standard | id: q0895

**Say:** Mostly it is timing and environment, not a bug in the browser mode. Headless runs faster and has no real window, so there are differences in viewport size, focus, fonts, GPU and timing. A test that relied on a lucky delay passes in headed mode where things are slower, and fails when everything happens faster. So I treat it as a race in the test or the app: I fix the wait condition, set a fixed viewport, and run in the same mode as CI while debugging. I do not add sleeps.

**Full process:**
1. Reproduce in the mode that fails, in the same container as CI if possible.
2. Record a trace and compare the timeline.
3. Look for waits on time and not on a condition, elements outside the viewport, and focus-dependent behaviour.
4. Set the viewport and locale explicitly in the config so both modes match.
5. Fix the race. Prove the fix with repeated runs.

**Follow-ups:**
- *What proof do you give?* A repeat run, for example 200 runs with 0 failures.

**Trap:** Increasing timeouts globally.

**Source:** https://playwright.dev/docs/emulation

### What are the stages of a performance test, from planning to report?

Topic: performance | Standard | id: q0896

**Say:** I follow the same lifecycle each time. Plan: agree the goals, the critical flows, the expected load and the pass criteria. Prepare: build the scripts, the test data and an environment that looks like production. Run: smoke first, then the real test, while monitoring the servers. Analyse: read percentiles, errors and resource use, and find the cause of problems. Report: say clearly if the targets were met, with numbers and a recommendation, and keep the results as a baseline for the next run.

**Full process:**
1. Goals and criteria: for example "p95 under 500 ms and error rate under 1% at 50 requests per second".
2. Workload model: which flows, in what mix, with what think time, how many users, and how they ramp up.
3. Environment and data: similar size to production, with realistic data volume and no other test running at the same time.
4. Script and debug with one user. Run a smoke test.
5. Execute the load test and watch monitoring (CPU, memory, database, logs).
6. Analyse: compare with criteria and with the previous baseline. Find the knee point.
7. Report: one page with the verdict, the numbers, the risks and the next step. Attach the raw results.
8. Store the baseline and rerun after significant changes.

**Follow-ups:**
- *What makes a result untrustworthy?* A load generator that is itself overloaded, an environment that differs from production, and no baseline.

**Trap:** Starting with the tool and no targets.

**Source:** https://jmeter.apache.org/usermanual/get-started.html

### What are virtual users, ramp-up and think time, and why do they matter?

Topic: performance | Standard | id: q0897

**Say:** A virtual user is a simulated user that runs the test script in its own thread. Ramp-up is how long the test takes to start all users, so the load grows gradually and the system is not hit all at once, unless you want a spike. Think time is the pause between a user's actions, because real people read and click slowly. Without think time, a hundred users produce a much heavier load than a hundred real people, so the result says nothing about real traffic. These three settings define the workload, so I choose them from real usage.

**Full process:** In JMeter.
1. Thread Group: number of threads (virtual users), ramp-up period in seconds, and loop count or duration.
2. Example: 50 threads and a 60 second ramp-up start about one new user per 1.2 seconds.
3. Add a timer (for example a Uniform Random Timer) between requests to model think time.
4. Derive numbers from production: peak concurrent users and requests per second from the analytics or logs.
5. Check the achieved throughput in the report matches the target, and adjust users or timers.
6. Watch for coordinated omission: if the load generator is too slow, it sends fewer requests than planned and hides the slow responses. The JMeter best practices describe sizing threads correctly for this.

**Follow-ups:**
- *Users or requests per second as the target?* Both views matter. Closed models fix the number of users, open models fix the arrival rate. k6 documents both.

**Trap:** Removing think time to "push harder" and then reporting the result as normal-load behaviour.

**Source:** https://jmeter.apache.org/usermanual/best-practices.html

## Security testing for a QA

### What is the OWASP Top 10, and how does it apply to a QA engineer?

Topic: security | Standard | id: q0898

**Say:** The OWASP Top 10 is a standard awareness list of the most critical web application security risks, made from a broad consensus. The current edition is 2025. It starts with Broken Access Control, then Security Misconfiguration, Software Supply Chain Failures, Cryptographic Failures, Injection, Insecure Design, Authentication Failures, Software or Data Integrity Failures, Security Logging and Alerting Failures, and Mishandling of Exceptional Conditions. The 2021 edition, which many articles still quote, listed Server-Side Request Forgery on its own, and in 2025 it sits inside Broken Access Control. As a QA I do not do penetration testing, but I turn the list into test ideas: access control checks, input handling, login and session behaviour, headers and error messages. My real level is basics, mainly role permissions.

**Full process:** How I use the list as a test checklist.
1. Broken access control: for each role, try each action and each URL as another role and as an anonymous user.
2. Injection and XSS: send special characters and script strings into inputs, and check for errors and unescaped output.
3. Authentication: wrong password limits, session expiry, logout invalidation, password reset behaviour.
4. Misconfiguration: error pages that show stack traces, default accounts, open admin paths, missing security headers.
5. Outdated components: run the dependency audit in CI (`npm audit`) and read the result.
6. Log what I find with the steps, expected and actual, and the risk in plain language.

**Follow-ups:**
- *Which edition is current?* The 2025 edition is final and replaces 2021. Many articles still quote the 2021 numbers, so I name the year when I give a rank.

**Trap:** Reciting the list without saying what you would test.

**Source:** https://owasp.org/Top10/2025/

### What is the difference between QA security testing and penetration testing?

Topic: security | Standard | id: q0899

**Say:** QA security testing is part of normal testing: checking permissions, input validation, session handling and configuration as the test cases are designed, and running automated scans. A penetration test is a focused, time-boxed attack on the system by security specialists, who try to exploit weaknesses with their own tools and techniques, and it produces a report of vulnerabilities. QA catches the common and obvious problems early and cheaply. A pentest goes deeper and is needed before major releases or for compliance. They complement each other.

**Full process:**
1. QA: add security cases to the test design (roles, invalid input, session), run a scanner such as OWASP ZAP against staging, and add regression tests for each fixed security bug.
2. Pentest: arrange scope, rules and a time window with the security team or an external company. Provide test accounts.
3. Triage the findings with severity, assign them, and retest after the fix.
4. Add regression tests for the fixed issues.

**Follow-ups:**
- *Do you run scanners on production?* No. Only on staging or with explicit agreement, because active scans can damage data.

**Trap:** Saying "QA replaces the pentest".

**Source:** https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References

### What is SQL injection and how do you test for it?

Topic: security | Standard | id: q0900

**Say:** SQL injection happens when user input goes into a SQL query as part of the query text, so an attacker can change what the query does. It can leak data, change data, bypass login or even run commands on the database server. The fix is parameterised queries, not string building. To test it, I send special characters such as a single quote into inputs and parameters and watch for database errors, changed results or different behaviour. I do this on a test environment only. For full coverage I rely on a scanner or a security specialist.

**Full process:**
1. Find the inputs that probably reach a query: search boxes, filters, ids in URLs, login fields, sort parameters.
2. Send a single quote `'`. A database error message or a 500 suggests the input is placed in the query.
3. Send a harmless logic probe such as a value that makes a condition always true on a test account, and compare with the normal result. A different result is a finding.
4. Report the input, request, response and the risk. Do not extract real data.
5. Retest after the fix: the same input should now be treated as plain text.
6. For the developers: parameterised queries and least-privilege database accounts. This follows the OWASP prevention cheat sheets.

**Follow-ups:**
- *What is blind SQL injection?* The page does not show errors or data, so the attacker infers the result from behaviour such as different responses or timing. Testing needs a scanner or specialist tools.
- *Does an ORM protect you?* Mostly, unless raw queries are built from input.

**Trap:** Proposing escaping as the main fix. Parameterised queries are.

**Source:** https://owasp.org/www-community/attacks/SQL_Injection

### What is XSS, and how do you test for it?

Topic: security | Standard | id: q0901

**Say:** Cross-site scripting is when an application puts user input into a page without encoding it, so the browser runs the attacker's script in the victim's session. It can steal session data or change the page. There are three kinds: reflected, where the script comes back from the request, stored, where it is saved and shown to other users, and DOM-based, where client-side code writes it into the page. To test, I enter a harmless marker with HTML characters into fields and check whether it appears as plain text or as markup. A good defence is output encoding plus a Content Security Policy.

**Full process:**
1. List where user text is displayed: names, comments, search results, error messages, rich text.
2. Enter a safe test string such as `<b>test</b>` and see if it renders as bold (a sign that it is not encoded) or shows as text.
3. If it renders, report it. A real proof of concept is a script that shows an alert, but only in a test environment.
4. Check stored fields from a second account, because stored XSS hits other users.
5. Check the response headers for a `Content-Security-Policy` header.
6. A Playwright regression test can submit the marker and assert the page shows it literally:

```ts
import { test, expect } from '@playwright/test';

test('comment text is shown literally', async ({ page }) => {
  await page.goto('/comments');
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('<b>x</b>');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('<b>x</b>', { exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *What does CSP do?* It tells the browser which sources of scripts are allowed, which limits the damage of an injected script. It is a second layer, not a replacement for encoding.

**Trap:** Saying input validation alone prevents XSS. Output encoding in the right context is the main defence.

**Source:** https://owasp.org/www-community/attacks/xss/

### What is CSRF, and how do you test for it?

Topic: security | Standard | id: q0902

**Say:** Cross-site request forgery tricks a logged-in user's browser into sending a request to a site, and the browser attaches the user's cookies automatically, so the site thinks the user did it. It targets state-changing requests, like changing an email or transferring money. The defences are anti-CSRF tokens, SameSite cookies and checking the request origin. To test, I check that a state-changing request fails without a valid token, and that the cookies have a SameSite attribute.

**Full process:**
1. Find a state-changing request (POST, PUT, DELETE) in the browser Network tab.
2. Replay it without the CSRF token, or with a token from another session, using the API client. Expect a rejection (403 or similar).
3. Check that actions are not done through GET requests, because a link or an image tag can trigger a GET.
4. Look at the `Set-Cookie` header for `SameSite` and `HttpOnly` and `Secure` attributes.
5. Report missing protection with the request and the consequence.

**Follow-ups:**
- *Does JSON-only API prevent CSRF?* Not automatically. It depends on how authentication is sent, and cookie-based sessions still need protection.
- *CSRF versus XSS?* CSRF abuses the browser's trust in the cookie. XSS runs attacker code inside the site.

**Trap:** Mixing up CSRF and XSS.

**Source:** https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF

### What is IDOR / broken access control, and how do you test it?

Topic: security | Standard | id: q0903

**Say:** Insecure direct object reference means the app uses an id from the request to fetch an object, and does not check that the current user may see it. Change `invoice=12345` to `invoice=12346` and you see someone else's invoice. It is part of Broken Access Control, number one in the OWASP Top 10, in both the 2021 and 2025 editions. To test, I use two accounts, and I try to read or change the second account's objects with the first account's session. This is my strongest security area, because it is role and permission testing.

**Full process:**
1. Create two users in the same role and one admin, each with their own objects.
2. As user A, record a request that reads or edits A's object. Note the id in the URL, body or query.
3. Replace the id with user B's object id. Send it with A's token.
4. Expect 403 or 404 and no data. A 200 with B's data is a defect.
5. Repeat for each action (read, update, delete) and for files and exports.
6. Repeat vertically: as a normal user, call admin-only endpoints directly, not through the UI.
7. Automate the matrix as API tests: for each role and endpoint, the expected status.

**Follow-ups:**
- *Why not hide the button?* Hiding a button in the UI is not access control. The server must check.
- *Which id style is safer?* Random ids make guessing harder, but the check must exist anyway.

**Trap:** Testing permissions only through the UI.

**Source:** https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References

### How do you test authentication and sessions?

Topic: security | Standard | id: q0904

**Say:** I check the login, the session and the logout from the user's side and the request side. Wrong passwords should give a generic message and eventually a limit. A session should expire and should end on logout, so an old token no longer works. Passwords must not be visible in URLs, logs or responses. Reset links should expire and work once. Cookies should be marked HttpOnly and Secure. I would not claim deep authentication testing, but these are the basics that every login should pass.

**Full process:**
1. Wrong password five times. Expect a generic error that does not reveal whether the user exists, and a lockout or delay as the product defines.
2. Log in, copy the session token or cookie, log out, replay an authenticated request with the old token. Expect 401.
3. Leave a session idle past the expiry. Expect re-login.
4. Password reset: use the link twice, and after the expiry. Expect failure.
5. Open the Network tab at login and check that the password is not in the URL and that credentials travel over HTTPS only.
6. Check cookie flags in the browser developer tools.
7. Token in the API (JWT, bearer): check that a changed or expired token is rejected, and that a token from another user cannot access this user's data.

**Follow-ups:**
- *What is the difference between authentication and authorization?* Authentication proves who you are. Authorization decides what you may do.

**Trap:** Verifying only that a valid login works.

**Source:** https://owasp.org/Top10/2021/

### What are security headers and what does QA check?

Topic: security | Standard | id: q0905

**Say:** Security headers are response headers that tell the browser to apply protections. The important ones are Content-Security-Policy against injected scripts and clickjacking, Strict-Transport-Security to force HTTPS, X-Content-Type-Options to stop content sniffing, and a framing policy. I check that they exist on the main pages and on API responses where relevant, and that cookies have the Secure, HttpOnly and SameSite flags. Missing headers are a configuration finding, usually low or medium risk.

**Full process:**
1. Open the Network tab, select the document request, and read the response headers.
2. Or from the terminal: `curl -sI https://staging.example.com` and read the output.
3. Check `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, and the framing control (the CSP `frame-ancestors` directive, or the older `X-Frame-Options`).
4. Check `Set-Cookie` flags.
5. A Playwright check:

```ts
import { test, expect } from '@playwright/test';

test('main page sends a CSP header', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toBeTruthy();
});
```
6. Report missing or weak settings with the header and a suggested value from the OWASP or MDN guidance.

**Follow-ups:**
- *Is the old X-XSS-Protection header useful?* No, modern browsers ignore it and CSP replaced it.

**Trap:** Setting `unsafe-inline` everywhere to make CSP pass. It removes most of the protection.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP

### How do you handle personal data and GDPR in test data?

Topic: security | Standard | id: q0906

**Say:** The rule is data minimisation: do not use real personal data in test environments unless there is a lawful reason and protection. GDPR says personal data must be limited to what is necessary for the purpose and kept no longer than needed. Prefer synthetic data, and when realistic data from production is needed, scrub it before it reaches a test system. Example: sampling production support tickets, scrubbing them with a rule-based pass and an LLM detector, reviewing samples by hand, and then importing 976 tickets into a dev project.

**Full process:** The data scrubbing steps, as a repeatable process.
1. Define the purpose: why the real-shaped data is needed (comparing two versions of a data pipeline).
2. Sample from production with a small, defined query, and keep only the fields the test needs.
3. First pass, rules: patterns for emails, phone numbers, names in known fields, ids, links with tokens, and replace them with placeholders.
4. Second pass: a detector (an LLM in this case) flags remaining personal data in free text.
5. Human review of a sample of the output, to measure what the automatic passes missed. Repeat until the sample is clean.
6. Import into the dev environment only, access-limited, with a retention date.
7. Keep a record of what was done, the counts and the checks.

**Follow-ups:**
- *Is masked data still personal data?* If it can be linked back to a person it is pseudonymised, and still covered by GDPR. True anonymisation cannot be reversed.
- *Why not copy production?* Test systems have weaker access control, and more people see the data.

**Trap:** Saying "we replaced the names, so it is anonymous". Free text, ids and combinations can still identify a person.

**Source:** https://gdpr-info.eu/art-5-gdpr/

### How do you handle secrets and credentials in test code?

Topic: security | Standard | id: q0907

**Say:** Never in the repository. Secrets go into the CI secret store or an environment, and the code reads them at runtime. Test code that needs a login uses test accounts with the least permission needed, not personal or admin accounts. I add checks so secrets cannot be committed, and I rotate them when they leak. If you have built a CI token that expires and rotates before expiry, so tests fail with a clear message and not silently, and an export endpoint that rejects every request when its token is not set, mention that.

**Full process:**
1. Put secrets in the CI variables, masked, and read them in code from `process.env`.
2. Fail fast with a clear message when a required variable is missing:

```ts
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```
3. Keep `.env` files out of the repository with `.gitignore`.
4. Use separate test accounts with limited roles per environment.
5. Do not print secrets in test logs or traces. Check that trace and report artifacts do not contain tokens.
6. If a secret is committed, treat it as leaked: revoke and rotate, then clean the history.

**Follow-ups:**
- *What about HAR files and traces?* They can contain tokens and cookies, so I do not share them outside the team without cleaning.

**Trap:** Committing a `.env.example` with real values.

**Source:** https://owasp.org/Top10/2021/

### How do you test API security as a QA?

Topic: security | Standard | id: q0908

**Say:** Test that the API enforces what the UI only suggests. For each endpoint, try it without a token, with an expired or wrong token, with another user's token, and with another role. Send unexpected input: wrong types, very long values, extra fields. Check that errors do not leak internal details, that rate limiting exists on login, and that responses do not contain more data than the client needs.

**Full process:**
1. Collect the endpoints from the OpenAPI spec or the collection.
2. For each one write the matrix: no token, valid token with the right role, valid token with the wrong role, another user's object. Expect 401, 200, 403, 403 or 404.
3. Send bad input: string for a number, negative numbers, empty body, 1 MB text, extra unknown fields (mass assignment: try setting `role` or `isAdmin` in a profile update).
4. Check error bodies for stack traces, SQL errors or internal paths.
5. Check the response fields for data the client should not receive, such as password hashes or other users' emails.
6. Check rate limiting: repeat a login many times and expect 429 or a lockout.
7. Automate the matrix in the API test suite so a new endpoint without a check is noticed in review.

**Follow-ups:**
- *What is mass assignment?* The API accepts fields from the client that should be server-controlled, so a user can promote themselves.

**Trap:** Testing only with the admin token you used to build the test.

**Source:** https://owasp.org/Top10/2021/

### Which security tools have you used or would you use?

Topic: security | Standard | id: q0909

**Say:** If your own use is basic, say so: the browser developer tools and an API client to replay requests with changed tokens and ids, and Charles Proxy to inspect traffic. For scanning, OWASP ZAP is an open-source proxy and scanner, and Burp Suite is used by security testers for manual testing. Run ZAP against a staging environment as a baseline scan in CI and read the findings, and leave deep exploitation to security specialists. If you have not done penetration testing, say so.

**Full process:** A baseline scan I would set up.
1. Run ZAP against a staging URL that I own, with permission. Use the passive baseline scan first because it does not attack.
2. Provide an authenticated session through a login script or a token, otherwise ZAP sees only the login page.
3. Export the report and triage: false positives, informational, and real findings.
4. Open tickets for real findings with the evidence and the fix hint.
5. Add the scan to the nightly pipeline and track the count of findings.

**Follow-ups:**
- *Why not scan production?* Active scans can create data, trigger alerts and cause outages.

**Trap:** Claiming Burp or ZAP expertise.

**Source:** https://owasp.org/Top10/2021/

### What is security misconfiguration, and how do you find it?

Topic: security | Standard | id: q0910

**Say:** It means the system is deployed with unsafe settings: default accounts, debug mode on, verbose error pages that show stack traces, open admin pages, directory listing, missing security headers, or cloud storage that is public. It is in the OWASP Top 10 and it is easy for QA to find, because it shows in responses and in the behaviour of the deployed environment. I check error pages, the headers, the admin paths and the difference between environments.

**Full process:**
1. Trigger an error on purpose (a bad id, a broken request). Expect a generic message, not a stack trace or a file path.
2. Check common admin and debug paths on staging with permission, such as an admin page without login.
3. Read response headers for the security headers and for version leaks (a header that names the exact server version).
4. Check default credentials on tools in the environment.
5. Compare staging and production settings in the checklist.
6. Report each finding with the request, the response and the risk.

**Follow-ups:**
- *Who fixes it?* Usually the developers or operations. Findings are cheap to fix, so QA reports them early.

**Trap:** Ignoring "low" findings. Several small leaks combine into a real attack path.

**Source:** https://owasp.org/Top10/2021/

### How do you check vulnerable and outdated dependencies?

Topic: security | Standard | id: q0911

**Say:** I use the dependency audit tools as a pipeline step, not as a one-off. For a Node project the package manager has an audit command that compares installed versions to known vulnerabilities, and a bot opens update pull requests. I read the result by severity and by whether the vulnerable code is reachable, because many findings are in development-only dependencies. In the OWASP 2025 list this risk sits in A03 Software Supply Chain Failures. In 2021 it was A06 Vulnerable and Outdated Components.

**Full process:**
1. Run `npm audit` (or the equivalent for the package manager) in CI, in the install stage.
2. Fail the job on high or critical findings in production dependencies. Report the rest.
3. Read each finding: which package, which path, is it a production or development dependency, is a fixed version available.
4. Update in a small pull request, run the tests, and merge.
5. If no fix exists, record the risk, the reason and a review date.
6. Keep the lock file committed, so builds use known versions.

**Follow-ups:**
- *Does a clean audit mean secure?* No. The audit knows only published vulnerabilities.

**Trap:** Running `npm audit fix --force` blindly, which can introduce breaking upgrades.

**Source:** https://owasp.org/Top10/2025/

### Where in the process should QA do security testing?

Topic: security | Standard | id: q0912

**Say:** As early as the design, because a design flaw costs far more to fix later. In refinement I ask the security questions: who can see this, who can change this, what is sent where. In development, I add permission cases and bad input cases to the test design, and run dependency and static checks in the pipeline. Before release I run the security regression suite and a scanner against staging. After a security bug, I add a regression test so it cannot return. Specialists do the deep penetration testing.

**Full process:**
1. Refinement: add acceptance criteria for roles and data access.
2. Test design: a role by action matrix and negative input cases.
3. Pipeline: dependency audit, secret scanning, and the automated permission API tests.
4. Staging: a baseline scan with a scanner.
5. Release: review open security findings in the go or no-go decision.
6. After a fix: add a regression test.

**Follow-ups:**
- *Manual or automated?* Automate the repeatable checks (permissions, headers, dependencies). Keep manual exploration for logic flaws.

**Trap:** Leaving security to the end of the project.

**Source:** https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References

## Accessibility

### What is WCAG, and what are the levels A, AA and AAA?

Topic: a11y | Niche | id: q0913

**Say:** WCAG, the Web Content Accessibility Guidelines, is the international standard from the W3C for making web content accessible to people with disabilities. It is organised in four principles: perceivable, operable, understandable and robust. WCAG 2.2 has 13 guidelines, and each guideline has testable success criteria at three levels. Level A is the minimum, AA is the common target, and AAA is the highest, and it is not expected for a whole site because some criteria cannot be met for all content. Most laws and contracts ask for AA. Version 2.2 was published in October 2023 and added 9 new success criteria.

**Full process:** How I use the levels in practice.
1. Ask which version and level the product commits to (usually WCAG 2.1 or 2.2 level AA).
2. Use the WCAG Quick Reference to filter the success criteria for that level.
3. Turn each relevant criterion into a check in the test plan, for example 1.4.3 Contrast (Minimum) is a check on every text colour pair.
4. Test with automated tools first, then manual keyboard and screen reader checks for what tools cannot decide.
5. Record each issue with the criterion number, so the fix has a clear target.
6. Re-test after the fix and add an automated regression check where one can exist.

**Follow-ups:**
- *What changed from 2.1 to 2.2?* Nine new success criteria, for example Focus Not Obscured and Target Size. The old 4.1.1 Parsing criterion was removed as obsolete.
- *Does a site "conform to AAA"?* Rarely. The standard itself says it is not recommended as a general policy.

**Trap:** Saying AAA is the goal for every site, or mixing up levels with versions.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/

### What are the four WCAG principles, with an example of each?

Topic: a11y | Niche | id: q0914

**Say:** Perceivable means users can perceive the content: text alternatives for images, captions for video, sufficient contrast. Operable means users can operate the interface: everything works with a keyboard, there is enough time, no seizure-causing flashes, clear focus. Understandable means the content and the interface are clear: readable language, predictable navigation, helpful error messages on forms. Robust means the content works with current and future assistive technology, which in practice means correct names, roles and states in the markup.

**Full process:** A one-page example per principle, as test cases.
1. Perceivable: every informative image has an `alt` text. A decorative one has `alt=""`. Text contrast is at least 4.5 to 1 for body text.
2. Operable: tab through the page, every control is reachable and usable, focus is visible, there is no keyboard trap.
3. Understandable: the page language is set (`lang` attribute), form errors name the field and say how to fix it, labels are visible.
4. Robust: custom controls have the right role, name and state, so a screen reader announces them correctly. Use native HTML elements where possible.
5. Map each failed check to its criterion number in the bug.

**Follow-ups:**
- *Which principle do automated tools cover best?* Robust, parts of perceivable (contrast, alt presence). Operable and understandable need manual checks.

**Trap:** Listing the principles without examples.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/

### What is the accessibility tree, and what are accessible role and name?

Topic: a11y | Niche | id: q0915

**Say:** The browser builds the DOM from the HTML, and from the DOM it builds an accessibility tree. That tree is what screen readers and other assistive technology read, through platform accessibility APIs. Each node has a name, a description, a role and a state. The role says what it is (button, link, checkbox, heading). The name says what to call it, for example "Send". The state says things like checked or expanded. If the tree is wrong, a screen reader user hears the wrong thing, even when the page looks fine.

**Full process:** Inspecting it.
1. Chrome DevTools, Elements panel, the Accessibility tab: select an element and read its computed name, role and states.
2. Playwright: an ARIA snapshot of a locator shows the roles and names that tests will see, for example `await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toMatchAriaSnapshot()` against a stored template.
3. Compare the tree with the visual page. A button made from a `div` has no role, so it is missing from the tree as a button.
4. Name sources, in order of precedence: `aria-labelledby`, `aria-label`, the native label (associated `<label>`, `alt`), then the element's own text content for roles that take their name from content (button, link), and `title` as a last fallback.
5. Fix the problem in the markup, not in the test.

**Follow-ups:**
- *Which name wins, aria-label or the visible text?* `aria-label` overrides the visible text for the accessible name, which is a common cause of the "label in name" problem. The visible text should be part of the accessible name.

**Trap:** Thinking a good-looking page has a good accessibility tree.

**Source:** https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree

### What is the first rule of ARIA, and when do you use ARIA at all?

Topic: a11y | Niche | id: q0916

**Say:** The first rule is to use a native HTML element when one exists, and add ARIA only when it does not. A real button already has the role, the keyboard behaviour and the focus. A div with `role="button"` has only the label, and the developer must add everything else. The APG says a role is a promise that the keyboard behaviour exists, and that no ARIA is better than bad ARIA. I use ARIA for things HTML cannot express: live regions, expanded and pressed states on custom widgets, labels for icon-only buttons, and landmarks.

**Full process:** Checking ARIA in a review.
1. Find every `role=` and `aria-*` in the changed code.
2. Ask if a native element does the job: `<button>`, `<a href>`, `<input>`, `<nav>`, `<main>`, `<dialog>`.
3. If a custom role stays, check the promise: keyboard (Enter and Space for a button, arrows for tabs and menus), focus handling, and state updates (`aria-expanded` changes when it opens).
4. Check for conflicts: `aria-label` on an element whose visible text differs, `role="presentation"` on something focusable, `aria-hidden="true"` on a focusable element.
5. Test with the keyboard first, then with a screen reader.
6. Use the ARIA Authoring Practices Guide patterns for the expected behaviour of each widget.

**Follow-ups:**
- *Is more ARIA better?* No. Wrong ARIA misleads assistive technology and is worse than none.
- *Example of a misuse?* `<ul role="navigation">` removes the list semantics from the items.

**Trap:** Adding `aria-label` everywhere to silence a scanner.

**Source:** https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/

### How do you test keyboard accessibility? Walk me through your process.

Topic: a11y | Niche | id: q0917

**Say:** I put the mouse away and use only the keyboard. I press Tab and Shift+Tab through the whole page and check that every interactive element is reachable, that the order matches the visual order, and that a visible focus indicator shows where I am. I operate each control: Enter or Space for buttons, arrows for menus and tabs, Escape to close dialogs. I look for keyboard traps, where focus gets stuck, and for focus that disappears when a dialog opens or closes. This is the most valuable manual check, and it fits criteria like 2.1.1 Keyboard and 2.4.7 Focus Visible.

**Full process:** A checklist for a single-page application.
1. Load the page, press Tab once. Expect the first focus on a skip link or the first control.
2. Tab through the page. Note the order. Expect it to follow the reading order.
3. Check every focused element has a clearly visible outline. Check it is not hidden behind a sticky header or banner (WCAG 2.2, 2.4.11 Focus Not Obscured).
4. Activate each control with the keyboard. A custom dropdown must open with Enter or arrow keys and choose with arrows and Enter.
5. Open a modal. Expect focus to move inside, Tab to stay inside (a trap that is allowed and expected for a modal), Escape to close, and focus to return to the trigger.
6. Route change in the SPA: expect focus or an announcement that the new view loaded, not focus left on a removed element.
7. Check there is no keyboard trap outside modals, and no element reachable only by mouse (hover menus).
8. Automate part of it in Playwright:

```ts
import { test, expect } from '@playwright/test';

test('modal returns focus to its trigger on Escape', async ({ page }) => {
  await page.goto('/settings');
  const trigger = page.getByRole('button', { name: 'Delete account', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Delete account', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Delete account', exact: true })).toBeHidden();
  await expect(trigger).toBeFocused();
});
```

**Follow-ups:**
- *Common focus bugs?* Focus lost after a dialog closes, focus order different from visual order from positive `tabindex`, focus trapped in a widget, and focus hidden by an overlay.
- *Why `getByRole` here?* It uses the same accessible names assistive technology uses, so the test fails if the name is missing.

**Trap:** Checking only that Tab reaches the elements, and not the visible focus and the dialog behaviour.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

### How do you test with a screen reader? What do you check?

Topic: a11y | Niche | id: q0918

**Say:** Use a real screen reader, NVDA on Windows, VoiceOver on Mac and iOS, and TalkBack on Android, and listen. Check that headings and landmarks give a good outline, that every control announces name, role and state, that images have meaningful alternatives, that form fields announce their label and errors, and that dynamic changes such as toasts and validation messages are announced. A page that looks fine can be unusable by ear, so this finds what scanners cannot. If you have done this with NVDA, VoiceOver and TalkBack together with keyboard-only navigation, mention that.

**Full process:**
1. Start the screen reader (NVDA, or VoiceOver with Cmd+F5). Close your eyes or turn the screen off for the key flows.
2. Navigate by headings (H in NVDA browse mode) and by landmarks. Expect a logical outline: one h1, then sections.
3. Move through a form. Each field announces its label, its type and whether it is required. Submit with errors. Expect the error to be announced, and focus to move to the first invalid field or an error summary.
4. Trigger a dynamic update (a toast, a loaded result). Expect it announced through a live region (`role="status"` or `aria-live="polite"`) without moving focus.
5. Check custom widgets: a tab list announces "tab, selected, 1 of 3".
6. Understand modes: browse mode, where arrows read the page, and focus mode, where keys go to a form control. Screen readers switch to focus mode in form fields.
7. Record which screen reader and browser combination you tested, because behaviour differs.

**Follow-ups:**
- *Browse mode versus focus mode?* In browse mode the screen reader intercepts keys to read the page. In focus mode, keys go to the control, for example typing in a text field.
- *Do you test with all of them?* I test the main flows with one primary combination and spot-check others.

**Trap:** Using a screen reader only to confirm what the scanner already said.

**Source:** https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/

### How do you use axe in Playwright, and what does the CI setup look like?

Topic: a11y | Niche | id: q0919

**Full process:**
1. Install: `npm i -D @axe-core/playwright`.
2. Write the test:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('settings page has no detectable WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });
  expect(results.violations).toEqual([]);
});
```
3. Scan interactive states: open the menu or dialog first, wait for it, and then scan, optionally narrowed with `.include(...)`. Axe scans the page as it is at the call.
4. Use `.exclude(...)` for third-party widgets you do not own, with a ticket, not silently.
5. In CI, run with the E2E job. The attached JSON appears in the Playwright report.
6. Start with a baseline: record current violations, fail only on new ones, and shrink the list over time.
7. Add manual checks for what axe cannot decide (next entries).

**Follow-ups:**
- *Why the tags?* Axe has best-practice rules that are not WCAG requirements. Tags limit the run to the standard you commit to.
- *Does it cover WCAG 2.2?* Not completely. Some 2.2 criteria, such as focus not obscured, need manual testing.

**Trap:** Saying "axe passes, so we are WCAG compliant".

**Source:** https://playwright.dev/docs/accessibility-testing

### What do automated accessibility tools miss?

Topic: a11y | Niche | id: q0920

**Say:** Automated tools can find only the issues that a rule can decide, such as a missing label, a missing alt attribute, a duplicate id or a low contrast on plain text. They cannot judge meaning or experience. They cannot tell if an alt text is useful, if the focus order makes sense, if a custom widget works with the keyboard, if the reading order is logical, if a screen reader announces the right thing, or if the content is understandable. Playwright's own docs say that many problems can only be found by manual testing, so I combine automated checks, manual keyboard and screen reader testing, and user feedback.

**Full process:** An example of what slips through and how I catch it.
1. Run axe: zero violations on a checkout form.
2. Tab through: the "Pay" button is a styled `div` with `tabindex="0"` and `role="button"`, but Space does not activate it. Axe passes it because the role and the name exist. Manual test finds it.
3. Screen reader: the error "Invalid" appears visually but is not announced and is not linked to the field. Axe sees an input with a label and passes.
4. Alt text: `alt="image1"` passes the rule "image has alt" but is useless.
5. Content: instructions only in colour ("fields in red are required"). Needs a human to judge.
6. Add the findings as manual test cases, and add an automated regression for the ones that can be automated (a keyboard test, an ARIA snapshot).

**Follow-ups:**
- *Rough share of problems found by tools?* Estimates vary by source, so I would not quote a percentage without a source.

**Trap:** Quoting a precise "tools find 30%" figure from memory.

**Source:** https://playwright.dev/docs/accessibility-testing

### A scan reports zero violations but a screen reader user cannot complete a form. What could be wrong?

Topic: a11y | Niche | id: q0921

**Say:** The scan only checks static rules, so the problem is probably in behaviour or in meaning. Typical causes: the error messages are not announced and not linked to their field; focus does not move to the first error after submit; a custom select or date picker cannot be operated with the keyboard; a required field is only marked with colour or an asterisk that is not announced; the labels exist but are wrong or misleading; the submit button is disabled with no explanation; or a timeout logs the user out. I would reproduce with the screen reader and the keyboard, and find which step breaks.

**Full process:**
1. Walk the form with the keyboard only. Can every field be reached and filled?
2. Walk with the screen reader. Does each field announce label, type, required state and hint?
3. Submit with an error. Is the error announced? Is it linked to the field with `aria-describedby`? Does focus go to the error or the first invalid field?
4. Test custom components: a combobox needs the combobox pattern (role, expanded state, active option), and a date picker needs a keyboard path.
5. Check the status messages after submit success. They should be announced through a live region.
6. File the findings with the WCAG criteria, for example 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 4.1.3 Status Messages.

**Follow-ups:**
- *What is the cheapest fix?* Use native form controls and a native `<label>`, and add a linked error text.

**Trap:** Replying "the scan is wrong". The scan is right about what it checks. The test needs more checks.

**Source:** https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/

### Why do accessible locators help tests?

Topic: a11y | Niche | id: q0922

**Say:** Locating by role and accessible name uses the same information a screen reader uses, so the test sees what a user sees. The locator does not depend on CSS classes, DOM structure or test ids that change on refactors, so it is more stable. And when the locator fails because an element has no name or the wrong role, that is a real accessibility defect found as a side effect. So I fix the missing name in the product, not with a workaround in the test. Example: a suite relying on XPath and copy text was moved to role and name locators.

**Full process:** The sequence I followed.
1. A test needs a control. Try `page.getByRole('button', { name: 'Send', exact: true })`.
2. If it fails because the button has no name (an icon-only button), do not fall back to CSS. Add the name in the product, for example an `aria-label` on the icon button, citing 4.1.2.
3. If the element is a `div` with a click handler, change it to a real `<button>`, or add role, name and keyboard handling.
4. Use `exact: true`, so a name that contains another name does not match two elements.
5. Before renaming any accessible name, grep the test tree for the old name, because every `getByRole(..., { name })` that used it will break.
6. Check each state (open overlays, read-only mode, nested navigation) because the happy path alone hides collisions.
7. Use `getByTestId` only when no user-facing locator works, and do not add new test ids.

**Follow-ups:**
- *Is it always right?* Not when the product copy changes often and the name is user-facing text. Then I agree on stable accessible names with the team.
- *What about translation?* Run tests in one locale, or use the names from the same i18n resource the app uses.

**Trap:** Using role locators but adding `nth()` and `first()` to dodge ambiguity. That hides a real problem of duplicate names.

**Source:** https://playwright.dev/docs/accessibility-testing

### How do you evaluate colour contrast, and what are the ratios?

Topic: a11y | Niche | id: q0923

**Say:** WCAG level AA asks for a contrast ratio of at least 4.5 to 1 for body text, and 3 to 1 for large text and for active interface components and graphical objects like icons. Level AAA asks for 7 to 1 for body text. If a designer sends light grey text on white, I measure it with a contrast checker, not by eye, and report the actual ratio, the required ratio and a passing colour. Inactive controls, logos and decoration are exempt. I also check focus indicators and error states, not only normal text.

**Full process:**
1. Get the foreground and background colour values (design tool, or DevTools colour picker, which shows the ratio).
2. Compute the ratio with the DevTools picker or a contrast checker.
3. Compare to the threshold: 4.5 to 1 for normal text, 3 to 1 for large text (roughly 18 pt, or 14 pt bold) and for UI component borders and icons.
4. Check states: hover, focus, disabled (exempt), error, text over images and gradients.
5. Report: "Grey #999 on white is 2.8 to 1, needs 4.5 to 1 (1.4.3). Suggested: #767676 or darker."
6. Axe checks contrast automatically for plain text but cannot decide on images or gradients, so check those by hand.

**Follow-ups:**
- *How do you tell the designer?* With the numbers and a suggestion that keeps the brand look, not "it is hard to read".

**Trap:** Judging contrast by eye on a bright monitor.

**Source:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast

### What is new in WCAG 2.2 that a tester should check?

Topic: a11y | Niche | id: q0924

**Say:** WCAG 2.2 added nine success criteria and removed 4.1.1 Parsing. The ones I would add to a test plan: Focus Not Obscured (2.4.11, level AA), meaning a focused element must not be hidden entirely by a sticky banner; Target Size Minimum (2.5.8, AA), where pointer targets should be at least 24 by 24 CSS pixels with some exceptions; Dragging Movements (2.5.7, AA), so anything done by dragging also has a simple alternative; Consistent Help (3.2.6, A); Redundant Entry (3.3.7, A); and Accessible Authentication (3.3.8, AA), which means a login must not depend only on remembering or solving a puzzle.

**Full process:**
1. Focus not obscured: tab through a page with a sticky header or cookie banner and check that each focused element is at least partly visible.
2. Target size: inspect small icon buttons and links in dense toolbars and confirm size or spacing.
3. Dragging: for a drag and drop list or slider, check there is a button or keyboard way to do the same.
4. Consistent help: the help link or chat sits in the same place on each page.
5. Redundant entry: a multi-step form does not ask for the same data twice in one session.
6. Accessible authentication: the login allows paste into the password field and password managers, and offers a method that is not a cognitive test.
7. Automated tools cover few of these, so they are manual cases.

**Follow-ups:**
- *Which are AA?* 2.4.11, 2.5.7, 2.5.8, 3.3.8 among the new ones. 2.4.12, 2.4.13 and 3.3.9 are AAA.

**Trap:** Quoting the 2.1 list and calling it current.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

### How do you integrate accessibility testing into a CI/CD pipeline and a team's process?

Topic: a11y | Niche | id: q0925

**Say:** I use layers. In the editor and in code review, a lint rule for accessibility. In the component and E2E tests, role-based locators and an axe scan on key pages, which fail the pipeline on new violations. Before a release, a manual pass with keyboard and screen reader on the new features. And in the definition of done for UI stories, an accessibility checklist. The automated part blocks regressions cheaply. The manual part finds what tools cannot. I also work with design from the start, because fixing a contrast or a flow in the design is much cheaper than in code.

**Full process:**
1. Definition of done for UI work: keyboard operable, visible focus, names and roles, contrast checked, no new axe violations.
2. Lint: an ESLint rule set for JSX accessibility on React code, which flags mistakes at commit time.
3. E2E: role-based locators for all tests, and an axe scan test for each key page and state (see the axe entry).
4. Pipeline: the axe tests run in the normal E2E job. New violations fail the job. Existing ones are in a tracked baseline that shrinks.
5. Release: a short manual checklist (keyboard, screen reader, zoom to 200%, contrast).
6. Track: number of open accessibility defects by severity and criterion.
7. Prioritise by user impact: blockers in core flows (checkout, login) first.

**Follow-ups:**
- *How do you prioritise when there is more work than capacity?* By impact and reach: issues that block a core task for a group of users first, then frequent ones, then cosmetic.
- *How do you convince a manager to pay for an audit?* Legal and contract risk (many procurement rules and laws require AA), a larger customer base, and cheaper fixes early. I would put numbers on the exposure.

**Trap:** A once-a-year audit as the only accessibility activity.

**Source:** https://playwright.dev/docs/accessibility-testing

### How do you handle a stakeholder who does not want to invest in accessibility?

Topic: a11y | Niche | id: q0926

**Say:** I do not argue about values, I show impact and cost. I show a real defect, for example a core flow that cannot be completed with a keyboard, which makes it concrete. I point to the legal and contract side, because many markets and customers require WCAG AA, and to the benefits for everyone: keyboard users, people with temporary injuries, small screens, bright sunlight. And I make it cheap: small steps in the normal flow, the cheapest fixes first, and automation to block regressions. I also note that it improves test stability.

**Full process:**
1. Collect two or three concrete failures in the main flows, with a short recording.
2. State the risk: legal, contractual, lost customers, support cost.
3. Offer a staged plan: first the critical flows to level AA, then the rest. Estimate the effort.
4. Start with fixes that cost almost nothing: labels, alt text, headings, contrast tokens in the design system.
5. Show the second benefit: more stable role-based test locators.
6. Track and report progress each sprint.

**Follow-ups:**
- *What if the answer is still no?* Record the decision and the risk, and keep the free practices (native elements, labels) in daily work.

**Trap:** Moralising instead of giving numbers and a plan.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/

### Who benefits from accessibility, and how does responsive design affect it?

Topic: a11y | Niche | id: q0927

**Say:** People with permanent disabilities benefit first, but also people with temporary limits such as a broken arm, and situational limits such as bright sunlight, a noisy room or one hand holding a baby. Older users benefit too. Everyone benefits from clear structure and good contrast. Responsive design affects accessibility: content must reflow at small widths and at 400% zoom without losing information or needing two-way scrolling, touch targets must be large enough, and the order of content must still make sense when the layout changes. Hidden menus on mobile must stay keyboard and screen reader operable.

**Full process:**
1. Zoom the browser to 200% and 400% (or set a 320 px wide viewport). Expect content to reflow, with no horizontal scroll for text content.
2. Check the mobile menu with a keyboard and a screen reader: the button announces expanded or collapsed, and the menu is not reachable when closed.
3. Check touch target size and spacing for the small controls.
4. Check that DOM order matches visual order after CSS reorder.
5. Check orientation: the content works in portrait and landscape.
6. Run the same flows at the mobile breakpoints in Playwright with a mobile device project.

**Follow-ups:**
- *Does hiding content with `display: none` hide it from screen readers?* Yes, it removes it from the accessibility tree too. Visually hidden but readable text needs a different technique.

**Trap:** Treating accessibility as only about blind users.

**Source:** https://playwright.dev/docs/emulation

### How do you test forms for accessibility?

Topic: a11y | Niche | id: q0928

**Say:** Forms are where accessibility problems hurt most, because users cannot finish their task. Each field needs a visible label that is programmatically linked to it. Required fields and format hints must be announced, not shown with colour only. On error, the message must say which field and how to fix it, be linked to the field, and be announced, and focus should go to the first error or to a summary. Autocomplete attributes help, and so does allowing paste and password managers. I test with the keyboard and a screen reader.

**Full process:**
1. Check each field has a `<label for>` or an accessible name. A placeholder alone is not a label.
2. Tab through: order, focus visible, no trap.
3. Submit empty. Expect a message per field that names the problem. Check it is tied to the field with `aria-describedby` and the field has `aria-invalid="true"`.
4. Expect the screen reader to announce the error, and focus to go to the first invalid field or to an error summary.
5. Check that success messages are announced through a live region.
6. A Playwright check:

```ts
import { test, expect } from '@playwright/test';

test('empty email shows a linked error', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('Enter your email address');
});
```

**Follow-ups:**
- *Which criteria?* 1.3.1 Info and Relationships, 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 4.1.2 Name, Role, Value, and 4.1.3 Status Messages.

**Trap:** Relying on a red border to show an error.

**Source:** https://www.w3.org/WAI/standards-guidelines/wcag/

### How do you make announcements for dynamic content (toasts, live regions) testable and accessible?

Topic: a11y | Niche | id: q0929

**Say:** A screen reader user cannot see a toast appear, so the page must announce it. The tool for this is a live region: an element with `role="status"` or `aria-live="polite"` that exists in the page before its text changes, so the change is read out without moving focus. Urgent messages use `role="alert"`. In tests I do not wait for the toast by timing. I assert on the live region text after the user action. That test also proves the announcement exists.

**Full process:**
1. In the app: render an empty live region container at page load, and put the message text into it when the event happens.
2. Use `polite` for success and information, and `role="alert"` only for errors that need immediate attention.
3. Manual check: with a screen reader on, trigger the action and listen for the message.
4. In Playwright, assert the text of the region by role:

```ts
import { test, expect } from '@playwright/test';

test('saving shows a status message', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved');
});
```
5. If a toast has no role, the test cannot find it by role, which is an accessibility signal to fix in the product.

**Follow-ups:**
- *Why must the region exist before the text?* Many screen readers only announce changes to a region that was already in the page.

**Trap:** Moving focus to the toast. It interrupts the user and breaks their place.

**Source:** https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/

### What are good accessible names for icon buttons and images?

Topic: a11y | Niche | id: q0930

**Say:** An icon-only button needs a name that says what it does, not what it looks like: "Close", not "X" or "cross icon". That name can come from an `aria-label`, from visually hidden text, or from `aria-labelledby`. Images that carry information need an `alt` text that conveys the meaning in context. Decorative images get an empty `alt=""` so screen readers skip them. The visible label, if there is one, should be part of the accessible name, so voice control users can say what they see.

**Full process:**
1. Find controls with no text: icon buttons, image links, toolbar items.
2. In DevTools, the Accessibility tab shows the computed name. An empty name is a defect (4.1.2).
3. Add the name in the markup, for example `<button aria-label="Close dialog">` with the icon marked hidden from the tree.
4. For images: informative gets a short meaningful `alt`, decorative gets `alt=""`, complex charts get a text alternative nearby.
5. Check the visible text is contained in the name, so "Search" is not named "Find items".
6. In tests, locate with `getByRole('button', { name: 'Close dialog', exact: true })`.

**Follow-ups:**
- *Is `title` enough?* No, it is a weak fallback and not reliably announced.

**Trap:** `alt="image"` or file names as alt text.

**Source:** https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree

## Compatibility and localisation

### How do you approach cross-browser and cross-device compatibility testing?

Topic: cross-compat | Niche | id: q0931

**Say:** I decide the support list from usage data, then cover the main browser engines in automation and a few real devices by hand. Playwright runs the same tests in Chromium, Firefox and WebKit, and can emulate phones. I run the full suite on one browser and a smaller smoke or critical path set on the others, because the cost grows with each project. For visual and layout differences I use screenshot checks and a manual look at real Safari and real mobile devices.

**Full process:**
1. Get browser and device share from analytics, and the supported list from product.
2. Configure projects in `playwright.config.ts` for `Desktop Chrome`, `Desktop Firefox`, `Desktop Safari` and one or two mobile devices from `devices`.
3. Tag a smaller set of tests for the extra browsers, so the pipeline stays fast.
4. Run, and read failures per project. A failure in one engine is either a real compatibility bug or an engine difference in the test.
5. Manual pass on real Safari on a Mac or iPhone for things emulation misses.
6. Document the matrix and review it every quarter.

**Follow-ups:**
- *Is WebKit in Playwright the same as Safari?* Close, but not identical, so a real Safari check remains for risky features.

**Trap:** Running every test on every browser by default.

**Source:** https://playwright.dev/docs/emulation

### What is the difference between internationalisation and localisation, and what do you test?

Topic: cross-compat | Niche | id: q0932

**Say:** Internationalisation (i18n) is building the product so it can be adapted to many languages and regions without code changes. Localisation (l10n) is the adaptation for one specific market: translation, but also date, time and number formats, currency, sorting, address and phone formats, and legal text. I test that nothing is hardcoded, that long translations do not break the layout, that right-to-left and special characters work, and that formats follow the locale.

**Full process:**
1. Switch the locale and check each screen for untranslated text and keys shown as raw ids.
2. Pseudo-localisation or a long language (German) to find text that overflows or is cut.
3. Characters: names with accents, non-Latin scripts, emoji. Check input, storage and display.
4. Formats: date order, 24-hour time, decimal comma versus point, currency symbol and position.
5. Sorting and search with accented characters.
6. Right-to-left, if supported.
7. In Playwright set `locale` and `timezoneId` in the context to run the same test in another region.

**Follow-ups:**
- *How do you avoid tests depending on the translation?* Locate by role, and use the same i18n resource for expected names, or run the suite in one fixed locale.

**Trap:** Believing localisation is only translation.

**Source:** https://www.w3.org/International/questions/qa-i18n

### How do you test time zones and daylight saving time?

Topic: cross-compat | Niche | id: q0933

**Say:** Time bugs hide at boundaries: midnight, the days when clocks change, and users in a different zone than the server. Test with a fixed zone for the test, and with dates around the clock change. Example: a daylight-saving bug was fixed in a time slider and date ranges that used a specific time zone. The key rule: store in UTC, show in the user's or project's zone, and test the conversion on both sides.

**Full process:**
1. Fix the time zone in the test: in Playwright set `timezoneId` in the context options.
2. Pick the transition days (the last Sunday of March and of October in the EU) and test an hour that does not exist or happens twice.
3. Test a range that crosses the change: its length in hours differs.
4. Test a user in zone A looking at data created in zone B, and a project zone that differs from the browser zone.
5. Check the API and the UI both show the same instant.
6. Freeze the clock in tests where the current time matters.

**Follow-ups:**
- *Why not use the machine's zone in CI?* CI machines are often UTC, so a bug that needs another zone never shows.

**Trap:** Testing only on a normal weekday afternoon.

**Source:** https://playwright.dev/docs/emulation

### How do you test a responsive layout and visual differences across screen sizes?

Topic: cross-compat | Niche | id: q0934

**Say:** I test at the real breakpoints, not at random sizes: small phone, large phone, tablet, laptop and wide desktop. In Playwright I use device projects and viewports. For layout regression I use screenshot comparison on stable pages, and I make it stable by blocking noisy requests, fixing the data and the currency, and disabling animations. Screenshots find unintended changes, but a person decides if a change is a bug.

**Full process:**
1. Take the breakpoints from the CSS or design system.
2. Create projects with those viewports or devices.
3. In the test, wait for the page to be ready (fonts and images loaded), mask dynamic regions, and call `await expect(page).toHaveScreenshot()`.
4. Generate the baseline images in the same environment as CI (a fixed Docker image), because fonts differ across operating systems.
5. Review diffs by eye and update the baseline only for intended changes.

**Follow-ups:**
- *Why do screenshots flake?* Fonts, animations, dynamic data and third-party requests. Fix those first.

**Trap:** Generating baselines on a laptop and comparing in CI.

**Source:** https://playwright.dev/docs/emulation

## SaaS and multi-tenant

### What does "multi-tenant" mean?

Topic: multitenant-saas | Niche | id: q0935

**Say:** A tenant is one customer of a product, usually a company, with all its users. A multi-tenant application is one running system that serves many tenants at the same time, and keeps their data and settings separate. Think of an apartment building: one building, many households, each with its own door and key. The opposite is single-tenant, where every customer gets its own copy of the application. Most SaaS products are multi-tenant because it is cheaper to run and update one system.

**Full process:** Explaining it from zero.
1. A user is a person. A tenant is the customer organisation that owns many users.
2. In a multi-tenant system all tenants use the same application servers and often the same database.
3. Every record belongs to a tenant, typically through a tenant id column, and every query is filtered by it.
4. The tenant boundary is the most important rule: one tenant must never see or change another tenant's data.
5. Settings, branding and feature flags can differ per tenant.
6. Isolation can be done at different levels: a shared database with a tenant id, a separate schema per tenant, or a separate database per tenant. More isolation costs more.
7. Deployment is shared, so a release changes all tenants at once.

**Follow-ups:**
- *Tenant versus user?* A tenant has many users. Permissions inside a tenant (roles) are a different layer than isolation between tenants.
- *Single-tenant?* Each customer has a separate deployment. Isolation is simple, but cost and updates are higher.

**Trap:** Using "tenant" and "user" as the same word.

**Source:** https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview

### How would you test tenant isolation?

Topic: multitenant-saas | Niche | id: q0936

**Say:** If you have not run tenant isolation testing as a task, say so, then explain how you would approach it. The goal is to prove that tenant A can never read or change tenant B's data, through any path. I would create two tenants with distinct data and try to cross the boundary with every kind of access: the UI, the API with changed ids, search, exports, files, webhooks, background jobs and caches. It is IDOR testing applied across tenants, which is the access control basics I already use.

**Full process:**
1. Create tenant A and tenant B, each with an admin and a normal user, and distinctive data (unique names, files, tags).
2. For each API endpoint, call it with tenant A's token and tenant B's object ids. Expect 403 or 404.
3. Check list endpoints, search and autocomplete: B's records must never appear in A's results, including counts.
4. Check exports, reports and file downloads: guess or replay another tenant's file URL.
5. Check caches and background jobs: a cached response for one tenant must not be served to another, and an email or webhook must go to the right tenant.
6. Check shared resources: a rate limit or a quota should not let one tenant degrade others (the noisy neighbour problem).
7. Check tenant-specific configuration and feature flags apply only to the right tenant.
8. Automate the cross-tenant matrix as API tests that run on every build.

**Follow-ups:**
- *What is a noisy neighbour?* One tenant using so many resources that others slow down. A load test with one heavy tenant and several normal tenants shows it.
- *Where is the risk highest?* In places that skip the usual query filter: search indexes, exports, admin tools, caches and background jobs.

**Trap:** Claiming experience with tenant isolation testing. Keep it as an approach.

**Source:** https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview

### What are the testing challenges of a multi-tenant SaaS product?

Topic: multitenant-saas | Niche | id: q0937

**Say:** Three things stand out. One release affects every customer at once, so changes need feature flags and a staged rollout, and regression coverage matters. Tenants have different configuration, plans and feature flags, so a test can pass on one tenant and fail on another, and tests must say which configuration they use. And test data must stay inside its own tenant: each test creates its own project or account, so parallel tests do not interfere. Example: feature-flag drift checks and self-cleaning, isolated test projects were used in practice.

**Full process:**
1. Each test or worker creates its own tenant (project) through the API and removes it at the end, so tests are independent and parallel-safe.
2. Compare the feature flags and configuration between the test environment and production, so tests do not pass on a configuration customers never see.
3. Run the suite also with new flags switched on before a rollout.
4. Cover plan differences (free, paid, trial) as separate scenarios.
5. Watch environment-wide limits: rate limits and quotas shared between tests.
6. Release carefully: staged rollout and monitoring, because rollback affects everyone.

**Follow-ups:**
- *How do you keep test data from leaking between tests?* A separate tenant per test or worker, and cleanup so the account holds nothing after the run.

**Trap:** Sharing one test account between parallel workers.

**Source:** https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview

### What is the difference between roles inside a tenant and isolation between tenants?

Topic: multitenant-saas | Niche | id: q0938

**Say:** They are two separate layers of access control. Roles decide what a user may do inside their own tenant: an admin can change billing, an agent cannot. Tenant isolation decides that no user can reach another tenant's data at all, whatever their role. A bug in the first layer gives a user too much power in their own company. A bug in the second layer exposes one customer's data to another, which is far more serious. A good tested area is roles and permissions, and I would extend the same method across tenants.

**Full process:**
1. Build the test matrix with two axes: role (admin, normal user, anonymous) and tenant (own tenant, other tenant).
2. Expected: in the own tenant, the result depends on the role. In the other tenant, always denied, even for an admin of the first tenant.
3. Run each cell on read, create, update and delete.
4. Include indirect paths: search, export, notifications and shared links.
5. Automate as API tests.

**Follow-ups:**
- *Which failure is worse?* A cross-tenant leak, because it exposes a customer's data to another customer and can have legal consequences.

**Trap:** Testing only admin versus normal user inside one account and calling it isolation testing.

**Source:** https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview

## Rare tools from the ads

### What is Artillery, and how does it compare with k6?

Topic: performance-artillery | Niche | id: q0939

**Say:** If you have not used Artillery in production, say so, then explain: it is a load testing tool where you define scenarios in YAML or TypeScript, and it has a built-in Playwright engine that runs real browsers. That's useful for reusing Playwright flows, but browsers cost far more than plain requests, so run most of the load at the API level. The planning stays the same as with k6: define the target, ramp up, and watch response times and error rates.

**Source:** https://www.artillery.io/docs/reference/engines/playwright
