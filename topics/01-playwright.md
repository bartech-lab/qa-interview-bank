# Playwright, part 1: core runner, locators, waits, fixtures, config, auth, parallelism, interactions

How to study this file: read the **Say** line out loud until it sounds like you, then read **Full process** once so you can type the code from memory. Sections run most-asked first. Current Playwright is 1.65.0 (checked 2026-11-05 against the GitHub release); the answers say when a feature is recent. The **Trap** line is the answer that sounds right and loses the point. Some answers state a team practice (no `toPass()`, no `force`, `exact: true`, no new test ids, no `networkidle`) and still explain the feature, because an interviewer may ask about it.

## Section 1: Auto-waiting and web-first assertions

### What does "web-first" mean in Playwright assertions?

Topic: pw-waits-assertions | Core | id: q0001

**Say:** Web-first means the assertion follows how a real page behaves. It does not check once. It re-reads the element in the browser and retries until the condition is true or the assertion timeout ends, which is 5 seconds by default. Pages update asynchronously, so a one-time check can run too early and make the test flaky. So I write `await expect(locator).toBeVisible()` and I never write `expect(await locator.isVisible()).toBe(true)`, because that reads the state once and then compares a plain boolean.

**Full process:**
1. Write the assertion on a locator, not on a value you already read. The matcher is async, so you must `await` it.
2. Playwright resolves the locator, checks the condition, and if it fails it waits and tries again. It re-fetches the element every time, so a re-rendered node does not break it.
3. The default retry intervals are not configurable for these matchers, and the total wait is the expect timeout (5 s by default, `expect: { timeout }` in the config).
4. On timeout the error shows the call log: the matcher, the timeout, and "waiting for" the locator.

```ts
import { test, expect } from '@playwright/test';

test('web-first versus one-shot', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // web-first: retries until visible, fails after the expect timeout
  await expect(page.getByRole('heading', { name: 'Playwright enables reliable web automation for modern apps.', exact: false })).toBeVisible();

  // not web-first: isVisible() returns at once, then a plain boolean is compared
  const visible = await page.getByRole('link', { name: 'Get started', exact: true }).isVisible();
  expect(visible).toBe(true);
});
```

Other web-first matchers: `toHaveText`, `toContainText`, `toHaveURL`, `toHaveTitle`, `toBeEnabled`, `toHaveCount`, `toHaveValue`, `toBeChecked`.

**Follow-ups:**
- *Is `expect(x).toBe(y)` web-first?* No. It is a generic matcher: it checks once and does not retry. Only the web-specific async matchers on a locator, page, or response retry.
- *What if I need retries for something that is not a locator?* Use `expect.poll` for a value you can read in a function, for example an API status. `expect().toPass()` exists for blocks of code, but I avoid it in my own suites.
- *Can the timeout be changed?* Yes: `expect: { timeout: 10_000 }` in the config, or `{ timeout }` on one assertion, or `expect.configure({ timeout })` for a custom instance.

**Trap:** Saying "it waits for the element". Auto-waiting for actions and web-first assertions are two different mechanisms. Actions wait for actionability, assertions retry a condition. Another trap is "the timeout is the test timeout": the expect timeout is separate.

**Source:** https://playwright.dev/docs/test-assertions

### What is auto-waiting, and what exactly does Playwright check before a click?

Topic: pw-waits-assertions | Core | id: q0002

**Say:** Before an action Playwright runs actionability checks and waits until they all pass, or until the action timeout. For `click()` it checks that the locator resolves to exactly one element, and that the element is visible, stable, receives events, and is enabled. If the checks do not pass in time, the action fails with a `TimeoutError` and the call log says which check was failing. That is why I do not add `waitFor` before every click. It is already built in.

**Full process:**
1. The locator resolves to one element (strictness).
2. Visible: non-empty bounding box and no `visibility:hidden`. Note that `opacity:0` still counts as visible.
3. Stable: the same bounding box for two animation frames in a row, so it is not animating.
4. Receives Events: the element is the hit target at the click point, so no overlay covers it.
5. Enabled: not `disabled`, and not under an `aria-disabled="true"` ancestor.
6. Different actions check different subsets: `fill()` checks visible, enabled and editable but not stable or receives-events; `hover()` does not check enabled; `press()` and `setInputFiles()` check nothing.
7. As of 1.65, actions also wait for the element to be not inert.

```ts
// If a spinner overlay covers the button, the click waits, and the timeout error names the intercepting element.
await page.getByRole('button', { name: 'Save', exact: true }).click();
```

**Follow-ups:**
- *What does the error look like when an overlay blocks the click?* The call log says the element "intercepts pointer events" and names the element on top. I read that line first, because it usually points at a modal or an animation that has not finished.
- *Does `fill()` wait for the field to be stable?* No. `fill()` checks visible, enabled and editable. Only click-like actions check stable and receives-events.
- *What does `force: true` do?* It skips the non-essential checks. I never use it, because it hides the overlay or disabled state a real user would hit.

**Trap:** Believing auto-wait means "Playwright waits for the page to finish loading". It waits for one element and one action, not for network or rendering of the rest of the page. Also, `click()` on a disabled button waits for it to become enabled, so a test can pass even when the button was wrongly disabled for too long.

**Source:** https://playwright.dev/docs/actionability

### Which assertions retry and which do not? Name examples of each.

Topic: pw-waits-assertions | Core | id: q0003

**Say:** Retrying assertions are the web-specific matchers: `toBeVisible`, `toHaveText`, `toHaveURL`, `toHaveCount`, `toBeEnabled` and similar. They are async and I always `await` them. Non-retrying assertions are the generic ones such as `toBe`, `toEqual`, `toContain`, `toBeTruthy`. They check once. Most pages show data asynchronously, so a generic matcher on a value I read earlier is a flaky test waiting to happen.

**Full process:**
1. Use a retrying matcher on a locator whenever the thing you check is in the page.
2. If the value is not in the page (an API result, a file, a database row), read it inside `expect.poll` and put the matcher after it.
3. Use a non-retrying matcher only on a value that is already final, for example after `await locator.allTextContents()` when the list was already asserted stable.

```ts
// retrying: the locator is re-read until it matches
await expect(page.getByRole('listitem')).toHaveCount(3);

// non-retrying: reads the count once, then compares
expect(await page.getByRole('listitem').count()).toBe(3);
```

**Follow-ups:**
- *Why is the second line worse?* `count()` returns the number at that instant, so if the list is still rendering, it fails and a retry of the whole test is the only fix.
- *Is `await` required?* Yes for the async matchers. A missing `await` makes the test pass before the assertion runs, and there is an ESLint rule (`@typescript-eslint/no-floating-promises`) that catches it.
- *Does `expect(locator).not.toBeVisible()` retry?* Yes, a negated web-first matcher retries until the negation holds.

- *A page object method reads the text from a locator and returns it, and you assert on that value. Does it retry?* No. `textContent()` reads the text once and returns a string. `expect(string).toBe(...)` compares that one string once. The retry lives in the matcher, and the matcher can only re-read something it can ask again: a locator. So the page object should return the locator, and the test should use `toHaveText`. When a method must return a value, `expect.poll` calls the method again until the matcher passes.

| | Auto-retrying | Non-retrying |
|---|---|---|
| Works on | a locator (or the page, or a response) | a value already read: string, number, object |
| Example | `await expect(locator).toHaveText('Majorka, 7 nocy')` | `expect(await locator.textContent()).toBe('Majorka, 7 nocy')` |
| How many reads | again and again until it matches or 5 s pass | one |
| `await` | needed | not needed on the matcher |

```ts
import { test, expect, type Page } from '@playwright/test';

// The offer title arrives half a second after the page opens.
const offerPage = `
  <h1 data-testid="offer-title">Ładowanie...</h1>
  <script>
    setTimeout(() => {
      document.querySelector('[data-testid="offer-title"]').textContent = 'Majorka, 7 nocy';
    }, 500);
  </script>`;

class OfferPage {
  constructor(private readonly page: Page) {}

  // Returns a locator: the assertion can read it again and again.
  get title() {
    return this.page.getByTestId('offer-title');
  }

  // Returns a string: read once, at this instant.
  async getTitle() {
    return this.title.textContent();
  }
}

test('non-retrying: the text is read once, too early', async ({ page }) => {
  await page.setContent(offerPage);
  const offer = new OfferPage(page);

  const title = await offer.getTitle();     // 'Ładowanie...' while the offer loads
  expect(title).toBe('Majorka, 7 nocy');    // compares one string once, and fails
});

test('auto-retrying: the locator is read until the text matches', async ({ page }) => {
  await page.setContent(offerPage);
  const offer = new OfferPage(page);

  await expect(offer.title).toHaveText('Majorka, 7 nocy');
});

test('a method that returns a value can still be retried with expect.poll', async ({ page }) => {
  await page.setContent(offerPage);
  const offer = new OfferPage(page);

  await expect.poll(() => offer.getTitle()).toBe('Majorka, 7 nocy');
});
```

Run on Playwright 1.65.1 as written: the first test fails, the other two pass.

**Trap:** Thinking every `expect` in Playwright retries. Only the matchers on locators, pages and responses retry. `expect(value).toBe(...)` is the plain Jest-style matcher.

**Source:** https://playwright.dev/docs/test-assertions

### Why should you not use `waitForTimeout`, and what do you use instead?

Topic: pw-waits-assertions | Core | id: q0004

**Say:** A fixed sleep is wrong in both directions. If the page is slow, the sleep is too short and the test still fails. If the page is fast, every run pays the full sleep for nothing, and a hundred sleeps slow the whole suite. The right replacement is to wait for the thing the test actually needs: a web-first assertion, `waitForURL`, or a `waitForResponse` started before the click. I treat `waitForTimeout` as a diagnosing tool at most, and I do not commit it.

**Full process:**
1. Ask what the test is really waiting for: a toast, a row, a URL, a response, a loader to go.
2. Pick the narrowest signal for that state.
3. Replace the sleep with it, run the test with `--repeat-each` to check it is stable.

```ts
// bad
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(3000);

// good: wait for the effect the user sees
await page.getByRole('button', { name: 'Save', exact: true }).click();
await expect(page.getByRole('status')).toHaveText('Saved');

// good: wait for the request the click triggers (start it before the click)
const saved = page.waitForResponse(
  (r) => r.url().includes('/api/items') && r.request().method() === 'PUT',
);
await page.getByRole('button', { name: 'Save', exact: true }).click();
expect((await saved).ok()).toBeTruthy();
```

**Follow-ups:**
- *What about `waitForLoadState('networkidle')`?* The docs discourage it for tests, and I do not use it: pages with polling or analytics never go idle, and the state says nothing about the element I need. I wait for the element or the response.
- *Is a sleep ever acceptable?* Only to reproduce a race while investigating, for example to see if a longer wait changes the failure. It never goes into a merged test.
- *How do you prove the replacement is stable?* Repeat it many times, for example `npx playwright test file.spec.ts --repeat-each=100 --workers=4`, and compare with the base branch.

**Trap:** "I use `waitForTimeout` with a short value, only 500 ms." Any value is a guess about the machine. CI is slower than a laptop, so the guess fails exactly where it matters.

**Source:** https://playwright.dev/docs/actionability

### What are the different timeouts in Playwright Test, and what are their defaults?

Topic: pw-waits-assertions | Core | id: q0005

**Say:** There are several, and they are independent. The test timeout is 30 seconds by default and includes the test body, fixture setup and `beforeEach`. The expect timeout is 5 seconds per assertion. The action timeout and the navigation timeout have no limit by default, so a stuck click is bounded only by the test timeout. There is also an optional global timeout for the whole run, with no default.

**Full process:**
1. Test timeout: `timeout: 30_000` default. Change in config, `test.setTimeout()`, or `test.slow()` which triples it.
2. Expect timeout: `expect: { timeout: 5_000 }` default, or per assertion `{ timeout }`.
3. Action timeout: `use: { actionTimeout }`, default 0 (none).
4. Navigation timeout: `use: { navigationTimeout }`, default 0 (none).
5. Global timeout: `globalTimeout`, default none.
6. `beforeAll` and `afterAll` have their own timeout, equal to the test timeout by default and not shared with any test. Fixture teardown and `afterEach` share a separate timeout of the same value.
7. A fixture can have its own timeout: `[fn, { timeout: 60_000 }]`. Worker-scoped fixtures already get their own.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalTimeout: 60 * 60 * 1000,
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
});
```

**Follow-ups:**
- *If the action timeout is unlimited, why does a stuck click still end?* The test timeout (30 s) ends it. The error then says the test timed out while running the action, which is less precise than an action timeout error.
- *Does a slow `beforeEach` count against the test?* Yes. The test function, fixture setup and `beforeEach` all share the test timeout.
- *When do you raise a timeout?* Rarely, for a known slow step such as a big import, and only on that test with `test.slow()` or `test.setTimeout()`. Raising it globally hides slowness.
- *On which levels can you set a timeout?* From widest to narrowest: the config for the whole suite, one project in the config, one file or `describe` group, one test, and one action or assertion. A narrower setting replaces the wider one for the same kind of timeout.
- *One action needs more time. Where do you set it?* On that action: `click({ timeout: 10_000 })`, or on that assertion: `toHaveText('...', { timeout: 10_000 })`. The test timeout stays as it is.
- *Three of sixty tests need more time. Where?* On those three. Put them in a `describe` group with `test.describe.configure({ timeout: 90_000 })`, or call `test.slow()` in each.
- *Why is raising the global timeout to three minutes a problem?* Every test now needs three minutes to report a real hang, so a broken build takes far longer to fail. The 57 tests that were fine lose their limit, so a test that gets slower goes unnoticed. And the reason those three tests are slow is never looked at.

| Who needs more time | Where to set it | Code |
|---|---|---|
| One action | on the action | `click({ timeout: 10_000 })` |
| One assertion | on the assertion | `toHaveText('Potwierdzono', { timeout: 10_000 })` |
| One test | in the test | `test.slow()` or `test.setTimeout(90_000)` |
| A group of tests | in the `describe` | `test.describe.configure({ timeout: 90_000 })` |
| One project | in the config project | `projects: [{ name: 'payments', timeout: 90_000 }]` |
| Every test | config, top level | `timeout: 60_000` |

```ts
import { test, expect } from '@playwright/test';

test('one slow action and one slow assertion get their own timeout', async ({ page }, testInfo) => {
  await page.goto('/booking/summary');

  await page.getByRole('button', { name: 'Zarezerwuj' }).click({ timeout: 10_000 });
  await expect(page.getByTestId('status')).toHaveText('Potwierdzono', { timeout: 10_000 });

  expect(testInfo.timeout).toBe(30_000); // the test timeout is untouched
});

test.describe('payment tests that are slow by nature', () => {
  test.describe.configure({ timeout: 90_000 }); // only the tests in this group

  test('pays by card', async ({}, testInfo) => {
    expect(testInfo.timeout).toBe(90_000);
  });

  test('pays by transfer', async ({}, testInfo) => {
    expect(testInfo.timeout).toBe(90_000);
  });
});

test('one slow test triples its own timeout', async ({}, testInfo) => {
  test.slow();
  expect(testInfo.timeout).toBe(90_000);
});

test('a test outside the group keeps the default', async ({}, testInfo) => {
  expect(testInfo.timeout).toBe(30_000);
});
```

Run on Playwright 1.65.1 with a local page in place of `/booking/summary`: all five pass, so the `testInfo.timeout` values above are real.

**Trap:** Saying "the default timeout is 30 seconds" for everything. Assertions are 5 seconds, and actions and navigations have none.

**Source:** https://playwright.dev/docs/test-timeouts

### What does `expect.poll` do and when do you use it?

Topic: pw-waits-assertions | Standard | id: q0006

**Say:** `expect.poll` turns a plain assertion into a retrying one. I give it an async function that returns a value, then I chain a normal matcher, and Playwright calls the function again until the matcher passes or the timeout ends. I use it for state that is not a locator, for example an API that becomes consistent a moment after a write, so I poll the endpoint until the record appears. The default timeout is 5 seconds and the default intervals are 100, 250, 500 and then 1000 ms.

**Full process:**
1. Write a function that reads the value. It must be safe to call many times.
2. Wrap it: `expect.poll(fn, options)`, then add a matcher.
3. Set `timeout` and `intervals` if the backend is slow. `timeout: 0` means no limit from this call (the test timeout still applies).
4. Add `message` so the failure explains what was awaited.

```ts
import { test, expect } from '@playwright/test';

test('record shows up in the API after saving', async ({ page, request }) => {
  await page.goto('/orders/new');
  await page.getByRole('button', { name: 'Create order', exact: true }).click();

  await expect
    .poll(
      async () => {
        const res = await request.get('/api/orders?status=new');
        return (await res.json()).items.length;
      },
      { message: 'order should be listed', timeout: 15_000, intervals: [500, 1_000, 2_000] },
    )
    .toBeGreaterThan(0);
});
```

**Follow-ups:**
- *How is it different from `toPass`?* `poll` retries a function that returns a value and applies one matcher. `toPass` retries a whole block of assertions. `toPass` has a default timeout of 0, so by default it retries until the test timeout.
- *Can it be soft?* Yes: `expect.soft.poll(...)`.
- *Should you poll in a loop for UI state?* No. UI state has web-first matchers.
- *You create a resource through an API, it goes through a queue, and the write takes 5 seconds to 2 minutes. Is a 2xx enough?* No. The 2xx, often a 202, says the request was accepted. It does not say the resource was written. A single read right after it fails, because the plain matchers check a value once. I read the resource in `expect.poll` with a timeout a little above the slowest real write and intervals that match it: no point asking every 100 ms for something that takes seconds.

```ts
import { test, expect } from '@playwright/test';

test('a booking sent through the queue is readable within 2 minutes', async ({ request }) => {
  const created = await request.post('/bookings', { data: { offer: 'Majorka' } });
  expect(created.status()).toBe(202);          // accepted, not yet written
  const { id } = await created.json();

  await expect
    .poll(async () => (await request.get(`/bookings/${id}`)).status(), {
      message: `booking ${id} was not written within 2 minutes`,
      intervals: [1_000, 2_000, 5_000],        // wait 1 s, then 2 s, then every 5 s
      timeout: 120_000,
    })
    .toBe(200);
});
```

Run on Playwright 1.65.1 against a backend that writes the booking 3 seconds after the 202: a single `GET` right after the `POST` got 404, and the poll passed.

| | `expect.poll` | `expect(async () => { ... }).toPass()` |
|---|---|---|
| Repeats | a function that returns one value | a whole block of code |
| Assertions | one matcher after the poll | as many as the block holds |
| Default timeout | 5 s | 0: it repeats until the test timeout |
| Use it for | "the status becomes 200" | "the status is 200 and the body says confirmed" |

**Trap:** Using `expect.poll` for something a locator assertion can do. Poll is the escape hatch for values outside the DOM.

**Source:** https://playwright.dev/docs/test-assertions

### What is `expect().toPass()` and why would you avoid it?

Topic: pw-waits-assertions | Standard | id: q0007

**Say:** `toPass` is a matcher on `expect`. I pass `expect` an async function and call `.toPass()` on the result, and Playwright runs that whole block again until every assertion inside passes. By default it has a timeout of 0 and ignores the custom expect timeout, so without a `timeout` option it keeps retrying until the test timeout. It is the right tool when a slow backend write must be checked with several assertions at once, for example the status and the body of a resource that goes through a queue. I do not use it to make a flaky UI test green: a block that needs retrying there usually means I have not found the real state the test waits for, and `toPass` can hide a race or a product bug. Where the thing to retry is one value, I use `expect.poll`. Where it is the UI, I use a web-first matcher.

**Full process:**
1. Syntax: `await expect(async () => { ... }).toPass({ intervals, timeout })`.
2. Default intervals are 100, 250, 500, 1000 ms.
3. Everything in the block is re-run from the top on each retry, so the block must have no side effects that cannot repeat (a `click` in there would click many times).

```ts
await expect(async () => {
  const res = await page.request.get('/api/health');
  expect(res.status()).toBe(200);
}).toPass({ intervals: [1_000, 2_000], timeout: 30_000 });
```

**Follow-ups:**
- *What goes wrong with a click inside `toPass`?* It repeats on every retry, so you can create duplicates or toggle a state back.
- *So when is it legitimate?* Waiting for an external system such as an email or a queue, where no locator or single value exists. Even then I prefer `expect.poll` on one value.
- *Where does `toPass` come from?* From `expect`, not from `page` and not from a locator. The form is `expect(async () => { ... }).toPass(options)`: `expect` receives a function instead of a value, and `toPass` is the matcher. There is no `page.toPass()`.
- *What exactly does it retry?* The whole function, from its first line, on every attempt. So the block holds only reads and assertions.

```ts
import { test, expect } from '@playwright/test';

test('a booking sent through the queue ends as confirmed', async ({ request }) => {
  const created = await request.post('/bookings', { data: { offer: 'Majorka' } });
  expect(created.status()).toBe(202);
  const { id } = await created.json();          // the POST stays outside the block

  await expect(async () => {
    const read = await request.get(`/bookings/${id}`);
    expect(read.status()).toBe(200);
    expect(await read.json()).toEqual({ id, status: 'confirmed' });
  }).toPass({ intervals: [1_000, 2_000, 5_000], timeout: 120_000 });
});
```

Run on Playwright 1.65.1 against a backend that writes the booking 3 seconds after the 202: passes.

- *How do you answer if the team already uses it widely?* I would not rewrite working tests as a drive-by. I would make new tests use web-first matchers and poll, and look at each `toPass` when the test next flakes.

**Trap:** Presenting `toPass` as the normal way to make a flaky test stable. It makes a flaky test green, which is not the same as stable.

**Source:** https://playwright.dev/docs/test-assertions

### What are soft assertions and when are they a good idea?

Topic: pw-waits-assertions | Standard | id: q0008

**Say:** A soft assertion is `expect.soft(...)`. When it fails, the test is marked failed but keeps running, so one run reports all the failing checks instead of stopping at the first. I use them when one page has many independent facts to check, such as several fields on a summary card. I do not use them for steps where a later step depends on the earlier one, because then the later failures are noise.

**Full process:**
1. Replace `expect` with `expect.soft` on the independent checks.
2. At the end of the test the failures are reported together.
3. To stop early when something soft failed, check `test.info().errors`.
4. For a block of soft checks, build `const softExpect = expect.configure({ soft: true })`.

```ts
await expect.soft(page.getByTestId('status')).toHaveText('Success');
await expect.soft(page.getByTestId('eta')).toHaveText('1 day');
// stop here when anything above failed
expect(test.info().errors).toHaveLength(0);
await page.getByRole('link', { name: 'next page', exact: true }).click();
```

**Follow-ups:**
- *Is a test with failed soft assertions failed?* Yes. It is marked failed at the end.
- *Do they work outside the Playwright runner?* No, soft assertions need the Playwright test runner.
- *Downsides?* Many soft failures can hide the root cause: a broken page produces 20 soft failures, the first one being the cause.

**Trap:** Using soft assertions so that a flaky check "does not fail the test". A soft failure still fails it.

**Source:** https://playwright.dev/docs/test-assertions

### Why can a test be flaky even though Playwright has auto-waiting?

Topic: pw-waits-assertions | Standard | id: q0009

**Say:** Auto-waiting covers one element for one action. It does not cover everything around it. A missing `await` makes the test run ahead. A one-shot check such as `isVisible()` or `count()` reads state at one instant. A request that starts after the click can finish after my assertion. A locator that matches two elements, or an overlay in an exit animation, makes an action hit the wrong thing. Shared test data between parallel tests is a common cause too. So I classify the failure from the trace first: race, ambiguity, overlay, environment, or product bug.

**Full process:**
1. Reproduce with tracing and one worker: `npx playwright test file.spec.ts --trace on -j 1 --repeat-each=20`.
2. Open the trace: `npx playwright show-trace test-results/.../trace.zip`. Read the failing action, its call log, the screenshot before and after, and the network tab.
3. Classify: missing await or one-shot read (race), locator that can match more than one thing (ambiguity), element covered (overlay), shared account or data (environment), real bug in the app (product).
4. Fix the cause. Do not add retries or sleeps.
5. Prove with many repeats on the base branch and the fix.

**Follow-ups:**
- *How do you know it is a product bug and not a test race?* If the trace shows the app reached a wrong state (a wrong redirect, a lost update) that a human would also see, and the failure rate drops after a product fix, it is product.
- *Would you add `retries`?* Not globally. A retry hides the cause, and a named test can get one with a reason while the fix is pending.
- *What is the cheapest first check for a flaky test?* Look at whether the same test also fails on the shared base branch in the same time window.

**Trap:** "Add retries" or "increase the timeout" as the first answer. It proves you treat symptoms.

**Source:** https://playwright.dev/docs/actionability

### What is the difference between `toHaveText` and `toContainText`, and what does `toHaveText` normalize?

Topic: pw-waits-assertions | Standard | id: q0010

**Say:** `toHaveText` matches the full text of the element, so use it when the whole message is the contract. `toContainText` matches a part, so use it when extra or dynamic text is expected. A string is compared after whitespace is normalized, and a string match is case sensitive unless I pass a regular expression with `i`. Because of the normalization, `toHaveText` cannot see a whitespace or line-break bug, so for that I compare `textContent` exactly.

**Full process:**
1. Whole message is fixed: `toHaveText('Saved')`.
2. Part is fixed: `toContainText('Saved')`.
3. A dynamic part: anchored regex, `toHaveText(/^Order #\d+ saved$/)`.
4. For a list of items: pass an array, `toHaveText(['a', 'b', 'c'])`, which also checks the count.
5. For an input value use `toHaveValue`, because `getByText` and `toHaveText` do not read input values.

```ts
await expect(page.getByRole('status')).toHaveText(/^Order #\d+ saved$/);
await expect(page.getByRole('listitem')).toHaveText(['Apple', 'Banana', 'Cherry']);
await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('ann@example.com');
```

**Follow-ups:**
- *How do you assert on a number formatted per locale?* Build the expected string with `Intl.NumberFormat` in the same locale. In pl-PL a thousands separator is a non-breaking space, which is easy to mistype.
- *Why not match LLM output exactly?* I do not assert on generated text at all. I assert UI that always renders, or a stable fragment by regex.
- *Is `toHaveText([...])` order sensitive?* Yes.

**Trap:** Typing a space where the app renders a non-breaking space. The test fails and the text looks identical.

**Source:** https://playwright.dev/docs/test-assertions

### When is an explicit wait the right tool? What is `locator.waitFor`?

Topic: pw-waits-assertions | Standard | id: q0011

**Say:** Actions auto-wait and assertions retry, so I add an explicit wait only for an effect the action does not guarantee. Examples: a navigation after a submit (`waitForURL`), a request my click triggers (`waitForResponse`, started before the click), or a loader that must be gone before I continue. `locator.waitFor({ state })` waits for `attached`, `detached`, `visible` or `hidden`. I prefer an assertion when the state is the thing I want to prove, and `waitFor` when it is only a precondition.

**Full process:**
1. Navigation: `await page.waitForURL('**/dashboard')` or `await expect(page).toHaveURL(...)`.
2. Response: start the promise first, then trigger, then await (see the next question).
3. A loader: `await loader.waitFor({ state: 'detached' })`. `detached` means the node is not in the DOM at all. A loader that never showed already satisfies it.
4. Hidden by CSS only (`display:none` but still in the DOM): use `hidden`, not `detached`.

```ts
const loader = page.getByRole('progressbar', { name: 'Loading', exact: true });
await page.getByRole('button', { name: 'Search', exact: true }).click();
await loader.waitFor({ state: 'detached' });
await expect(page.getByRole('row')).toHaveCount(10);
```

**Follow-ups:**
- *Do you add `waitFor({ state: 'visible' })` before every click?* No. The click already waits for visible, stable, enabled and receives-events. A redundant wait only adds noise, even inside an iframe or shadow DOM.
- *Visible-only `toBeHidden` risk?* A lone `toBeHidden()` also passes when the dialog never opened. I assert it is visible first, then assert it is hidden.
- *`isVisible()`?* It does not wait, so I never branch on it for flow control.

**Trap:** Waiting for `state: 'visible'` when the real need is a gone-state, or using `detached` for an element the app only hides with CSS.

**Source:** https://playwright.dev/docs/actionability

### How do you wait for a network response triggered by a click without a race?

Topic: pw-waits-assertions | Standard | id: q0012

**Say:** I start listening for the response before I trigger it. If I click first and listen after, a fast response can come back before the listener exists, and the test hangs or fails. So I create the `waitForResponse` promise first, do the click, then await the promise. The same pattern works for `popup`, `download` and `filechooser` events. I put them in one `Promise.all`, or I keep the promise in a variable and await it after the action.

**Full process:**
1. Build the promise with a predicate that is specific: URL and HTTP method.
2. Run the action.
3. Await the promise and assert on the status or body.

```ts
const [response] = await Promise.all([
  page.waitForResponse(
    (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
  ),
  page.getByRole('button', { name: 'Place order', exact: true }).click(),
]);
expect(response.status()).toBe(201);
```

**Follow-ups:**
- *Why not `await` the click first?* Because the response can arrive during the click, before `waitForResponse` is called.
- *Is a response wait always needed?* No. If a visible effect follows the response, a web-first assertion on it is enough and simpler. I use the response wait when the effect is not visible, or when I want to assert on the status.
- *`expect(response).toBeOK()`?* Better than an `if (!response.ok())` throw: it reports the status in the failure.

**Trap:** `await click(); await waitForResponse(...)`. It works on a laptop and fails on CI.

**Source:** https://playwright.dev/docs/api/class-page#page-wait-for-response

### What does `timeout: 0` mean, and how do you check the current state once without waiting?

Topic: pw-waits-assertions | Standard | id: q0013

**Say:** In Playwright `timeout: 0` means no timeout, not "check once". So `toHaveCount(0, { timeout: 0 })` waits forever until the test timeout, and passes as soon as the element is gone. If I really want a one-shot read of the current state, I call `await locator.count()` and assert on the number with a plain matcher. I only do that when the value is final, because it does not retry.

**Full process:**
1. Want to wait: use a retrying matcher with a normal timeout.
2. Want a single read (rare): `const n = await locator.count(); expect(n).toBe(0);`.
3. Want to wait longer for one slow step: `{ timeout: 20_000 }` on that assertion only.

**Follow-ups:**
- *What does `toPass` default to?* Timeout 0, which in that API also means it retries until the test timeout.
- *What does `isVisible()` do with a `timeout` option?* The option is ignored. `isVisible()` returns at once.
- *Where do you see the timeout in a failure?* In the error: "expect.toHaveText with timeout 5000ms" followed by the "waiting for" line.

**Trap:** Setting `timeout: 0` thinking it makes the check immediate. It makes it unbounded.

**Source:** https://playwright.dev/docs/test-timeouts

### Why is `networkidle` a bad wait, and what do you wait for instead?

Topic: pw-waits-assertions | Standard | id: q0014

**Say:** `networkidle` means no network connections for at least 500 ms. Modern apps poll, stream, send analytics, or hold a WebSocket, so the state can arrive late or never. Even when it arrives, it says nothing about the element I need to use. The Playwright docs discourage it for testing. I wait for the narrowest observable fact: the URL, a heading, a row, a response. If a tracker is the only thing keeping the page busy, waiting on the element removes the problem.

**Full process:**
1. After `goto`, wait for the page's main landmark or heading with an assertion.
2. After a navigation click, `waitForURL` or `toHaveURL`.
3. For data tables, assert the first expected row or the row count.
4. In visual tests, exclude tracker and remarketing requests from the page, so they do not delay stability.

```ts
await page.goto('/orders');
await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
await expect(page.getByRole('row')).toHaveCount(11);
```

**Follow-ups:**
- *What does `page.goto` wait for by default?* The `load` event.
- *What about `waitForLoadState('domcontentloaded')`?* It is fine when I need the document but not the resources. The element assertion is still what proves readiness.
- *Does `waitForLoadState` after `click()` help?* Rarely: a client-side route change fires no new load event, so it can return at once.

**Trap:** Using `networkidle` because "it is the safe wait". It is the slowest and least precise wait.

**Source:** https://playwright.dev/docs/api/class-page#page-wait-for-load-state

### What is the difference between a failing and a flaky test in the Playwright report?

Topic: pw-waits-assertions | Standard | id: q0015

**Say:** A test that fails and then passes on a retry is reported as flaky, and the run still succeeds unless I ask otherwise. A test that fails on every attempt is failed. A test that passes the first time is passed. Because retries make flaky tests pass quietly, I want the flaky count visible and I can make the run fail on it with `--fail-on-flaky-tests`. Flaky is a smell about the test or the product, not a pass.

**Full process:**
1. Set retries: `retries: process.env.CI ? 2 : 0`.
2. In the report, a flaky test shows each attempt, with trace of the retry when `trace: 'on-first-retry'`.
3. To gate the pipeline on flakiness, pass `--fail-on-flaky-tests` (or `failOnFlakyTests: true` in the config).
4. Count flaky tests across runs (the list reporter prints them); default JUnit keeps only the final result, so flaky-then-passed tests disappear there. Since 1.59 `includeRetries: true`, or `PLAYWRIGHT_JUNIT_INCLUDE_RETRIES=1` on `merge-reports`, adds a `<flakyFailure>` for each failed attempt.

**Follow-ups:**
- *Why not just retry?* Retries are a policy for infrastructure noise. They hide races and product bugs, and they make suites slower.
- *What happens to the worker after a failure?* Playwright discards the worker process and its browser and starts a new one, so a failure cannot leak state into the next test.
- *How do you measure a fix?* Repeat it in volume with `--repeat-each` on the base branch and on the fix.

**Trap:** Calling a green run with flaky tests "all passed".

**Source:** https://playwright.dev/docs/test-retries

### Does an assertion on a negated state need anything special, for example "the dialog is closed"?

Topic: pw-waits-assertions | Standard | id: q0016

**Say:** I prove the positive state first, then the negative one. A lone `toBeHidden()` passes when the dialog never opened, so it proves nothing about closing. I assert `toBeVisible()` after the open action, then do the close action, then assert `toBeHidden()`. The pair also gives two different failure messages, which makes the diagnosis faster. Keeping both assertions around a state change is a pair, not duplication.

**Full process:**
1. Open the dialog and assert it is visible.
2. Close it.
3. Assert it is hidden (or `not.toBeAttached()` if the app removes it).
4. Only then do the next keyboard action, because a closing animation can return focus to the opener and eat keystrokes.

```ts
const dialog = page.getByRole('dialog', { name: 'Delete project', exact: true });
await page.getByRole('button', { name: 'Delete', exact: true }).click();
await expect(dialog).toBeVisible();
await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
await expect(dialog).toBeHidden();
```

**Follow-ups:**
- *`toBeHidden` or `not.toBeVisible`?* Equivalent in effect. `toBeHidden` also passes when the element is not in the DOM.
- *`toBeInViewport` versus `toBeVisible`?* `toBeVisible` checks the box and visibility, `toBeInViewport` checks intersection with the viewport. I assert visible first, so a missing element and an off-screen element fail differently.
- *Do these two pass for clipped content?* Yes, both pass for content clipped by a too-short container, so for clipping I compare the bounding box with the container.

**Trap:** A single `toBeHidden()` after an action that may have done nothing.

**Source:** https://playwright.dev/docs/actionability

### How do `test.step` and a custom `expect` message help reporting?

Topic: pw-waits-assertions | Standard | id: q0017

**Say:** `test.step` groups actions into a named block that shows up in the HTML report and the trace viewer, so a failure tells me which business step broke. A custom message as the second argument of `expect` appears in reports for both passing and failing assertions. I use them where the locator alone does not explain the intent, for example a login step in a long flow.

**Full process:**
1. Wrap the logical step: `await test.step('Log in as admin', async () => { ... })`.
2. Add a message to an assertion that is not self-explaining: `expect(locator, 'user should be logged in')`.
3. Since 1.63 a step accepts `subtitle` and `params` for reporters.

```ts
await test.step('Log in', async () => {
  await page.getByLabel('Email', { exact: true }).fill('ann@example.com');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true }), 'should be logged in').toBeVisible();
});
```

**Follow-ups:**
- *Do steps change timeouts?* No. They are reporting only.
- *Where do diagnostics go?* `testInfo.attach()` instead of `console.log`, so they land in the report.
- *Is a step a place for an assertion?* Yes, assertions inside steps are fine, and a failure marks the step.

**Trap:** Using steps to hide long scripts. A step is a label, not a structure for reuse (fixtures and page objects do that).

**Source:** https://playwright.dev/docs/test-assertions

## Section 2: Locators

### What is the priority order of locators in Playwright, and why?

Topic: pw-locators | Core | id: q0018

**Say:** The recommended order is `getByRole` first, then `getByText`, `getByLabel`, `getByPlaceholder`, `getByAltText` and `getByTitle`, then `getByTestId`, and CSS or XPath last. Role and text locators describe what a user sees and what assistive technology reads, so they survive markup changes and they fail when the product's accessibility breaks. Test ids are stable but not user-facing. CSS and XPath are tied to the DOM structure and break on a refactor. A good rule is: user-facing first, and I add no new test ids.

**Full process:**
1. Interactive element: `getByRole(role, { name })`. Add `exact: true` so a shorter name does not match a longer one.
2. Form field: `getByLabel` when a label exists.
3. Non-interactive text: `getByText`.
4. Only when no user-facing locator works: an existing `getByTestId`.
5. CSS or XPath only as a last resort, and never `nth()` or `first()` except while diagnosing.

```ts
await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
await page.getByLabel('Password', { exact: true }).fill('secret');
await expect(page.getByText('Order placed', { exact: true })).toBeVisible();
```

**Follow-ups:**
- *Why not CSS selectors?* Classes and structure change for styling reasons. A test tied to them breaks without any behavior change.
- *What if the element has no accessible name?* Fix it in the product, then locate by role and name. Building a structural locator around the gap hides an accessibility defect.
- *When is `getByTestId` right?* For technical or unnamed elements with no user-facing handle, such as a canvas or a chart wrapper, when an id already exists.

**Trap:** Answering "I use `data-testid` everywhere because it is the most stable". Stable is not the same as testing what the user perceives.

**Source:** https://playwright.dev/docs/locators

### How does `getByRole` work, and how do you find the accessible name?

Topic: pw-locators | Core | id: q0019

**Say:** `getByRole` finds elements by their ARIA role, explicit or implicit, and optionally by accessible name. A `<button>` has the role `button` without any attribute, and its name comes from its content, `aria-label` or `aria-labelledby`. I use `name` with `exact: true`, because by default the name match is a case-insensitive substring. If the name has a dynamic part, I use an anchored regex.

**Full process:**
1. Identify the role: button, link, textbox, checkbox, heading (with `level`), dialog, row, cell.
2. Get the name: run codegen (`npx playwright codegen <url>`), use the Playwright Inspector pick locator, or print `await page.locator('body').ariaSnapshot()`.
3. Write `getByRole('role', { name: 'Name', exact: true })`.
4. For a dynamic name: `name: /^New Flow .+ \d{2}:\d{2}:\d{2}$/`.
5. Assert the name when it matters: `await expect(locator).toHaveAccessibleName('Save')`.

```ts
await page.getByRole('heading', { name: 'Sign up', level: 1, exact: true }).waitFor();
await page.getByRole('checkbox', { name: 'I agree to the terms', exact: true }).check();
await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveAccessibleName('Send');
```

**Follow-ups:**
- *Does `getByRole` find hidden elements?* By default it matches only elements in the accessibility tree, so hidden ones are excluded. The `includeHidden` option includes them.
- *What happens if I rename a button in the product?* Every `getByRole` using the old name matches nothing. Retries cannot fix a locator that matches nothing, so I grep the old name across specs and page objects before merging.
- *Role locator for a checkbox or its label?* I locate the control itself (`getByRole('checkbox', { name })`), not its label text, because a label locator keeps passing when the control is broken.

**Trap:** Forgetting that the name match is a substring by default. A button "Save" and one called "Save and close" both match without `exact: true`.

**Source:** https://playwright.dev/docs/locators

### What is strictness in Playwright locators? What do you do on a "strict mode violation"?

Topic: pw-locators | Core | id: q0020

**Say:** Locators are strict: an action on a locator that matches more than one element throws a "strict mode violation" error and lists the matches. That protects the test from clicking the wrong element by accident. I fix it by making the locator more specific: scope it to a stable parent, add a name with `exact: true`, or filter. I do not silence it with `first()` or `nth()`, because that hides an ambiguity that will break later when the DOM order changes. Methods that work on many elements, like `count()` and `allTextContents()`, do not need a single match.

**Full process:**
1. Read the error: it prints each matching element with a short snippet.
2. Decide what separates the intended one: a container, an accessible name, a role.
3. Narrow from a stable parent with chaining or `filter`.
4. Re-run with `--repeat-each` to be sure the match is stable.

```ts
// fails: two "Delete" buttons
// await page.getByRole('button', { name: 'Delete', exact: true }).click();

// fixed: scope to the row that contains the item
const row = page.getByRole('row').filter({ hasText: 'Invoice 1042' });
await row.getByRole('button', { name: 'Delete', exact: true }).click();
```

**Follow-ups:**
- *When is `first()` acceptable?* While diagnosing, to see what the other matches are. Not in a merged test, as a rule.
- *Is a locator checked for strictness when I only assert?* Yes, web-first assertions on a locator also require one element, except matchers built for lists such as `toHaveCount` and `toHaveText([...])`.
- *Why not `{ strict: false }`?* There is no such switch for locator actions, and `first()`/`nth()` are the opt-outs. I prefer a meaningful relationship over an index.

**Trap:** Fixing the error with `.first()`. It makes the test green and the next DOM reorder silently clicks the wrong thing.

**Source:** https://playwright.dev/docs/locators

### How do you filter and chain locators?

Topic: pw-locators | Core | id: q0021

**Say:** Chaining narrows the search: a locator method called on a locator searches only inside it. `filter` narrows a set by text or by a descendant. I use `filter({ hasText })` and `filter({ has: locator })` to find the row or card that contains something, then chain a role locator inside it. `hasNotText` and `hasNot` exclude. The inner locator in `has` is relative to the outer match, not the page.

**Full process:**
1. Find the repeating item with a role: `getByRole('listitem')` or `getByRole('row')`.
2. Filter by content: `filter({ hasText: 'Product 2' })` (case-insensitive for strings, or a regex), or by a child: `filter({ has: page.getByRole('heading', { name: 'Product 2', exact: true }) })`.
3. Chain the target inside: `.getByRole('button', { name: 'Add to cart', exact: true })`.
4. `and()` combines two conditions on one element, `or()` accepts either of two, which can match both, so then it needs narrowing.

```ts
const product = page
  .getByRole('listitem')
  .filter({ has: page.getByRole('heading', { name: 'Product 2', exact: true }) });
await product.getByRole('button', { name: 'Add to cart', exact: true }).click();
await expect(page.getByRole('status')).toHaveText('1 item in cart');
```

**Follow-ups:**
- *`filter({ hasText })` and exactness?* `hasText` is a substring or regex match, not exact. For an exact heading I use `has` with a role locator and `exact: true`.
- *`and` versus chaining?* Chaining means "inside". `and` means "the same element matches both".
- *What is `filter({ visible })`?* It keeps only visible or only non-visible matches. Since 1.63 there is also `locator.visible()`, the replacement for the `:visible` CSS pseudo-class.

**Trap:** Chaining many CSS hops instead of a semantic relationship. A parent hop is as brittle as XPath.

**Source:** https://playwright.dev/docs/locators

### What is `locator.within()`, and what else is new in locators in recent versions?

Topic: pw-locators | Core | id: q0022

**Say:** `within()` came in 1.64. It combines two locators I already have, reading naturally: "this button, within that dialog". Relative locators such as `nth()` are resolved inside each parent separately, which makes column-like queries easy. Close neighbours: 1.63 added `locator.visible()` and `frameLocator()` without a selector, which searches in any frame, and 1.64 made elements inside hidden iframes count as hidden. I would use `within` when I already hold both locators, and keep chaining otherwise.

**Full process:**
1. Hold two locators: `const save = page.getByRole('button', { name: 'Save', exact: true }); const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });`.
2. Combine: `await save.within(dialog).click();`.
3. Column query: `page.getByRole('cell').nth(2).within(page.getByRole('row'))` is the third cell of every row.

**Follow-ups:**
- *Why does this matter for page objects?* A page object can expose a button and a dialog separately, and the test combines them.
- *Is it available in older versions?* No, it is 1.64 and later, so I check the version before using it in a team repo.
- *`frameLocator()` with no selector?* It finds a frame by searching the subtree and throws if the match is in several frames (1.63).

**Trap:** Quoting an API from a release note without checking the repo's pinned version.

**Source:** https://playwright.dev/docs/release-notes

### How do you work with iframes in Playwright?

Topic: pw-locators | Standard | id: q0023

**Say:** I use `frameLocator()` with a stable selector for the iframe, then locate the content with normal semantic locators inside it. Locators inside a frame auto-wait and re-resolve like any other, which is why I prefer them to handling a `Frame` object or an element handle's `contentFrame()`. If I need a `Frame` for navigation events or evaluation, I use `page.frame()` with a name or URL. Recent versions: a hidden iframe makes its content hidden for actions and assertions, and `frameLocator()` with no selector searches all frames.

**Full process:**
1. Identify the iframe by a stable attribute (title, name, or id).
2. `const frame = page.frameLocator('iframe[title="Payment"]');`
3. Locate inside: `frame.getByLabel('Card number', { exact: true }).fill('4242 4242 4242 4242')`.
4. Nested iframes: chain `frameLocator` calls.
5. Assert inside the frame with a normal web-first matcher.

```ts
const payment = page.frameLocator('iframe[title="Secure payment"]');
await payment.getByLabel('Card number', { exact: true }).fill('4242 4242 4242 4242');
await payment.getByRole('button', { name: 'Pay', exact: true }).click();
await expect(page.getByRole('heading', { name: 'Thank you', exact: true })).toBeVisible();
```

**Follow-ups:**
- *What if the iframe loads later?* The locator waits for the frame and the element in it, so no extra wait is needed.
- *Does a locator inside the iframe need a wait before it, because it is "in a frame"?* No. Adding `waitFor` merely for the context is redundant.
- *Cross-origin iframe?* Playwright can reach it, unlike tools that run inside the page.

**Trap:** Using `page.locator('iframe').contentFrame()` or `elementHandle().contentFrame()` and then timing issues with a stale handle.

**Source:** https://playwright.dev/docs/locators

### Do Playwright locators pierce shadow DOM?

Topic: pw-locators | Standard | id: q0024

**Say:** Yes. CSS and role/text locators pierce open shadow roots by default, so `getByText` and `getByRole` find elements inside a shadow root without extra syntax. XPath does not pierce shadow roots, and closed shadow roots are not supported. So I do not need to write special code for web components, and I keep using semantic locators.

**Full process:**
1. Write the locator as usual: `page.getByRole('button', { name: 'Details', exact: true })`.
2. If it fails to find the element, check whether the root is closed and whether the locator is XPath.
3. For testing the serialized markup, `page.content({ includeShadow: true })` (1.64) serializes open shadow roots.

**Follow-ups:**
- *What about Selenium?* It needs explicit shadow root access (`getShadowRoot`) and a second search inside it.
- *Is an accessible name computed through the shadow boundary?* Yes for rendered text. In 1.65 text that is not rendered (for example text not assigned to a slot) is no longer part of accessible names.
- *When might a role locator miss it?* When the component exposes no role or name. Then I fix the component's accessibility.

**Trap:** Believing you need `>>` chains or JS evaluation for shadow DOM.

**Source:** https://playwright.dev/docs/locators

### When is `getByTestId` the right choice?

Topic: pw-locators | Standard | id: q0025

**Say:** When there is no user-facing handle for the element: a chart canvas, a wrapper with no role or name, or an element whose text changes per user. It is stable and cheap, but it says nothing about what the user sees, and it never tells you that an accessible name is missing. A strict rule is to never add new test ids and to use an existing one only when no user-facing locator works. Where a team already uses ids, `testIdAttribute` in the config maps Playwright to the attribute name they use.

**Full process:**
1. Try role, then label, then text.
2. If none fits and an id exists, use `getByTestId('chart-revenue')`.
3. If the repo uses `data-test-id`, set `use: { testIdAttribute: 'data-test-id' }`. Playwright's default is `data-testid`.
4. If an id is unused after the move to semantic locators, remove it.

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({ use: { testIdAttribute: 'data-test-id' } });
```

**Follow-ups:**
- *What if the product has two id attributes?* `getByTestId` reads one. Moving to semantic locators removes the need for either.
- *Is a test id an accessibility tool?* No. It is invisible to users, so it can stay while the element is unusable.
- *Convince a developer who prefers ids?* Show a role locator catching a missing label, which an id would never catch.

**Trap:** "Test ids are best practice, so I add one to every element". The docs rank them below user-facing locators.

**Source:** https://playwright.dev/docs/locators

### Why do Playwright locators re-resolve, and how is that different from an element handle?

Topic: pw-locators | Standard | id: q0026

**Say:** A locator is a recipe, not a reference. Every time I act on it or assert on it, Playwright runs the query again and gets a fresh DOM node. An element handle is a pointer to one node that existed at one moment. In a framework like React the node can be replaced on each render, so a handle goes stale and fails with a detached error. A locator survives re-renders, and that is why the docs recommend locators and discourage handles.

**Full process:**
1. Create the locator once: `const row = page.getByRole('row', { name: /Invoice 1042/ });` Nothing is queried yet.
2. At each `click()` or `expect(row)...`, Playwright queries the page, checks actionability, and acts.
3. A handle from `page.$()` or `locator.elementHandle()` is bound to one node, so after a re-render it points at nothing.
4. In page objects, store `Locator` objects, never handles.

```ts
const status = page.getByRole('status');
await expect(status).toHaveText('Saving');   // query 1
await expect(status).toHaveText('Saved');    // query 2, fresh node
```

**Follow-ups:**
- *Is it expensive?* No. The query is cheap and it is what makes auto-waiting work.
- *Does a locator hold state?* No, only the selector and its chain. It can be created before the element exists.
- *Which class fields trap exists in 1.65?* With TypeScript's `useDefineForClassFields` now followed (1.65), a field initializer that reads a constructor parameter property fails, because the initializer runs first. Initialize locators in the constructor.

**Trap:** Saying "locators cache the element". They do the opposite.

**Source:** https://playwright.dev/docs/locators

### How do you assert on a list or a table with locators?

Topic: pw-locators | Standard | id: q0027

**Say:** I use the list-aware web-first matchers. `toHaveCount(n)` waits for the number of matches. `toHaveText([...])` passes an array and checks both the count and the text of each item in order. To check one row, I filter the rows by text and assert inside it. I avoid `locator.all()` and loops over `await`, because `all()` returns whatever exists at that moment and does not wait.

**Full process:**
1. Wait for the set: `await expect(rows).toHaveCount(3)`.
2. Check content: `await expect(rows).toHaveText(['a', 'b', 'c'])`.
3. A single row: `rows.filter({ hasText: 'Invoice 1042' })` then assert cells inside.
4. Never `forEach(async ...)` for assertions: it awaits nothing. Use `for...of` with `await`, or `Promise.all`.

```ts
const rows = page.getByRole('row');
await expect(rows).toHaveCount(4); // header + 3
const invoice = rows.filter({ hasText: 'Invoice 1042' });
await expect(invoice.getByRole('cell').nth(2)).toHaveText('PAID');
```

**Follow-ups:**
- *Why is `forEach` with async a bug?* It does not await the callbacks, so assertions race.
- *How do you check sorting?* Read the texts with `await expect.poll(() => rows.allTextContents())` and compare with a sorted copy, or use `toHaveText` with the expected order.
- *The nth in my example breaks my rule?* It is shown to read a column. A semantic alternative is a `columnheader` check or a cell with an accessible name, and the cell-in-row relation is the meaningful part.

**Trap:** `const n = await rows.count(); expect(n).toBe(3)` right after navigation.

**Source:** https://playwright.dev/docs/test-assertions

## Section 3: Why Playwright, architecture, comparison

### Why Playwright? What is it and what does it give you?

Topic: pw-general | Core | id: q0028

**Say:** Playwright is an end-to-end testing library and test runner from Microsoft. It drives Chromium, Firefox and WebKit with one API, on Windows, Linux and macOS, and it has bindings for Node.js, Python, Java and .NET. What I like in practice is that reliability is built in: auto-waiting, web-first assertions, isolated browser contexts per test, and a trace viewer that records every action with DOM snapshots and network. It also gives parallel workers, projects for cross-browser runs, network mocking, an API testing client, and codegen.

**Full process:**
1. Install: `npm init playwright@latest`. It asks TypeScript or JavaScript, an optional GitHub Actions workflow, and whether to install browsers.
2. It creates `playwright.config.ts`, a `tests/` folder with `example.spec.ts`, and `package.json`.
3. Run: `npx playwright test`. Open the HTML report: `npx playwright show-report`.
4. Debug: `npx playwright test --ui`, `--debug`, or a trace.
5. Node requirement per the install page: latest 22.x, 24.x or 26.x.

**Follow-ups:**
- *What has it that others lack?* Cross-engine support including WebKit, multi-tab and multi-origin in one test, a built-in runner with parallelism and fixtures, and tracing.
- *Weak points?* The WebKit build is not real Safari, and it is a newer ecosystem than Selenium, with a smaller set of third-party integrations and grid vendors.
- *Which features have you used?* Test runner, fixtures, projects, storage state, network mocking, the API request client and the trace viewer.

**Trap:** Describing Playwright as "like Selenium but faster". The architecture and the built-in runner are the point.

**Source:** https://playwright.dev/docs/intro

### How is Playwright built? Explain the architecture, the browsers and the protocols.

Topic: pw-general | Core | id: q0029

**Say:** A test script talks to a Playwright server process through a JSON-based channel, and that server talks to each browser with that browser's own protocol. For Chromium it is the Chrome DevTools Protocol, over a pipe. Firefox and WebKit are builds that Playwright patches and ships with its own version, with protocol extensions added, so Playwright does not work with branded Firefox or Safari. Because the browser is controlled out of process through a protocol, not through code injected into the page, tests can handle several tabs, origins and contexts. Tests in the runner run in separate worker processes, each with its own browser.

**Full process:**
1. Your test code uses the client API (`page.click`, `locator`), and each call becomes a message to the Playwright driver.
2. The driver translates it to the browser protocol: CDP for Chromium, Playwright's patched protocol for Firefox and WebKit.
3. The browser executes it and sends events back (network, dialogs, console), which Playwright exposes as events and promises.
4. Browsers are installed with `npx playwright install`, and each Playwright version pins its browser builds.
5. You can also use branded Chromium channels: `channel: 'chrome'` or `'msedge'` in `use`.

**Follow-ups:**
- *What is the difference between `connect` and `connectOverCDP`?* `connect` attaches to a Playwright server started with `launchServer` and needs a matching Playwright version. `connectOverCDP` attaches to a running Chromium over raw CDP and is, per the docs, lower fidelity. It is Chromium only.
- *Why are browser builds pinned to the version?* Playwright relies on patches in Firefox and WebKit and a curated list of launch arguments.
- *What about WebDriver BiDi?* It is the W3C bidirectional standard, and Selenium is building on it. If you have not used it directly in Playwright, say so plainly and explain that it is currently not a core part of the Playwright API surface.

**Trap:** Saying Playwright uses WebDriver like Selenium. It does not: it uses each browser's own automation protocol.

**Source:** https://playwright.dev/docs/api/class-browsertype

### What is a browser context, and why does it matter for tests?

Topic: pw-general | Core | id: q0030

**Say:** A browser context is an isolated, incognito-like profile inside one browser instance: its own cookies, local storage, session storage, cache, permissions and pages. The test runner creates a fresh context for every test, so one test's login or data cannot leak into the next. Creating a context is fast and cheap compared with launching a browser, so the isolation does not cost much. I can also open two contexts in one test to model two users, for example an admin and a visitor in a chat.

**Full process:**
1. A `Browser` is shared across tests in a worker.
2. For each test, the `context` fixture creates a new `BrowserContext`, and the `page` fixture opens one page in it.
3. A page is one tab or popup. A context can hold several pages that share cookies and routes.
4. Two users in one test: create two contexts yourself.

```ts
import { test, expect } from '@playwright/test';

test('admin and visitor chat', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const visitorContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const visitor = await visitorContext.newPage();

  await visitor.goto('/widget');
  await visitor.getByRole('textbox', { name: 'Message', exact: true }).fill('Hello');
  await visitor.getByRole('button', { name: 'Send', exact: true }).click();

  await admin.goto('/inbox');
  await expect(admin.getByText('Hello', { exact: true })).toBeVisible();

  await adminContext.close();
  await visitorContext.close();
});
```

**Follow-ups:**
- *Why not a new browser per test?* A browser launch is far slower, and a context gives the same isolation.
- *Does the context fixture clean up?* Yes. Contexts you create yourself you must close.
- *Is a context a security boundary?* It isolates storage from the app's view. It is not a sandbox against hostile code.

**Trap:** Mixing up page and context. Cookies belong to the context, so two pages in one context share a login.

**Source:** https://playwright.dev/docs/browser-contexts

### What is the difference between the Playwright library and Playwright Test?

Topic: pw-general | Core | id: q0031

**Say:** The library (`playwright`) is the automation API: launch a browser, create a context, open a page. You manage everything yourself, and it has no built-in assertions. Playwright Test (`@playwright/test`) is a full test runner on top of it: it creates an isolated context and page for each test, runs tests in parallel workers, provides fixtures, retries, reporters, projects, and web-first assertions. For E2E testing the docs say to use Playwright Test. I would use the library for scraping, scripts, or when I need to bring my own runner.

**Full process:**
1. Library: `npm i -D playwright`, then `chromium.launch()`, `browser.newContext()`, `context.newPage()`, and close everything.
2. Test runner: `npm init playwright@latest`, then write `test('...', async ({ page }) => ...)`.
3. The runner owns lifecycle: you do not close the built-in fixtures.

```ts
// library: you manage everything
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://playwright.dev/');
console.log(await page.title());
await browser.close();
```

**Follow-ups:**
- *Can you use Playwright with Jest?* Yes, with the library, but you lose the runner's fixtures, parallel model, trace integration and web-first `expect`.
- *Which is `playwright-core`?* The package without bundled browsers, used by wrappers and tools.
- *Why does it matter in an interview?* It shows you know that most of what people call "Playwright features" (fixtures, retries, projects) belong to the test runner.

**Trap:** Saying "Playwright is a test framework". The core is a browser automation library, and the test runner is a separate package.

**Source:** https://playwright.dev/docs/library

### Compare Playwright and Cypress.

Topic: tools-other-e2e | Core | id: q0032

**Say:** If you have used Playwright in depth and only basic experience with Cypress, say so, and here is the architectural difference as understood from the docs. Cypress runs the test code inside the browser, in JavaScript only, and its own docs list the trade-offs: it controls one browser at a time, each test is bound to one superdomain (with `cy.origin` for cross-origin), and iframe support is limited. Playwright controls the browser from outside through a protocol, so multiple tabs, contexts and origins in one test are normal, it supports WebKit, and the runner is multi-process. It would be reasonable to pick Cypress if a team already has a Cypress suite and good reasons to keep it.

**Full process:** For a comparison answer, hold five points and say them in this order:
1. Where the test code runs: in the browser (Cypress), outside through a protocol (Playwright).
2. Browsers: Playwright runs Chromium, Firefox, WebKit; Cypress lists its own support, check the current docs before quoting.
3. Multi-tab and multi-origin: normal in Playwright, restricted in Cypress by design (`cy.origin`, a plugin for tabs).
4. Parallelism: Playwright parallelizes by workers on one machine and shards across machines for free. Cypress parallelism ties to its Cloud product or other tooling.
5. Languages: Playwright has Node.js, Python, Java and .NET. Cypress test code is JavaScript or TypeScript.

**Follow-ups:**
- *Where does Cypress win?* A friendly interactive runner with time travel, a mature plugin ecosystem, and a team that already knows it.
- *Can Cypress test iframes?* Same-origin iframes can be queried; the docs list iframe support as a temporary trade-off.
- *Have you migrated between them?* No. I would start by running both on a few high-value flows, comparing flake rate and runtime, and migrate by risk.

**Trap:** Claiming deep Cypress experience. The honest answer is basics, plus the concept.

**Source:** https://docs.cypress.io/app/references/trade-offs

### Compare Playwright and Selenium.

Topic: tools-other-e2e | Core | id: q0033

**Say:** If you have basic Selenium experience and Playwright is your main tool, say so. Selenium WebDriver is a W3C standard and drives real browsers through their drivers; it has the widest language support and the biggest ecosystem, including grids and cloud vendors. Playwright is a newer tool that talks to browsers over each browser's own protocol, and it comes with the test runner, auto-waiting and tracing built in. In Selenium, waits were often written manually (implicit and explicit); in Playwright, actions auto-wait. Selenium is also adding WebDriver BiDi, the bidirectional standard that gives it event access similar to Playwright.

**Full process:** The points to hold:
1. Standard versus tool: Selenium implements the W3C WebDriver standard. Playwright uses each engine's protocol (CDP for Chromium) and ships patched Firefox and WebKit.
2. Test runner: Selenium is only the driver, so you add a runner and a reporter. Playwright Test is included.
3. Waiting: manual in Selenium (explicit waits, expected conditions). Automatic actionability checks in Playwright.
4. Real browsers: Selenium can drive real branded browsers including Safari, which matters for exact browser behavior. Playwright's WebKit is a build, not Safari.
5. Ecosystem: Selenium has a long history with grids and many languages. Playwright covers Node.js, Python, Java and .NET.

**Follow-ups:**
- *When is Selenium the better choice?* A large existing suite, a need for real Safari or older browsers, or a Java or C# shop with a Selenium Grid.
- *Is Playwright faster?* Often, because of contexts and parallel workers, but I would measure on the team's suite and not claim a number.
- *How do you migrate?* By flow, keep both running while the Playwright suite proves equal coverage, then retire the old tests.

**Trap:** Saying "Selenium is outdated". It is a standard with a large installed base.

**Source:** https://www.selenium.dev/documentation/webdriver/

### What is new in recent Playwright versions that you would care about?

Topic: pw-general | Core | id: q0034

**Say:** The latest is 1.65, and a few things matter for a QA suite. Test locks (1.63) let tests that share a resource avoid running at the same time, and 1.65 adds a built-in exclusive lock for tests that must run alone. `--shuffle` (1.64) randomizes the order to find hidden dependencies between tests. `locator.within()` (1.64) and `locator.visible()` (1.63) improve locators. In 1.65, actions wait for the element to be not inert, a sharded run fails if no tests match in any shard, and there is a `failures` reporter and an `onlyFailures` option. I read the release notes for each upgrade, because breaking changes touch real suites.

**Full process:**
1. Test locks: `test('...', { lock: 'user-settings' }, ...)`. Tests that share a lock name never run at the same time, across files, workers and projects. `{ lock: '-exclusive-' }` (1.65) runs a test only when nothing else is running.
2. Shuffle: `npx playwright test --shuffle`, then pass the printed seed to reproduce: `--shuffle 271828182`.
3. Project `default: false` (1.64): keep a project in the config but out of a plain `npx playwright test`; run it with `--project=firefox` or `--project="*"`.
4. Reports (1.65): `reporter: [['failures'], ['html', { onlyFailures: true }]]`.
5. Breaking in 1.65: TypeScript class fields follow `useDefineForClassFields`, so a page object field initializer that reads a constructor parameter property now throws.
6. Also 1.65: the test runner runs under Bun with `bunx --bun playwright test`, without watch mode.

**Follow-ups:**
- *Which breaking change would hit a page-object suite first?* The class fields change: a field like `readonly submit = this.page.getByRole(...)` with `constructor(private readonly page: Page)` throws. Move the initialization into the constructor.
- *What does `test.skip('reason')` do now?* As of 1.65 `skip`, `fixme`, `fail` and `slow` accept only a description and record it in the annotation.
- *How do you upgrade safely?* Read the release notes, bump in a branch, run the suite with a repeat on the base and the branch, and update snapshots only after reviewing diffs.

**Trap:** Quoting features from memory without a version. I check the release notes and the repo's pinned version.

**Source:** https://github.com/microsoft/playwright/releases/tag/v1.65.0

### How does the Playwright test runner execute tests: processes, files and order?

Topic: pw-general | Standard | id: q0035

**Say:** The runner starts worker processes, which are separate OS processes with their own browser. Test files run in parallel across workers, and the tests inside one file run in order, in the same worker, unless I enable full parallelism. After a test fails, the worker is shut down and a new one starts, so a failure cannot dirty the next test. Workers cannot talk to each other. Each test gets its own context and page, built from fixtures.

**Full process:**
1. The runner loads the config and collects tests (`npx playwright test --list` shows them without running).
2. It schedules test files across workers. The default workers count is 50% of the CPU cores.
3. Each worker runs its tests, set up fixtures per test and worker-scoped fixtures once.
4. Results flow back to the reporters.
5. A failed test restarts the worker, and with retries on, the new worker retries the failed test.

**Follow-ups:**
- *How do you share data between workers?* You do not at runtime. Use the backend, files created before the run (setup project), or one account per worker.
- *What is `workerIndex` versus `parallelIndex`?* `workerIndex` is unique and grows on restart; `parallelIndex` stays between 0 and workers minus 1 and is reused by the restarted worker.
- *What is `--list` for?* To check which tests the filters select, for example before and after splitting a spec file.

**Trap:** Thinking tests in one file run in parallel by default. They do not.

**Source:** https://playwright.dev/docs/test-parallel

## Section 4: Fixtures

### What are fixtures in Playwright Test, and why use them instead of `beforeEach`?

Topic: pw-fixtures | Core | id: q0036

**Say:** A fixture is a named piece of setup that a test asks for by listing it in its arguments, like `{ page }` or `{ todoPage }`. Playwright builds only the fixtures the test uses, in dependency order, and tears them down after. They beat hooks in four ways: setup and teardown live in one place, they are reusable across files, they are on demand, and they compose by depending on each other. Hooks force you to group tests in `describe` blocks by shared setup, while fixtures let me group tests by meaning.

**Full process:**
1. Define with `test.extend` in a shared file.
2. Code before `await use(value)` is setup, code after is teardown.
3. Import `test` from that file in specs.
4. Tests destructure the fixtures they need.

```ts
// fixtures.ts
import { test as base, expect } from '@playwright/test';

class TodoPage {
  constructor(private readonly page: import('@playwright/test').Page) {}
  async goto() { await this.page.goto('https://demo.playwright.dev/todomvc/'); }
  async add(text: string) {
    await this.page.getByPlaceholder('What needs to be done?', { exact: true }).fill(text);
    await this.page.keyboard.press('Enter');
  }
}

export const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await use(todoPage);
    // teardown goes here, after use()
  },
});
export { expect };
```

```ts
// todo.spec.ts
import { test, expect } from './fixtures';

test('adds an item', async ({ todoPage, page }) => {
  await todoPage.add('buy milk');
  await expect(page.getByText('buy milk', { exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *When is a hook still fine?* For a small local setup used in one file, such as navigating before each test in a describe block.
- *Are fixtures isolated between tests?* Test-scoped fixtures are created fresh for every test.
- *What are the built-in fixtures?* `page`, `context`, `browser`, `browserName`, `request`.

**Trap:** "Fixtures are the same as `beforeEach`". They are on demand, composable, and own their teardown.

**Source:** https://playwright.dev/docs/test-fixtures

### What is the difference between test-scoped and worker-scoped fixtures?

Topic: pw-fixtures | Core | id: q0037

**Say:** A test-scoped fixture is set up and torn down for every test. It is the default. A worker-scoped fixture is set up once per worker process and shared by every test that worker runs. I use worker scope for expensive things that tests only read, like creating an account or starting a service, and test scope for anything a test can change. A worker fixture cannot depend on a test-scoped one, because it outlives it.

**Full process:**
1. Test scope: `todoPage: async ({ page }, use) => { ... }`.
2. Worker scope: use the tuple form with `{ scope: 'worker' }`, and put its type in the second generic parameter of `extend`.
3. Worker fixtures get their own timeout equal to the test timeout, so a slow setup does not eat the test's time.
4. A worker is reused across files when worker fixtures match. After a failure the worker restarts and its fixtures run again.

```ts
import { test as base, expect } from '@playwright/test';

type Account = { username: string; password: string };

export const test = base.extend<{}, { account: Account }>({
  account: [
    async ({}, use, workerInfo) => {
      const username = `user${workerInfo.workerIndex}`;
      // create the account through an API here
      await use({ username, password: 'verysecure' });
      // delete the account here
    },
    { scope: 'worker' },
  ],
});
export { expect };
```

**Follow-ups:**
- *Why unique usernames from `workerIndex`?* Parallel workers must not share a mutable account.
- *`workerIndex` or `parallelIndex`?* `workerIndex` changes when a worker restarts, so a restarted worker gets a new account. `parallelIndex` is stable for the slot, which suits fixed pools of pre-made accounts.
- *Risk of worker scope?* State leaks between tests in that worker. Treat it as read-only or cleanup after each test.

**Trap:** Putting mutable data in a worker fixture. The second test that edits it fails, and a worker restart hides it as flakiness.

**Source:** https://playwright.dev/docs/test-fixtures

### How do you write teardown in a fixture?

Topic: pw-fixtures | Core | id: q0038

**Say:** Everything after `await use(...)` is teardown. It runs when the test finishes, in the reverse order of setup, whether the test passed or failed. That keeps creation and cleanup next to each other, which is the main reason to prefer fixtures over a `beforeEach` plus `afterEach` pair. Teardown has its own timeout, shared with `afterEach`, of the same size as the test timeout.

**Full process:**
1. Create data before `use`.
2. Pass the handle to the test with `use`.
3. Delete it after `use`.
4. If cleanup can fail, log it and do not throw over the test result, unless leaving data behind is itself a failure for your suite.

```ts
import { test as base, expect } from '@playwright/test';

type Project = { id: string };

export const test = base.extend<{ project: Project }>({
  project: async ({ request }, use, testInfo) => {
    const res = await request.post('/api/projects', { data: { name: `p-${testInfo.testId}` } });
    expect(res.ok()).toBeTruthy();
    const project: Project = await res.json();

    await use(project);

    const del = await request.delete(`/api/projects/${project.id}`);
    expect(del.ok()).toBeTruthy();
  },
});
```

**Follow-ups:**
- *What if the test fails?* Teardown still runs.
- *Order with several fixtures?* Reverse of setup: the fixture set up last is torn down first.
- *What about a crash of the worker?* Teardown may not run, so unique names and a sweep job for leftover data are a good safety net.

**Trap:** Cleaning up inside the test body. A failing assertion skips the cleanup.

**Source:** https://playwright.dev/docs/test-fixtures

### What is an automatic fixture?

Topic: pw-fixtures | Core | id: q0039

**Say:** An automatic fixture runs for every test (or worker) even when the test does not list it. I use it for cross-cutting work: attach logs on failure, fail a test on an unexpected console error, or clear state. The syntax is the tuple form with `{ auto: true }`.

**Full process:**
1. Write the fixture with a tuple: `[async ({}, use, testInfo) => { ... }, { auto: true }]`.
2. Use `testInfo` to read the status and attach files after `use`.
3. Keep automatic fixtures cheap, because they run for every test.

```ts
import { test as base } from '@playwright/test';

export const test = base.extend<{ saveLogs: void }>({
  saveLogs: [
    async ({ page }, use, testInfo) => {
      const logs: string[] = [];
      page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('console', { body: logs.join('\n'), contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
});
```

**Follow-ups:**
- *Can an automatic fixture be worker scoped?* Yes: `{ auto: true, scope: 'worker' }`.
- *Risk?* Hidden behavior: a new person cannot see why a test does something. I keep them few and named clearly.
- *Why `void` in the type?* The fixture provides no value.

**Trap:** Using an automatic fixture for setup that only some tests need. It slows all tests.

**Source:** https://playwright.dev/docs/test-fixtures

### What are option fixtures? How do they relate to `use` in the config?

Topic: pw-fixtures | Core | id: q0040

**Say:** An option fixture is a fixture whose value can be set from the config or from `test.use()`. I declare it with a default and `{ option: true }`. This is how the built-in options like `baseURL`, `locale` or `storageState` work. It lets me parameterize a suite per project: the same tests run with a different value of the option for each project, and the type is checked by TypeScript.

**Full process:**
1. Declare the option with a default.
2. Put the type in the first generic parameter of `extend`.
3. Override per project in `use`, or in a file or describe with `test.use`.

```ts
// fixtures.ts
import { test as base } from '@playwright/test';

export type TestOptions = { person: string };

export const test = base.extend<TestOptions>({
  person: ['John', { option: true }],
});
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import type { TestOptions } from './fixtures';

export default defineConfig<TestOptions>({
  projects: [
    { name: 'alice', use: { person: 'Alice' } },
    { name: 'bob', use: { person: 'Bob' } },
  ],
});
```

**Follow-ups:**
- *How does `test.use` scope?* At file level for the whole file, inside `describe` for that block. `test.use({ baseURL: undefined })` inside a describe resets to the config value.
- *Why not an env var?* An env var is untyped and global. An option fixture is typed and varies per project.
- *Example in the built-ins?* `baseURL`, `viewport`, `locale`, `storageState`.

**Trap:** Forgetting `defineConfig<TestOptions>`. Without it TypeScript rejects the unknown option in `use`.

**Source:** https://playwright.dev/docs/test-parameterize

### How do you combine fixtures from several files? What is `mergeTests`?

Topic: pw-fixtures | Standard | id: q0041

**Say:** Each file can export a `test` object extended with its own fixtures, for example one for pages, one for the API, one for data. `mergeTests` combines them into one `test` that has all the fixtures. That keeps fixture files small and lets a spec import a single `test`. For custom matchers there is `mergeExpects`.

**Full process:**
1. One file per area, each exporting `test`.
2. A top-level file merges them.
3. Specs import from the top-level file.

```ts
// fixtures/index.ts
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as pagesTest, expect as pagesExpect } from './pages';
import { test as apiTest, expect as apiExpect } from './api';

export const test = mergeTests(pagesTest, apiTest);
export const expect = mergeExpects(pagesExpect, apiExpect);
```

**Follow-ups:**
- *Name clashes?* If two merged fixtures share a name, the later wins, so I keep names unique.
- *Versus chaining `extend`?* Chaining is linear and ties files in a chain. `mergeTests` combines independent branches.
- *What do page objects look like here?* A fixture creates the page object from `page` and passes it with `use`.

**Trap:** Importing `test` from `@playwright/test` in one spec and from the fixtures file in another, so some tests miss the custom fixtures.

**Source:** https://playwright.dev/docs/test-assertions

### What is the order of fixture setup and teardown? Can fixtures depend on each other?

Topic: pw-fixtures | Standard | id: q0042

**Say:** Fixtures are created lazily, in the order of their dependencies: if `todoPage` needs `page`, `page` is built first, and `page` needs `context`, so the context comes first. Playwright sets up only what the test (or an automatic fixture) needs. Teardown runs in reverse. A fixture can depend on other fixtures of the same or a wider scope, never on a narrower one. A worker fixture cannot use `page`, because `page` is test-scoped.

**Full process:**
1. List the fixtures a test uses, including automatic ones.
2. Playwright builds a dependency graph from the parameters of each fixture function.
3. It sets up in dependency order, runs the test, and tears down in reverse.
4. A fixture overriding a built-in one can still use it: `page: async ({ page }, use) => { ... await use(page); }`.

```ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  // override the built-in page: navigate to baseURL first
  page: async ({ baseURL, page }, use) => {
    await page.goto(baseURL!);
    await use(page);
  },
});
```

**Follow-ups:**
- *How do `beforeEach` hooks relate?* Hooks run after the fixtures that the hook arguments need, and fixture time counts in the test timeout.
- *Can an override replace a fixture completely?* Yes, for example `storageState` can be replaced with your own value.
- *What if two fixtures depend on each other?* That is a cycle and Playwright reports an error.

**Trap:** Assuming fixtures run in the order you list them in the test arguments.

**Source:** https://playwright.dev/docs/test-fixtures

### Fixtures versus hooks versus page objects: how do you decide?

Topic: pw-fixtures | Standard | id: q0043

**Say:** A fixture is for setup that has teardown or that many tests need, such as a logged-in page, data created through an API, or a page object instance. A hook is for a small step local to one file or describe block, such as a navigation. A page object is a class with locators and user actions, and it is not a replacement for either: a fixture is the natural place to create it. A good rule is: the page object holds `Locator`s and view actions, and the assertions stay in the tests.

**Full process:**
1. Does it need cleanup, or is it reused across files? Make it a fixture.
2. Is it a one-line setup used by one describe? A `beforeEach` is fine.
3. Is it a set of locators and actions for one screen or component? A page object, created in a fixture.
4. Keep assertions in the tests, so a reader sees the contract in the test.

**Follow-ups:**
- *Why no assertions in page objects?* A hidden assertion makes a test's contract invisible and couples tests to a helper's idea of correct.
- *Per-test state in `beforeAll`?* No. Create state that a test can change per test, so a failure cannot corrupt the next test.
- *Component objects?* For a header or modal that appears on many pages, a small component object beats one giant page class.

**Trap:** A page class with one method per click. Expose meaningful user actions.

**Source:** https://playwright.dev/docs/test-fixtures

### How do you share a worker-scoped value that needs the `browser`?

Topic: pw-fixtures | Standard | id: q0044

**Say:** A worker fixture can depend on the worker-scoped `browser` fixture, so I can open my own page or context inside it. I use that to create an account or sign in once per worker, and then save a storage state file that the test-scoped `storageState` option reads. I make sure to authenticate in a clean environment by passing `storageState: undefined` to `newPage`, otherwise the project's state is applied.

**Full process:**
1. Declare a worker fixture that depends on `browser`.
2. Create the account, log in, and save `context.storageState({ path })`.
3. Close the page you opened.
4. Override `storageState` so each test uses that file.

```ts
import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export { expect };
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [
    async ({ browser }, use) => {
      const id = test.info().parallelIndex;
      const file = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);
      if (!fs.existsSync(file)) {
        const page = await browser.newPage({ storageState: undefined });
        await page.goto('/login');
        await page.getByLabel('Email', { exact: true }).fill(`worker${id}@example.com`);
        await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD ?? '');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
        await page.context().storageState({ path: file });
        await page.close();
      }
      await use(file);
    },
    { scope: 'worker' },
  ],
});
```

**Follow-ups:**
- *Why `parallelIndex`?* It maps each worker slot to one pre-made account.
- *Where is the file stored?* Under the project's `outputDir`, which is cleaned before each run, so it does not go stale.
- *Which accounts?* Unique per worker, so parallel tests do not edit one another's data.

**Trap:** Forgetting `storageState: undefined` when logging in inside a fixture. The page starts already logged in as another user.

**Source:** https://playwright.dev/docs/auth

## Section 5: Config and projects

### What goes in `playwright.config.ts`? Walk me through a CI-ready config.

Topic: pw-config | Core | id: q0045

**Say:** The config sets where the tests are, how they run, and the browser options. A CI-minded config has `fullyParallel`, `forbidOnly` on CI so a stray `test.only` fails the run, a small number of retries on CI only, a limited worker count, a reporter that suits CI, `trace: 'on-first-retry'`, a `baseURL`, projects for the browsers I care about, and a `webServer` to start the app. I keep environment-dependent values in environment variables.

**Full process:**
1. Create the file at the repo root, or let `npm init playwright@latest` create it.
2. Set the options and run `npx playwright test`.
3. Use `process.env.CI` to differ between local and CI.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['blob'], ['list']] : 'html',
  globalTimeout: 60 * 60 * 1000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Follow-ups:**
- *Why retries only on CI?* Locally I want a failure to be a failure. On CI a small retry count handles infrastructure noise, and the trace of the retry helps diagnosis. A strict rule is no global retries, and a retry on a named test with a reason.
- *What does `forbidOnly` do?* The run fails if any `test.only` exists, so a focused test cannot silently skip the rest on CI.
- *What does `trace: 'on-first-retry'` need?* Retries above zero, because the trace is recorded on the first retry.

**Trap:** `retries: 3` for the whole suite to "make CI green".

**Source:** https://playwright.dev/docs/test-configuration

### What are projects in Playwright, and what do you use them for?

Topic: pw-config | Core | id: q0046

**Say:** A project is a named group of tests that run with the same configuration. The usual use is one project per browser or device, so the same tests run in Chromium, Firefox and WebKit. Each project has its own `use` options, can set its own `retries`, `testMatch` and `testIgnore`, and can depend on other projects. I run a single one with `--project=firefox`. Since 1.64 a project can be marked `default: false`, so a plain run skips it and CI runs everything with `--project="*"`.

**Full process:**
1. Add entries under `projects` with a `name` and `use`.
2. Spread a device descriptor: `...devices['Desktop Chrome']`.
3. Run all, or filter by name.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, default: false },
    { name: 'mobile', use: { ...devices['iPhone 13'] }, default: false },
  ],
});
```

```bash
npx playwright test                 # chromium only
npx playwright test --project=firefox
npx playwright test --project="*"   # all three
```

**Follow-ups:**
- *Other uses besides browsers?* Different environments, roles (one storage state per role), or a "setup" project, or a mobile layout.
- *Do a device descriptor and a custom viewport clash?* Presets set a viewport, so define your own after spreading it.
- *Why run the same test on WebKit?* To catch engine differences. It is not real Safari, though.

**Trap:** Duplicating test files per browser. Projects do that without copies.

**Source:** https://playwright.dev/docs/test-projects

### Project dependencies versus `globalSetup`: which and why?

Topic: pw-config | Core | id: q0047

**Say:** Both run setup before tests, but I prefer project dependencies. A setup project is made of normal tests, so it shows in the HTML report, can record a trace, and can use fixtures, and its failure stops the dependent projects. `globalSetup` is a plain function that runs once before everything: no fixtures, no trace, not in the report, and no browser fixture, so you launch a browser by hand. The docs recommend project dependencies. I would use `globalSetup` only for something tiny and non-browser, like setting an environment variable.

**Full process:**
1. Create `tests/auth.setup.ts` with a normal `test`.
2. Add a project `{ name: 'setup', testMatch: /.*\.setup\.ts/ }`.
3. Add `dependencies: ['setup']` on the projects that need it.
4. For teardown, set `teardown: 'cleanup'` on the setup project, with another project that matches `*.teardown.ts`.
5. `--no-deps` skips dependencies and teardown.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'setup db', testMatch: /global\.setup\.ts/, teardown: 'cleanup db' },
    { name: 'cleanup db', testMatch: /global\.teardown\.ts/ },
    { name: 'chromium', dependencies: ['setup db'] },
  ],
});
```

**Follow-ups:**
- *What happens if the setup fails?* The dependent projects do not run.
- *How can `globalSetup` pass data?* Through `process.env`, serialized as JSON for complex values.
- *Any limitation of project dependencies?* UI mode does not run the setup project by default, so you run it manually when the state expires.

**Trap:** "globalSetup is the standard way". The docs put project dependencies first.

**Source:** https://playwright.dev/docs/test-global-setup-teardown

### How do you handle environments and secrets in the config?

Topic: pw-config | Core | id: q0048

**Say:** I read them from environment variables, never hard-code them. The config picks the `baseURL` from `process.env`, and secrets such as passwords come from CI variables or a local `.env` file that is ignored by git, loaded with `dotenv`. I keep one config and change values by environment, not one config file per environment. Credentials for a third-party service go only into the tests that need them, never into global setup.

**Full process:**
1. Local: a `.env` file in `.gitignore`, loaded at the top of the config with `dotenv`.
2. CI: variables in the pipeline settings, masked.
3. Config: `baseURL: process.env.BASE_URL ?? 'http://localhost:3000'`.
4. Run another environment: `BASE_URL=https://staging.example.com npx playwright test`.
5. Fail early on a missing required variable, with a clear message.

```ts
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error('BASE_URL is required');

export default defineConfig({ use: { baseURL } });
```

**Follow-ups:**
- *Why not commit the `.env`?* It holds secrets. Commit a `.env.example` with names only.
- *Same tests against QA, UAT and staging?* Yes: change `baseURL` and credentials by variable, and use tags or projects when some tests only fit one environment.
- *Is the browser's time zone from `timezoneId`?* `timezoneId` affects only the browser. Use the `TZ` env var for the Node process.

**Trap:** Putting a real password in the repo "temporarily".

**Source:** https://playwright.dev/docs/test-parameterize

### How does the `webServer` option work?

Topic: pw-config | Core | id: q0049

**Say:** `webServer` starts a command before the tests, waits until a URL answers, and stops it at the end. I use it when the tests run against a local dev build. The `url` option says when the server is ready: it accepts statuses 2xx, 3xx, 400, 401, 402 and 403. `reuseExistingServer: !process.env.CI` reuses a running server locally and starts a fresh one in CI. The startup timeout is 60 seconds by default, and I can pass an array for several servers.

**Full process:**
1. Set `command`, and `url` (the older `port` is deprecated).
2. Set `reuseExistingServer`. Without it, a running server on that URL is an error.
3. Raise `timeout` for a slow build.
4. Set `baseURL` in `use` so `page.goto('/')` works.
5. `stdout: 'pipe'` to see server logs, `stderr` is piped by default.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
```

**Follow-ups:**
- *What if the tests run against a deployed environment?* Omit `webServer` and set `baseURL`.
- *`wait` option?* It treats the server as started when stdout or stderr matches a regex, and named groups become environment variables.
- *How is the process stopped?* The process group gets SIGKILL unless `gracefulShutdown` is set (ignored on Windows).

**Trap:** Starting the server in the CI script and in `webServer`. Two servers fight for the port.

**Source:** https://playwright.dev/docs/test-webserver

### What are `retries`, and how do you configure them well?

Topic: pw-config | Standard | id: q0050

**Say:** `retries` is how many times a failed test is run again. The test that fails and then passes is reported as flaky, and one that fails every time is failed. I set it from the config or `--retries`, and I can set it for one group with `test.describe.configure({ retries: 2 })`. I use it as a policy for noise, not as a fix. It must come with traces on the first retry, a visible flaky count, and a plan to remove the cause. A strict rule is no global retries, only a retry on a named test with a stated reason.

**Full process:**
1. Config: `retries: process.env.CI ? 1 : 0`, or CLI `--retries=1`.
2. Group: `test.describe.configure({ retries: 2 })`.
3. Read the attempt in code with `testInfo.retry`, for example to clean server caches on a retry.
4. After a failure a new worker starts and begins by retrying the failed test.
5. Gate on flakiness with `--fail-on-flaky-tests`.

**Follow-ups:**
- *What happens to `beforeAll` on a retry?* It runs again in the new worker.
- *What is the risk of retries?* They hide races, make CI slow, and train people to ignore red.
- *What should be done with a test that is only green on retry?* Reproduce it with `--repeat-each`, find the cause, and remove the retry.

**Trap:** Using retries to hide infrastructure or backend errors.

**Source:** https://playwright.dev/docs/test-retries

### How do tags, grep and annotations work?

Topic: pw-config | Standard | id: q0051

**Say:** A tag is a label starting with `@`, added with the `tag` option or in the title. I run a subset with `--grep @smoke` and exclude with `--grep-invert @slow`. Annotations are metadata and behavior: `test.skip`, `test.fixme`, `test.fail`, `test.slow` and `test.only`, plus custom ones with a `type` and a `description` that show in reports. Conditions can use fixtures, for example skip on Firefox with a reason. I use tags to make a smoke subset for pull requests and the full run for nightly.

**Full process:**
1. Tag a test: `test('login', { tag: ['@smoke', '@auth'] }, async ({ page }) => { ... })`.
2. Run: `npx playwright test --grep @smoke`.
3. OR: `--grep "@smoke|@auth"`. AND: `--grep "(?=.*@smoke)(?=.*@auth)"`.
4. Annotate: `test.fixme(browserName === 'webkit', 'blocked by a known WebKit bug')`.
5. Custom annotation: `{ annotation: { type: 'issue', description: 'link' } }`.

```ts
import { test, expect } from '@playwright/test';

test('login works', { tag: ['@smoke'], annotation: { type: 'area', description: 'auth' } }, async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test('export on firefox', async ({ browserName }) => {
  test.skip(browserName === 'firefox', 'download dialog differs');
});
```

**Follow-ups:**
- *`skip` versus `fixme`?* Both do not run the test. `fixme` says it should be fixed. `fail` runs the test and expects it to fail, and reports a problem when it passes.
- *Does `test.skip` with only a description work?* As of 1.65, `test.skip('reason')` records the description.
- *I do not delete a skipped test.* Right: I fix its types and logic, and I do not remove a test without strong evidence.

**Trap:** `test.only` committed to the repo. `forbidOnly` on CI catches it.

**Source:** https://playwright.dev/docs/test-annotations

### What can you put in `use`, and how do you scope it?

Topic: pw-config | Standard | id: q0052

**Say:** `use` holds the options that configure each test's browser context and page: `baseURL`, `viewport`, `locale`, `timezoneId`, `geolocation`, `permissions`, `colorScheme`, `storageState`, `trace`, `screenshot`, `video`, `headless`, `extraHTTPHeaders`, `testIdAttribute`, `actionTimeout`, `navigationTimeout`, `launchOptions`. It can be set at the top of the config, per project, or per file and describe with `test.use()`. The narrowest scope wins.

**Full process:**
1. Global: `use: { baseURL, trace: 'on-first-retry' }`.
2. Project: `use: { ...devices['Desktop Chrome'], locale: 'de-DE' }`.
3. File or describe: `test.use({ viewport: { width: 1600, height: 1200 } })`.
4. Reset to the config value inside a describe: `test.use({ baseURL: undefined })`.
5. Trace and video share modes: `off`, `on`, `retain-on-failure`, `on-first-retry` and others.

```ts
import { test, expect } from '@playwright/test';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });

test('date uses German format', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByText(/\d{2}\.\d{2}\.\d{4}/)).toBeVisible();
});
```

**Follow-ups:**
- *Do you pin `timezoneId` or `locale` in the global config?* No. A suite-wide pin hides real product bugs, such as DST offsets. I set them in the specific test that needs them.
- *Where do trace modes matter?* `on-first-retry` keeps cost down, `retain-on-failure` records every run and keeps only failed ones.
- *Are `use` values fixtures?* Yes, they are option fixtures.

**Trap:** Setting the time zone in the config so a failing test passes.

**Source:** https://playwright.dev/docs/test-use-options

### What do `--repeat-each`, `--last-failed`, `--only-changed`, `--max-failures` and `--list` do?

Topic: pw-config | Standard | id: q0053

**Say:** `--repeat-each=N` runs each test N times, which is how I measure flakiness in volume. `--last-failed` reruns only the failures from the previous run. `--only-changed` runs only test files changed relative to a git ref, or uncommitted changes by default, and it needs git. `--max-failures` (`-x` for one) stops the run early. `--list` shows which tests would run without running them, which I use to check a filter or a file split.

**Full process:**
1. Flake check: `npx playwright test tests/orders.spec.ts --repeat-each=100 --workers=4`.
2. Rerun failures: `npx playwright test --last-failed`.
3. Pull request subset: `npx playwright test --only-changed=origin/main`.
4. Stop early on a broken build: `--max-failures=10`.
5. After splitting a spec file: compare `--list` output before and after.

**Follow-ups:**
- *Does `--only-changed` follow imports?* Yes on Node: changing only an imported helper and the spec that imports it ran, while an unrelated spec did not (checked on 1.65.0). Under Bun it does not follow imports (1.65 release notes).
- *Does `--only-changed` replace the full run?* No. I use it for fast feedback on a PR and run the full suite before a merge or nightly.
- *How is `--debug` different?* It opens the Inspector, runs headed with one worker, and sets timeout to 0.

**Trap:** Trusting one passing run. One run proves nothing about flakiness.

**Source:** https://playwright.dev/docs/test-cli

## Section 6: Auth and storage state

### How do you handle authentication in Playwright tests? Walk me through the full setup.

Topic: pw-auth | Core | id: q0054

**Say:** I log in once in a setup project, save the browser state to a file, and let every test project start from that file, so no test pays for a login. The setup is a normal test in `auth.setup.ts` that signs in and calls `context.storageState({ path })`. Projects list the setup project in `dependencies` and set `storageState` to that file. The file goes under `playwright/.auth`, which I add to `.gitignore`, because it contains session cookies. If a login fails, the dependent tests do not run.

**Full process:**
1. Create the folder and ignore it: `mkdir -p playwright/.auth` and add `playwright/.auth` to `.gitignore`.
2. Write the setup test and save the state.
3. Add the setup project and make the browser projects depend on it, with `storageState`.
4. Tests then start authenticated.
5. Delete the state file when it expires. If you do not need it between runs, write it under `outputDir`, which is cleaned before each run.

```ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(process.env.TEST_EMAIL ?? '');
  await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // wait for the final URL so the cookies from redirects are set
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

**Follow-ups:**
- *Why wait for the URL before saving?* Login can set cookies through several redirects. Saving early stores an incomplete state.
- *Can I authenticate through the API instead?* Yes, if the app supports it: `request.post(...)` then `request.storageState({ path })`. It is faster and less flaky than the UI.
- *Does UI mode run the setup?* Not by default, so run `auth.setup.ts` manually when the state expires.

**Trap:** Committing the state file. It can impersonate the test account.

**Source:** https://playwright.dev/docs/auth

### What does storage state contain, and what does it not?

Topic: pw-auth | Core | id: q0055

**Say:** It contains the cookies of the context and the local storage of each origin. IndexedDB is included only when I ask for it with `storageState({ indexedDB: true })`, which matters for apps like Firebase auth that keep tokens there. It never contains session storage, so a token kept there is lost on restore. It also does not hold anything server-side, so if the server session expires, the file is useless even though it loads fine.

**Full process:**
1. Save: `await context.storageState({ path: 'state.json', indexedDB: true })`.
2. Inspect the file: `cookies` (name, value, domain, path, expires, flags) and `origins` with `localStorage` entries.
3. For session storage, serialize it with `page.evaluate`, write it to a file, and restore it with `context.addInitScript` that sets each item for the matching hostname.
4. The docs also mention `opfs` and `credentials` (virtual passkeys) options on `storageState`, and a `setStorageState` method on the context.

```ts
// save session storage after login
const session = await page.evaluate(() => JSON.stringify(window.sessionStorage));
require('fs').writeFileSync('playwright/.auth/session.json', session);

// restore in a fixture, before navigation
const saved = JSON.parse(require('fs').readFileSync('playwright/.auth/session.json', 'utf-8'));
await context.addInitScript((data) => {
  if (window.location.hostname === 'app.example.com') {
    for (const [key, value] of Object.entries(data)) window.sessionStorage.setItem(key, value as string);
  }
}, saved);
```

**Follow-ups:**
- *How do you know it expired?* The test starts on the login page, or an API call returns 401. A setup that runs on every test run avoids stale files.
- *Can I reuse state across browsers?* Not if the authentication is browser-specific, the docs list it as a case against the shared account approach.
- *Does `storageState` include HTTP auth or headers?* No. Use `httpCredentials` or `extraHTTPHeaders` for those.

**Trap:** Saying "storage state saves the whole session". It saves cookies, local storage, and optionally IndexedDB.

**Source:** https://playwright.dev/docs/api/class-browsercontext

### How do you test with multiple roles, for example admin and a regular user?

Topic: pw-auth | Core | id: q0056

**Say:** I save one storage state file per role in the setup project, then choose the file per test file or describe with `test.use({ storageState })`. When one test needs two roles at once, such as an admin approving what a user submits, I create two browser contexts, each with its own storage state, and a page in each. For a team that does this a lot, I wrap that into `adminPage` and `userPage` fixtures that create a context and close it afterwards.

**Full process:**
1. Setup: log in as each role and save `admin.json` and `user.json`.
2. One role per file: `test.use({ storageState: 'playwright/.auth/admin.json' })`.
3. Two roles in one test: two contexts.
4. Test an unauthenticated case: `test.use({ storageState: { cookies: [], origins: [] } })`.

```ts
import { test, expect } from '@playwright/test';

test('admin sees what the user submitted', async ({ browser }) => {
  const userContext = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
  const adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
  const user = await userContext.newPage();
  const admin = await adminContext.newPage();

  await user.goto('/requests/new');
  await user.getByRole('button', { name: 'Submit request', exact: true }).click();

  await admin.goto('/requests');
  await expect(admin.getByRole('row').filter({ hasText: 'pending' })).toHaveCount(1);

  await userContext.close();
  await adminContext.close();
});
```

**Follow-ups:**
- *Why not log in inside each test?* It is slow and each login is an extra failure point.
- *Role-permission tests?* I test that a role cannot reach what it should not, by asserting the denied state. It is basic role-permission testing, not a full security audit.
- *Where do you keep the file names?* In one place (a constant or fixture), so a rename does not need edits in many tests.

**Trap:** Forgetting to close contexts you created manually.

**Source:** https://playwright.dev/docs/auth

### When do tests need one account per worker?

Topic: pw-auth | Core | id: q0057

**Say:** When the tests change server-side state and run in parallel. One shared account is fine when every test could run at the same time without affecting another, for example read-only checks. If one test changes a setting while another test checks the rendering of that setting, they race on the shared account. So I give each parallel worker its own account, authenticate once per worker in a worker-scoped fixture, and key the account to `parallelIndex`.

**Full process:**
1. A worker fixture picks an account by `test.info().parallelIndex`.
2. It logs in once and saves a state file under the project's `outputDir`.
3. It overrides `storageState` to use that file.
4. Accounts come from a pre-made pool or are created through an API.
5. Make sure accounts are unique, so two team members running tests at once do not collide.

(Full code is in the fixtures answer about worker-scoped values that need the browser.)

**Follow-ups:**
- *How many accounts do you need?* At least the maximum worker count. More if team members share the environment.
- *Cleanup?* Each test cleans what it creates, or the fixture resets the account after each test.
- *Alternative?* Test locks (1.63) for the few tests that touch a shared resource, so everything else keeps running in parallel.

**Trap:** Sharing one account and adding `workers: 1` to remove the race. It makes the suite slow and hides isolation problems.

**Source:** https://playwright.dev/docs/auth

### How do you deal with expiring tokens or sessions in long runs?

Topic: pw-auth | Core | id: q0058

**Say:** First I make the setup run on every run, so a state file is never older than the run. Then I check how long the token lives against the longest run time. If a token can expire mid-run, I refresh it in a worker fixture or sign in through the API again when a request returns 401. For credentials that expire on a schedule, like request signatures, I automate the rotation ahead of time so the test fails with a clear message, not silently.

**Full process:**
1. Write the state under `outputDir` (cleaned each run), or delete the file at the start of the run.
2. Know the token lifetime and the p95 run time of a shard.
3. For API tokens, log in with `request.post` in a worker fixture and set `extraHTTPHeaders`.
4. Add a guard: a check at the start that fails with "token expires in N days" for scheduled credentials.

**Follow-ups:**
- *What if the refresh token is single-use?* Parallel workers refreshing the same one invalidate each other, so each worker needs its own account.
- *How do you reproduce an expiry test?* With the clock API: install a clock and fast forward the browser time, if expiry is checked in the page. If it is server-side, use a short-lived token in a test account.
- *Where do you keep secrets?* In CI variables, never in the repo.

**Trap:** Letting a stale state file in a CI cache cause "random" login failures.

**Source:** https://playwright.dev/docs/auth

### How do you authenticate with the API instead of the UI?

Topic: pw-auth | Standard | id: q0059

**Say:** If the app has a login endpoint, I send the request with the `request` fixture (an `APIRequestContext`), then save its state with `request.storageState({ path })`. It is faster than driving the login form and removes UI flakiness from setup. I still keep one UI login test, because the login screen itself needs coverage. I check the response status before parsing the body, with `expect(response).toBeOK()`.

**Full process:**
1. In the setup project, use `request.post('/api/login', { data })`.
2. Assert the response is OK.
3. Save the state: `await request.storageState({ path: authFile })`.
4. Projects use that file as `storageState`.

```ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate via API', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
  });
  expect(response).toBeOK();
  await request.storageState({ path: authFile });
});
```

**Follow-ups:**
- *Does it work if the app keeps its token in local storage?* The cookie-based session will work. For a token the app stores in local storage you may need to inject it with an init script or write the state file by hand.
- *Why check status before `.json()`?* A 4xx or 5xx HTML page turns into a JSON parse error and hides the status.
- *Risk?* The API login can differ from the UI login, so a UI login bug is not caught. That is why the UI login test stays.

**Trap:** Replacing UI login coverage with API login everywhere.

**Source:** https://playwright.dev/docs/auth

## Section 7: Parallelism and sharding

### How does Playwright run tests in parallel? What are workers and `fullyParallel`?

Topic: pw-parallel | Core | id: q0060

**Say:** The runner starts worker processes, and each one runs tests independently with its own browser. By default test files run in parallel and the tests inside one file run in order in the same worker. Setting `fullyParallel: true` makes every test its own unit, so even tests in the same file can go to different workers. The default number of workers is half of the CPU cores, and I limit it on CI with `workers`. Workers cannot talk to each other, so tests must not depend on shared state.

**Full process:**
1. Default: parallel by file, in order within a file.
2. File level opt-in: `test.describe.configure({ mode: 'parallel' })`.
3. Everywhere: `fullyParallel: true` in the config or in a project.
4. Limit workers: `--workers=4`, or `workers: process.env.CI ? 2 : undefined`.
5. Disable parallelism: `--workers=1`.
6. Opt a describe out of full parallelism: `test.describe.configure({ mode: 'default' })`.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
});
```

**Follow-ups:**
- *What happens when a test fails?* The worker is shut down and a new one starts, so state cannot leak.
- *Can you push workers to the maximum?* I do not. More workers raise load on the app under test and on shared backends, and create flakiness. I prefer sharding across machines and `--shuffle`.
- *Should serial tests ever run in parallel?* No, serial is a separate mode.

**Trap:** Believing `workers` can exceed useful limits for free. Past the CPU count it only adds contention.

**Source:** https://playwright.dev/docs/test-parallel

### What is serial mode and why do you avoid it?

Topic: pw-parallel | Core | id: q0061

**Say:** Serial mode marks a group of tests as dependent: they run in order in one worker, and if one fails, the rest are skipped. On a retry the whole group runs again together, with `beforeAll` too. The docs say it is not recommended. I avoid it because dependent tests are slow, hard to debug (the second failure is a consequence of the first), and cannot be parallelized or sharded below the group. I make tests independent and use fixtures for shared setup.

**Full process:**
1. How it looks: `test.describe.configure({ mode: 'serial' })` in a file or describe.
2. State sharing usually needs a module-level variable, such as a page created in `beforeAll`.
3. The alternative: each test sets up what it needs, through a fixture or API call.
4. For a real long flow (a checkout wizard), write one test with `test.step`, not five dependent tests.

```ts
import { test, expect } from '@playwright/test';

// one test, several named steps, instead of five serial tests
test('checkout flow', async ({ page }) => {
  await test.step('add to cart', async () => {
    await page.goto('/shop');
    await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  });
  await test.step('pay', async () => {
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Pay', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Thank you', exact: true })).toBeVisible();
  });
});
```

**Follow-ups:**
- *When is it justified?* A flow that is truly one long scenario where each step's state is expensive to rebuild. Even then I prefer one test with steps.
- *How do retries behave?* The whole group retries together in a new worker.
- *Better alternatives for shared resources?* Test locks (1.63 and later), which keep other tests parallel.

**Trap:** Using serial to hide order dependencies between tests.

**Source:** https://playwright.dev/docs/test-parallel

### How do you make tests isolated for parallel runs?

Topic: pw-parallel | Core | id: q0062

**Say:** Each test must create the data it needs and not depend on another test. The browser side is already isolated, because every test has its own context. Isolation problems come from outside: shared backend records, shared accounts, shared files. So I give every test unique data, for example a name that includes `testInfo.testId`, write files to `testInfo.outputPath()`, use one account per worker when tests change server state, and clean up in fixture teardown. Then `--shuffle` confirms there is no hidden order dependency.

**Full process:**
1. Unique ids: derive from `testInfo.testId` or a random suffix.
2. Files: `testInfo.outputPath('export.csv')`.
3. Accounts: one per worker for tests that mutate shared server state.
4. Shared resource that cannot be split: a named test lock.
5. Verify: `npx playwright test --shuffle` and run it a few times.

```ts
import { test, expect } from '@playwright/test';

test('creates an order', async ({ page }, testInfo) => {
  const orderId = `order-${testInfo.testId}`;
  await page.goto(`/orders/new?id=${orderId}`);
  await expect(page.getByText(orderId, { exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *Varied or single test data?* Varied, one sample can hide a bug.
- *What if two tests must touch one record?* A test lock, so they do not run at the same time.
- *Do tests in different projects collide?* They can, since projects run in parallel too, and locks work across projects.

**Trap:** Module-level variables shared between tests. They work in order and break in parallel.

**Source:** https://playwright.dev/docs/test-parallel

### How does sharding work, and how do you merge reports?

Topic: pw-parallel | Core | id: q0063

**Say:** Sharding splits the suite across machines: `--shard=2/4` runs the second quarter. In CI each shard is a separate job in a matrix, and the jobs run in parallel. Each shard writes a blob report, and a final job downloads all blob files into one folder and runs `npx playwright merge-reports --reporter html` to produce one HTML report. I use `fullyParallel: true` so tests, not whole files, are balanced across shards. The merge job should run even if shards failed, and it should fail when a shard report is missing.

**Full process:**
1. Config: `reporter: process.env.CI ? 'blob' : 'html'`.
2. CI matrix: shard index 1 to 4 and total 4, running `npx playwright test --shard=${index}/${total}`.
3. Each job uploads `blob-report` as an artifact with a unique name.
4. A merge job `needs` the test job, runs `if: ${{ !cancelled() }}`, downloads all blobs into one directory, and runs `npx playwright merge-reports --reporter html ./all-blob-reports`.
5. Upload the HTML report from `playwright-report`.

```yaml
# .github/workflows/playwright.yml (shortened)
jobs:
  tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: lts/* }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: blob-report-${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1
  merge-reports:
    if: ${{ !cancelled() }}
    needs: [tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: lts/* }
      - run: npm ci
      - uses: actions/download-artifact@v5
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
      - uses: actions/upload-artifact@v4
        with:
          name: html-report
          path: playwright-report
```

**Follow-ups:**
- *Why `fullyParallel` for sharding?* Without it, sharding is by file, so unevenly sized files give unbalanced shards. With it, individual tests are balanced.
- *What happens in 1.65 when no tests match in any shard?* The sharded run fails with "No tests found". `--pass-with-no-tests` allows it. An empty single shard still passes if other shards have tests.
- *Same tests in several environments?* Set `tag` in the config from an environment variable, and the blob report and merge keep it.

**Trap:** Sharding without merging reports, so no one can see the whole result. Or a merge job that skips when a shard fails.

**Source:** https://playwright.dev/docs/test-sharding

### What is a test lock, and when do you use it?

Topic: pw-parallel | Core | id: q0064

**Say:** A test lock arrived in 1.63. It is a named lock on a test: tests that share a lock name never run at the same time, across files, workers and projects, while everything else keeps running in parallel. I use it when a few tests touch a shared resource that cannot handle concurrency, such as a global account setting or an external service. In 1.65 there is a built-in `-exclusive-` lock that runs a test only when no other test is running.

**Full process:**
1. On a test: `test('update settings', { lock: 'user-settings' }, async ({ page }) => { ... })`.
2. On a group: `test.describe('settings', { lock: 'user-settings' }, ...)` or `test.describe.configure({ lock: 'user-settings' })`.
3. Several locks: `{ lock: ['database', 'external-api'] }`, and the test runs only when all are free.
4. In default and serial modes, all tests in a file run together in order, so a lock on any test is held for the whole file.
5. Exclusive: `{ lock: '-exclusive-' }`.

**Follow-ups:**
- *Why not serial?* Serial forces order and skip-on-failure inside a group. A lock only prevents overlap.
- *Cost?* Locked tests wait for each other, so too many locks serialize the suite.
- *Alternative?* Separate data or accounts per worker is better when possible.

**Trap:** Quoting locks as an old feature. They are 1.63 and later.

**Source:** https://playwright.dev/docs/test-parallel

### How do you find tests that depend on each other?

Topic: pw-parallel | Standard | id: q0065

**Say:** I run the suite in random order with `--shuffle`. It prints a seed, and passing the same seed reproduces the order, so a failing order can be investigated. Tests that pass in file order and fail shuffled have a hidden dependency, usually shared data or state left behind. `--shuffle` came in 1.64. I also run a single test alone, because a test that only passes after another has run is not independent.

**Full process:**
1. `npx playwright test --shuffle` prints "shuffle seed N".
2. On a failure, reproduce: `npx playwright test --shuffle N`.
3. Run the failing test alone with `-g "title"` or by file and line.
4. Find the data it borrowed and move it into the test or a fixture.
5. After splitting a file, run each new file alone.

**Follow-ups:**
- *Does shuffle apply within a file?* Only with `fullyParallel` or `test.describe.configure({ mode: 'parallel' })`. Without them `--shuffle` reorders whole files and tests inside a file keep their order (checked on 1.65.0 with several seeds).
- *Before 1.64?* Use `--repeat-each` and `--workers` changes, or custom ordering.
- *CI use?* A nightly shuffled run, kept as a separate job so a failure does not block merges.

**Trap:** Assuming "passes in CI" means independent. CI may run in the same order every time.

**Source:** https://playwright.dev/docs/release-notes

## Section 8: Page interactions

### How do you handle a new tab or popup?

Topic: pw-general | Standard | id: q0066

**Say:** I start waiting for the new page before I click, and then await it after the click. For a link with `target="_blank"` that opens a tab, I wait for the `page` event on the context. For a popup opened by the current page, I wait for the `popup` event on the page. Starting the wait first matters, because the page can open before the listener exists. Then I wait for load on the new page and use it like any other page.

**Full process:**
1. Start the wait without awaiting it.
2. Click.
3. Await the promise and get the new `Page`.
4. Use normal locators and assertions on it.

```ts
import { test, expect } from '@playwright/test';

test('opens docs in a new tab', async ({ page, context }) => {
  await page.goto('/help');

  const pagePromise = context.waitForEvent('page');
  await page.getByRole('link', { name: 'Documentation', exact: true }).click();
  const docs = await pagePromise;

  await docs.waitForLoadState();
  await expect(docs).toHaveURL(/\/docs/);
  await expect(docs.getByRole('heading', { level: 1 })).toBeVisible();
});
```

**Follow-ups:**
- *Popup or page event?* `popup` fires only for popups opened by that page. The context `page` event fires for any new page. The `popup` event also fires in addition to `page`.
- *If I do not know what opens it?* Listen with `context.on('page', ...)`.
- *Does it work in Cypress?* Multiple tabs are a documented trade-off there.

**Trap:** `await click(); const p = await context.waitForEvent('page')` and missing the event.

**Source:** https://playwright.dev/docs/pages

### How do you handle alerts, confirms, prompts and `beforeunload` dialogs?

Topic: pw-general | Standard | id: q0067

**Say:** Playwright dismisses dialogs automatically if I register no listener. If I need to accept one or read its text, I register `page.on('dialog')` before the action that opens it, and call `accept()` or `dismiss()`. If the listener does neither, the page stays blocked and the action hangs, because a dialog is modal. For `beforeunload`, I use `page.close({ runBeforeUnload: true })` and handle the dialog.

**Full process:**
1. Register the handler first, with `page.once` if the dialog appears once.
2. Check `dialog.type()` and `dialog.message()` and assert on them.
3. Accept with an optional prompt text: `dialog.accept('text')`, or `dismiss()`.
4. Then do the action.

```ts
import { test, expect } from '@playwright/test';

test('confirm delete', async ({ page }) => {
  await page.goto('/items');

  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Delete this item?');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('row')).toHaveCount(1);
});
```

**Follow-ups:**
- *Why does the test hang with a logging-only handler?* A handler that neither accepts nor dismisses leaves the dialog open, so `click()` never completes.
- *Is an HTML `<dialog>` or a modal the same?* No. Those are page elements and I use normal locators. Dialog events are for native browser dialogs.
- *Assertions inside a listener?* A failed `expect` there throws outside the test flow, so I prefer to collect the message in a variable and assert after.

**Trap:** Registering the handler after the click.

**Source:** https://playwright.dev/docs/dialogs

### How do you test a file download?

Topic: pw-general | Standard | id: q0068

**Say:** I start waiting for the `download` event, click the trigger, then await the event to get the `Download` object. I read `suggestedFilename()`, save the file with `saveAs`, and then check its content from disk. By default the file is stored in a temporary folder and deleted when the browser context closes. I assert on the file name and the content, not only that a download started.

**Full process:**
1. `const downloadPromise = page.waitForEvent('download');`
2. Click the export control.
3. `const download = await downloadPromise;`
4. Save under the test output path: `await download.saveAs(testInfo.outputPath(download.suggestedFilename()))`.
5. Read it and assert.

```ts
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('exports a CSV', async ({ page }, testInfo) => {
  await page.goto('/reports');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('report.csv');
  const file = testInfo.outputPath('report.csv');
  await download.saveAs(file);
  expect(fs.readFileSync(file, 'utf-8')).toContain('id,name');
});
```

**Follow-ups:**
- *Where does the file go by default?* A temporary folder, deleted when the context that produced it closes.
- *How do I choose a folder?* `downloadsPath` in `browserType.launch()`.
- *What if the export is generated by an API and not by the click?* I can also fetch it through the `request` fixture and compare.

**Trap:** Clicking first and listening after.

**Source:** https://playwright.dev/docs/downloads

### How do you upload a file?

Topic: pw-general | Standard | id: q0069

**Say:** For a normal file input I call `setInputFiles` on the locator with a path, an array of paths, or an in-memory object with name, MIME type and buffer. An empty array clears the selection. If the page creates the input dynamically when I click a button, I wait for the `filechooser` event, started before the click, and call `setFiles` on the chooser. After the upload I assert on what the user sees, such as the file name in a list.

**Full process:**
1. Prepare a file in the repo, or create a buffer.
2. Locate the input by label.
3. Call `setInputFiles`.
4. Assert the result.

```ts
import { test, expect } from '@playwright/test';

test('uploads an avatar', async ({ page }) => {
  await page.goto('/profile');

  await page.getByLabel('Upload file', { exact: true }).setInputFiles({
    name: 'avatar.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('test content'),
  });
  await expect(page.getByText('avatar.txt', { exact: true })).toBeVisible();

  // dynamic input: wait for the chooser first
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
});
```

**Follow-ups:**
- *Directory upload?* Pass a directory path.
- *Relative paths?* They resolve against the current working directory.
- *Does `setInputFiles` do actionability checks?* No, it checks none.

**Trap:** Typing a path into the input with `fill`. File inputs need `setInputFiles`.

**Source:** https://playwright.dev/docs/input

### How do you do drag and drop?

Topic: pw-general | Standard | id: q0070

**Say:** The simple way is `source.dragTo(target)`. It hovers the source, presses the left mouse button, moves to the target, and releases. When an app needs finer control, for example it relies on `dragover` events, I do the steps by hand with `hover()`, `mouse.down()`, hovering the target twice, and `mouse.up()`. I assert on the result, such as the new order of items.

**Full process:**
1. Locate source and target by role and name.
2. Try `dragTo`.
3. If the app does not react, use manual mouse steps.
4. Assert the new order with `toHaveText([...])`.

```ts
import { test, expect } from '@playwright/test';

test('reorders cards', async ({ page }) => {
  await page.goto('/board');
  const first = page.getByRole('listitem', { name: 'Card A', exact: true });
  const third = page.getByRole('listitem', { name: 'Card C', exact: true });

  await first.dragTo(third);
  await expect(page.getByRole('listitem')).toHaveText(['Card B', 'Card C', 'Card A']);

  // manual steps when the app needs dragover
  await first.hover();
  await page.mouse.down();
  await third.hover();
  await third.hover();
  await page.mouse.up();
});
```

**Follow-ups:**
- *Actionability of `dragTo`?* Visible, stable, receives events.
- *Keyboard-based reorder?* If the product supports it, that also tests accessibility, and I add a test for it.
- *HTML5 drag and drop that fails in a browser?* I compare engines, since drag events differ between them.

**Trap:** Using `force` to drag when the target is covered. Find the overlay.

**Source:** https://playwright.dev/docs/input

### How do you control time in a test? What is the clock API?

Topic: pw-general | Standard | id: q0071

**Say:** `page.clock` fakes time in the browser: `Date`, timers, `requestAnimationFrame`, `performance` and similar. `setFixedTime` fixes what `Date.now()` returns while timers still run. `install` takes control so I can `pauseAt` a moment, `fastForward` ahead, or `runFor` to tick the timers. I call `install` before anything else that uses the clock, normally before `goto`. It lets me test a five-minute inactivity logout in a second, or a date-dependent display.

**Full process:**
1. Only the date: `await page.clock.setFixedTime(new Date('2024-02-02T10:00:00'));`.
2. Control flow: `await page.clock.install({ time: new Date('2024-02-02T08:00:00') });`.
3. `goto` the page.
4. `await page.clock.pauseAt(new Date('2024-02-02T10:00:00'));` then `fastForward('05:00')` or `runFor(2000)`.
5. `resume()` to let time flow again.

```ts
import { test, expect } from '@playwright/test';

test('logs out after 5 minutes of inactivity', async ({ page }) => {
  await page.clock.install();
  await page.goto('/app');
  await page.clock.fastForward('05:00');
  await expect(page.getByRole('heading', { name: 'You were logged out', exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *Does time freeze after `install`?* No. By default it keeps flowing in real time until you pause it, so to hold time still, install with a time and call `pauseAt`.
- *What does it not fake?* The server clock. If the logic is server-side, I need a server-side way to move time.
- *Test the DST transition?* Set the clock to the transition date in a DST-observing zone, with `timezoneId` on that test only.

**Trap:** Faking time on the page for a rule enforced by the backend. The test then proves nothing.

**Source:** https://playwright.dev/docs/clock

### How do you emulate time zones, locale and geolocation?

Topic: pw-browsers | Core | id: q0072

**Say:** These are context options: `timezoneId`, `locale`, `geolocation` and `permissions`. I set them in a project's `use`, in a file with `test.use`, or on a new context. Geolocation needs the permission too, `permissions: ['geolocation']`, or the page cannot read it. I can change the location at runtime with `context.setGeolocation`. `timezoneId` and `locale` affect only the browser, so for the Node process I use the `TZ` variable.

**Full process:**
1. Set options for one test file.
2. Grant the permission.
3. Navigate and assert the effect.
4. Move the location at runtime if the test needs it.

```ts
import { test, expect } from '@playwright/test';

test.use({
  locale: 'it-IT',
  timezoneId: 'Europe/Rome',
  geolocation: { longitude: 12.492507, latitude: 41.889938 },
  permissions: ['geolocation'],
});

test('shows Rome pharmacies', async ({ page, context }) => {
  await page.goto('/pharmacies');
  await expect(page.getByRole('heading', { name: /Roma/ })).toBeVisible();

  await context.setGeolocation({ longitude: 9.19, latitude: 45.4642 });
  await page.getByRole('button', { name: 'Refresh location', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Milano/ })).toBeVisible();
});
```

**Follow-ups:**
- *Where to put them for many tests?* A project in the config, for example a mobile project with a device preset.
- *Other emulation?* `colorScheme`, `reducedMotion`, `forcedColors`, `offline`, `userAgent`, and device descriptors like `devices['iPhone 13']`.
- *Do you pin time zone for the whole suite?* No, a global pin hides real product bugs.

**Trap:** Setting geolocation without the permission.

**Source:** https://playwright.dev/docs/emulation

### How do you test with a mobile device emulation?

Topic: pw-browsers | Core | id: q0073

**Say:** Use a device descriptor in a project, for example `devices['iPhone 13']`, which sets the user agent, viewport, `isMobile`, `hasTouch` and the device scale factor. The tests run in an emulated mobile browser, so responsive layout and touch can be checked. It is emulation in desktop engines, not a real phone, so for real device behavior use a device cloud such as BrowserStack. If you have used one, say how; if not, say so plainly and explain the limitations of emulation. Descriptors set a viewport, so define a custom viewport after spreading it.

**Full process:**
1. Add a project: `{ name: 'mobile', use: { ...devices['iPhone 13'] } }`.
2. Write tests that check layout-dependent behavior, such as a menu button.
3. Use `tap()` for touch actions.
4. Run it: `npx playwright test --project=mobile`.

**Follow-ups:**
- *Does emulation replace real devices?* No. It misses real hardware, real Safari behavior and real network conditions.
- *Offline testing?* `offline: true`, or `context.setOffline(true)`.
- *Where do mobile tests sit in the pyramid?* A few layout and flow checks on emulation, device cloud for a smaller critical set.

**Trap:** Claiming mobile coverage from a viewport resize alone.

**Source:** https://playwright.dev/docs/emulation

## Section 9: Scenario questions

### A test passes locally and fails in CI. Walk me through it.

Topic: pw-general | Standard | id: q0074

**Say:** I first read the failure, not guess. I open the CI artifacts: the error, the screenshot, and the trace of the failing run, and I classify the failure as race, ambiguity, overlay, environment, or product. Then I reproduce in conditions close to CI: the same browser image, the same reporter and retry settings, fewer CPUs, and one worker with tracing on. I compare with the base branch in the same window, because the cause may not be my change. When I find the cause I fix it and prove it with many repeated runs.

**Full process:**
1. Read the error and call log. A timeout with "intercepts pointer events" is an overlay. "Strict mode violation" is ambiguity. A wrong value is often a race or data.
2. Open the trace (`trace: 'on-first-retry'` or `retain-on-failure`): `npx playwright show-trace trace.zip`. Check the action timeline, DOM snapshots before and after, network and console.
3. Check the environment gap: the app version deployed, test data and accounts, time zone and locale, viewport and fonts, CPU speed and worker count, and whether a dev environment was down by design.
4. Reproduce: run in the same container image as CI, with the same flags, and `npx playwright test file.spec.ts --trace on -j 1 --repeat-each=20`. Slow it down by limiting CPU if needed.
5. Check whether the base branch fails the same way in the same period.
6. Fix the root cause, such as a missing wait for a response, a locator that matches two elements, shared data, or a product race.
7. Prove it: for example 200 repeats on the base and 200 on the fix, with 0 retries.

**Follow-ups:**
- *What if I cannot reproduce it?* Add `trace: 'retain-on-failure'` and screenshots in CI, collect failures over several runs, and look for a pattern in time, worker, or test order.
- *CI is slower, so what usually breaks?* Hidden assumptions about timing: a sleep, a one-shot read, an animation not finished, or a request not awaited.
- *Would you raise the timeout?* Only if the trace shows a real slow step. A raised timeout can hide a regression.

**Trap:** "I would rerun it" or "I would add a retry".

**Source:** https://playwright.dev/docs/test-retries

### A test is flaky, about 5% of runs. How do you approach it?

Topic: pw-waits-assertions | Standard | id: q0075

**Say:** I measure first. I run it in volume, for example a hundred repeats on several workers, so I know the real rate and can compare after the fix. Then I read the traces of failed attempts, not passing ones, and find the common thread: a race, a locator ambiguity, shared data, or an environment issue. I fix that cause with a deterministic wait for the actual condition, and I prove it with the same volume run. I do not hide it with a retry, a longer timeout, or a sleep.

**Full process:**
1. Baseline: `npx playwright test file.spec.ts --repeat-each=100 --workers=4 --trace retain-on-failure`.
2. Open traces for the failures. Look at the last good action and the first bad one.
3. Typical causes and fixes: a missing `await`, a click before the effect is ready (wait for the observable state), a response race (`waitForResponse` before the click), a locator that sometimes matches two nodes (scope it), a stale test account (create data per test), or a product race (fix the product).
4. Confirm: the same run, expect 100 of 100, and compare with the base.
5. Write down the cause and the rate before and after in the ticket.

**Follow-ups:**
- *What if the failure rate does not change?* The cause is different from my hypothesis. Go back to the traces.
- *Is it worth fixing every flaky test?* I rank by cost: tests that block the pipeline first.
- *Quarantine?* A named skip with a ticket and a due date is acceptable while fixing, but I do not delete the test.

**Trap:** Reporting a fix after one green run.

**Source:** https://playwright.dev/docs/test-retries

### The suite takes 90 minutes. How do you speed it up without losing coverage?

Topic: pw-parallel | Standard | id: q0076

**Say:** I measure where the time goes before I change anything: the slowest tests and the setup cost. Then in order: remove fixed sleeps, login through storage state instead of the UI, create data through the API, and delete duplicated E2E coverage that a unit or API test already has. After that I scale out: `fullyParallel`, more workers up to what the app can handle, and sharding across CI machines with merged reports. I also run a smoke subset on pull requests with tags and the full suite nightly.

**Full process:**
1. Get timings from the HTML report or a JSON report, list the top 20 slowest tests.
2. Cut waste: sleeps, UI login, UI data setup, duplicate tests.
3. Parallelize: `fullyParallel: true`, a sensible `workers`.
4. Shard: four to eight jobs with `--shard`, blob reports, merge job.
5. Tier the runs: `--grep @smoke` on PRs, `--only-changed` for fast feedback, full run on schedule.
6. Re-measure and watch flake rate, because more parallelism can expose shared-state bugs.

**Follow-ups:**
- *What breaks when you add workers?* Shared accounts and data, rate limits on the backend, and CPU starvation that causes timeouts.
- *Do you remove tests?* Yes, duplicates, with evidence, and I check whether a unit test already covers the flow.
- *What about browsers?* Run full cross-browser on a schedule, and Chromium only on PRs.

**Trap:** Only adding workers. It moves the bottleneck to shared state.

**Source:** https://playwright.dev/docs/test-sharding

### A click times out. What do you look at?

Topic: pw-waits-assertions | Standard | id: q0077

**Say:** I read the call log in the error, because it says which actionability check was failing. "Element is not visible", "not enabled", "not stable" or "intercepts pointer events" each point at a different cause. An intercepting element is usually an overlay or an animation that has not finished, so I wait for it to go. A strict mode violation means the locator matches several elements. If the locator matches nothing, the name or the markup probably changed. I do not reach for `force: true`.

**Full process:**
1. Read the call log lines: resolved to N elements, visible, enabled, stable, receives events.
2. Open the trace at the failing action: the snapshot shows what was on screen and what covered the target.
3. Overlay or modal: wait for it to be hidden, and ask why it appeared (a tour modal on a second page, a cookie banner).
4. Disabled: check whether the app was supposed to enable it, and assert `toBeEnabled()` when that is the contract.
5. No match: check the accessible name, the role, and whether the element is inside an iframe or hidden.
6. Fix the cause. Never force.

**Follow-ups:**
- *Why not `force`?* It skips the checks, so the test passes even when a real user could not click.
- *What if the element is off-screen?* Playwright scrolls into view for the click. If it still fails, something covers it.
- *And `dispatchEvent('click')`?* It skips checks too. I use it only when the interaction is not a real user action.

**Trap:** Adding `{ force: true }`, `waitForTimeout`, or `.first()` until it passes.

**Source:** https://playwright.dev/docs/actionability

### How would you start automating a new web application from scratch with Playwright?

Topic: pw-general | Standard | id: q0078

**Say:** I start with a risk list and a few critical flows, not with a framework. I set up Playwright Test with TypeScript, a config with projects, a `baseURL` and traces on retry, and CI from day one. I write the first test on the most valuable flow with role-based locators, add a setup project for login with storage state, and build fixtures only when I see repeated setup. I add page objects when screens repeat. I agree on rules early (locators, waits, test data, no sleeps) and enforce them with lint.

**Full process:**
1. Explore the app and pick five flows by business risk.
2. `npm init playwright@latest`, choose TypeScript and the CI workflow.
3. Config: `baseURL`, `trace: 'on-first-retry'`, `forbidOnly` on CI, a `webServer` if tests run on a local build.
4. Auth: a setup project and storage state.
5. First tests with role locators and web-first assertions. Run them 50 times to see the flake rate before you build more.
6. CI: run on pull requests, upload the report and traces, shard when runtime grows.
7. Lint rules: `@typescript-eslint/no-floating-promises` and the Playwright plugin rules.
8. Test data: create through the API per test and clean up in fixture teardown.

**Follow-ups:**
- *What do you not automate?* Highly volatile screens, things a unit or API test covers better, and low-risk flows.
- *Where do page objects start?* When two tests repeat the same screen interaction.
- *Who owns the suite?* A CODEOWNERS entry for the E2E folder and a review rule.

**Trap:** Building a big framework before the first test runs reliably.

**Source:** https://playwright.dev/docs/intro

### The tests pass but the product has a bug. Why might that happen with Playwright tests?

Topic: pw-general | Standard | id: q0079

**Say:** A test can pass for the wrong reason. The assertion may be too weak or in the wrong place, for example a lone `toBeHidden()` that passes when the element never appeared. A `click()` can wait through a disabled state that was the actual bug. A retry can hide a flaky product bug. The environment can differ from production, such as feature flags. And a UI check can pass while the backend did the wrong thing. So I watch tests fail once, I assert the state that proves the contract, and I check the environment matches what customers see.

**Full process:**
1. Review each assertion: does it prove the behavior, or would it pass on a broken app?
2. Mutation check: change the product behavior or the test by one line and confirm the test fails. Use Stryker on a project to find tests that never fail.
3. Assert delivery, not configuration: check the receiver's log and status codes, not only that the UI shows it was configured.
4. Compare environment configuration, such as feature flags, with production.
5. Do not weaken an assertion to make a test pass.

**Follow-ups:**
- *Example of environment drift?* E2E environments drifted from production feature flags, so tests passed on a configuration customers never saw.
- *How do you see that a test can fail?* Run it against the unfixed code or a deliberate mutation.
- *Does 100% pass rate mean quality?* No. It means the checks ran.

**Trap:** Treating a green suite as proof.

**Source:** https://playwright.dev/docs/test-assertions

## Section 10: Code reading, "what is wrong with this test?"

### What is wrong with this test? (missing `await`)

Topic: pw-waits-assertions | Standard | id: q0080

**Say:** Two things. The assertion has no `await`, so the test function ends before it runs, and the test passes even when the text is wrong. Second, `click()` is not awaited either, so the next line can run before the click. The fix is to await every Playwright call and every async matcher. I also turn on the lint rule for floating promises so the compiler catches it.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test('saves the profile', async ({ page }) => {
  await page.goto('/profile');
  page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(page.getByRole('status')).toHaveText('Saved');
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test('saves the profile', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

**Follow-ups:**
- *Why does the buggy test often pass?* The un-awaited assertion is a floating promise, so the test finishes first and the failure appears nowhere, or in a later test.
- *How do you prevent it?* ESLint `@typescript-eslint/no-floating-promises`, and the `eslint-plugin-playwright` rules.
- *Same bug with `forEach`?* `items.forEach(async (i) => await ...)` awaits nothing. Use `for...of`.

**Trap:** Believing a green test means it ran its assertion.

**Source:** https://playwright.dev/docs/test-assertions

### What is wrong with this test? (one-shot check and sleep)

Topic: pw-waits-assertions | Standard | id: q0081

**Say:** It sleeps for a fixed time and then reads the state once. On a slow CI machine three seconds is not enough, and on a fast one it wastes three seconds every run. `isVisible()` also does not wait, and `toBe(true)` is a plain matcher with no retry, so the failure message says only "expected true, got false". The fix is to remove the sleep and assert with a web-first matcher, which waits as long as needed up to the expect timeout.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test('shows the confirmation', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await page.waitForTimeout(3000);
  expect(await page.getByText('Payment received', { exact: true }).isVisible()).toBe(true);
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test('shows the confirmation', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
  await expect(page.getByText('Payment received', { exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *What if the confirmation appears only after a slow payment API?* Raise the timeout for this one assertion: `toBeVisible({ timeout: 15_000 })`, or wait for the payment response.
- *Does the fixed version still prove the payment worked?* It proves the UI shows it. For a backend check, I would also assert the order through the API with `expect.poll`.
- *Why is the failure message better?* It includes the call log with the locator and the timeout.

**Trap:** Keeping the sleep "to be safe".

**Source:** https://playwright.dev/docs/test-assertions

### What is wrong with this test? (strict mode and brittle selectors)

Topic: pw-locators | Standard | id: q0082

**Say:** The locator is a CSS chain tied to the DOM structure and class names, so any styling refactor breaks it. It also matches many buttons, so it would throw a strict mode violation, and the author silenced that with `first()`, which clicks whatever is first today. The fix is a semantic locator scoped to the item the test means: find the row by its content, then the button by role and name inside it.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test('deletes an invoice', async ({ page }) => {
  await page.goto('/invoices');
  await page.locator('div.table > div:nth-child(2) .btn.btn-danger').first().click();
  await expect(page.locator('.toast')).toBeVisible();
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test('deletes an invoice', async ({ page }) => {
  await page.goto('/invoices');
  const row = page.getByRole('row').filter({ hasText: 'Invoice 1042' });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Invoice deleted');
  await expect(row).toHaveCount(0);
});
```

**Follow-ups:**
- *What if the delete button has no accessible name?* Fix the product so it has one, such as an `aria-label`, and then locate by role and name.
- *Why also check the row is gone?* The toast alone does not prove the item was removed.
- *And if two invoices share the text?* Use unique test data per test.

**Trap:** Replacing `.first()` with `.nth(0)`. It is the same problem.

**Source:** https://playwright.dev/docs/locators

### What is wrong with this test? (a race with a response)

Topic: pw-waits-assertions | Standard | id: q0083

**Say:** The test clicks first and then starts waiting for the response. If the response arrives before `waitForResponse` is called, the listener misses it and the test times out, so it passes on a laptop and fails on CI. The fix is to create the wait first and then click, in the same `Promise.all`. A cleaner fix is to assert the visible effect and skip the response wait if the UI shows it.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test('saves settings', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Auto-assign chats', exact: true }).click();
  const response = await page.waitForResponse('**/api/settings/**');
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test('saves settings', async ({ page }) => {
  await page.goto('/settings');
  const [response] = await Promise.all([
    page.waitForResponse('**/api/settings/**'),
    page.getByRole('switch', { name: 'Auto-assign chats', exact: true }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

**Follow-ups:**
- *What if several requests match the URL?* Use a predicate with URL and method, so you wait for the right one.
- *Is the `Promise.all` order important?* The wait must be created before the action in the array.
- *Same pattern for others?* Yes: `popup`, `download`, `filechooser`.

**Trap:** Thinking the order of two awaited lines does not matter.

**Source:** https://playwright.dev/docs/api/class-page#page-wait-for-response

### What is wrong with this fixture and test? (shared state and teardown)

Topic: pw-fixtures | Standard | id: q0084

**Say:** Three problems. The `project` is created in `beforeAll`, so every test in the file shares one project and the second test that edits it fails or passes depending on order. The cleanup is at the end of the test body, so a failing assertion skips it and leaves data behind. And the project name is fixed, so a parallel run on the same account collides. The fix is a test-scoped fixture with a unique name that creates the project before `use` and deletes it after.

**Full process:**
Buggy code:

```ts
import { test, expect, type APIRequestContext } from '@playwright/test';

let projectId: string;

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const res = await request.post('/api/projects', { data: { name: 'My project' } });
  projectId = (await res.json()).id;
});

test('renames the project', async ({ page, request }) => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Renamed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renamed', exact: true })).toBeVisible();
  await request.delete(`/api/projects/${projectId}`);
});
```

Fixed code:

```ts
import { test as base, expect } from '@playwright/test';

const test = base.extend<{ project: { id: string; name: string } }>({
  project: async ({ request }, use, testInfo) => {
    const name = `project-${testInfo.testId}`;
    const res = await request.post('/api/projects', { data: { name } });
    expect(res).toBeOK();
    const { id } = await res.json();
    await use({ id, name });
    await request.delete(`/api/projects/${id}`);
  },
});

test('renames the project', async ({ page, project }) => {
  await page.goto(`/projects/${project.id}`);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Renamed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renamed', exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *Why does `beforeAll` hurt in parallel?* With `fullyParallel`, each parallel test executes `beforeAll` for itself, and module variables are not shared across workers.
- *What if the fixture's own delete fails?* It fails the teardown and is visible in the report.
- *Is the failure of the first buggy version deterministic?* No, it depends on order and workers, so it looks like flakiness.

**Trap:** Sharing created data across tests to "save time".

**Source:** https://playwright.dev/docs/test-fixtures

### What is wrong with this config? (CI settings)

Topic: pw-config | Standard | id: q0085

**Say:** Several things. `retries: 5` for the whole suite hides flaky tests and slows CI. `workers: 20` can overload both the CI machine and the app under test, which creates the flakiness the retries then hide. `forbidOnly` is off, so a stray `test.only` skips the rest of the suite and CI is green. The trace is always on, which is heavy, where `on-first-retry` is enough. And the password is in the file. I would fix each and keep one environment-driven config.

**Full process:**
Buggy code:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: 5,
  workers: 20,
  use: {
    baseURL: 'https://staging.example.com',
    trace: 'on',
    httpCredentials: { username: 'qa', password: 'hunter2' },
  },
});
```

Fixed code:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    httpCredentials: process.env.HTTP_USER
      ? { username: process.env.HTTP_USER, password: process.env.HTTP_PASSWORD ?? '' }
      : undefined,
  },
});
```

**Follow-ups:**
- *Is `retries: 1` ok with my rule of no global retries?* My strict rule is a retry on a named test with a reason. Where a team requires a CI policy, I keep it small, count flaky tests, and fail on them with `--fail-on-flaky-tests` once the backlog is cleared.
- *Why `fullyParallel`?* It balances tests across workers and shards.
- *What does trace `on` cost?* Disk and time on every test, with little benefit when the first retry trace is enough.

**Trap:** More workers and more retries as the answer to slowness.

**Source:** https://playwright.dev/docs/test-configuration

### What is wrong with this test? (auth in every test and a leaked state)

Topic: pw-auth | Standard | id: q0086

**Say:** Every test logs in through the UI, which is slow and makes each login a failure point. The test also uses one shared admin account and changes a setting, so a parallel test that reads the same setting will see it change. The fix is a setup project that signs in once and saves the state, per-role state files, and a separate account per worker when tests change shared server state.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('admin-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
});

test('turns on dark mode', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Dark mode', exact: true }).check();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
```

Fixed code:

```ts
// playwright/fixtures.ts: per-worker account, authenticated once
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export { expect };
export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser }, use) => {
      const id = test.info().parallelIndex;
      const file = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);
      if (!fs.existsSync(file)) {
        const page = await browser.newPage({ storageState: undefined });
        await page.goto('/login');
        await page.getByLabel('Email', { exact: true }).fill(`qa${id}@example.com`);
        await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD ?? '');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
        await page.context().storageState({ path: file });
        await page.close();
      }
      await use(file);
    },
    { scope: 'worker' },
  ],
});
```

```ts
// settings.spec.ts
import { test, expect } from '../playwright/fixtures';

test('turns on dark mode', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Dark mode', exact: true }).check();
  await expect(page.getByRole('switch', { name: 'Dark mode', exact: true })).toBeChecked();
});
```

**Follow-ups:**
- *Still one UI login test?* Yes, the login screen needs its own test.
- *What was weak in the original assertion?* A class check on `html` is an implementation detail. I assert the user-facing state, here the switch being checked, and a visual check if the theme itself is the contract.
- *Where is the password?* In an environment variable, not in the spec.

**Trap:** Moving login to `beforeAll` and sharing the page across tests.

**Source:** https://playwright.dev/docs/auth

### What is wrong with this test? (iframe, hidden check and `networkidle`)

Topic: pw-locators | Standard | id: q0087

**Say:** It waits for `networkidle`, which can take long or never arrive on a page with polling. It handles the iframe through an element handle and `contentFrame()`, which is timing sensitive. And it asserts the dialog is hidden without ever proving it opened, so it would pass if the click did nothing. The fix is `frameLocator`, an assertion on the element I need instead of network quiet, and a visible-then-hidden pair.

**Full process:**
Buggy code:

```ts
import { test, expect } from '@playwright/test';

test('closes the widget', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const handle = await page.$('iframe#widget');
  const frame = await handle!.contentFrame();
  await frame!.click('text=Close');
  await expect(page.locator('#dialog')).toBeHidden();
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test('closes the widget', async ({ page }) => {
  await page.goto('/');
  const widget = page.frameLocator('iframe#widget');
  const dialog = widget.getByRole('dialog', { name: 'Chat', exact: true });
  await expect(dialog).toBeVisible();
  await widget.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});
```

**Follow-ups:**
- *Why is the handle risky?* If the iframe re-renders, the handle points at a stale node.
- *What does the fixed version prove that the buggy one did not?* The dialog opened, the close button worked, and the dialog closed.
- *Is `waitUntil: 'networkidle'` ever fine?* It is discouraged for tests, and I do not use it.

**Trap:** Believing `toBeHidden()` alone proves the close action.

**Source:** https://playwright.dev/docs/locators

### What is wrong with this page object and test? (assertions in the page object, handles, class fields)

Topic: fw-pom | Core | id: q0088

**Say:** The page object stores a handle from `page.$`, which goes stale on a re-render. It also asserts inside the object, so the test hides its own contract, and it exposes one method per click. In 1.65 there is a fourth problem: the field initializer reads a constructor parameter property, which now throws a TypeError because TypeScript class fields follow `useDefineForClassFields`. The fix is to hold `Locator`s, initialize them in the constructor, expose user actions, and keep the assertions in the test.

**Full process:**
Buggy code:

```ts
import { expect, type Page } from '@playwright/test';

export class LoginPage {
  readonly submit = this.page.getByRole('button', { name: 'Sign in', exact: true });

  constructor(private readonly page: Page) {}

  async clickEmail() { await this.page.getByLabel('Email', { exact: true }).click(); }
  async typeEmail(v: string) { await this.page.keyboard.type(v); }
  async clickSubmit() {
    const handle = await this.page.$('button[type=submit]');
    await handle!.click();
    await expect(this.page.getByRole('alert')).toBeVisible();
  }
}
```

Fixed code:

```ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email', { exact: true });
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: 'Sign in', exact: true });
    this.error = page.getByRole('alert');
  }

  async goto() { await this.page.goto('/login'); }

  async signIn(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```

```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './login-page';

test('wrong password shows an error', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.signIn('ann@example.com', 'wrong');
  await expect(login.error).toBeVisible();
});
```

**Follow-ups:**
- *Why keep assertions out?* The test should show what it promises. A page object that asserts hides that, and makes reuse awkward when a flow needs the opposite outcome.
- *Is `keyboard.type` a good way to fill a field?* No, `fill()` is the simple way, and `pressSequentially` only when the page needs key events.
- *Where is the object created?* In a fixture, so tests just ask for `loginPage`.

**Trap:** Thinking POM means "every element and every click wrapped".

**Source:** https://github.com/microsoft/playwright/releases/tag/v1.65.0

### What is wrong with this time-zone and date test?

Topic: pw-browsers | Core | id: q0089

**Say:** The test pins `timezoneId` and the clock for the whole suite so that a date assertion passes, which hides the real problem. If the product has a bug at a DST change, a pinned zone and a frozen date never see it. The fix is to leave the suite unpinned, and put the zone and the date on the one test that needs them, ideally on the DST transition date in a zone that observes DST, with an expected value built from the same zone.

**Full process:**
Buggy code:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: { timezoneId: 'UTC', locale: 'en-US' },
});
```

Fixed code:

```ts
import { test, expect } from '@playwright/test';

test.describe('around the spring DST change in Warsaw', () => {
  test.use({ timezoneId: 'Europe/Warsaw', locale: 'pl-PL' });

  test('slots keep local wall-clock times', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-03-29T00:30:00+01:00') });
    await page.goto('/booking');
    await page.clock.pauseAt(new Date('2026-03-29T00:45:00+01:00'));
    await expect(page.getByRole('option', { name: '03:00', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: '02:30', exact: true })).toHaveCount(0);
  });
});
```

**Follow-ups:**
- *Why does a unit runner in UTC not help?* It never crosses a DST change.
- *Does `timezoneId` change the Node process?* No. Use `TZ` for the runner.
- *How do you test fast-forwarding time across the change?* `fastForward` after `install`, with the zone set on that test.

**Trap:** A global pin to make a flaky date test pass.

**Source:** https://playwright.dev/docs/clock

## Network (`pw-network`)

### What is HAR in Playwright trace logs?

Topic: pw-network | Core | id: q0090

**Say:** HAR is HTTP Archive, a JSON file format for recorded network traffic: every request with its headers and post data, and the response with status, headers and body. A Playwright trace is a different file, a `trace.zip`. The trace has a Network tab that shows the same kind of information, so people mix the two up. A HAR is something you can feed back into Playwright with `routeFromHAR` to replay responses. A trace is for looking at what happened, not for replaying it. When a request is served from a HAR, the trace shows that request as answered from the file and not from the server.

**Full process:** How to see the difference in practice.
1. Run a test with `npx playwright test --trace on`. Output: `test-results/<test-name>/trace.zip`.
2. Open it with `npx playwright show-trace test-results/<test-name>/trace.zip`, then open the Network tab. You see method, URL, status, content type, duration, size, and request and response headers and bodies per request.
3. Double click an action in the left list and the Network tab filters to the requests made during that action.
4. A HAR is a separate file you create on purpose, with `routeFromHAR(..., { update: true })` or `npx playwright open --save-har=...` (see the next entries). Open it as plain text: it is JSON with `log.entries[]`.
5. Rule of thumb: trace = diagnosis after the run, HAR = test input for the next run.

**Follow-ups:**
- *Can I replay a trace.zip with routeFromHAR?* No. `routeFromHAR` takes a HAR file. A trace is an archive of actions, snapshots and network records for the Trace Viewer.
- *So why does the trace show network at all?* For debugging: you check whether the request was sent, with which payload, and what came back, next to the DOM snapshot of the same action.

**Trap:** Saying "the HAR is inside the trace and you replay the trace". It is not, and a trace cannot be used as a mock.

**Source:** https://playwright.dev/docs/trace-viewer

### How can I use HAR to mock something in Playwright? Walk me through the whole process.

Topic: pw-network | Core | id: q0091

**Say:** Three steps. First I record: I add `page.routeFromHAR` with the path of the HAR file, a URL filter so only my API is recorded, and `update: true`, and I run the test once against a working environment. Playwright saves the HAR when the browser context closes, so when the test ends. Second I review the file, remove secrets, and commit it next to the tests. Third I turn `update` off. Now the same line serves the responses from the file, the backend is not called, and a request that is not in the file is aborted by default. When the API changes I run once more with update on.

**Full process:**
1. Config: block service workers, so nothing bypasses the route (in `playwright.config.ts`: `use: { serviceWorkers: 'block' }`).
2. Test file `tests/offers.spec.ts`. One switch controls record or replay:

```ts
import { test, expect } from '@playwright/test';

const recordHar = process.env.UPDATE_HAR === '1';

test('offers page renders from a recorded HAR', async ({ page }) => {
  await page.routeFromHAR('tests/hars/offers.har', {
    url: '**/api/**',
    update: recordHar,
    updateContent: 'attach',
    updateMode: 'minimal',
    notFound: 'abort',
  });

  await page.goto('/offers');
  await expect(page.getByRole('heading', { name: 'Offers', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(3);
});
```

3. Record: `UPDATE_HAR=1 npx playwright test tests/offers.spec.ts --project=chromium`. The test runs against the real API. When the context closes, Playwright writes `tests/hars/offers.har`. The path is relative to the current working directory, which is normally the project root, so run the command from there. With `updateContent: 'attach'` the response bodies are written as separate files beside the HAR, named by hash. With `'embed'` they sit inline in the JSON.
4. Review: open the HAR, read the entries, delete anything private (see the sanitising entry), edit bodies you want to change.
5. Replay: `npx playwright test tests/offers.spec.ts`. No `UPDATE_HAR`, so `update` is `false`. Responses come from the file, and the API is not called. Check the trace: the requests are answered from the HAR.
6. Commit `offers.har` and the body files together. Without the body files the replay has no bodies.
7. Maintenance: when the API contract changes, run step 3 again, review the git diff of the HAR, commit.

Verified by running it on Playwright 1.65.0 (2026-11-06, local test server, Chromium): recording with `updateContent: 'attach'` wrote `app.har` plus one body file per response, named by a 40-character hash with the extension `.json`, beside it. Each entry's `response.content` held `_file` and no inline text. On replay, a reload and a repeated `fetch` both got the same recorded body, while the real server was not called. A URL inside the filter with no entry, and the same path with a different query string (`?page=2` against a recorded `?page=1`), both failed with "Failed to fetch" under the default `notFound: 'abort'`. With `notFound: 'fallback'` the missing URL reached the real server. A `Set-Cookie` value from the server appeared in plain text in `app.har`, in the response headers, even though the `cookies` array was empty.

**Follow-ups:**
- *Why a `url` filter?* Without it the HAR records, and on replay serves, every request, including images, fonts and analytics. The file gets big and noisy, and replay of assets can hide real problems.
- *What happens to a request that matches the `url` filter but is not in the HAR?* It is aborted by default (`notFound: 'abort'`). `notFound: 'fallback'` sends it to the real network, or to the next matching route.
- *Why do you gate `update` with an environment variable?* A forgotten `update: true` makes every CI run overwrite the file with live data and call the real API, so the test stops being deterministic.

**Trap:** "I record the HAR once and it works forever". The data goes stale when the API changes, and a stale HAR keeps a broken contract green.

**Source:** https://playwright.dev/docs/mock

### What does a HAR file look like when it holds many responses from many endpoints?

Topic: pw-network | Core | id: q0092

**Say:** It is one JSON file with a `log` object, and inside it an `entries` array. One entry is one request and response pair, so ten endpoints called twice give twenty entries. Each entry has a `request` with method, URL, query string, headers and, for a POST, `postData`. It has a `response` with status, headers and a `content` object with the MIME type and the body. The body is either inline text or, with Playwright's attach mode, kept in a separate file. There are also timings, which Playwright leaves out in minimal mode. So the file is a flat list, and replay looks entries up by URL, method and payload.

**Full process:** A trimmed example with two endpoints (field names follow the HAR 1.2 spec; the exact extra fields Playwright adds can differ by version, so open your own file once):

```json
{
  "log": {
    "version": "1.2",
    "creator": { "name": "Playwright", "version": "1.65.0" },
    "entries": [
      {
        "request": {
          "method": "GET",
          "url": "https://shop.example.com/api/offers?limit=3",
          "headers": [{ "name": "accept", "value": "application/json" }]
        },
        "response": {
          "status": 200,
          "headers": [{ "name": "content-type", "value": "application/json" }],
          "content": { "mimeType": "application/json", "text": "[{\"id\":1,\"name\":\"Basic\"}]" }
        }
      },
      {
        "request": {
          "method": "POST",
          "url": "https://shop.example.com/api/cart",
          "headers": [{ "name": "content-type", "value": "application/json" }],
          "postData": { "mimeType": "application/json", "text": "{\"offerId\":1}" }
        },
        "response": {
          "status": 201,
          "headers": [{ "name": "content-type", "value": "application/json" }],
          "content": { "mimeType": "application/json", "text": "{\"cartId\":\"c-1\"}" }
        }
      }
    ]
  }
}
```

1. Count entries fast: `node -e "const h=require('./tests/hars/offers.har');console.log(h.log.entries.length)"`.
2. List what is in it: `node -e "for (const e of require('./tests/hars/offers.har').log.entries) console.log(e.request.method, e.request.url, e.response.status)"`.
3. With `updateContent: 'attach'` the `content` object has no inline text. It refers to a body file next to the HAR instead. Edit that file to change a body.
4. A `.zip` HAR path makes Playwright store the HAR and the bodies inside one archive.

**Follow-ups:**
- *Which entry is used when two entries have the same URL?* The docs say the one with the most matching headers is picked. Do not rely on order, so do not design a test that expects the first call and the second call to get different bodies from the same HAR.
- *How big can it get and does it matter?* Large bodies make noisy diffs and slow reviews, so filter with `url` and keep one HAR per scenario.

**Trap:** Thinking a HAR is a script that plays responses in recorded order. It is a lookup table.

**Source:** https://playwright.dev/docs/mock

### How does Playwright match a request to a HAR entry?

Topic: pw-network | Core | id: q0093

**Say:** Replay matching is strict. The URL must match, the HTTP method must match, and for a POST the post data must match too. If several entries qualify, Playwright picks the one with the most matching headers. If the entry is a redirect, Playwright follows it. The `url` option on `routeFromHAR` is a different thing: it decides which requests go through the HAR at all. A request outside that filter is left alone. A request inside the filter with no matching entry is aborted, unless `notFound` is `'fallback'`.

**Full process:**
1. Two decisions per request: does it match the `url` filter (glob or regex; `routeFromHAR` takes no predicate function), and is there an entry with the same URL, method and payload.
2. Typical failure: the app sends a timestamp or a random id in the query string or in a POST body. The recorded entry never matches, and the request is aborted.
3. Fix, option A: make the data deterministic in the test (fixed ids, a frozen clock with `page.clock`).
4. Fix, option B: do not use HAR for that endpoint. Add a `page.route` for it with `fulfill`, and let HAR serve the rest. Routes registered later run first, and `route.fallback()` passes a request on to the earlier route.

```ts
import { test, expect } from '@playwright/test';

test('HAR for the list, a handler for the volatile endpoint', async ({ page }) => {
  await page.routeFromHAR('tests/hars/dashboard.har', { url: '**/api/**', notFound: 'abort' });
  await page.route('**/api/session/ping*', route => route.fulfill({ json: { ok: true } }));

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
```

**Follow-ups:**
- *Does the query string count?* URL matching is strict, so a different query string is a different URL. Check the failing request in the trace Network tab and compare it to the entry.
- *Does a header difference break the match?* Headers do not have to be equal. They only decide between several entries for the same request.

**Trap:** Believing the `url` option is the matching rule for entries. It is only the filter for which requests use the HAR.

**Source:** https://playwright.dev/docs/mock

### routeFromHAR: `notFound: 'abort'` versus `'fallback'`. When do you use each?

Topic: pw-network | Core | id: q0094

**Say:** `abort` is the default. A request that passes the `url` filter but has no entry in the HAR fails, so the test shows that the app made a call that was not recorded. This is preferred for a strict, fully offline test. `fallback` sends the missing request on to the real network, or to the next matching route handler. Use it when the HAR covers only part of the traffic and real calls are accepted for the rest, for example a mostly real environment where only one slow endpoint is frozen.

**Full process:**
1. Strict offline test: `notFound: 'abort'` (default). Any unrecorded call fails loudly, and the trace shows the aborted URL.
2. Partial mock: `notFound: 'fallback'`, combined with a narrow `url` filter.

```ts
import { test, expect } from '@playwright/test';

test('freeze only the pricing call, the rest hits the real backend', async ({ page }) => {
  await page.routeFromHAR('tests/hars/pricing.har', {
    url: '**/api/pricing/**',
    notFound: 'fallback',
  });
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible();
});
```
3. Risk of `fallback`: a missing entry is silent. The test passes by using the live API, and you think it is isolated when it is not.

**Follow-ups:**
- *How would you notice silent fallbacks?* Listen with `page.on('request', ...)` and fail on calls to the real backend, or keep `abort` and fix the missing entry.

**Trap:** Setting `fallback` to make a red test green. That hides the missing recording and removes the isolation you wanted.

**Source:** https://playwright.dev/docs/api/class-page#page-route-from-har

### Does `routeFromHAR` apply until the test ends, or only for the next request?

Topic: pw-network | Standard | id: q0095

**Say:** It applies until the test ends, or until I remove it. It is not a one-shot. Every matching request the page makes after I register it is served from the HAR: the first click, the tenth click, a reload. `page.routeFromHAR` covers that page. `context.routeFromHAR` covers every page in the context, including popups. Registration is also not retroactive. Requests that went out before the call are not affected, so I register it before `page.goto`. If I want a limited number of hits I use `page.route` with the `times` option, not HAR.

**Full process:**
1. Register before navigation:

```ts
import { test, expect } from '@playwright/test';

test('HAR stays active for the whole test', async ({ page }) => {
  await page.routeFromHAR('tests/hars/offers.har', { url: '**/api/offers**' });
  await page.goto('/offers');
  await expect(page.getByRole('listitem')).toHaveCount(3);

  await page.reload();
  await expect(page.getByRole('listitem')).toHaveCount(3);

  await page.unroute('**/api/offers**');
});
```
2. After `page.reload()` the HAR still answers. That is the proof it is not one-shot.
3. To stop it earlier use `page.unroute(url)` or `page.unrouteAll()`. Use the same URL argument you routed with.
4. Handlers run in reverse registration order, so a handler registered later for the same URL wins, and can call `route.fallback()` to hand the request down to the HAR.

**Follow-ups:**
- *Page-level or context-level for a popup?* Context-level, because a popup is a new page. A page route does not cover it.
- *Which wins when both exist?* The docs say page routes take precedence over context routes when a request matches both.

**Trap:** "It applies to the next step". Steps do not exist at network level. Routes belong to the page or context for its lifetime.

**Source:** https://playwright.dev/docs/network

### HAR versus `page.route`: when do you use which?

Topic: pw-network | Standard | id: q0096

**Say:** I use `page.route` with `fulfill` when I need one specific response that I control in code: an error case like a 500, an empty list, a slow response, a very specific payload. It is explicit, short and lives in the test. I use HAR when the page needs many realistic responses from several endpoints and writing them by hand would be long, for example a dashboard that loads ten endpoints. A HAR gives realistic data fast, but it is a recorded snapshot that goes stale and is hard to read in a diff. I often combine them: HAR for the bulk, and `page.route` on top for the one case I am testing.

**Full process:**

| Need | Tool |
|---|---|
| One endpoint, one controlled response | `page.route` + `route.fulfill({ json })` |
| Error, empty state, timeout | `page.route` + `fulfill({ status: 500 })` or `abort()` |
| Real response, small patch | `page.route` + `route.fetch()` + `fulfill({ response, json })` |
| Many endpoints, realistic data, offline page | `routeFromHAR` |
| Look at traffic only | `page.on('request')` or the trace Network tab |

```ts
import { test, expect } from '@playwright/test';

test('dashboard shows an error banner when the stats endpoint fails', async ({ page }) => {
  await page.routeFromHAR('tests/hars/dashboard.har', { url: '**/api/**', notFound: 'fallback' });
  await page.route('**/api/stats', route => route.fulfill({ status: 500, json: { error: 'boom' } }));

  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('Could not load statistics');
});
```
The `page.route` was registered last, so it runs first for `/api/stats`. Everything else falls to the HAR.

**Follow-ups:**
- *Maintenance cost?* Code mocks change when the code changes. HAR changes when someone re-records, and the diff is large. A reviewer cannot judge a re-recorded HAR easily, so I keep HARs small and per scenario.
- *Would you mock at all in an E2E test?* Yes, for what I cannot control: payment, email, third parties, flaky external data. For my own backend I prefer the real thing in at least the smoke and critical-path tests.

**Trap:** Saying HAR replaces mocking in code. They solve different sizes of problem.

**Source:** https://playwright.dev/docs/mock

### How do you record a HAR from the command line, without writing a test?

Topic: pw-network | Standard | id: q0097

**Say:** I use `npx playwright open` with `--save-har` and optionally `--save-har-glob` to keep only the API calls. A browser opens, I click through the flow by hand, and when I close the window the HAR file is written. If the file name ends with `.zip`, Playwright stores the bodies as separate entries inside one archive. The docs recommend the `update` option in a test, because it is repeatable and lives in the repo, but the CLI is fine for a quick capture.

**Full process:**
1. Run from the project root:
```bash
npx playwright open --save-har=tests/hars/offers.har --save-har-glob="**/api/**" https://shop.example.com/offers
```
2. Click through the flow in the browser that opens. Close the browser window.
3. Output: `tests/hars/offers.har`. The path is relative to where you ran the command. With a `.zip` name instead, the bodies are packed into the archive and `routeFromHAR` reads the zip directly.
4. Use it in a test with `page.routeFromHAR('tests/hars/offers.har', { url: '**/api/**' })`.
5. Compared with `update: true` in a test: the CLI records whatever you click, so it is not repeatable. The test with `update` records the exact steps of the test every time.

**Follow-ups:**
- *Does the browser need a login?* Yes, and a manual login ends up in the HAR with its tokens. Log in with a test user and clean the file before commit.
- *Can you also record in code outside the test runner?* Yes: `browser.newContext({ recordHar: { path: 'x.har', urlFilter: '**/api/**' } })`, then `context.close()` writes the file.

**Trap:** Forgetting to close the browser or the context. The HAR is written on close, so a killed process leaves no file.

**Source:** https://playwright.dev/docs/mock

### `routeFromHAR` with `update` versus `recordHar` in a context. What is the difference?

Topic: pw-network | Standard | id: q0098

**Say:** `routeFromHAR` with `update: true` is the method I use in tests. It records into the HAR path I give, and the same call, without `update`, replays it, so record and replay share one line. `recordHar` is a context option: it records everything that context does until the context closes, and it only records. In the test runner I use `routeFromHAR`, because record and replay share one line. In a plain library script I use `recordHar`. `recordHar` inside `use.contextOptions` does write a HAR in the runner (checked on 1.65.0), but the typings say it produces no file when `reuseContext: true` is set.

**Full process:**
1. Test runner: `await page.routeFromHAR('tests/hars/x.har', { url: '**/api/**', update: true })`.
2. Library script:
```ts
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  recordHar: { path: 'x.har', urlFilter: '**/api/**', mode: 'minimal', content: 'attach' },
});
const page = await context.newPage();
await page.goto('https://shop.example.com/offers');
await context.close();
await browser.close();
```
3. `context.close()` is the moment the file is written.
4. `mode: 'minimal'` keeps only what routing needs. `'full'` also keeps sizes, timings, cookies and more, and is the default for `recordHar`. For `routeFromHAR`, `updateMode` defaults to `minimal`.

**Follow-ups:**
- *What is `content`?* `embed` stores bodies inline and is the default for a `.har` path. `attach` stores them as separate files and is the default for a `.zip` path. `omit` stores none.

**Trap:** Recording with `recordHar` in `use.contextOptions` and `reuseContext: true`, then wondering why no file appears. With `reuseContext: true` that option is not supported. Also, the file is written only when the context closes.

**Source:** https://playwright.dev/docs/api/class-browser#browser-new-context

### Where do the HAR files land, and how do you organise them in the repo?

Topic: pw-network | Standard | id: q0099

**Say:** They land exactly at the path I pass, resolved against the current working directory, so I always pass a path under the tests folder, like `tests/hars/offers.har`. If I use attach mode, the body files land beside it. I keep one HAR per scenario or per page, named after it, and I commit them. I do not put them in `test-results`, because that folder is wiped on each run.

**Full process:**
1. Layout:
```
tests/
  offers.spec.ts
  hars/
    offers.har
    <hash>.json     (body files when updateContent is 'attach')
```
2. Check the real names after your first record: `ls tests/hars`. Do not guess the body file names.
3. Run tests from the project root. A different working directory means a different resolved path, and the replay then looks in the wrong place and aborts every request.
4. `.gitignore` must not exclude `*.har` or the body files.
5. For many files, a helper keeps paths in one place:
```ts
import path from 'node:path';

export const harPath = (name: string) => path.join('tests', 'hars', `${name}.har`);
```

**Follow-ups:**
- *Zip or folder?* A `.zip` is one file in git and easy to move, but git cannot diff inside it. A folder gives readable diffs of the bodies. I choose the folder if people review HAR changes.

**Trap:** Relative paths that work on your machine and fail in CI because CI runs from a different directory.

**Source:** https://playwright.dev/docs/api/class-page#page-route-from-har

### How do you edit a recorded HAR?

Topic: pw-network | Standard | id: q0100

**Say:** I open the body file and edit the JSON, or in embed mode the body text inside the HAR. The docs show this: change the response body, commit it, and replay returns the changed data. I use it to build edge cases, like an empty list or a very long name, without a backend change. The risk is that the file then differs from what the real API returns, so I keep edits few and say so in the commit message.

**Full process:**
1. Record with `updateContent: 'attach'` so the bodies are separate, readable files.
2. Find the body file: open the HAR, find the entry by URL, read `response.content`, and open the file it refers to.
3. Edit the body, for example add an item to the list.
4. Replay without `update`. The page now shows your edit.
5. Warning: running again with `update: true` overwrites your edits with the live API.
6. Rule: a HAR you edited by hand is no longer a record of the API. Put a note in the commit message, and prefer `page.route` with `route.fetch()` and `fulfill({ response, json })` when you only need a small patch on live data.

**Follow-ups:**
- *Can you edit inside a zip?* Extract it, edit the files, and point `routeFromHAR` at the extracted `.har`. The docs say payloads then resolve relative to that file.

**Trap:** Editing the HAR and then re-recording with `update: true` the same day. The edits vanish silently.

**Source:** https://playwright.dev/docs/mock

### How do you sanitise a HAR, and what secrets can be in one?

Topic: pw-network | Standard | id: q0101

**Say:** A HAR is a copy of real traffic, so it can hold `Authorization` headers, session and CSRF cookies, API keys in query strings, tokens in response bodies, and real names or emails in the data. I never commit one without checking. I record with a test user on a test environment, use a `url` filter to cut third parties, and run a small script that blanks sensitive headers and cookie values. Then I grep for tokens and emails, and review the diff in the merge request. If a real secret was committed, I rotate it, because git history keeps it.

**Full process:**
1. Record with a test account on a non-production environment.
2. Run a sanitising script on the HAR (this handles headers and cookies; with attach mode scan the body files too):
```ts
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const har = JSON.parse(readFileSync(file, 'utf8'));
const secretHeaders = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-csrf-token']);

for (const entry of har.log.entries) {
  for (const part of [entry.request, entry.response]) {
    for (const header of part.headers ?? []) {
      if (secretHeaders.has(header.name.toLowerCase())) header.value = 'REDACTED';
    }
    for (const cookie of part.cookies ?? []) cookie.value = 'REDACTED';
  }
}
writeFileSync(file, JSON.stringify(har, null, 2));
```
Run: `npx tsx scripts/sanitise-har.ts tests/hars/offers.har`.
3. Search what is left: `rg -n -i "bearer|token|password|@|session" tests/hars`.
4. Check the sanitised HAR still replays: run the test without `update`. Matching uses URL, method and post data, so redacting header values is safe unless two entries are told apart by headers.
5. Add a pre-commit check or a CI step that fails on `Bearer ` in `tests/hars`.

**Follow-ups:**
- *Is `updateMode: 'minimal'` enough?* It drops cookies and timings, but headers and bodies can stay, so no. Still check.
- *A token was already pushed.* Revoke it first, then clean the file. Removing it from the latest commit does not remove it from history.

**Trap:** Treating a HAR like a test fixture with no sensitive content. It is a network capture.

**Source:** https://playwright.dev/docs/mock

### Do you store HAR files in git? What are the downsides?

Topic: pw-network | Standard | id: q0102

**Say:** Yes, I commit them, because the test is not reproducible without them, and the docs say to commit the HAR next to the tests. The downsides are size, noisy diffs on re-record, staleness, and secrets. So I keep them small with a URL filter, one per scenario, sanitise before commit, and treat a HAR change in a merge request like a contract change: the reviewer must see why it was re-recorded. For big bodies I would consider Git LFS, but I would first ask if the test needs those bodies at all.

**Full process:**
1. Commit `*.har` and the body files in the same commit as the test.
2. Keep `update` behind an env variable so CI never rewrites them.
3. In CI, add a check that the tree is clean after the run: `git diff --exit-code tests/hars`. If a test rewrote a HAR, the job fails.
4. Put the recording date and the environment in the commit message. A HAR carries no label of the environment it came from.
5. Review rule: look at status codes, field names and schema changes in the diff, not every value.

**Follow-ups:**
- *HAR staleness: how do you detect it?* Keep a small contract check against the real API, such as a schema validation test with the `request` fixture. When the API changes, that test fails and tells you to re-record.
- *When is the HAR not worth it?* When the backend is cheap and stable in the test environment. Then the real API is more honest than an old copy.

**Trap:** Committing a 20 MB HAR with every asset in it, because nobody set a URL filter.

**Source:** https://playwright.dev/docs/mock

### What is the difference between the HAR you get from the trace viewer Network tab and a HAR you record?

Topic: pw-network | Standard | id: q0103

**Say:** The recorded HAR is a file made on purpose, in a standard format, that Playwright can replay with `routeFromHAR`. The Network tab of the trace viewer is a view of what the trace captured during one test run. It is for diagnosis: I see each request, filter it by the action I selected, and read headers and bodies. It is not a file I hand back to Playwright for mocking. If I need a replayable HAR from a scenario I saw in a trace, I record it again with `update: true`, with a URL filter. The trace also includes more than the HAR: DOM snapshots, console and the action log, aligned in time with the requests.

**Full process:**
1. Trace: `npx playwright test --trace on`, then `npx playwright show-trace test-results/<test>/trace.zip`, Network tab. Double click an action to filter requests to that action.
2. Recorded HAR: `UPDATE_HAR=1 npx playwright test ...` with `routeFromHAR(... update ...)`, output `tests/hars/*.har`.
3. When a request is served from a HAR in a later run, the trace Network tab still shows it, so you can check what the page really received.
4. Practical use of both: a replay test fails with an aborted request. Open the trace, find the request in the Network tab, compare its URL and body to the HAR entry. The difference is the cause.

**Follow-ups:**
- *Can the trace hold response bodies?* The Network tab shows request and response bodies when they were captured. Check on your own trace what is in it.

**Trap:** Telling the interviewer you "export the HAR from the trace and replay it". The docs do not describe that workflow.

**Source:** https://playwright.dev/docs/trace-viewer

### How do you mock a GraphQL API with Playwright?

Topic: pw-network | Standard | id: q0104

**Say:** All GraphQL calls usually go to one URL, so a URL pattern is not enough. In the route handler I read the request body with `postDataJSON()`, look at `operationName`, and fulfill only the operation I want. Every other operation I pass on with `route.fallback()`, so the real backend or the HAR answers. The response is JSON with a `data` key, and for an error case I return an `errors` array, because many GraphQL servers answer 200 even for errors.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('empty orders list', async ({ page }) => {
  await page.route('**/graphql', async route => {
    const body = route.request().postDataJSON();
    if (body.operationName === 'GetOrders') {
      await route.fulfill({ json: { data: { orders: [] } } });
    } else {
      await route.fallback();
    }
  });

  await page.goto('/orders');
  await expect(page.getByText('No orders yet', { exact: true })).toBeVisible();
});

test('GraphQL error shows the error banner', async ({ page }) => {
  await page.route('**/graphql', route =>
    route.fulfill({ json: { data: null, errors: [{ message: 'Internal error' }] } }),
  );
  await page.goto('/orders');
  await expect(page.getByRole('alert')).toBeVisible();
});
```
1. Check the real request in the trace first to see the operation name and the variables.
2. For persisted queries or batched requests the body has another shape, so read it before you write the condition.
3. `routeFromHAR` matches POST payloads strictly, so a HAR also works for GraphQL, but only when the variables are the same each run.

**Follow-ups:**
- *Why not match on the URL?* The URL is the same for every operation.

**Trap:** Fulfilling `**/graphql` for everything. The page then loses all other queries.

**Source:** https://playwright.dev/docs/network

### How do you mock only the first request and let the next ones go through? (scenario)

Topic: pw-network | Standard | id: q0105

**Say:** I use the `times` option of `page.route`, which removes the route after that many hits. After the first hit the request goes to the next handler or to the network. For more control I keep a counter in the handler and call `route.fallback()` when I am done. I use it to test retry logic: the first call fails with a 503, and the second call must succeed against the real backend or the HAR.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('retry after one 503 succeeds', async ({ page }) => {
  await page.route('**/api/offers', route => route.fulfill({ status: 503 }), { times: 1 });

  await page.goto('/offers');
  await expect(page.getByRole('alert')).toContainText('try again');

  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('listitem').first()).toBeVisible();
});
```
1. `times: 1` is the third argument of `page.route`.
2. The retry click reaches the real handler or the HAR because the route is gone.
3. `.first()` appears here only to say "at least one row". When the count is known, assert `toHaveCount`.

**Follow-ups:**
- *Why not `unroute` in the test body?* It works too, but `times` states the intent in one line.

**Trap:** A global counter shared between tests. Parallel tests then see each other's count.

**Source:** https://playwright.dev/docs/api/class-page#page-route

### Glob URL patterns in `page.route`: how do they work and what goes wrong?

Topic: pw-network | Standard | id: q0106

**Say:** Playwright uses simple globs, not full shell globs. A single `*` matches anything except `/`. A `**` matches anything including `/`. `{a,b}` means a list of options, and `?` matches only a literal question mark. The pattern must match the whole URL, including the query string. The common bug is a pattern like `**/api/users` that does not match `https://x.com/api/users?page=2`, so the route never fires. For harder cases I use a regex or a predicate function.

**Full process:**
1. Examples from the docs:
   - `https://example.com/*.js` matches `/file.js`, not `/path/file.js`.
   - `**/*.js` matches both.
   - `**/*.{png,jpg,jpeg}` matches images.
   - `https://example.com/?page=1` matches that URL only, because `?` is a literal.
2. Match a path with any query string:
```ts
import { test, expect } from '@playwright/test';

test('route matches the endpoint with a query string', async ({ page }) => {
  await page.route(url => url.pathname === '/api/users', route =>
    route.fulfill({ json: [{ id: 1, name: 'Ada' }] }),
  );
  await page.goto('/users');
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
});
```
3. Debug a route that never fires: log with `page.on('request', r => console.log(r.url()))` and compare with the pattern.

**Follow-ups:**
- *Does baseURL apply to routes?* When `baseURL` is set and the pattern is relative, it is resolved against it. Confirm with a log if you rely on it.

**Trap:** `**/api/users` with a trailing query string. It matches the whole URL or nothing.

**Source:** https://playwright.dev/docs/network

### Explain `route.fulfill`, `route.continue`, `route.fallback` and `route.abort`.

Topic: pw-network | Standard | id: q0107

**Say:** Once a route handler is registered, every matching request waits until the handler calls one of four methods. `fulfill` answers the request itself, so no network call happens. `continue` sends the request to the server, optionally with changes such as headers or method. `abort` fails the request, for example to block images or simulate a network error. `fallback` passes the request to the next matching handler, and if there is none it continues, so it is how handlers cooperate. A handler that calls none of them leaves the request hanging, and the test times out.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('the four route outcomes', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: [{ id: 1 }] }));
  await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
  await page.route('**/api/**', async route => {
    const headers = { ...route.request().headers(), 'x-test-run': 'e2e' };
    await route.fallback({ headers });
  });

  await page.goto('/offers');
  await expect(page.getByRole('heading', { name: 'Offers', exact: true })).toBeVisible();
});
```
1. Handlers run from the last registered to the first. The third handler adds a header and calls `fallback`, so the first handler, which matches `**/api/**` too, answers with `fulfill`. Images are aborted by the second.
2. Pick `fulfill` for a mock, `continue` to change the outgoing request and send it to the server, `abort` to simulate a failure, `fallback` to let another handler decide.
3. `continue` ends the chain. Other handlers do not run after it.

**Follow-ups:**
- *What can you pass to fulfill?* `status`, `headers`, `contentType`, `body`, `json`, `path` for a file, or `response` from `route.fetch()` to reuse a real response with overrides.
- *Can you change a redirect?* Playwright treats a request with its redirects as one unit. The handler runs once for the original request. Fulfilling with a 3xx status does not give you a second interception.

**Trap:** Using `continue` where you meant `fallback`. `continue` stops other handlers from running.

**Source:** https://playwright.dev/docs/api/class-route

### How do you modify a real response, for example add one item to a list from the live API?

Topic: pw-network | Standard | id: q0108

**Say:** I do not mock the whole response. In the route handler I call `route.fetch()`, which performs the real request and returns the response. I read its JSON, change what I need, and call `route.fulfill` with the original response and the new `json`. The page gets a real, up-to-date payload with one controlled difference. I use it to force an edge case, like one very long name, without losing the rest of the real data.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('real list plus one forced item', async ({ page }) => {
  await page.route('**/api/v1/fruits', async route => {
    const response = await route.fetch();
    const json = await response.json();
    json.push({ name: 'Loquat', id: 100 });
    await route.fulfill({ response, json });
  });

  await page.goto('https://demo.playwright.dev/api-mocking');
  await expect(page.getByText('Loquat', { exact: true })).toBeVisible();
});
```
1. `route.fetch()` needs a reachable backend. This is a partial mock, not an offline one.
2. `fulfill({ response, json })` keeps the original status and headers, and replaces the body.
3. `route.fetch()` accepts `maxRetries` (retries on `ECONNRESET` only) and `maxRedirects`.

**Follow-ups:**
- *Why not just mock everything?* A full mock drifts from the real API. A patched real response still fails when the real contract breaks.

**Trap:** Calling `route.fetch()` and then `route.continue()`. That sends the request twice.

**Source:** https://playwright.dev/docs/mock

### How do you assert that the app sent the right request body, without mocking it?

Topic: pw-network | Standard | id: q0109

**Say:** I wait for the request at the same time as I trigger it, then assert on it. `page.waitForRequest` returns the request, and `request.postDataJSON()` gives the body. I do not use a route for this if I do not need to change anything, because a route changes the traffic. If I also want the response, I use `waitForResponse` the same way. The request promise starts before the click, and I await it after the click.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('checkout sends the cart', async ({ page }) => {
  await page.goto('/cart');

  const requestPromise = page.waitForRequest(
    r => r.url().endsWith('/api/orders') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const request = await requestPromise;

  expect(request.postDataJSON()).toMatchObject({ items: [{ sku: 'A-1', qty: 2 }] });
});
```
1. Start the wait, then act, then await the promise.
2. Use a predicate, so another call to a similar URL does not satisfy it.
3. For the response side use `const response = await responsePromise; expect(response.status()).toBe(201);`.

**Follow-ups:**
- *Why not fill a variable inside a route handler?* A shared variable has no wait built in, so the assertion can run before the request exists.

**Trap:** `await page.getByRole(...).click(); const request = await page.waitForRequest(...)`. If the request already went out, it never comes and the test times out.

**Source:** https://playwright.dev/docs/network

### How do you wait for a response after a click without a race condition?

Topic: pw-network | Standard | id: q0110

**Say:** I create the `waitForResponse` promise first, without awaiting it, then do the click, then await the promise. The cleanest way is one `Promise.all` that holds both. If I click first and wait after, a fast response can arrive before the listener exists, and the test hangs or flakes. I use a URL pattern or a predicate that also checks the method, so a different request cannot satisfy the wait. And I assert on the visible result after it, because the response only proves the server answered.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('save settings waits for the PUT and shows the toast', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Ada');

  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/settings') && r.request().method() === 'PUT',
    ),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);

  expect(response.status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Settings saved');
});
```
1. The listener is registered first inside the array, the click second, and both settle in `Promise.all`.
2. The docs show the same pattern with a stored promise: `const responsePromise = page.waitForResponse(...); await click; const response = await responsePromise;`.
3. Both are correct. A click before the promise is created is not.

**Follow-ups:**
- *Why not a fixed sleep or `networkidle`?* A sleep is a guess and wastes time. `networkidle` is discouraged, and background polling can keep the page from ever being idle.
- *When is waiting for the response not needed?* When a web-first assertion on the visible result already waits. I add the response wait when the effect is not visible, or when a later step needs the write finished.

**Trap:** The wrong order. Click, then `await page.waitForResponse(...)`. It works on a fast machine and fails on a slow CI.

**Source:** https://playwright.dev/docs/network

### Code reading: this test is flaky. Find the bug.

Topic: pw-network | Standard | id: q0111

**Say:** The wait starts after the click. If the response arrives between the click and the line that creates the wait, the wait never sees it and times out. The fix is to create the wait before the action. It is a race that only shows up on a loaded machine, so it passes locally and fails in CI.

**Full process:** Buggy:
```ts
import { test, expect } from '@playwright/test';

test('buggy: wait after click', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await page.waitForResponse('**/api/settings');
  expect(response.ok()).toBeTruthy();
});
```
Fixed:
```ts
import { test, expect } from '@playwright/test';

test('fixed: wait started before the click', async ({ page }) => {
  await page.goto('/settings');
  const responsePromise = page.waitForResponse('**/api/settings');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
});
```
1. Reproduce: add `await page.route('**/api/settings', r => r.fulfill({ json: {} }))` to make the response instant, and the buggy version fails often.
2. Confirm the fix with `npx playwright test --repeat-each=50 -j 1`, which should stay green.

**Follow-ups:**
- *Does the glob match a URL with a query string?* No. Use a predicate if the URL may carry one.

**Trap:** "Add a `waitForTimeout`". That hides the race and makes the suite slower.

**Source:** https://playwright.dev/docs/network

### Code reading: the mock never fires and the real API gets called. Why?

Topic: pw-network | Standard | id: q0112

**Say:** In this code the route is registered after the navigation. The page already fired its API call during `goto`, before the route existed, so the real request went out. Routes only affect requests made after they are registered. The fix is to register the route before `page.goto`. The second thing to check is service workers, because a service worker can answer requests so that the route never sees them.

**Full process:** Buggy:
```ts
import { test, expect } from '@playwright/test';

test('buggy: route after goto', async ({ page }) => {
  await page.goto('/offers');
  await page.route('**/api/offers', route => route.fulfill({ json: [] }));
  await expect(page.getByText('No offers', { exact: true })).toBeVisible();
});
```
Fixed:
```ts
import { test, expect } from '@playwright/test';

test('fixed: route before goto', async ({ page }) => {
  await page.route('**/api/offers', route => route.fulfill({ json: [] }));
  await page.goto('/offers');
  await expect(page.getByText('No offers', { exact: true })).toBeVisible();
});
```
1. If it still fails, log requests: `page.on('request', r => console.log(r.method(), r.url()))`.
2. Compare the logged URL to the glob, especially the query string and the host.
3. Set `serviceWorkers: 'block'` in `use` to rule out a service worker.

**Follow-ups:**
- *Is it also a problem for `page.reload`?* No. The route stays registered, so a reload goes through it.

**Trap:** Believing a route can rewrite a request that is already finished.

**Source:** https://playwright.dev/docs/network

### Why does `page.route` not see requests when the app uses a service worker (for example MSW)?

Topic: pw-network | Standard | id: q0113

**Say:** A service worker sits between the page and the network and answers requests itself, so Playwright's `page.route` and `context.route` never see them. The docs name Mock Service Worker as an example. For Playwright mocking I set `serviceWorkers: 'block'` in the context options, so the worker is not registered and the route works. If I want to keep the app's own MSW, I mock there, and I do not expect Playwright routes or network events for those requests.

**Full process:**
1. Symptom: no `request` events, the route handler never runs, or network events are missing.
2. Config:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { serviceWorkers: 'block' },
});
```
3. Re-run. The route handler now fires.
4. The same limit applies to `routeFromHAR`. The docs say Playwright does not serve requests intercepted by a service worker from the HAR, and recommend blocking service workers.
5. If the app needs its service worker to work (a PWA offline test), keep it on and do not use Playwright routes for that test.

**Follow-ups:**
- *Can you route requests made by the service worker itself?* The docs link a separate guide for that. I would read it first, because it is a special case.

**Trap:** Debugging the glob for an hour when the real cause is a service worker.

**Source:** https://playwright.dev/docs/network

### What is the difference between `page.route` and `context.route`?

Topic: pw-network | Standard | id: q0114

**Say:** `page.route` covers one page. `context.route` covers every page in the browser context, including popups and tabs opened by links. A common use is `context.route` in a `beforeEach` to block images, fonts or analytics for the whole test. When both match a request, the page route wins over the context route, per the docs. And `fallback` lets a page handler hand a request down to a context handler.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*.{png,jpg,jpeg,woff2}', route => route.abort());
  await context.route('**/analytics/**', route => route.fulfill({ status: 204 }));
});

test('popup also has the blocks', async ({ page }) => {
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Help centre', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('heading', { level: 1 })).toBeVisible();
});
```
1. The `popup` page inherits the context routes. A page route would not cover it.
2. Remove with `context.unroute(pattern)`.
3. Aborting fonts and images speeds tests, but a layout bug caused by a missing font will not show. Do not use it in visual tests.

**Follow-ups:**
- *Per-test or per-file?* Put it in `beforeEach`, or in a fixture so every test gets it.

**Trap:** Registering on `page` and wondering why the new tab was not mocked.

**Source:** https://playwright.dev/docs/network

### How do you test slow responses, server errors and offline mode?

Topic: pw-network | Standard | id: q0115

**Say:** Slow and failing backends are where `page.route` is the right tool. For an error I `fulfill` with a status like 500 and check the error state of the UI. For slowness I delay in the handler with a promise, or fetch the real response and fulfill late. For a dropped connection I call `route.abort()` with an error code. For the whole context offline I use `context.setOffline(true)`. In each case I assert on what the user sees: the message, the retry button, and that nothing is lost.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('shows an error and recovers on retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/offers', route => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 500, json: { error: 'boom' } })
      : route.fulfill({ json: [{ id: 1, name: 'Basic' }] });
  });

  await page.goto('/offers');
  await expect(page.getByRole('alert')).toContainText('Something went wrong');

  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Basic', { exact: true })).toBeVisible();
});

test('shows the offline banner', async ({ page, context }) => {
  await page.goto('/offers');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('offline');
});
```
1. A counter in the handler gives different answers per call. The counter is local to this test, so parallel tests do not share it.
2. Slow response: `await new Promise(r => setTimeout(r, 3000)); await route.fulfill(...)` inside the handler checks a loading state. Keep the delay short and assert on the spinner while it waits.

**Follow-ups:**
- *Does a mocked 500 prove the backend handles errors?* No. It proves the UI handles one. The backend side is an API test.

**Trap:** Testing the error state with a mock and never testing that the real backend returns that code.

**Source:** https://playwright.dev/docs/api/class-route

### What would you mock in an E2E suite and what would you leave real? (scenario)

Topic: pw-network | Standard | id: q0116

**Say:** I leave my own backend real in the critical paths, because the value of an E2E test is that the pieces work together. I mock what I cannot control or what is slow or costly: payment providers, email and SMS, third-party widgets, analytics, maps, and time-dependent data. I also mock to reach states that are hard to create, like server errors, slow responses, rate limits and an empty account. I never mock in a way that hides a real bug, and I keep a few unmocked smoke tests so a wrong mock cannot hide a broken integration.

**Full process:**
1. List the dependencies of the page: own API, other internal services, third parties.
2. Third parties and side-effect services: mock at the network edge with `page.route`, or use the provider's test mode.
3. Hard-to-reach states: `fulfill` with the case.
4. Contract protection: an API test with the `request` fixture checks the real response against a schema, so a mock cannot drift unnoticed.
5. Keep a short list in the repo: "mocked: payments, email; real: everything else".

**Follow-ups:**
- *What if the product team says "mock everything, it is faster"?* I show the cost: mocks pass while the real integration is broken. I would offer a small real smoke set plus fast mocked UI tests.

**Trap:** A suite that is fully mocked and is called end-to-end.

**Source:** https://playwright.dev/docs/mock

### The HAR replay test passes locally and fails in CI with aborted requests. How do you debug it? (scenario)

Topic: pw-network | Standard | id: q0117

**Say:** Aborted means the request passed the URL filter but had no matching entry. So something differs between the two runs. I open the CI trace, find the aborted request in the Network tab and compare it to the HAR entry: the URL, the query string, the method and the body. The usual causes are a different base URL in CI, a date or random id in the request, a different working directory so the HAR path is wrong, and a changed app version that makes a new call. I fix the cause, not with `notFound: 'fallback'`.

**Full process:**
1. Download the CI trace and open `npx playwright show-trace trace.zip`. Look for requests with an error status.
2. Compare to the HAR: `node -e "for (const e of require('./tests/hars/offers.har').log.entries) console.log(e.request.method, e.request.url)"`.
3. Check the cwd: the HAR path is resolved against the current working directory. Print `process.cwd()` in a debug run.
4. Check the base URL: the HAR holds absolute URLs. A different host in CI means no match. Record on the same host that CI uses.
5. Check volatile values: timestamps, ids, cache busters. Make them deterministic or move that endpoint to `page.route`.
6. Re-record if the app changed, and review the HAR diff.

**Follow-ups:**
- *Why not `fallback`?* It would make CI hit a live backend, and the test would depend on it again.

**Trap:** Re-running the job until it passes.

**Source:** https://playwright.dev/docs/mock

### How do you block third-party scripts to make tests faster and more stable?

Topic: pw-network | Standard | id: q0118

**Say:** I use `context.route` with a pattern for the third-party hosts and call `route.abort()` or fulfill an empty response. I do it in a fixture or `beforeEach`, so all tests get it. It removes chat widgets, trackers and ad scripts that slow the page and cause random overlays. I check the product still works without them. And I do not block anything in tests that are about those integrations.

**Full process:**
```ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/(google-analytics|googletagmanager|hotjar)\./, route => route.abort());
    await use(context);
  },
});

export { expect };
```
1. Use `test` from this file in specs. Every page in the context gets the block.
2. Abort gives an error to the page. If the page code breaks on a failed script, fulfill with an empty 200 JS response instead: `route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })`.
3. Keep the host list short, explicit and in one shared file.

**Follow-ups:**
- *Does this change what you test?* Yes, so one smoke test runs without the block, to catch a page that breaks when a script fails or loads slowly.

**Trap:** A broad regex that also blocks your own scripts.

**Source:** https://playwright.dev/docs/network

## API testing in Playwright (`pw-api`)

### How do you test an API with Playwright? What is the `request` fixture?

Topic: pw-api | Core | id: q0119

**Say:** Playwright has `APIRequestContext`, an HTTP client that sends requests from Node without a browser page. In the test runner it comes as the `request` fixture, and it respects `baseURL`, `extraHTTPHeaders` and the proxy from the config. I call `request.get`, `post`, `put`, `delete`, check `response.ok()` or the status, and assert on `await response.json()`. I use it to test the API directly, to prepare data before a UI test, and to check the server state after a UI action.

**Full process:**
1. Config sets base URL and headers once:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'https://api.example.com',
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  },
});
```
2. Test:
```ts
import { test, expect } from '@playwright/test';

test('creates an issue', async ({ request }) => {
  const created = await request.post('/issues', { data: { title: '[Bug] report 1' } });
  expect(created.status()).toBe(201);

  const list = await request.get('/issues');
  expect(list.ok()).toBeTruthy();
  expect(await list.json()).toContainEqual(expect.objectContaining({ title: '[Bug] report 1' }));
});
```
3. `data` is serialised as JSON. Use `form` or `multipart` for other bodies.
4. The token comes from the environment, never from the repo.

**Follow-ups:**
- *Typed responses?* Since 1.63 request methods accept a type argument, `request.get<User>(...)`, so `response.json()` is typed. That is a compile-time hint, not validation.
- *`request` fixture versus `playwright.request.newContext`?* The fixture is created for you with the config. `newContext` gives you an isolated instance you manage and must `dispose()`.

**Trap:** Asserting only `ok()`. A 200 with a wrong body passes.

**Source:** https://playwright.dev/docs/api-testing

### How do you mix API setup with UI checks in one test?

Topic: pw-api | Core | id: q0120

**Say:** I create the state through the API, because it is fast and does not depend on UI steps I am not testing, and then I check the one UI behaviour I care about. After a UI action I can also read the server state back through the API to verify the write. This keeps the UI test short and focused, and its failures point to the feature under test. I clean up what I created, in a fixture, so the next run starts clean.

**Full process:**
```ts
import { test as base, expect } from '@playwright/test';

type Fixtures = { issue: { id: number; title: string } };

const test = base.extend<Fixtures>({
  issue: async ({ request }, use) => {
    const created = await request.post('/issues', { data: { title: `Issue ${Date.now()}` } });
    expect(created.ok()).toBeTruthy();
    const issue = await created.json();
    await use(issue);
    await request.delete(`/issues/${issue.id}`);
  },
});

test('new issue is in the list', async ({ page, issue }) => {
  await page.goto('/issues');
  await expect(page.getByRole('link', { name: issue.title, exact: true })).toBeVisible();
});

test('closing an issue in the UI is saved on the server', async ({ page, request, issue }) => {
  await page.goto(`/issues/${issue.id}`);
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();

  const saved = await request.get(`/issues/${issue.id}`);
  expect((await saved.json()).state).toBe('closed');
});
```
1. The fixture creates and deletes, so cleanup runs even when the test fails.
2. Unique titles, like with `Date.now()`, keep parallel tests apart.

**Follow-ups:**
- *Why not clean up in `afterAll`?* A fixture is per test and runs teardown after failure too, and it works with parallel workers.

**Trap:** Setting up state through a long UI flow in every test. It is slow and a failure there hides the actual feature.

**Source:** https://playwright.dev/docs/api-testing

### How do you share authentication between the API client and the browser?

Topic: pw-api | Core | id: q0121

**Say:** Storage state is the same format for both. I log in once with an API call, save the state with `request.storageState({ path })`, and create the browser context with that file, so the page starts already logged in. It also works the other way round. If I use `context.request` or `page.request`, that request context shares cookies with the browser context, so a `Set-Cookie` from an API response lands in the browser. A standalone context from `playwright.request.newContext` is isolated and has its own cookies.

**Full process:**
1. Login by API and save the state, for example in a setup project:
```ts
import { test as setup, expect } from '@playwright/test';

setup('api login', async ({ request }) => {
  const res = await request.post('/auth/login', {
    data: { email: process.env.TEST_USER!, password: process.env.TEST_PASSWORD! },
  });
  expect(res.ok()).toBeTruthy();
  await request.storageState({ path: 'playwright/.auth/user.json' });
});
```
2. Use it in the config: `use: { storageState: 'playwright/.auth/user.json' }` for the projects that depend on the setup project.
3. `.gitignore` must contain `playwright/.auth`. The file holds live session cookies.
4. Shared cookies: `context.request.fetch(...)` sends the context cookies and updates them from `Set-Cookie`. `playwright.request.newContext()` does not.

**Follow-ups:**
- *Token auth instead of cookies?* Put the token in `extraHTTPHeaders` for the API, and for the browser either set local storage in the storage state or inject it with `addInitScript`.
- *Expired session?* The setup project runs once per run, so a long run can outlive it. Keep the TTL longer than the run, or refresh in a fixture.

**Trap:** Committing `user.json`.

**Source:** https://playwright.dev/docs/api-testing

### How do you validate an API response schema in Playwright?

Topic: pw-api | Core | id: q0122

**Say:** Playwright does not ship a schema validator, so I use a library, for example Zod or Ajv, inside the test. I parse the JSON with the schema and fail on a mismatch. For the minimal case, `expect(json).toMatchObject({...})` with `expect.any(String)` matchers works. The typed `request.get<User>()` helps the editor, but it does not check anything at runtime, so I never mistake it for validation. A schema test is also how I notice that an API changed and a recorded HAR is stale.

**Full process:**
```ts
import { test, expect } from '@playwright/test';
import { z } from 'zod';

const User = z.object({
  id: z.number().int(),
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
});

test('GET /users/1 matches the contract', async ({ request }) => {
  const response = await request.get('/users/1');
  expect(response.status()).toBe(200);

  const parsed = User.safeParse(await response.json());
  expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
});
```
1. Install: `npm i -D zod`.
2. `safeParse` returns `success: false` with an `error` object. The message argument of `expect` prints the issues on failure.
3. Put schemas in a shared folder and reuse them in mocks, so a mock and the real API follow the same contract.

**Follow-ups:**
- *Zod or Ajv?* Zod gives TypeScript types from the schema. Ajv validates JSON Schema or OpenAPI files directly. I pick Ajv if the team already maintains an OpenAPI spec.

**Trap:** Asserting every field by hand in each test. It is long, and nobody updates it.

**Source:** https://playwright.dev/docs/api-testing

### How do you create and dispose a custom `APIRequestContext`? Why would you?

Topic: pw-api | Core | id: q0123

**Say:** I use it when I need a different base URL or a different user than the config gives, for example an admin client next to a user client. I create it with `playwright.request.newContext(...)`, usually in a fixture, and I dispose it at the end, so memory and connections are released. A context made this way is isolated and has its own cookies, unlike `page.request`.

**Full process:**
```ts
import { test as base, expect, type APIRequestContext } from '@playwright/test';

const test = base.extend<{ adminApi: APIRequestContext }>({
  adminApi: async ({ playwright }, use) => {
    const api = await playwright.request.newContext({
      baseURL: 'https://api.example.com',
      extraHTTPHeaders: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    });
    await use(api);
    await api.dispose();
  },
});

test('admin can list users', async ({ adminApi }) => {
  const res = await adminApi.get('/admin/users');
  expect(res.ok()).toBeTruthy();
});
```
1. `dispose()` also drops stored response bodies.
2. Cookie helpers on a request context exist since 1.64: `addCookies`, `cookies`, `clearCookies`.

**Follow-ups:**
- *Why not one global token?* Role tests need two identities at once.

**Trap:** Forgetting `dispose()` in a `beforeAll` context. It leaks until the worker ends.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

### How do you test an asynchronous backend job (a report, an import) through the API?

Topic: pw-api | Standard | id: q0124

**Say:** I start the job with one request, then poll its status with `expect.poll`, which retries a function until the value matches or the timeout ends. It replaces a sleep and a hand-made loop. I set intervals and a timeout that fit the job, and I assert on the final state and its result. If the job never finishes, the failure message shows the last value it saw.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('export job finishes and has rows', async ({ request }) => {
  const start = await request.post('/exports', { data: { type: 'orders' } });
  expect(start.status()).toBe(202);
  const { id } = await start.json();

  await expect
    .poll(async () => (await (await request.get(`/exports/${id}`)).json()).status, {
      intervals: [500, 1000, 2000],
      timeout: 30_000,
    })
    .toBe('done');

  const result = await request.get(`/exports/${id}/rows`);
  expect((await result.json()).length).toBeGreaterThan(0);
});
```
1. `202 Accepted` tells you the work is queued, not finished.
2. `expect.poll` is the right tool here because there is no locator to wait on.
3. Keep the timeout honest. A job that takes 10 minutes needs a different test design, such as a test hook that completes the job.

**Follow-ups:**
- *Why not `toPass`?* My rule is to avoid it. `expect.poll` polls one value and reads clearly.

**Trap:** `waitForTimeout(5000)` then one check.

**Source:** https://playwright.dev/docs/test-assertions

### API test or UI test: how do you decide where a check belongs? (scenario)

Topic: pw-api | Standard | id: q0125

**Say:** I test business rules, validation and status codes at the API level, because it is fast, stable and points to the cause. I use the UI test for what only the UI can prove: that the user can do the flow, that the right message appears, that the page reflects the data. For a rule like "email must be unique", one API test covers all cases, and one UI test checks that the error shows. That keeps the suite fast, and a failure tells me which layer broke.

**Full process:**
1. For each feature, list the rules and the user-visible behaviour.
2. Rules and error codes go to API tests, parametrised with a table of inputs:
```ts
import { test, expect } from '@playwright/test';

const cases = [
  { email: 'not-an-email', status: 422 },
  { email: '', status: 422 },
  { email: 'taken@example.com', status: 409 },
];

for (const { email, status } of cases) {
  test(`register with "${email}" returns ${status}`, async ({ request }) => {
    const res = await request.post('/register', { data: { email, password: 'Aa1!aaaa' } });
    expect(res.status()).toBe(status);
  });
}
```
3. One UI test per flow checks the message and the state.
4. Seed data through the API, not the UI.

**Follow-ups:**
- *Where do you get the contract from?* From the OpenAPI spec or the developers. If neither exists, I write down what the API does now and ask whether it is intended.

**Trap:** Testing every validation through a browser.

**Source:** https://playwright.dev/docs/api-testing

## Trace viewer and debugging (`pw-debug`)

### What does a Playwright trace contain, and how do you record one?

Topic: pw-debug | Core | id: q0126

**Say:** A trace is a `trace.zip` with a timeline of the test. For each action it holds the name, the call log, the before and after DOM snapshots, screenshots, the console output, the network requests and the source code line. You open it in the Trace Viewer and step through it. You turn it on with the `trace` option, usually `'retain-on-failure'` or `'on-first-retry'` in CI, or `--trace on` for one local run. I use it to debug failures that happened somewhere I cannot attach a debugger.

**Full process:**
1. Config:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { trace: 'retain-on-failure' },
});
```
2. Local run: `npx playwright test --trace on`, then `npx playwright show-report`, and click the trace icon. Or open directly: `npx playwright show-trace test-results/<test>/trace.zip`.
3. Viewer tabs: Actions list, a timeline with screenshots, a DOM snapshot you can inspect, Source, Call (the call log with actionability), Log, Errors, Console, Network, Metadata and Attachments.
4. Since 1.63 you can also capture aria and screen snapshots per action with `trace: { mode: 'on', snapshots: { dom: true, aria: true, screen: true } }`, and the viewer has a Display Aria mode.

**Follow-ups:**
- *Does the trace need extra setup per test?* No. The fixture starts and stops it.
- *Where does it live?* In `test-results/<test-name>/trace.zip`, and attached to the HTML report.

**Trap:** Saying "a trace is a video". It is a time-travel debugger with DOM snapshots, and it has no video unless you also record one.

**Source:** https://playwright.dev/docs/trace-viewer

### Which trace modes exist, and which do you use in CI and why?

Topic: pw-debug | Core | id: q0127

**Say:** The modes are `off`, `on`, `on-first-retry`, `on-all-retries`, `retain-on-failure`, `retain-on-first-failure` and `retain-on-failure-and-retries`. `on` is heavy, because every test records and saves. For CI I pick between `on-first-retry` and `retain-on-failure`. `on-first-retry` costs nothing on passing tests but needs retries, and it records only the retry, not the first failing run. `retain-on-failure` records every run and keeps only the failed ones, so it costs recording time but gives a trace from the first failure even without retries. A strict rule is no global retries, so I would use `retain-on-failure`.

**Full process:**

| Mode | Records on | Keeps |
|---|---|---|
| `on` | every run | always |
| `retain-on-failure` | every run | runs that failed |
| `retain-on-first-failure` | first run only | if it failed |
| `retain-on-failure-and-retries` | every run | failed runs and retries |
| `on-first-retry` | first retry | always |
| `on-all-retries` | every retry | always |

1. With `retries: 2`, a test that fails then passes on retry keeps: `retain-on-failure` the first run, `retain-on-failure-and-retries` the first run and the retry, `on-first-retry` the retry only.
2. Choose by what you need: the trace of the failing run is the useful one, and it is the first run, so `on-first-retry` skips it.
3. Upload `test-results` and `playwright-report` as CI artifacts with `if: always()`.

**Follow-ups:**
- *What does a trace cost?* Recording time and disk. It adds some overhead per action and a zip of a few MB for a long test. Measure on your own suite.
- *Can you set it per test?* Yes, `test.use({ trace: 'on' })` in a file or describe.

**Trap:** `trace: 'on'` in CI for thousands of tests. It slows the suite and fills the artifact storage.

**Source:** https://playwright.dev/docs/test-use-options

### A test failed in CI. How do you read its trace?

Topic: pw-debug | Core | id: q0128

**Say:** I download the artifact, open the trace, and look first at the failing action: the error with the expected and received values and the call log. Then I look at the DOM snapshot before and after that action to see what the page really showed. I check the Network tab for a failed or late request, and the Console tab for an app error. Then I classify it: a race, an ambiguous locator, an overlay, the environment, or a product bug. Only after that do I change the test, and never to hide a product bug.

**Full process:**
1. Download the report artifact. Open `npx playwright show-report playwright-report`, or `npx playwright show-trace path/to/trace.zip`. The docs also support a URL: `npx playwright show-trace https://ci.example.com/trace.zip`, and the hosted viewer at trace.playwright.dev loads a file in your browser without sending data out.
2. Errors tab and the failing action: read the call log. It shows each retry of the actionability check and why it waited ("element is not visible", "intercepts pointer events").
3. Snapshot tabs: Before, Action, After. Hover over an action in the timeline to see the page at that moment.
4. Network tab, filtered by the action. Look for 4xx and 5xx, slow calls, and a request that never came.
5. Console tab: errors thrown by the app at that time.
6. Classify and act. Reproduce locally: `npx playwright test <file> --trace on -j 1 --repeat-each=20`.

**Follow-ups:**
- *The trace looks fine but the test failed.* Then the failure is a timing difference, so reproduce with the same workers and repeat count, and compare the action timestamps.
- *No trace in the artifacts.* Then the trace mode was `on-first-retry` with no retries, or the artifact upload was skipped on failure. Fix the config first.

**Trap:** Looking only at the screenshot at the end of the test. The cause is usually several actions earlier.

**Source:** https://playwright.dev/docs/trace-viewer

### What is UI mode and how is it different from the trace viewer and the inspector?

Topic: pw-debug | Core | id: q0129

**Say:** UI mode is a local app with the test list, a watch mode, and a time-travel view of each test, built on the trace viewer. I run `npx playwright test --ui` while I write tests: I pick tests, run them, and see snapshots, network and console for every step. The trace viewer opens a trace after the fact, so it also works for CI files. The inspector is a debugger that opens with `--debug`, pauses the test and lets me step through it. So: UI mode for authoring, trace viewer for CI failures, inspector for stepping in a live browser.

**Full process:**
1. UI mode: `npx playwright test --ui`. UI mode traces each test automatically.
2. Pick a locator in the UI, filter by project or tag, and re-run on file change with the watch icon.
3. Trace viewer: `npx playwright show-trace trace.zip`.
4. Inspector: `npx playwright test example.spec.ts:10 --debug`. This runs headed, with the default timeout set to 0, one test at a time, and opens the Inspector.
5. Under Bun (1.65) there is no watch mode in UI mode, so tests do not re-run on file change.

**Follow-ups:**
- *Can UI mode run on a CI machine?* It is for a person at a screen. In CI, use the trace and the report.

**Trap:** Describing UI mode as "the headed browser". It is a separate test runner interface.

**Source:** https://playwright.dev/docs/trace-viewer

### How do you debug with `--debug`, the inspector and `page.pause()`?

Topic: pw-debug | Core | id: q0130

**Say:** `npx playwright test file.spec.ts:10 --debug` runs one test headed, with no timeout, and opens the Inspector. I can step through actions, see the actionability log, pick a locator and edit it live. `await page.pause()` puts a breakpoint in the code: the test runs normally until that line, then stops, so I do not step through everything before it. For a fast diagnosis of a bad locator I use the locator picker in the Inspector or the VS Code extension. I remove `page.pause()` before the commit.

**Full process:**
1. Debug one test on one browser: `npx playwright test example.spec.ts:10 --project=chromium --debug`.
2. Add a breakpoint:
```ts
import { test } from '@playwright/test';

test('debug the checkout step', async ({ page }) => {
  await page.goto('/checkout');
  await page.pause();
  await page.getByRole('button', { name: 'Pay', exact: true }).click();
});
```
3. In the Inspector: Resume, Step over, the locator picker, and the live locator edit box that highlights matches.
4. The VS Code extension offers breakpoints, "Show Browser", and "Pick locator" in the sidebar.
5. Alternative without a UI: set `DEBUG=pw:api` to print the call log to the terminal.

**Follow-ups:**
- *`--debug` changes timeouts. Is that a problem?* A bug that depends on the timeout will not show under `--debug`, so confirm with a normal run.

**Trap:** Leaving a `page.pause()` in a committed test. CI hangs.

**Source:** https://playwright.dev/docs/debug

### What is codegen and when do you use it?

Topic: pw-debug | Standard | id: q0131

**Say:** Codegen records my clicks in a browser and writes the test code. I use it to get a first draft or to find a locator for a hard element, never as the finished test, because the output needs cleaning: better names, assertions in the right place, and my locator rules. Run `npx playwright codegen https://example.com`. The recorder has buttons to add assertions like visibility, text and value. It supports device emulation and viewport options.

**Full process:**
1. `npx playwright codegen https://shop.example.com`
2. Click through the flow. Code appears in the Inspector window.
3. Use the toolbar to assert visibility, text or value on an element.
4. Options: `--viewport-size="800,600"`, `--device="iPhone 13"`. Since 1.63: `--http-credentials` for pages behind HTTP auth.
5. Copy into a spec and edit: use role and label locators, add `exact: true`, move assertions into the test body, remove steps that are not part of the scenario.

**Follow-ups:**
- *Why not ship generated tests?* They record every click and no intent. Names are weak, there are no wait reasons, and the first selector found may be a brittle one.

**Trap:** "Codegen writes my suite." It writes a draft.

**Source:** https://playwright.dev/docs/codegen

### Video and screenshot options: what are the modes and what do they cost?

Topic: pw-debug | Standard | id: q0132

**Say:** Both are `use` options. `screenshot` can be `off`, `on`, `only-on-failure` and `on-first-failure`. `video` has `off`, `on`, `retain-on-failure`, `on-first-retry`, `on-all-retries`, `retain-on-first-failure` and `retain-on-failure-and-retries`. A screenshot is cheap. A video is the expensive one: it records continuously and writes a file per test, so I do not keep it for every run. Since 1.64 you can set the frame rate and style the action markers, and videos use VP9, which takes less CPU and gives smaller files. I use the trace as the main tool and the video as a way to show a failure to people who do not open traces.

**Full process:**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
```
1. Videos land in the test output folder under `test-results/<test>/`.
2. A custom size and frame rate (1.64): `video: { mode: 'on', size: { width: 1280, height: 720 }, fps: 25 }`. Firefox and WebKit capture up to 25 fps.
3. Cost: recording and encoding CPU time, and disk per test. Measure the suite time with and without.
4. Choose by audience: developers read the trace, product people watch the video.

**Follow-ups:**
- *Do video and trace together slow the run?* Both add work per action. Keep both only if you need both.

**Trap:** `video: 'on'` for a big suite in CI.

**Source:** https://playwright.dev/docs/test-use-options

### How do you make a failing test easier to read: steps, attachments, annotations?

Topic: pw-debug | Standard | id: q0133

**Say:** I wrap logical phases in `test.step`, so the report and the trace show "Fill the address" and "Pay" instead of a flat list of clicks. Since 1.63 a step can carry a `subtitle` and `params`, which reporters and the trace viewer show next to the title. I attach evidence with `testInfo.attach`, such as an API response body or a log, so the person who opens the report has it. I keep step names about intent, not about locators.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('checkout with a saved card', async ({ page, request }, testInfo) => {
  await test.step('Open the cart', async () => {
    await page.goto('/cart');
  });

  await test.step('Pay', async () => {
    await page.getByRole('button', { name: 'Pay', exact: true }).click();
  }, { subtitle: 'saved card', params: { method: 'card' } });

  const order = await request.get('/api/orders/latest');
  await testInfo.attach('latest-order.json', {
    body: await order.text(),
    contentType: 'application/json',
  });
  await expect(page.getByRole('heading', { name: 'Thank you', exact: true })).toBeVisible();
});
```
1. Steps show in the HTML report and the trace Actions list.
2. Attachments show in the report under the test and are stored with the results.
3. A failed assertion inside a step is reported with that step as the context.

**Follow-ups:**
- *Do steps change test behaviour?* No, they only group and label.

**Trap:** A step per click, with the same text as the locator. It adds noise only.

**Source:** https://playwright.dev/docs/release-notes

### How do you debug a test that fails only when run in parallel or in CI? (scenario)

Topic: pw-debug | Standard | id: q0134

**Say:** I assume shared state or a race until proven otherwise. I reproduce the failure first: same workers, repeat many times, trace on. Then I classify it from the trace: shared data between tests, a timing race, an environment limit like CPU or memory, or a real product bug. I do not add retries or sleeps. When I find a product bug, I report it and keep the test red.

**Full process:**
1. Reproduce: `npx playwright test path/to/file.spec.ts --repeat-each=50 --workers=4 --trace on`. Add `--shuffle` (since 1.64) to find hidden order dependencies. Pass the printed seed to repeat the order.
2. If it passes alone but fails in parallel: shared data. Make each test create its own records with unique names.
3. If it fails only under CPU load: a race. Look in the trace for an action that ran before the app was ready, and wait on that state with a web-first assertion.
4. If it fails only in CI: compare the environment, such as Docker image, browser version, viewport, locale and timezone.
5. Test locks (1.63) serialise tests that share a resource: `test('x', { lock: 'user-settings' }, ...)`.

**Follow-ups:**
- *When do you give up and quarantine?* Not before I know the cause. A quarantined test needs an owner and a date.

**Trap:** Setting `retries: 3` to make the report green.

**Source:** https://playwright.dev/docs/test-parallel

## Visual testing (`pw-visual`)

### How does `toHaveScreenshot` work?

Topic: pw-visual | Core | id: q0135

**Say:** `await expect(page).toHaveScreenshot()` takes a screenshot and compares it to a saved baseline image. On the first run there is no baseline, so Playwright writes one and fails that run, and I commit the file. After that, each run captures the page until two consecutive screenshots match, which makes it stable, and compares the last one with the baseline. The comparison uses pixelmatch with a `threshold` for how different a pixel must be, and `maxDiffPixels` or `maxDiffPixelRatio` for how many pixels may differ. I update baselines on purpose with `--update-snapshots`.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('pricing page looks right', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('pricing.png', { fullPage: true, maxDiffPixels: 100 });
});
```
1. First run: error "A snapshot doesn't exist ... writing actual", and `pricing.spec.ts-snapshots/pricing-chromium-linux.png` is created.
2. Commit the PNG. Next runs compare.
3. A diff failure writes actual, expected and diff images into `test-results`, and the HTML report shows them side by side.
4. Update after an intended change: `npx playwright test --update-snapshots`. The `updateSnapshots` config modes are `all`, `changed`, `missing`, `none` and `default`. Since 1.64, `missing` creates missing snapshots and passes, so CI can create new ones and check old ones in one run. `default` creates them and fails the test.
5. Since 1.62 you can store baselines as lossless WebP with a `.webp` name.

**Follow-ups:**
- *Defaults?* `threshold` is 0.2, `animations` is `disabled`, `caret` is `hide`, `scale` is `css`.
- *Only a part of the page?* `expect(locator).toHaveScreenshot()` for one element is less sensitive to unrelated changes.

**Trap:** Updating snapshots without looking at the diff. The baseline then records the bug.

**Source:** https://playwright.dev/docs/test-snapshots

### Why do screenshot baselines differ per platform, and how do you handle it?

Topic: pw-visual | Core | id: q0136

**Say:** The file name has the browser and the platform in it, like `pricing-chromium-linux.png`, because rendering differs by OS, fonts, hardware and headless mode. A baseline made on a Mac fails on a Linux CI. So the rule is: make and run baselines in the same environment. The usual solution is to generate and run them in the official Playwright Docker image, in CI and locally, so fonts and rendering are the same.

**Full process:**
1. Run in the same container locally and in CI:
```bash
docker run --rm -it --ipc=host -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble npx playwright test --update-snapshots
```
2. Pin the image tag to the same version as the `@playwright/test` package.
3. Commit the baselines made in the container only.
4. The path pattern can be customised with `snapshotPathTemplate` in the config, for example to drop the platform name if everything runs in one image.
5. Different browsers have different baselines, because the project name is part of the file name.

**Follow-ups:**
- *Docker flags?* The docs recommend `--ipc=host` for Chromium. Check the current Docker page for the user and seccomp advice.
- *No Docker?* Generate baselines on the CI machine through a manual workflow, and commit the result.

**Trap:** Developers update baselines on their laptops and CI goes red.

**Source:** https://playwright.dev/docs/docker

### How do you reduce flaky screenshots: thresholds, masking and animations?

Topic: pw-visual | Core | id: q0137

**Say:** First I remove the cause of noise, and only then I loosen the comparison. Animations are disabled by default in `toHaveScreenshot`. I mask changing areas such as dates, avatars and ads with the `mask` option, hide them with a `stylePath` stylesheet, or mock the data. I wait for the page to be ready, so the screenshot is not taken early. For anti-aliasing noise I may raise `maxDiffPixels` a little. A large threshold hides real regressions, so I keep it tight.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('dashboard without dynamic parts', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-15T10:00:00') });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [page.getByRole('img', { name: 'Avatar', exact: true }), page.getByRole('status')],
    maxDiffPixelRatio: 0.01,
    stylePath: 'tests/screenshot.css',
  });
});
```
1. `mask` covers each locator with a pink box (`#FF00FF`, change with `maskColor`).
2. `stylePath` takes a stylesheet, which pierces the shadow DOM and inner frames, to hide the rest.
3. Freeze time with `page.clock` if the page shows dates. Seed the data so the content is the same.
4. Move the mouse away so hover states do not show: `await page.mouse.move(-1, -1)`.

**Follow-ups:**
- *`threshold` versus `maxDiffPixels`?* `threshold` decides if one pixel differs, by perceived colour distance, 0 strict to 1 lax. `maxDiffPixels` decides how many different pixels are allowed.
- *Full page or element?* Element shots fail for fewer unrelated reasons.

**Trap:** Raising the thresholds until the test passes. It then catches nothing.

**Source:** https://playwright.dev/docs/api/class-pageassertions

### Native Playwright screenshots versus Percy (or Applitools): how do you choose?

Topic: pw-visual | Core | id: q0138

**Say:** Native `toHaveScreenshot` is free, runs in my own CI, and stores baselines in git. It compares pixels, so I manage the environment, the baselines and the review myself. Hosted tools like Percy upload page snapshots to a cloud service that renders them in several browsers and gives a review dashboard with approve and reject. That helps with many browsers, many viewports and a team of reviewers, and it costs money and adds a vendor. If you have not used Percy in production, say so, then explain that you would start with native and move to a hosted tool only when the review workflow becomes the problem.

**Full process:**
1. Native: `expect(page).toHaveScreenshot()`, baselines in the repo, diffs in the HTML report.
2. Percy (concept, not verified in this pack): the test calls the Percy SDK for Playwright to send a snapshot, and the run goes through the Percy CLI. Percy renders the snapshot in its cloud, compares it to the approved baseline of the branch, and shows diffs for approval. Read the current BrowserStack Percy docs before you promise details.
3. Choose native when: one browser, few pages, a small team, no budget.
4. Choose hosted when: many browsers and viewports, designers need to approve, or baseline management in git has become painful.

**Follow-ups:**
- *Aria snapshots as a cheaper alternative?* For structure and text, `toMatchAriaSnapshot` has no pixel noise. It does not catch colour or layout bugs.

**Trap:** Claiming experience with Percy.

**Source:** https://playwright.dev/docs/test-snapshots

### What is an aria snapshot test and when is it better than a screenshot?

Topic: pw-visual | Core | id: q0139

**Say:** An aria snapshot is a YAML description of the accessibility tree: roles, names and structure. `toMatchAriaSnapshot` compares the page or a locator with that description, with no pixels involved. So there is no font or platform noise, and it checks what a screen reader user gets. It is better than a screenshot when I care about structure and text, such as a menu, a form or a table of results. It does not see colours or layout, so I use screenshots for those.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('todo page structure', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc/');
  await expect(page).toMatchAriaSnapshot(`
    - heading "todos"
    - textbox "What needs to be done?"
  `);
});
```
1. Inline: a string with YAML. The matching is partial: it checks the listed nodes.
2. As a file: `await expect(page).toMatchAriaSnapshot({ name: 'home.aria.yml' })` stores `home.aria.yml` in the snapshot folder. Update it with `--update-snapshots`.
3. Since 1.63, `locator.ariaSnapshotJSON()` returns the tree as JSON.

**Follow-ups:**
- *Why does it help with accessibility?* The snapshot is built from roles and accessible names. If a button loses its name, the snapshot fails.

**Trap:** Treating an aria snapshot as visual testing. It cannot see a broken layout.

**Source:** https://playwright.dev/docs/api/class-pageassertions

### How do you do visual checks across viewports (responsive layouts)?

Topic: pw-visual | Standard | id: q0140

**Say:** I use projects with different viewports or devices, so the same test runs at desktop and mobile sizes, and each project has its own baseline because the project name is in the snapshot file name. I keep the number of screens and sizes small: the pages that carry risk, at the breakpoints the design uses. I test one component or section by locator screenshot when I can, to keep diffs small.

**Full process:**
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
```
1. One test, two baselines: `home-desktop-linux.png` and `home-mobile-linux.png`.
2. For a single breakpoint inside a test: `await page.setViewportSize({ width: 768, height: 1024 })` before the screenshot.
3. Run only visual tests when needed: tag them with `{ tag: '@visual' }` and use `--grep @visual`.

**Follow-ups:**
- *Does Mobile emulation cover real phones?* No, it is the same engine with phone settings.

**Trap:** Screenshots of every page at five sizes. The review cost grows faster than the value.

**Source:** https://playwright.dev/docs/emulation

### Scenario: visual tests pass locally and fail in CI after a font change. What do you do?

Topic: pw-visual | Standard | id: q0141

**Say:** The diff images in the report show what changed. If the entire page differs a bit, it is the environment: fonts or the browser version. I confirm by running the same test in the CI Docker image locally. If it passes there, the baseline was made in a different environment, and I regenerate it in the CI image. If one component differs, it may be a real change, and I decide with the team whether it is intended before I update anything.

**Full process:**
1. Open the HTML report. Check the expected, actual and diff images.
2. Run in the CI image: `docker run --rm -it --ipc=host -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble npx playwright test tests/visual`.
3. Same result as CI: reproduced, and the cause is rendering in that image. Different result: the baselines are from another environment.
4. Regenerate in the CI image with `--update-snapshots`, review the diff in git, and commit.
5. Prevent: pin the image version and run baseline updates only through a CI job.

**Follow-ups:**
- *Who approves a baseline change?* The person who owns the UI, in the merge request, by looking at images.

**Trap:** Updating all baselines to make the job green.

**Source:** https://playwright.dev/docs/test-snapshots

## Component testing (`pw-component`)

### What is Playwright component testing, and what is its status?

Topic: pw-component | Core | id: q0142

**Say:** It runs a component in a real browser through Playwright instead of in jsdom. The old way was the `@playwright/experimental-ct-react` and `-vue` packages, and they are no longer updated. From 1.62 there is a new model with stories: a story wraps the component in one scenario, a gallery page that you serve renders stories by id, and the built-in `mount` fixture opens the gallery and returns a locator. If you have not used it in production, say so, then explain that you know the idea and the status.

**Full process:**
1. Concept: stories (`*.story.tsx`), a gallery page with `window.mount` and `window.unmount`, served by your own dev server, and the `mount` fixture.
2. Setup helper: `npx playwright init-skills` installs agent skills, and the docs suggest asking a coding agent to set up the gallery.
3. A test (from the docs):
```ts
import { test, expect } from '@playwright/test';

test('click should expand', async ({ mount }) => {
  const component = await mount('components/Expandable/Stateful');
  await component.getByRole('button').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
});
```
4. A project in the config points `baseURL` at the gallery page, and `webServer` starts the dev server.
5. Status as of 1.63: the experimental packages (`ct-react`, `ct-react17`, `ct-vue`) are no longer updated, and there is a migration guide.

**Follow-ups:**
- *Why did Playwright change it?* The old packages compiled their own bundle with their own Vite config, so they only worked when your setup matched. The new model uses your own pipeline.

**Trap:** Recommending `@playwright/experimental-ct-react` for a new project.

**Source:** https://playwright.dev/docs/test-components

### When would you use component tests, and when not?

Topic: pw-component | Core | id: q0143

**Say:** I use them for components with rich behaviour and many states, like a date picker, a data grid or a form control, where an E2E test would be slow and need the whole app. They run in a real browser, so layout, focus and real clicks work. I do not use them to replace unit tests of logic, or E2E tests of flows. If you have not run isolated component suites in a job, say so, then explain that you would first check whether the team already has Storybook or a similar tool, and not add another.

**Full process:**
1. Component tests fit when: the state space is large, the component is shared, and a bug needs a real browser to show (focus, scroll, resize).
2. They do not fit when: it is pure logic (unit test), or the risk is in the integration (E2E).
3. Check what exists: existing stories may be reusable for the gallery.
4. Pilot on one shared component, measure time and bugs found, then decide.

**Follow-ups:**
- *Do they replace E2E?* No. They do not test routing, backend and real data.

**Trap:** Moving E2E tests into component tests just because they are faster.

**Source:** https://playwright.dev/docs/test-components

### How are component tests different from E2E tests in Playwright?

Topic: pw-component | Core | id: q0144

**Say:** Both are normal Playwright tests with the same runner, locators, assertions, traces and parallelism. The difference is what is on the page: an E2E test visits the real app, and a component test visits a small gallery page that renders one story with fixed props, mock data and providers. So the component test is faster and isolated, and it cannot catch integration bugs.

**Full process:**
1. E2E: `page.goto('/checkout')`, the real app, the real backend or mocks.
2. Component: `mount('components/Expandable/Stateful')`, a story in the gallery. The mock data and providers are inside the story, running in the browser.
3. What the test asserts is observable through the page: DOM, URL and network.
4. Use `update(props)` and `unmount()` on the returned locator to re-render and tear down.

**Follow-ups:**
- *Network mocking in a component test?* The same `page.route` works, because it is a normal page.

**Trap:** Believing component tests run in Node. The test runs in Node, the component runs in the browser.

**Source:** https://playwright.dev/docs/test-components

## Reporters (`pw-reporting`)

### Which built-in reporters does Playwright have, and which do you use?

Topic: pw-reporting | Core | id: q0145

**Say:** The built-in ones are `list`, `line`, `dot`, `html`, `blob`, `json`, `junit`, `github`, and newer ones: `failures` (1.65) and `perfetto` (1.63). `list` is the default locally and `dot` is the default on CI. I use `html` for people, `blob` when tests are sharded so I can merge later, `junit` or `json` for tools that read them, and `github` for annotations in pull requests. I can use several at once. Since 1.63 `--add-reporter` adds one on top of the configured ones, while `--reporter` replaces them.

**Full process:**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI
    ? [['blob'], ['junit', { outputFile: 'results/junit.xml' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
});
```
1. HTML writes `playwright-report/`, opens automatically on failure by default (`open: 'on-failure'`), and shows traces, screenshots and step durations. Open it with `npx playwright show-report`.
2. `blob` writes `blob-report/report.zip`, or `report-<shard number>.zip` when you pass `--shard`. It is the format for merging.
3. `onlyFailures: true` on html, json and junit keeps only failed, flaky and interrupted tests (1.65). On junit it also keeps every attempt, whatever `includeRetries` says.
4. `omitTags` (1.63) removes automatic tags from titles in some reporters.

**Follow-ups:**
- *Why not `html` on CI?* One shard produces one HTML report. With shards you need `blob` and a merge job.
- *`--reporter` or the config?* The command line overrides the config.

**Trap:** `reporter: 'html'` with `--shard`. You get one report per machine and no total.

**Source:** https://playwright.dev/docs/test-reporters

### How do you merge reports from sharded runs?

Topic: pw-reporting | Core | id: q0146

**Say:** Each shard runs with the `blob` reporter and uploads its blob zip as an artifact. A final job downloads all the blobs into one folder and runs `npx playwright merge-reports --reporter html ./all-blob-reports`. That makes one HTML report for the whole run. The merge job must run even if some shards failed, so the report shows the failures. Blob names contain the shard number, so they do not clash.

**Full process:**
1. Config: `reporter: process.env.CI ? 'blob' : 'html'`.
2. Shard jobs (GitHub Actions matrix): `npx playwright test --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}`, then upload `blob-report` as an artifact.
3. Merge job: `if: ${{ !cancelled() }}`, `needs: [playwright-tests]`, download artifacts with `pattern: blob-report-*` and `merge-multiple: true` into `all-blob-reports`.
4. Run: `npx playwright merge-reports --reporter html ./all-blob-reports`, then upload `playwright-report`.
5. Since 1.65, a sharded run fails with "No tests found" if no test matches across all shards, unless you pass `--pass-with-no-tests`. An empty single shard still passes when the other shards have tests.
6. 1.65: the blob reporter deletes the content of its output folder before it writes.

**Follow-ups:**
- *A shard crashed and has no blob.* The merge then misses those tests and may look green. Make the merge step count the blobs and fail if one is missing.
- *Same tests on several environments?* The docs describe merging reports from multiple environments, with a label to tell them apart. Read that section before you set it up.

**Trap:** `if: success()` on the merge job. A failing shard then means no report at all.

**Source:** https://playwright.dev/docs/test-sharding

### How do you make flaky tests visible in a JUnit report?

Topic: pw-reporting | Core | id: q0147

**Say:** By default JUnit shows a test that failed and then passed on retry as a plain pass, so CI tools never see the flake. I turn on `includeRetries`, available since 1.59, and each failed attempt is written as a `<flakyFailure>`. With 1.65 there is also `onlyFailures`, which drops the stable tests and keeps every attempt of the failed and flaky ones. When I need a clean terminal view, the new `failures` reporter prints failures and successful retries as they happen.

**Full process:**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: 1,
  reporter: [
    ['failures'],
    ['junit', { outputFile: 'all.xml', includeRetries: true }],
    ['junit', { outputFile: 'only-problems.xml', onlyFailures: true }],
  ],
});
```
1. For shards, set `PLAYWRIGHT_JUNIT_INCLUDE_RETRIES=1` on `npx playwright merge-reports --reporter=junit blob-report`.
2. Verified on 1.65.0 with one stable, one flaky and one broken test. Default output showed the flaky test as a plain pass. `includeRetries` added `<flakyFailure>` for the flaky test and `<rerunFailure>` for the broken one. `onlyFailures` left out the stable test.

**Follow-ups:**
- *Does the suite still count a flaky test as passed?* Yes. `failures` stays 0 for it in the XML, so a tool must read the `<flakyFailure>` element to count it.
- *Is `includeRetries` new in 1.65?* No, it arrived in 1.59. `onlyFailures` and the `failures` reporter are the 1.65 additions.

**Trap:** Saying JUnit cannot show flaky tests. That is only the default.

**Source:** https://playwright.dev/docs/test-reporters

### How do you write a custom reporter?

Topic: pw-reporting | Core | id: q0148

**Say:** A reporter is a class that implements some methods of the `Reporter` interface: `onBegin`, `onTestBegin`, `onTestEnd`, `onStepBegin`, `onStepEnd`, `onError`, `onEnd` and a few more. I export it as default and point the config at the file. I write one when I need a custom output, such as a Slack summary or a flaky test list. The data in `onTestEnd` is the test case and the result with status, duration, errors and attachments. Since 1.63 steps carry `subtitle` and `params`.

**Full process:**
```ts
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

class SummaryReporter implements Reporter {
  private failed: string[] = [];
  private flaky: string[] = [];

  onBegin(_config: FullConfig, suite: Suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'failed' || result.status === 'timedOut') this.failed.push(test.title);
    if (test.outcome() === 'flaky') this.flaky.push(test.title);
  }

  onEnd(result: FullResult) {
    console.log(`Run ${result.status}. Failed attempts: ${this.failed.length}. Flaky tests: ${this.flaky.length}.`);
  }
}

export default SummaryReporter;
```
1. Register it: `reporter: [['list'], ['./reporters/summary-reporter.ts']]`.
2. Or try once: `npx playwright test --reporter=./reporters/summary-reporter.ts`.
3. A reporter runs in the runner process, not in the workers. It gets events from all workers.
4. `test.outcome()` returns `expected`, `unexpected`, `flaky` or `skipped`. A flaky test passes on retry but has a failed attempt, so `failed` above counts attempts, not tests.

**Follow-ups:**
- *Should a reporter fail the run?* Most reporters only observe. Change the exit status only when you really need to.

**Trap:** Putting logic about test outcomes in the reporter that should be an assertion in the test.

**Source:** https://playwright.dev/docs/test-reporters

### How do Allure and ReportPortal work with Playwright?

Topic: pw-reporting | Core | id: q0149

**Say:** Both are third-party reporters that plug into the same reporter API. Allure writes result files with steps, attachments, labels and history, and a separate step builds the Allure report. ReportPortal sends results to a server, so a team has dashboards, trends, flaky test analysis and failure triage across runs. The Playwright docs list both in the community reporters. A common setup uses them for dashboards and flaky-test reports, with Slack alerts on top.

**Full process:**
1. Allure: install the `allure-playwright` package and add it: `reporter: [['list'], ['allure-playwright']]`. Run the tests, then build the report with the Allure command line. Check the package docs for the exact output folder and commands.
2. ReportPortal: install the Playwright agent from the ReportPortal project (`agent-js-playwright`), and add the reporter with your server endpoint, project and API key in its options. Keep the key in an environment variable, never in the repo.
3. Both can run next to the built-in `html` reporter.
4. With shards, decide one way to send results (merge first, or send from each shard under one launch name) and write it down. Each tool has its own rules for this.
5. History and trends need a persistent store: for Allure keep the history folder between runs, for ReportPortal the server holds it.

**Follow-ups:**
- *Why not just the HTML report?* It is a report of one run. Dashboards over many runs show flaky tests and trends, and let a team triage failures.

**Trap:** Putting the API key in the config file.

**Source:** https://playwright.dev/docs/test-reporters

### The HTML report is too large and slow on CI. What do you do?

Topic: pw-reporting | Standard | id: q0150

**Say:** The size comes from attachments: traces, videos and screenshots for every test. I record them only on failure, and I use `onlyFailures: true` on the HTML reporter (1.65), so passing tests are not in the report. I also keep the report artifact for a short time. For a large suite I use the `failures` reporter for the terminal and keep the full data in blobs.

**Full process:**
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['failures'], ['html', { open: 'never', onlyFailures: true }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
});
```
1. `onlyFailures` keeps failed, flaky and interrupted tests, with every attempt.
2. Artifact retention: set `retention-days` on the upload step.
3. If someone needs the full run, keep the blob report and merge on request.

**Follow-ups:**
- *Can you lose a flaky test this way?* No. Flaky tests are kept even when they pass on retry.

**Trap:** Turning off traces to save space, then having nothing when a test fails.

**Source:** https://playwright.dev/docs/test-reporters

### How do you get test results into a Slack alert or a dashboard? (scenario)

Topic: pw-reporting | Standard | id: q0151

**Say:** I use the `json` or `junit` reporter, or a small custom reporter, to get the result in a machine-readable form, and a CI step posts a summary: the number of tests, failures, flaky tests and a link to the report. For history and trends I use a dashboard such as ReportPortal or Allure. The Slack message goes to a channel with a link to the CI job and the report, and only has what a person needs to decide: pass or fail, which tests, and where to look.

**Full process:**
1. Reporters: `[['json', { outputFile: 'results/report.json' }], ['html', { open: 'never' }]]`.
2. A CI step reads the JSON and counts with `node`:
```ts
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('results/report.json', 'utf8'));
const { expected, unexpected, flaky, skipped } = report.stats;
console.log(`passed ${expected}, failed ${unexpected}, flaky ${flaky}, skipped ${skipped}`);
```
3. Post the line and the job URL to a Slack incoming webhook with `curl`. Keep the webhook URL in a CI secret.
4. Alert on scheduled runs and release runs, and not on every merge request, so the channel stays readable.

**Follow-ups:**
- *Who gets the alert?* The owners of the failing area, named in the message if you can map files to teams.

**Trap:** An alert on every red run. People mute the channel.

**Source:** https://playwright.dev/docs/test-reporters

## Cross-browser and devices (`pw-browsers`)

### How do you run tests on several browsers and devices?

Topic: pw-browsers | Core | id: q0152

**Say:** I define projects in `playwright.config.ts`, one per browser or device, using device descriptors like `devices['Desktop Chrome']`, `devices['Desktop Firefox']`, `devices['Desktop Safari']` and `devices['Pixel 7']`. Playwright runs the same tests in each project, and the project name shows in the report and in snapshot names. I choose projects by risk: Chromium for every run, and WebKit and Firefox on a schedule or for tagged tests. Since 1.64 a project can have `default: false`, so a plain `npx playwright test` runs only my favourite and `--project="*"` runs all.

**Full process:**
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, default: false },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, default: false },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] }, default: false },
  ],
});
```
1. Install browsers: `npx playwright install` (or `npx playwright install webkit`).
2. Run one: `npx playwright test --project=webkit`. Run all: `npx playwright test --project="*"`.
3. Breaking change in 1.64: descriptors now forward `screen`, so `window.screen` and media queries see the emulated size. Set `screen: undefined` to opt out.
4. Branded browsers work too: `use: { channel: 'chrome' }`.

**Follow-ups:**
- *What does a device descriptor set?* The user agent, the viewport and screen size, device scale factor, `isMobile` and `hasTouch`, and the default browser type.

**Trap:** Running all browsers on every merge request. It multiplies the run time for little extra signal.

**Source:** https://playwright.dev/docs/browsers

### How do you run only some tests in some browsers?

Topic: pw-browsers | Core | id: q0153

**Say:** I tag the tests and use `--grep` for a subset, and I use `testMatch` or `grep` on a project so that a project runs only its files or tags. A common set is: all tests on Chromium, a `@smoke` or `@cross-browser` subset on Firefox and WebKit. For a single test that is known to fail in one engine, I use `test.fixme` with a condition on the browser name and a reason, so it stays visible and is not deleted.

**Full process:**
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: /@cross-browser/,
      default: false,
    },
  ],
});
```
```ts
import { test, expect } from '@playwright/test';

test('menu opens', { tag: '@cross-browser' }, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
});

test('drag and drop', async ({ page, browserName }) => {
  test.fixme(browserName === 'webkit', 'Product bug in Safari: drop target does not highlight');
  await page.goto('/board');
});
```
1. Run the subset everywhere: `npx playwright test --project="*"`.
2. A `fixme` with a reason shows in the report as skipped, so the gap stays visible.

**Follow-ups:**
- *Is a skip a way to hide a bug?* Only when there is no reason and no owner. A product bug in one engine is reported, and the skip points to it.

**Trap:** Skipping a test in one browser to make CI green, with no note.

**Source:** https://playwright.dev/docs/test-projects

### What does device emulation not cover?

Topic: pw-browsers | Standard | id: q0154

**Say:** Emulation changes how a desktop browser behaves: viewport, user agent, touch, device pixel ratio, locale, timezone, geolocation, permissions, colour scheme, offline mode. It does not run the real mobile browser or the real operating system. So it does not cover real touch hardware and gestures beyond the basics, the mobile browser's own chrome like the address bar and keyboard, the OS-level behaviour like native pickers and share sheets, real performance on a slow phone, or real network conditions. For those I use real devices or a device cloud.

**Full process:**
1. Emulation covers: `viewport`, `userAgent`, `isMobile`, `hasTouch`, `deviceScaleFactor`, `locale`, `timezoneId`, `geolocation`, `permissions`, `colorScheme`, offline mode and `javaScriptEnabled`.
2. Example:
```ts
import { test, expect } from '@playwright/test';

test.use({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  geolocation: { latitude: 52.52, longitude: 13.4 },
  permissions: ['geolocation'],
});

test('shows the German locale and the Berlin store', async ({ page }) => {
  await page.goto('/stores');
  await expect(page.getByRole('heading', { name: 'Filiale in Berlin', exact: true })).toBeVisible();
});
```
3. Not covered: real device performance, real iOS Safari quirks beyond what WebKit gives, a virtual keyboard resizing the viewport, native app wrappers, real cameras.

**Follow-ups:**
- *Is Mobile Safari emulation real Safari?* It uses the WebKit engine from Playwright with iPhone settings. It is not the Safari app on iOS.

**Trap:** "We tested on iPhone" when you ran an emulation project.

**Source:** https://playwright.dev/docs/emulation

### What are the WebKit caveats in Playwright?

Topic: pw-browsers | Standard | id: q0155

**Say:** Playwright WebKit is the WebKit engine, built by Playwright and shipped with it, not the Safari app. It is the closest you get to Safari on Linux and in CI, and it catches many Safari-only bugs, but it is not identical to Safari on a Mac or an iPhone. Rendering, fonts and some features differ, and not every Safari bug shows in it. It also behaves a bit differently in some details, for example a `fulfill` with a 3xx status is rejected in WebKit. For a high-stakes Safari bug I confirm on a real Mac or device.

**Full process:**
1. Install: `npx playwright install webkit`. On Linux use the Playwright Docker image or install system dependencies with `npx playwright install-deps`.
2. Run: `npx playwright test --project=webkit`.
3. Keep separate screenshot baselines per project. WebKit pixels differ from Chromium.
4. Observed behaviour, not on the browsers docs page: fulfilling with a `3xx` status is followed on the network without calling your handler again in Chromium (checked on 1.65.0), and WebKit throws "Cannot fulfill with redirect status".
5. For real Safari: a Mac runner, or a device cloud.

**Follow-ups:**
- *Is WebKit on Windows or Linux Safari?* No. Same engine family, different build and platform integration.

**Trap:** Telling a product owner "WebKit passed, Safari is fine".

**Source:** https://playwright.dev/docs/browsers

### Why and when would you use BrowserStack with Playwright?

Topic: pw-browsers | Standard | id: q0156

**Say:** BrowserStack gives me real browsers and real devices in the cloud that I do not have locally: many browser and OS versions, real iPhones and Android phones. I use it for a small cross-browser and real-device set, not for the whole suite, because it is slower and costs per parallel session. If you have used BrowserStack a little, say so. As I understand it, with the Playwright SDK I add a `browserstack.yml` with credentials and a list of platforms, and the SDK runs my tests on those platforms in parallel.

**Full process:**
1. Install the BrowserStack SDK for Node per their docs, and add `browserstack.yml` in the project root with `userName`, `accessKey` (from the environment, not committed) and a `platforms` list (OS, OS version, browser, browser version).
2. Run the tests through the SDK command from the BrowserStack docs. Check the exact command there, since it is not verified in this pack.
3. See results in the BrowserStack Automate dashboard.
4. Scope: smoke and critical-path tests on the platforms the customers use. The rest runs locally and in CI on Playwright's own browsers.

**Follow-ups:**
- *Why not run everything there?* Cost, speed, and network latency to the cloud, and failures are harder to debug than local traces.
- *How do you choose platforms?* From the analytics of real users.

**Trap:** Saying BrowserStack replaces Playwright's own projects.

**Source:** https://www.browserstack.com/docs/automate/playwright/getting-started/nodejs

### Scenario: a bug appears only on iPhone Safari. How do you test it?

Topic: pw-browsers | Standard | id: q0157

**Say:** First I try to reproduce it in a `Mobile Safari` project, which uses WebKit and iPhone settings, because that is cheap and traceable. If it reproduces, I write a failing test, fix, and keep the test. If it does not, the cause may be real Safari behaviour or the real device, so I check on a real device or a device cloud, and note what the emulation missed. I do not close the bug as "cannot reproduce" before that.

**Full process:**
1. Run: `npx playwright test --project="Mobile Safari" tests/bug.spec.ts --trace on`.
2. Compare viewport and user agent with what the user reported.
3. Not reproduced in emulation: try a real device through BrowserStack or a colleague's phone, and record the iOS and Safari versions.
4. Common causes: viewport units with the dynamic address bar, `position: fixed` with the keyboard, date inputs, and storage limits in private mode.
5. Add a regression test in the closest project, and a note that the real device is the final check.

**Follow-ups:**
- *Can emulation confirm the fix?* Only if it reproduced the bug. Otherwise confirm on the real device.

**Trap:** Declaring it fixed because the emulated test passes when the emulated test never failed.

**Source:** https://playwright.dev/docs/emulation

## WebSockets and realtime (`pw-websockets`)

### How do you test a chat with two users in Playwright?

Topic: pw-websockets | Core | id: q0158

**Say:** I use two separate browser contexts in one test, one per user, each with its own cookies and storage, so they are two real sessions. User A sends a message on page A, and I assert that it appears on page B with a web-first assertion, which waits for the realtime event. No sleeps. I assert on the visible message and its state, not on the socket frames, unless the frame itself is the contract.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('a message from the agent reaches the visitor', async ({ browser }) => {
  const agentContext = await browser.newContext({ storageState: 'playwright/.auth/agent.json' });
  const visitorContext = await browser.newContext();
  const agent = await agentContext.newPage();
  const visitor = await visitorContext.newPage();

  await visitor.goto('/widget');
  await agent.goto('/inbox');

  await visitor.getByRole('textbox', { name: 'Message', exact: true }).fill('Hello');
  await visitor.getByRole('button', { name: 'Send', exact: true }).click();

  await agent.getByRole('link', { name: 'Hello', exact: true }).click();
  await agent.getByRole('textbox', { name: 'Reply', exact: true }).fill('Hi, how can I help?');
  await agent.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(visitor.getByText('Hi, how can I help?', { exact: true })).toBeVisible();

  await agentContext.close();
  await visitorContext.close();
});
```
1. Each `browser.newContext()` is isolated: two logins, two sessions.
2. Close the contexts you create. Contexts from the `context` fixture close themselves.
3. The final assertion waits up to the expect timeout for the message, which covers the realtime delay.

**Follow-ups:**
- *Can one context hold two pages?* Yes, but they share cookies, so it is the same user in two tabs.
- *Why not wait for a socket frame?* The user sees the DOM. If the DOM shows the message, the chain worked.

**Trap:** `waitForTimeout(2000)` after sending to "give the socket time".

**Source:** https://playwright.dev/docs/api/class-websocket

### How do you wait for or assert on WebSocket messages?

Topic: pw-websockets | Core | id: q0159

**Say:** Playwright fires `page.on('websocket')` for each socket the page opens, and the socket object emits `framesent` and `framereceived`. I register the listener before the page opens the socket. For an assertion I collect frames into an array, or wait for a specific frame with `ws.waitForEvent('framereceived', { predicate })`. For what the user sees, I still assert the DOM, since frames can arrive and the UI can still be wrong.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('the server sends a typing event', async ({ page }) => {
  const wsPromise = page.waitForEvent('websocket', ws => ws.url().includes('/socket'));
  await page.goto('/inbox');
  const ws = await wsPromise;

  const frame = await ws.waitForEvent('framereceived', {
    predicate: f => String(f.payload).includes('"typing"'),
  });
  expect(JSON.parse(String(frame.payload))).toMatchObject({ type: 'typing' });

  await expect(page.getByText('Visitor is typing', { exact: true })).toBeVisible();
});
```
1. Create the `waitForEvent('websocket')` promise before `goto`, so you do not miss the socket that opens on load.
2. `framereceived` and `framesent` give `{ payload }`, a string or a Buffer.
3. Log everything while debugging: `ws.on('framesent', e => console.log('>>', e.payload))`.
4. socket.io frames contain the engine.io and socket.io framing, like `42[...]`, so a predicate on a substring is simpler than parsing. Adapt the `JSON.parse` line to the real frame shape.

**Follow-ups:**
- *Which URL does socket.io use?* It usually connects to a path like `/socket.io/` and may start with polling and upgrade to WebSocket, so the first frames can be HTTP requests.

**Trap:** Registering the `websocket` listener after `goto` and missing the connection.

**Source:** https://playwright.dev/docs/network

### How does `routeWebSocket` work, and when do you use it?

Topic: pw-websockets | Core | id: q0160

**Say:** `page.routeWebSocket(url, handler)` intercepts WebSocket connections the page makes after the call. If the handler does not call `connectToServer()`, the socket is fully mocked: Playwright opens it in the page without any server, and I answer messages with `ws.send`. If I call `connectToServer()`, I get the real server socket as a second object, and I can forward, change or block messages in both directions. I use it to make realtime tests deterministic, to simulate a server message, a close, or a reconnect, and to block messages I do not want.

**Full process:**
1. Fully mocked:
```ts
import { test, expect } from '@playwright/test';

test('mock server replies to a ping', async ({ page }) => {
  await page.routeWebSocket('wss://example.com/ws', ws => {
    ws.onMessage(message => {
      if (message === 'request') ws.send('response');
    });
  });
  await page.goto('/chat');
  await expect(page.getByText('response', { exact: true })).toBeVisible();
});
```
2. Pass-through with changes:
```ts
import { test } from '@playwright/test';

test('rewrite one message to the server', async ({ page }) => {
  await page.routeWebSocket('wss://example.com/ws', ws => {
    const server = ws.connectToServer();
    ws.onMessage(message => server.send(message === 'request' ? 'request2' : message));
  });
  await page.goto('/chat');
});
```
3. Once you call `onMessage`, messages are not forwarded automatically. You must forward them yourself with `send`.
4. Register it before navigation, and it covers only sockets created after the call.
5. Other methods: `ws.close({ code, reason })`, `ws.onClose(...)`, `ws.url()`, `ws.protocols()`.

**Follow-ups:**
- *`page.routeWebSocket` versus `context.routeWebSocket`?* Same split as for HTTP: page for one page, context for all pages in the context.
- *Does it work for socket.io?* For the WebSocket transport, yes. If the client starts with HTTP polling, those requests are HTTP and go through `page.route`.

**Trap:** Calling `routeWebSocket` after `goto`.

**Source:** https://playwright.dev/docs/mock

### How do you test reconnect behaviour?

Topic: pw-websockets | Core | id: q0161

**Say:** I make the connection drop on purpose and check what the user sees and what survives. With `routeWebSocket` I can close the mocked socket from the server side with `ws.close()`, and then check that the UI shows a "reconnecting" state, the client opens a new socket, and the messages are not lost or doubled. A simpler way is `context.setOffline(true)` and then `false`. I assert on the UI, and I count connections inside the route handler. Reconnect races were a main source of flaky tests for me, so I test the exact order: drop, reconnect, then continue.

**Full process:**
```ts
import { test, expect } from '@playwright/test';

test('client reconnects after the server closes the socket', async ({ page }) => {
  let connections = 0;
  await page.routeWebSocket('wss://example.com/ws', ws => {
    connections += 1;
    if (connections === 1) {
      ws.onMessage(() => ws.close({ code: 1011, reason: 'server restart' }));
    } else {
      ws.onMessage(message => ws.send(`echo:${message}`));
    }
  });

  await page.goto('/chat');
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('first');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Reconnecting', { exact: true })).toBeVisible();

  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('second');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('echo:second', { exact: true })).toBeVisible();
  expect(connections).toBe(2);
});
```
1. The first connection closes on the first message. The second one echoes.
2. The test uses visible states, so no fixed waits. The UI texts are placeholders for your app.
3. The final count proves the client reconnected exactly once.

**Follow-ups:**
- *Why does reconnect make parallel tests flaky?* A reconnect can replay or reset state while another step of the test still expects the old state. The fix is to wait for the "connected" state before the next action, and not to assume the first connection is final.

**Trap:** Asserting right after sending, while the client is still reconnecting.

**Source:** https://playwright.dev/docs/api/class-websocketroute

### Code reading: this realtime test is flaky. Find the bug.

Topic: pw-websockets | Core | id: q0162

**Say:** The test sends a message and sleeps for two seconds before it checks the other page. A fixed sleep is a guess. On a slow CI the message needs longer, and on a fast machine the test wastes time. The count is also read once and does not retry. The fix is a web-first assertion on the receiving page, which retries until the message shows or the timeout ends.

**Full process:** Buggy:
```ts
import { test, expect } from '@playwright/test';

test('buggy: sleep for the socket', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('/room');
  await b.goto('/room');
  await a.getByRole('textbox', { name: 'Message', exact: true }).fill('hi');
  await a.getByRole('button', { name: 'Send', exact: true }).click();
  await a.waitForTimeout(2000);
  expect(await b.getByText('hi').count()).toBe(1);
});
```
Problems: `waitForTimeout`, a one-time `count()` read that does not retry, and a locator without `exact: true` that matches any text containing "hi". Fixed:
```ts
import { test, expect } from '@playwright/test';

test('fixed: web-first assertion on the receiver', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  await a.goto('/room');
  await b.goto('/room');

  await a.getByRole('textbox', { name: 'Message', exact: true }).fill('hi');
  await a.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(b.getByText('hi', { exact: true })).toHaveCount(1);
  await contextA.close();
  await contextB.close();
});
```

**Follow-ups:**
- *Why is `expect(await locator.count())` bad?* It reads once. `await expect(locator).toHaveCount(1)` retries.

**Trap:** Replacing the sleep with a longer sleep.

**Source:** https://playwright.dev/docs/test-assertions

## Playwright and AI (`pw-general`)

### What are Playwright Test Agents: planner, generator and healer?

Topic: pw-general | Standard | id: q0163

**Say:** The Playwright docs describe three agents that come with Playwright. The planner explores the app and writes a Markdown test plan. The generator turns that plan into Playwright test files, checking locators and assertions live in a browser. The healer runs failing tests, inspects the page, proposes a patch such as a locator update or a wait change, and re-runs until it passes or a guardrail stops it. You can use them one by one or in a loop. I treat their output as a draft that I review, because a healer can make a test pass by weakening it.

**Full process:**
1. Add agent definitions to the repo for your AI tool: `npx playwright init-agents --loop=claude` (other values: `vscode`, `codex`, `opencode`). Regenerate after every Playwright update.
2. Planner input: a request ("plan for guest checkout"), a seed test `tests/seed.spec.ts` that sets up the environment, and optionally a product requirements document. Output: `specs/<name>.md`.
3. Generator input: the Markdown plan. Output: test files under `tests/`, with a comment that names the spec and the seed.
4. Healer input: the failing test name. It replays, inspects, patches and re-runs.
5. Seed test example:
```ts
import { test } from '@playwright/test';

test('seed', async ({ page }) => {
  await page.goto('/');
});
```
6. My review step: read every generated test against my rules, check locators are user-facing with `exact: true`, check assertions are real, and reject any healer change that removes or weakens an assertion.

**Follow-ups:**
- *Where do the agents run?* In your AI tool, such as Claude Code or VS Code. The definitions are instructions plus MCP tools.
- *Is the healer safe on a real product bug?* No. If the app is broken, the healer should skip or fail the test, not rewrite it.

**Trap:** Believing the agents are a separate paid product. They are definitions you generate into your repo, and they run in your own AI tool.

**Source:** https://playwright.dev/docs/test-agents

### What is Playwright MCP, and how is it different from the test agents?

Topic: pw-general | Standard | id: q0164

**Say:** Playwright MCP is a Model Context Protocol server that gives an AI client browser tools: navigate, click, type, take a snapshot, read network requests and so on. The model reads accessibility snapshots with element refs, so it needs no vision model. It is a tool layer. The test agents are workflows built on top of such tools: a planner, a generator and a healer with defined inputs and outputs. So MCP is the hands, and the agents are the roles that use them to produce specs and tests.

**Full process:**
1. Add to an MCP client, such as Claude Code or VS Code:
```json
{ "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
```
2. The loop: `browser_navigate`, then `browser_snapshot` returns the accessibility tree with refs like `e5`, then `browser_click` or `browser_type` use a ref, then a new snapshot comes back.
3. Extra tool groups are switched on with `--caps`: `network` (route and mock), `storage`, `testing` (locator generation and verify tools), `devtools` (tracing, video), `pdf`, `vision`.
4. Opens headed by default. `--headless` for no window. Version 1.64 adds WebMCP support, for tools that a page registers itself.
5. There is also Playwright CLI (`@playwright/cli`), which the docs recommend for coding agents that work in large codebases, because it uses fewer tokens than MCP tool schemas and snapshots.

**Follow-ups:**
- *MCP or CLI?* MCP for exploratory and specialised loops, the CLI for a coding agent that already has a shell.
- *Does MCP write tests?* It acts in a browser. The model decides what to write. `browser_generate_locator` helps with locators.

**Trap:** "Playwright MCP generates my tests." It exposes browser actions, and the model writes the tests.

**Source:** https://playwright.dev/mcp/introduction

### How would you use AI agents with Playwright safely in a real team? (scenario)

Topic: pw-general | Standard | id: q0165

**Say:** I use them for drafts and for exploration, and I keep a person responsible for what is merged. The agent gets a seed test, the project rules and a narrow task. I review the diff like code from a junior colleague: locators, assertions, waits, data isolation. I never let an agent fix a failing test by deleting an assertion, adding a sleep or skipping, because that hides a bug. And I do not assert on AI output text in tests, because it changes on every run. I assert on UI that always renders.

**Full process:**
1. Give the agent the rules in a file it reads: user-facing locators, `exact: true`, no fixed waits, no `networkidle`, no forced actions, assertions in tests.
2. Task size: one scenario or one failing test per run.
3. Review checklist: does the test fail when the feature breaks, is data isolated, are locators stable, is anything weakened.
4. Prove the new test: break the feature or mutate one line and see the test fail.
5. CI runs the same checks for human and agent code.

**Follow-ups:**
- *How do you test a feature that returns LLM text?* I assert the UI around it, such as the message bubble, loading state and error state, and mock the model's response when I need exact text.

**Trap:** Merging generated tests because they are green.

**Source:** https://playwright.dev/docs/test-agents

## Playwright overall (`pw-general`)

### Why Playwright and not Cypress or Selenium?

Topic: pw-general | Standard | id: q0166

**Say:** Playwright drives Chromium, Firefox and WebKit with one API, auto-waits for actionability, retries web-first assertions, and gives a trace viewer, built-in parallelism and sharding, API testing, network mocking and multiple contexts in one test. Those multiple contexts make tests like a two-user chat simple. Selenium needs explicit waits and more setup. Cypress runs inside the browser, which gives a nice runner, but the model makes multi-tab and multi-user flows harder. These are tradeoffs, not a ranking: if a team has a stable Cypress suite and no pain, a migration needs a reason.

**Full process:**
1. Compare on what you need, not on a feature list: browsers, languages, parallelism, debugging tools, CI cost, team skills.
2. Run a small pilot: take five tests of different kinds, including a flaky one, and write them in the candidate tool.
3. Measure: time to write, flake rate over 50 repeats, run time, quality of failure information.
4. Decide with numbers and write down the reason.

**Follow-ups:**
- *What does Playwright not do better?* A large existing suite in another tool has a real cost to move. Ecosystem and team knowledge count.

**Trap:** Quoting a feature list from a blog without checking it against the current docs.

**Source:** https://playwright.dev/docs/intro

### How do you upgrade Playwright safely?

Topic: pw-general | Standard | id: q0167

**Say:** I read the release notes first, especially the breaking changes. Then I upgrade `@playwright/test` and install the matching browsers, run the suite, and update the Docker image and CI to the same version, because browsers and the library must match. I upgrade in its own merge request, with no other change in it, so a failure points to the upgrade. I re-record screenshot baselines only if the browser change moved pixels, and I review that diff.

**Full process:**
1. `npm i -D @playwright/test@latest` and `npx playwright install --with-deps`.
2. Read the notes of every version you skip. Current examples from 1.64 and 1.65: descriptors forward `screen`, `--update-snapshots=missing` now passes, TypeScript class fields follow `useDefineForClassFields` (a page object that reads a constructor parameter property in a field initialiser now throws), actions wait for the element not to be inert, cookie matching follows RFC 6265, Node 20 is no longer tested, and sharded runs with no tests fail unless `--pass-with-no-tests`.
3. Run the suite with `--repeat-each=3` to catch new flakiness.
4. Page object fix for the 1.65 class field change:
```ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.submit = this.page.getByRole('button', { name: 'Submit', exact: true });
  }
}
```
5. Update the CI image to `mcr.microsoft.com/playwright:v1.65.0-noble` and keep the `@playwright/test` version the same.
6. Regenerate agent definitions if you use them: `npx playwright init-agents --loop=claude`.

**Follow-ups:**
- *How often?* Regularly, so each step is small. Waiting a year turns one upgrade into a project.
- *Pin or float?* Pin the exact version in the lockfile, and upgrade on purpose.

**Trap:** Upgrading the package and leaving the CI image on the old browsers.

**Source:** https://playwright.dev/docs/release-notes

### What is new in recent Playwright versions that matters in practice?

Topic: pw-general | Standard | id: q0168

**Say:** From the recent release notes: 1.65 added running tests with Bun, a `failures` reporter and `onlyFailures` for reports, and a built-in `-exclusive-` lock. 1.64 added `testProject.default`, `--shuffle`, `locator.within()`, better videos and cookie methods on the request context. 1.63 added test locks, aria and screen snapshots in traces, and the `perfetto` reporter. 1.62 added the new component testing model, `AbortSignal` support and WebP screenshots. The ones I would use first are `--shuffle` for hidden order dependencies, locks for shared resources, and `onlyFailures` for smaller reports.

**Full process:**
1. `npx playwright test --shuffle` prints a seed. Re-run with `--shuffle <seed>` to repeat the order.
2. Locks:
```ts
import { test } from '@playwright/test';

test('update user settings', { lock: 'user-settings' }, async ({ page }) => {
  await page.goto('/settings');
});

test('restart the server', { lock: '-exclusive-' }, async () => {});
```
3. `lock` tests with the same name never run at the same time, across files, workers and projects. `-exclusive-` runs a test only when nothing else runs.
4. `locator.within()`: `page.getByRole('button', { name: 'Save', exact: true }).within(page.getByRole('dialog'))`.
5. Under Bun: `bunx --bun playwright test`. There is no watch mode, and console output of a test does not get into the trace.

**Follow-ups:**
- *Which breaking changes hit most suites?* Check the notes. In 1.65 the TypeScript class field change affects page objects that use constructor parameter properties in field initialisers.

**Trap:** Quoting features from memory. The release notes change every few weeks.

**Source:** https://playwright.dev/docs/release-notes

### How would you migrate a suite from Cypress or Selenium to Playwright? (scenario)

Topic: pw-general | Standard | id: q0169

**Say:** I do not migrate everything at once. I start with a short list of the most valuable tests and the ones that flake most, and I rewrite them rather than translate line by line, because the models differ: Playwright auto-waits and uses locators, Cypress queues commands, and Selenium needs explicit waits. I run both suites side by side until the Playwright set covers the critical paths, then retire the old tests. I set the rules for the new suite first: locators, fixtures, auth by storage state, data isolation. I measure flakiness and run time before and after, so I can show the result.

**Full process:**
1. Inventory: list tests with value, flakiness and run time.
2. Skeleton: config, projects, fixtures, auth setup project, reporters, CI with sharding.
3. Pilot: 10 to 20 important tests, written in the new style.
4. Map the concepts: Cypress `cy.intercept` becomes `page.route`, `cy.session` becomes storage state, Selenium explicit waits disappear in favour of auto-waiting and web-first assertions, `cy.get` chains become locators.
5. Run both in CI. Compare failures to find product bugs that one suite hides.
6. Move the rest in slices, in order of value. Delete the old tests slice by slice.
7. Do not port tests that are no longer valid. A migration is a chance to delete.

**Follow-ups:**
- *Biggest trap?* Copying waits and sleeps from the old suite.
- *What about parallelism?* Playwright runs files in parallel with workers by default. Tests must not share state.

**Trap:** A line-by-line translation that keeps all the old flakiness.

**Source:** https://playwright.dev/docs/intro

### How do you structure a Playwright project at scale?

Topic: pw-general | Standard | id: q0170

**Say:** I keep tests grouped by feature, with page objects for shared flows that hold locators and user actions, and small component objects for shared UI like headers and modals. Fixtures provide the page objects, the API clients and the test data, so tests stay short. Assertions live in the tests, not in the page objects. I separate projects for setup (auth), browsers and test types, and I run in CI with shards and a merged report. I keep the config small and the conventions written down.

**Full process:**
1. Layout:
```
playwright.config.ts
tests/
  checkout/checkout.spec.ts
  inbox/inbox.spec.ts
  fixtures/index.ts
  pages/login.page.ts
  components/header.component.ts
  api/orders.client.ts
  hars/
playwright/.auth/       (git-ignored)
```
2. A fixtures file merges pages and clients:
```ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

export const test = base.extend<{ loginPage: LoginPage }>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
```
3. Page objects hold `Locator`s and actions, never element handles.
4. Projects: `setup` (auth), then browser projects with `dependencies: ['setup']`.
5. Tags: `{ tag: '@smoke' }` and `--grep @smoke` for a fast run.
6. CI: shards, blob reports, a merge job, artifacts for traces.

**Follow-ups:**
- *Page objects or only fixtures?* A page object is fine when it stays small and idiomatic. Do not build a method per click or a giant class.
- *Ownership?* Name an owner for each area, and review tests like code.

**Trap:** One page object with 80 methods that every test depends on.

**Source:** https://playwright.dev/docs/pom

### What would you not test in Playwright?

Topic: pw-general | Standard | id: q0171

**Say:** I would not use it for unit logic, for exhaustive API validation through the UI, for load and performance testing, or for things the browser cannot see, such as a real native mobile app. I also avoid testing third-party systems I do not own, and AI model output text, which changes every run. Playwright is great for user flows and integration through a real browser. The rest belongs to unit tests, API tests, a load tool, and manual or device testing.

**Full process:**
1. Logic and edge cases of a function: unit test.
2. Every validation rule: API test with a table of cases.
3. Load: a load tool such as JMeter. Playwright runs one browser per test and is not a load generator.
4. Native app: a native automation tool. Playwright covers web and mobile web emulation.
5. Third-party UI that I do not control: contract at the boundary, with a mock.
6. LLM output: check the UI that always renders, such as the bubble and the state, not the words.

**Follow-ups:**
- *Visual testing?* Use it for stable, important screens, not for every page.

**Trap:** "Playwright can do everything, so everything goes into E2E." The suite becomes slow and flaky.

**Source:** https://playwright.dev/docs/intro

### Scenario: the E2E suite takes 45 minutes and is flaky. What do you do?

Topic: pw-general | Standard | id: q0172

**Say:** I measure first. I split the time by test and by cause: slow setup, long waits, serial tests, too few workers or shards. Then I fix the largest cost: move setup to the API, share auth with storage state, remove tests that duplicate lower-level tests, shard on CI, and fix flaky tests at the root. I do not push workers to the maximum, and I do not add retries globally. I report time and flake rate before and after.

**Full process:**
1. Data: the JSON or HTML report for per-test durations, and a list of tests that failed then passed. Sort by duration.
2. Setup cost: replace UI login with a setup project and storage state, and create data through the API.
3. Parallelism: `fullyParallel: true`, and shards: `--shard=1/4` per CI job with `blob` reports and a merge job.
4. Flake: reproduce with `--repeat-each=50 --workers=4`, and fix causes. Use `--shuffle` to find order dependencies.
5. Scope: move checks to API or unit tests where the UI adds nothing.
6. Track the numbers each week.

**Follow-ups:**
- *What if tests share a resource?* Use a lock so only those tests wait.

**Trap:** Adding more machines to a flaky suite. You get faster flakiness.

**Source:** https://playwright.dev/docs/test-parallel
