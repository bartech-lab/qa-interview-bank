# Live coding, whiteboard and home tasks

How to study this file. Live coding tasks are small on purpose. A real interview gives one of them, often with 15 to 20 minutes on camera, and a partial solution with clear narration usually passes. Home tasks are the longer kind: you get hours or days, then present the result on a call and defend your choices. Each entry has what to say, a worked solution and the usual mistakes. For a live task, copy the starter, set a timer, fill in the `// your code here` parts, then compare with "In the slot". The full solution after it is for study, not for the timer. TypeScript starters run with `node file.ts` and fail on their asserts until you fill them in. For a home task, build it once without looking, then practise presenting it in five minutes. Every solution was run, not just read: the Playwright tests ran on Playwright 1.64.1 with Chromium, and everything compiled with `strict` on TypeScript 7.0.2. Algorithm files run on Node 22.18 or later with `node file.ts` (Node strips the types). The project needs `@playwright/test`, `typescript` and `@types/node` as dev dependencies, and `"type": "module"` in `package.json`. Pages come from `page.setContent` or from `page.route`, so no test needs the network, with one marked exception (TodoMVC). The code follows common Playwright practice: user-facing locators, `exact: true`, no `waitForTimeout`, no `force`, no `networkidle`, assertions in the test and not in page objects. Say the "Say" part out loud while you type: interviewers grade the narration as much as the code.

## Setup used by the Playwright tasks

Save this once. `playwright.config.ts` in the project root:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: { trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

`tests/support/shop.ts`, the small shop page several tasks reuse:

```ts
export const shopHtml = `<!doctype html>
<html lang="en"><head><title>Shop</title></head><body>
<h1>Mini shop</h1>
<p role="status" id="count">Cart: 0 items</p>
<section aria-label="Products">
  <article><h2>Blue Mug</h2><p>9 EUR</p><button>Add to cart</button></article>
  <article><h2>Red Cap</h2><p>15 EUR</p><button>Add to cart</button></article>
  <article><h2>Green Bag</h2><p>30 EUR</p><button>Add to cart</button></article>
</section>
<section aria-label="Cart"><h2>Your cart</h2><ul id="cart"></ul></section>
<script>
  const cart = [];
  const render = () => {
    const n = cart.length;
    document.getElementById('count').textContent = 'Cart: ' + n + (n === 1 ? ' item' : ' items');
    const ul = document.getElementById('cart');
    ul.innerHTML = '';
    cart.forEach((name, i) => {
      const li = document.createElement('li');
      li.append(name + ' ');
      const b = document.createElement('button');
      b.textContent = 'Remove ' + name;
      b.onclick = () => { cart.splice(i, 1); render(); };
      li.append(b);
      ul.append(li);
    });
  };
  document.querySelectorAll('article').forEach((a) => {
    a.querySelector('button').onclick = () => { cart.push(a.querySelector('h2').textContent); render(); };
  });
</script>
</body></html>`;
```

Run one file with `npx playwright test tests/t02-cart.spec.ts`, and type-check everything with `npx tsc --noEmit`.

## Live coding: Playwright

### Live task, 20 min: write an E2E test for a login form.

Topic: pw-general | Core | id: q1013

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import { test, expect } from '@playwright/test';
// loginHtml is the page from the full solution below.

test('valid login shows the welcome heading', async ({ page }) => {
  await page.setContent(loginHtml);
  // your code here
});

test('wrong password shows the error', async ({ page }) => {
  await page.setContent(loginHtml);
  // your code here
});
```

**Say:** First I ask what must be covered: the happy path, a wrong password, and the loading state. I use user-facing locators, label for the inputs and role for the button, and I do not add test ids. The page shows "Signing in..." and then the result, so I assert on the result and let the web-first assertion wait. I vary the bad logins in a loop, because one wrong sample proves little. At the end I check that the error does not show on success, and the welcome heading does not show on failure.

**In the slot:** two tests are enough: success and one wrong password. Say the rest (the loop of bad logins, the loading state) as what you would add next. With `loginHtml` from below:

```ts
test('valid login shows the welcome heading', async ({ page }) => {
  await page.setContent(loginHtml);
  await page.getByLabel('Email', { exact: true }).fill('ann@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Ann', exact: true })).toBeVisible();
});

test('wrong password shows the error', async ({ page }) => {
  await page.setContent(loginHtml);
  await page.getByLabel('Email', { exact: true }).fill('ann@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
});
```

**Full process:**
1. Brief as given: "Here is a login page. Write tests for it. You have 20 minutes." In that time the happy path and one wrong password are enough. The loop over three bad logins is the extra if time is left. The page has Email, Password and a Sign in button. It shows a status for 300 ms, then either a heading "Welcome, Ann" or an alert "Invalid email or password".
2. Put the page in `setContent` inside `beforeEach`, so every test starts from a fresh page. No state is shared between tests.
3. Write the happy path first, then the negative cases as a loop that creates one test per row.
4. Run it: `npx playwright test tests/t01-login.spec.ts`. Four tests pass; the three rejection tests take about 0.9 s each because of the 300 ms delay plus start-up.

```ts
import { test, expect } from '@playwright/test';

const loginHtml = `<!doctype html>
<html lang="en"><body>
<h1>Sign in</h1>
<form id="f">
  <label for="email">Email</label><input id="email" type="email">
  <label for="password">Password</label><input id="password" type="password">
  <button type="submit">Sign in</button>
</form>
<p id="out"></p>
<script>
  document.getElementById('f').addEventListener('submit', (e) => {
    e.preventDefault();
    const out = document.getElementById('out');
    out.innerHTML = '<span role="status">Signing in...</span>';
    setTimeout(() => {
      const ok = document.getElementById('email').value === 'ann@example.com'
        && document.getElementById('password').value === 'correct-horse';
      out.innerHTML = ok
        ? '<h2>Welcome, Ann</h2>'
        : '<span role="alert">Invalid email or password</span>';
    }, 300);
  });
</script>
</body></html>`;

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(loginHtml);
  });

  test('valid credentials show the welcome heading', async ({ page }) => {
    await page.getByLabel('Email', { exact: true }).fill('ann@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct-horse');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Welcome, Ann', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  const wrongLogins = [
    { name: 'wrong password', email: 'ann@example.com', password: 'wrong' },
    { name: 'unknown user', email: 'bob@example.com', password: 'correct-horse' },
    { name: 'password with different case', email: 'ann@example.com', password: 'Correct-Horse' },
  ];

  for (const { name, email, password } of wrongLogins) {
    test(`rejects ${name}`, async ({ page }) => {
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();

      await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
      await expect(page.getByRole('heading', { name: 'Welcome, Ann', exact: true })).toHaveCount(0);
    });
  }
});
```

**Follow-ups:**
- *What would you add with more time?* Empty fields, an email without `@`, a locked account after N attempts, keyboard submit with Enter, and a check that the password field has `type="password"`. In a real app I log in through the API in a setup step for all other tests and keep one UI login test.
- *Why no `waitForTimeout` for the 300 ms?* The assertion retries until the heading appears or the timeout ends. A fixed sleep is either too long (slow suite) or too short (flaky).
- *How do you assert the loading state?* `await expect(page.getByRole('status')).toHaveText('Signing in...')` right after the click. It is only safe when the delay is long enough to observe, so in a real suite I hold the response with `page.route` and release it after the assertion.

**Trap:** Asserting that a spinner is hidden as the proof of success. `toBeHidden` also passes if the spinner never appeared. Assert the result that proves the login worked. A second trap is a single wrong-password sample presented as "negative testing".

### Live task, 15 min: test a file download (export to CSV).

Topic: pw-general | Core | id: q1014

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// exportHtml is the page from the full solution below.

test('Export CSV downloads a file with the expected name and rows', async ({ page }, testInfo) => {
  await page.setContent(exportHtml);
  // your code here
});
```

**Say:** A download is an event, so I start waiting for it in the same `Promise.all` as the click. Awaiting the click first can miss the event. Then I check three things: the file name, that the download did not fail, and the content. I save the file into the test's own output folder, read it, and compare the lines. I do not use a fixed path, so parallel tests cannot overwrite each other.

**In the slot:** the solution below is already slot size: one test, about ten lines of your own code. If time is short, drop the `failure()` check and say it out loud instead.

**Full process:**
1. Brief as given: "The Export CSV button downloads a file. Verify it."
2. `Promise.all([page.waitForEvent('download'), button.click()])` gives you the `Download` object.
3. `download.suggestedFilename()` is the name from the server header or the `download` attribute. `download.failure()` returns `null` on success, otherwise an error string.
4. `download.saveAs(testInfo.outputPath('products.csv'))`, then `readFile`. `outputPath` is unique for each test and each retry.
5. The page in this example creates the CSV with a `Blob`, so it needs no server.

```ts
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const exportHtml = `<!doctype html>
<html lang="en"><body>
<button id="export">Export CSV</button>
<script>
  document.getElementById('export').addEventListener('click', () => {
    const csv = 'id,name\\n1,Mug\\n2,Cap\\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'products.csv';
    a.click();
  });
</script>
</body></html>`;

test('Export CSV downloads a file with the expected name and rows', async ({ page }, testInfo) => {
  await page.setContent(exportHtml);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('products.csv');
  expect(await download.failure()).toBeNull();

  const saved = testInfo.outputPath('products.csv');
  await download.saveAs(saved);
  const lines = (await readFile(saved, 'utf8')).trim().split('\n');
  expect(lines).toEqual(['id,name', '1,Mug', '2,Cap']);
});
```

**Follow-ups:**
- *How do you test a PDF or XLSX?* The same event. For the content I parse the file with a library (for example `exceljs` for XLSX, `pdf-parse` for PDF) and check the values that matter. I would not compare bytes.
- *What if the download starts after a server job?* The button only starts the job. I wait for the event with a longer timeout on `waitForEvent`, and I do not poll with sleeps.
- *Does the file stay on disk?* Playwright deletes its temporary download when the context closes. A copy from `saveAs` stays in the test output folder.

**Trap:** Clicking, then calling `waitForEvent('download')`. The event can fire before the listener exists, so the test hangs until the timeout. The other trap is checking only that a download happened, not what is inside.

### Live task, 15 min: this suite creates tests inside `beforeEach`. It fails. Explain why and fix it.

Topic: pw-fixtures | Core | id: q1015

**Starter:** The broken file in step 1 of the full process. You explain, then fix it in place.

**Say:** Playwright reads the test file once, before any test runs, and builds the list of tests from the calls to `test()` at that moment. A `beforeEach` runs later, once per test, inside a worker, so a `test()` call there is too late and it throws "Playwright Test did not expect test() to be called here". The hook should do setup only. If I want several tests from a list of data, I loop at the file or `describe` level, and the loop creates the tests. If I want stages inside one test, I use `test.step`.

**In the slot:** the explanation matters more than the code. Say why it fails, then move the loop out of the hook. `test.step` is the follow-up, not part of the minimum.

```ts
import { test, expect } from '@playwright/test';
import { shopHtml } from './support/shop';

const products = ['Blue Mug', 'Red Cap'];

test.beforeEach(async ({ page }) => {
  await page.setContent(shopHtml);
});

for (const name of products) {
  test(`shows ${name}`, async ({ page }) => {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  });
}
```

**Full process:**
1. Brief as given: "Why does this fail?" The broken file:

```ts
import { test, expect } from '@playwright/test';

const products = ['Blue Mug', 'Red Cap'];

test.beforeEach(async ({ page }) => {
  await page.setContent('<h1>Shop</h1>');
  for (const name of products) {
    test(`shows ${name}`, async () => {
      expect(name).toBeTruthy();
    });
  }
});

test('first', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
});
```

2. Running it gives this, from the run on Playwright 1.64.1: the test `first` fails with `Error: Playwright Test did not expect test() to be called here.` The text lists the common reasons: calling `test()` in a config file, two versions of `@playwright/test`, or calling it from an async `describe`. The inner tests are never registered.
3. Fix one: move the loop out of the hook. The hook keeps only the setup, and the loop sits inside `describe`.
4. Fix two: when the stages belong to one scenario, keep one test and wrap each stage in `test.step`. Steps show in the report and the trace, but they are not separate tests.
5. This version runs: four tests pass.

```ts
import { test, expect } from '@playwright/test';
import { shopHtml } from './support/shop';

const products = ['Blue Mug', 'Red Cap', 'Green Bag'];

test.describe('Product cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(shopHtml);
  });

  for (const name of products) {
    test(`shows ${name} with an Add to cart button`, async ({ page }) => {
      const card = page
        .getByRole('article')
        .filter({ has: page.getByRole('heading', { name, exact: true }) });

      await expect(card.getByRole('button', { name: 'Add to cart', exact: true })).toBeVisible();
    });
  }
});

test('one test can group its stages with test.step', async ({ page }) => {
  await page.setContent(shopHtml);

  await test.step('add a product', async () => {
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Blue Mug', exact: true }) })
      .getByRole('button', { name: 'Add to cart', exact: true })
      .click();
  });

  await test.step('the counter shows it', async () => {
    await expect(page.getByRole('status')).toHaveText('Cart: 1 item');
  });
});
```

**Follow-ups:**
- *Can `describe` be async?* No. Tests must be registered synchronously. The same error text names it.
- *How do I generate tests from data read from a file?* Read the file synchronously at the top of the module (`readFileSync` and `JSON.parse`), then loop. An async read at that point cannot create tests.
- *When is a step better than a separate test?* When later stages depend on earlier ones and splitting would repeat expensive setup. Otherwise separate tests give better isolation and parallelism.

**Trap:** Believing a hook can "generate" tests at run time. A second trap is a `test.describe` callback marked `async`.

### Live task, 15 min: write a fixture with worker scope and explain when it runs.

Topic: pw-fixtures | Core | id: q1016

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{}, { runId: string }>({
  // your code here: a fixture runId, created once per worker
});

test('gets the shared run id', async ({ runId }) => {
  expect(runId).toMatch(/^run-\d+$/);
});
```

**Say:** A test-scoped fixture is created and torn down for every test. A worker-scoped fixture is created once for each worker process and shared by all tests that worker runs. I use worker scope for expensive things that tests do not change, such as a started server, a token, or a seeded database name. A worker fixture cannot depend on a test fixture like `page`, because the worker outlives the pages. Playwright rejects that when it loads the file.

**In the slot:** one worker fixture and one test, then explain out loud when it runs. The counters and the test fixture below are what you add if they ask you to prove it.

```ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{}, { runId: string }>({
  runId: [
    async ({}, use) => {
      await use(`run-${Date.now()}`);
    },
    { scope: 'worker' },
  ],
});

test('gets the shared run id', async ({ runId }) => {
  expect(runId).toMatch(/^run-\d+$/);
});
```

**Full process:**
1. Brief as given: "Create a fixture that is set up once per worker, and a per-test fixture that uses it."
2. Declare two types, one for test fixtures and one for worker fixtures, and pass both to `extend<TestFixtures, WorkerFixtures>`.
3. A worker fixture is a tuple: `[async ({}, use) => {...}, { scope: 'worker' }]`.
4. The test fixture `userName` depends on the worker fixture `runId`. That direction is allowed.
5. The counters show the behaviour. `test.describe.configure({ mode: 'serial' })` puts both tests in one worker, so they create one `runId` and two users, and the `afterAll` check asserts exactly that. Without it, parallel workers each create their own `runId`.
6. The wrong direction: a worker fixture that asks for `page`. Playwright stops with `worker fixture "sharedToken" cannot depend on a test fixture "page" defined in <builtin>.` The TypeScript compiler also reports that `page` does not exist on the worker fixture arguments.

```ts
import { test as base, expect } from '@playwright/test';

type TestFixtures = { userName: string };
type WorkerFixtures = { runId: string };

let runIdsCreated = 0;
let usersCreated = 0;

export const test = base.extend<TestFixtures, WorkerFixtures>({
  runId: [
    async ({}, use) => {
      runIdsCreated += 1;
      await use(`run-${runIdsCreated}`);
    },
    { scope: 'worker' },
  ],
  userName: async ({ runId }, use, testInfo) => {
    usersCreated += 1;
    await use(`${runId}-user-${testInfo.testId}`);
  },
});

test.describe.configure({ mode: 'serial' });

test('first test gets its own user, same run id', async ({ userName, runId }) => {
  expect(userName.startsWith(runId)).toBe(true);
});

test('second test gets another user, same run id', async ({ userName, runId }) => {
  expect(userName.startsWith(runId)).toBe(true);
});

test.afterAll(() => {
  expect({ runIdsCreated, usersCreated }).toEqual({ runIdsCreated: 1, usersCreated: 2 });
});
```

**Follow-ups:**
- *How many times does a worker fixture run with four workers?* Once per worker, so up to four, not once for the whole run. For once per run I use `globalSetup` or a project dependency.
- *Is a worker fixture safe for mutable state?* Only if tests do not change it. Tests in one worker run one after another, but tests in different workers do not share it, so it must not carry data that tests depend on.
- *What does `scope: 'worker'` do after a test fails?* Playwright restarts the worker after a failed test, so the worker fixtures are created again.

**Trap:** Putting a database reset in a worker fixture and expecting a clean database for each test. That needs test scope, or the data must be unique per test.

### Live task, 15 min: a page shows a spinner while a report loads. Write a test that does not break on slow loads.

Topic: pw-waits-assertions | Core | id: q1017

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import { test, expect } from '@playwright/test';
// reportHtml is the page from the full solution below.

test('waits for the report, not for the spinner', async ({ page }) => {
  await page.route('https://app.test/', (r) => r.fulfill({ contentType: 'text/html', body: reportHtml }));
  await page.route('https://app.test/api/report', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await r.fulfill({ json: ['Q1', 'Q2'] });
  });
  await page.goto('https://app.test/');

  // your code here
});
```

**Say:** I do not wait for the spinner. I wait for the thing the user wants, the report. A check that the spinner is hidden also passes when the spinner never showed, so it proves nothing alone. To see the loading state, I hold the API response behind a promise, assert that the spinner is visible and the table is hidden, then release the response and assert the rows. Playwright waits for `toBeVisible` and `toHaveText` on its own, so I add no sleep. At the end I assert the spinner is gone, as the second half of a pair, after it was seen.

**In the slot:** click, then assert the result. The web-first assertion waits through the slow response (2 s here), so no sleep. Holding the response behind a gate, to prove the spinner showed, is the extra. With `reportHtml` from below:

```ts
test('waits for the report, not for the spinner', async ({ page }) => {
  await page.route('https://app.test/', (r) => r.fulfill({ contentType: 'text/html', body: reportHtml }));
  await page.route('https://app.test/api/report', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await r.fulfill({ json: ['Q1', 'Q2'] });
  });
  await page.goto('https://app.test/');

  await page.getByRole('button', { name: 'Load report', exact: true }).click();

  await expect(page.getByRole('cell')).toHaveText(['Q1', 'Q2']);
});
```

**Full process:**
1. Brief as given: "Click Load report. A spinner shows, then a table. Test it so it passes on a slow network."
2. Serve the page at `https://app.test/` with `page.route`. For `/api/report` the handler awaits `gate`, then fulfils with two rows.
3. Click the button, and assert that the spinner is visible and the table is hidden. This proves the loading state was real, not skipped.
4. Call `release()`. Assert `toHaveText(['Q1', 'Q2'])` on the cells: that is the result.
5. Last, assert that the spinner is gone: `toHaveCount(0)` because this page removes it from the DOM. If the app only hides it with CSS, use `toBeHidden()`. In a locator wait, `waitFor({ state: 'detached' })` means removed from the DOM, and a spinner that never appeared already counts as detached.
6. Run: it passes in under half a second.

```ts
import { test, expect } from '@playwright/test';

const reportHtml = `<!doctype html>
<html lang="en"><body>
<button id="load">Load report</button>
<div id="spinner" role="progressbar" aria-label="Loading" hidden>Loading...</div>
<table id="report" aria-label="Report" hidden>
  <tbody></tbody>
</table>
<script>
  document.getElementById('load').onclick = async () => {
    document.getElementById('report').hidden = true;
    document.getElementById('spinner').hidden = false;
    const rows = await (await fetch('/api/report')).json();
    document.querySelector('tbody').innerHTML = rows.map((r) => '<tr><td>' + r + '</td></tr>').join('');
    document.getElementById('spinner').remove();
    document.getElementById('report').hidden = false;
  };
</script>
</body></html>`;

test('waits for the report, not for the spinner', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://app.test/', (r) => r.fulfill({ contentType: 'text/html', body: reportHtml }));
  await page.route('https://app.test/api/report', async (r) => {
    await gate;
    await r.fulfill({ json: ['Q1', 'Q2'] });
  });
  await page.goto('https://app.test/');

  await page.getByRole('button', { name: 'Load report', exact: true }).click();

  const spinner = page.getByRole('progressbar', { name: 'Loading', exact: true });
  await expect(spinner).toBeVisible();
  await expect(page.getByRole('table', { name: 'Report', exact: true })).toBeHidden();

  release();

  await expect(page.getByRole('cell')).toHaveText(['Q1', 'Q2']);
  await expect(spinner).toHaveCount(0);
});
```

**Follow-ups:**
- *What if the spinner appears after a delay?* Do not assert it unless the spinner is the subject. If it is the subject, control the response with the gate as above, so its timing is not random.
- *Why not `networkidle`?* Polling, analytics or websockets keep the network busy, and the wait then hangs or ends early. It also says nothing about what the user sees.
- *What does web-first mean?* The assertion retries until the condition is true or the timeout ends, unlike `expect(await locator.isVisible()).toBe(true)`, which reads once.

**Trap:** `await page.waitForTimeout(3000)` or `waitForLoadState('networkidle')`. Another one is `await expect(spinner).toBeHidden()` as the only check after the click: it can pass before the spinner appears, and the test then reads the old table.

### Live task, 20 min: on https://demo.playwright.dev/todomvc add todos, complete one and check the filters.

Topic: pw-general | Core | id: q1018

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import { test, expect } from '@playwright/test';

test('a completed todo shows under the Completed filter', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  // your code here
});
```

**Say:** This is the usual warm-up site, so keep it simple and clean. Add todos through the input with Enter, like a user, and assert the list text as an array so order and count are both checked. For the counter, use the visible text "2 items left". Find a todo row by its text with `filter`, and tick its checkbox by role and name. This is the one task here that needs the internet, so say so, and one would mock or self-host it in a real suite.

**In the slot:** one test that covers the brief. Helpers and the counter checks come after.

```ts
import { test, expect } from '@playwright/test';

test('a completed todo shows under the Completed filter', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  const input = page.getByPlaceholder('What needs to be done?', { exact: true });
  await input.fill('buy milk');
  await input.press('Enter');
  await input.fill('book a table');
  await input.press('Enter');

  await page.getByRole('listitem').filter({ hasText: 'buy milk' }).getByRole('checkbox', { name: 'Toggle Todo', exact: true }).check();
  await page.getByRole('link', { name: 'Completed', exact: true }).click();

  await expect(page.getByTestId('todo-title')).toHaveText(['buy milk']);
});
```

**Full process:**
1. Brief as given: "Open the TodoMVC demo. Add two items, complete one, check that the Completed filter shows it."
2. `beforeEach` opens `https://demo.playwright.dev/todomvc`. A fresh context has empty local storage, so every test starts with no todos.
3. A helper `addTodo` fills the input and presses Enter.
4. The titles are `data-testid="todo-title"` on a label in this demo. A label has no role, so this is the case where an existing test id is the right tool. One did not add one.
5. Run: both tests pass in about one second (run on 2026-11-06 with network).

```ts
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
});

async function addTodo(page: Page, text: string): Promise<void> {
  await page.getByPlaceholder('What needs to be done?', { exact: true }).fill(text);
  await page.getByPlaceholder('What needs to be done?', { exact: true }).press('Enter');
}

test('adds todos and shows the remaining count', async ({ page }) => {
  await addTodo(page, 'buy milk');
  await addTodo(page, 'book a table');

  await expect(page.getByTestId('todo-title')).toHaveText(['buy milk', 'book a table']);
  await expect(page.getByText('2 items left', { exact: true })).toBeVisible();
});

test('completing a todo updates the count and the Completed filter', async ({ page }) => {
  await addTodo(page, 'buy milk');
  await addTodo(page, 'book a table');

  await page.getByRole('listitem').filter({ hasText: 'buy milk' }).getByRole('checkbox', { name: 'Toggle Todo', exact: true }).check();

  await expect(page.getByText('1 item left', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Completed', exact: true }).click();
  await expect(page.getByTestId('todo-title')).toHaveText(['buy milk']);
});
```

**Follow-ups:**
- *What else would you test there?* Edit by double click, delete, Clear completed, the persistence after reload, the "Toggle all" checkbox, and an empty title (not added).
- *How do you avoid the dependency on the live site?* Run the app in a Docker container or save it in the repository and serve it with `webServer` in the config.
- *How do you check persistence?* `page.reload()` and assert the same list, because the app stores the todos in local storage.

**Trap:** Selecting with `.todo-list li:nth-child(1) input`. It breaks on any markup change and reads as noise in the report.

## Live coding: TypeScript and JavaScript

All of these files are standalone: save as `name.ts`, run `node name.ts` (Node 22.18 or later runs TypeScript by removing the types), and the asserts at the bottom print `ok` or throw. They need `"type": "module"` in `package.json`, and they compile with `npx tsc --noEmit` under `strict`. In the interview, write the function, then write three or four asserts out loud: empty input, one item, the normal case, and the nasty case. Interviewers at this level watch for the edge cases more than for the clever solution.

### Live task, 10 min: reverse a string. Then: what about emoji? Then: check for a palindrome.

Topic: js-core | Core | id: q1019

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function reverseString(input: string): string {
  // your code here
}

export function reverseGraphemes(input: string): string {
  // your code here
}

export function isPalindrome(input: string): boolean {
  // your code here
}

assert.equal(reverseString('abc'), 'cba');
assert.equal(isPalindrome('QA'), false);
// add your own edge cases
console.log('reverse: ok');
```

**Say:** The short answer is spread the string into an array, reverse it and join. I spread instead of using `split('')`, because spread walks code points, so an emoji made of two UTF-16 units is not cut in half. I say that even this is not perfect: a letter with a combining accent is two code points, and for that I would use `Intl.Segmenter` with grapheme granularity. For a palindrome I drop everything that is not a letter or digit, lower-case it, and compare from both ends, which needs no extra copy.

**Full process:**
1. Ask: "Only ASCII, or any text?" and "Should I change it in place?" Strings are immutable in JavaScript, so in place is not possible. Say that.
2. Write the function, then the asserts for empty string, one character and an emoji.
3. Complexity: O(n) time and O(n) space.

```ts
import assert from 'node:assert/strict';

export function reverseString(input: string): string {
  return [...input].reverse().join('');
}

export function reverseGraphemes(input: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmenter.segment(input), (part) => part.segment).reverse().join('');
}

export function isPalindrome(input: string): boolean {
  const letters = [...input.toLowerCase()].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
  for (let i = 0, j = letters.length - 1; i < j; i += 1, j -= 1) {
    if (letters[i] !== letters[j]) return false;
  }
  return true;
}

assert.equal(reverseString('abc'), 'cba');
assert.equal(reverseString(''), '');
assert.equal(reverseString('a'), 'a');
assert.equal(reverseString('x😀y'), 'y😀x');
assert.equal(reverseGraphemes('aéb'), 'bé'.normalize('NFD').length === 3 ? 'béa' : '');
assert.equal(isPalindrome('A man, a plan, a canal: Panama'), true);
assert.equal(isPalindrome('QA'), false);
console.log('reverse: ok');
```

**Follow-ups:**
- *Why not `split('').reverse().join('')`?* It works for plain text and breaks surrogate pairs, so `'x😀y'` gets a broken emoji in the middle.
- *What is the cost of the palindrome check?* O(n) time. The two-pointer loop uses no second array of the reversed text, but my filter step does build one array, so space is O(n).
- *How do you test a function like this?* Empty, one character, even and odd length, emoji, accents, whitespace and punctuation for the palindrome.

**Trap:** Saying "reverse in place" for a string in JavaScript, or a loop that concatenates one character at a time and calls it O(n) without a word about it. The other trap is not mentioning that characters and code units differ.

### Live task, 10 min: count the words in a text, and count how often each word appears.

Topic: js-core | Core | id: q1020

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function countWords(text: string): Map<string, number> {
  // your code here
}

export function totalWords(text: string): number {
  // your code here
}

const counts = countWords('The cat and the hat. THE end, café Café');
assert.equal(counts.get('the'), 3);
assert.equal(totalWords('  one   two\nthree  '), 3);
// add your own edge cases
console.log('wordcount: ok');
```

**Say:** There are two different questions, so I ask which one it is. The total is a split on whitespace after a trim, and I handle the empty string, because `''.split(/\s+/)` returns one empty item. For frequency I lower-case the text, take the words with a Unicode-aware regular expression, and count them in a `Map`. A `Map` is the right tool because keys like `constructor` or `__proto__` can break a plain object. I say what I decided about punctuation and case, and that it is a decision.

**Full process:**
1. Ask: "Is `The` the same as `the`? Is `don't` one word? What about `café`?" Then state the rule you pick.
2. Implement both functions. `\p{L}` with the `u` flag matches letters in any language, so `café` stays one word.
3. Asserts: repeated words with different case, an accent, whitespace-only text and the empty string.

```ts
import assert from 'node:assert/strict';

export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

export function totalWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

const counts = countWords('The cat and the hat. THE end, café Café');
assert.equal(counts.get('the'), 3);
assert.equal(counts.get('café'), 2);
assert.equal(counts.get('cat'), 1);
assert.equal(counts.size, 6);
assert.equal(totalWords('  one   two\nthree  '), 3);
assert.equal(totalWords('   '), 0);
assert.equal(totalWords(''), 0);
console.log('wordcount: ok');
```

**Follow-ups:**
- *How do you get the top three words?* `[...counts].sort((a, b) => b[1] - a[1]).slice(0, 3)`. For equal counts I add a tie-break, for example alphabetical, so the result is stable.
- *Why `Map` and not an object?* No inherited keys, keys of any type, and the insertion order is kept.
- *What is the complexity?* O(n) to count. Sorting adds O(k log k) for k distinct words.

**Trap:** `text.split(' ').length`. It counts the empty pieces between double spaces and gives 1 for an empty string.

### Live task, 10 min: remove duplicates from an array. Then: from an array of objects by a key.

Topic: js-core | Core | id: q1021

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function dedupe<T>(items: readonly T[]): T[] {
  // your code here
}

export function dedupeBy<T, K>(items: readonly T[], keyOf: (item: T) => K): T[] {
  // your code here
}

assert.deepEqual(dedupe([3, 1, 3, 2, 1]), [3, 1, 2]);
const users = [
  { id: 1, name: 'Ann' },
  { id: 2, name: 'Bob' },
  { id: 1, name: 'Ann (duplicate)' },
];
assert.deepEqual(dedupeBy(users, (u) => u.id), [
  { id: 1, name: 'Ann' },
  { id: 2, name: 'Bob' },
]);
// add your own edge cases
console.log('dedupe: ok');
```

**Say:** For primitives I make a `Set` and spread it back, which keeps the first occurrence and the original order. For objects, a `Set` compares by reference, so two equal-looking objects both stay. Then I need a key function: I walk the items and keep the first item for each key, using a `Set` of keys. I make the function generic, so the key type and the item type are checked. It is O(n) time.

**Full process:**
1. Clarify: "Keep the first or the last? Does order matter?" Say you keep the first and keep the order.
2. `dedupe` with `Set`. Note that `Set` treats `NaN` as equal to `NaN`, and `+0` and `-0` as equal.
3. `dedupeBy(items, keyOf)` for objects.
4. Asserts: empty array, order kept, reference equality for objects.

```ts
import assert from 'node:assert/strict';

export function dedupe<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

export function dedupeBy<T, K>(items: readonly T[], keyOf: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

assert.deepEqual(dedupe([3, 1, 3, 2, 1]), [3, 1, 2]);
assert.deepEqual(dedupe([]), []);
assert.deepEqual(dedupe([NaN, NaN]).length, 1);
const users = [
  { id: 1, name: 'Ann' },
  { id: 2, name: 'Bob' },
  { id: 1, name: 'Ann (duplicate)' },
];
assert.deepEqual(dedupeBy(users, (u) => u.id), [
  { id: 1, name: 'Ann' },
  { id: 2, name: 'Bob' },
]);
assert.equal(dedupe([{ a: 1 }, { a: 1 }]).length, 2);
console.log('dedupe: ok');
```

**Follow-ups:**
- *What is the naive way and why is it worse?* `filter((x, i) => arr.indexOf(x) === i)` is O(n squared).
- *How do you dedupe objects that are equal by value?* Make a key, such as `JSON.stringify` for simple data with a fixed key order, or pick the fields. For general data I would use the deep equality function from this file's later task, and accept O(n squared).
- *How do you keep the last occurrence?* Go from the end, or use a `Map` keyed by the key and take its values: the later set wins, but the position is the first one.

**Trap:** Using `Set` on objects and expecting value comparison.

### Live task, 10 min: flatten a nested array of any depth.

Topic: js-core | Core | id: q1022

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export type Nested<T> = T | Nested<T>[];

export function flatten<T>(input: Nested<T>[], depth = Infinity): T[] {
  // your code here
}

assert.deepEqual(flatten<number>([1, [2, [3, [4]], 5]]), [1, 2, 3, 4, 5]);
assert.deepEqual(flatten<number>([1, [2, [3, [4]], 5]], 1), [1, 2, [3, [4]], 5]);
// add your own edge cases
console.log('flatten: ok');
```

**Say:** The built-in answer is `arr.flat(Infinity)`, and I say it first. If I have to write it, I do it recursively: for each item, if it is an array I flatten it and add the items, otherwise I add the item. I give the function a depth argument, because that is what `flat` has and it is a nice edge to show. For the types I use a recursive type, `Nested<T> = T | Nested<T>[]`, so the result is a flat `T[]`. I mention that a very deep input can overflow the call stack, and an explicit stack avoids that.

**Full process:**
1. Say the built-in, then write the recursive version.
2. Use `push(...recursiveResult)` carefully: spreading a huge array into `push` can hit the argument limit. For test-size data it is fine, and I say so.
3. Asserts: normal, depth 1, empty, nested empties.

```ts
import assert from 'node:assert/strict';

export type Nested<T> = T | Nested<T>[];

export function flatten<T>(input: Nested<T>[], depth = Infinity): T[] {
  const result: T[] = [];
  for (const item of input) {
    if (Array.isArray(item) && depth > 0) {
      result.push(...flatten(item as Nested<T>[], depth - 1));
    } else {
      result.push(item as T);
    }
  }
  return result;
}

assert.deepEqual(flatten<number>([1, [2, [3, [4]], 5]]), [1, 2, 3, 4, 5]);
assert.deepEqual(flatten<number>([1, [2, [3, [4]], 5]], 1), [1, 2, [3, [4]], 5]);
assert.deepEqual(flatten<number>([]), []);
assert.deepEqual(flatten<number>([[], [[]]]), []);
assert.deepEqual(flatten<string>(['a', ['b']]), ['a', 'b']);
console.log('flatten: ok');
```

**Follow-ups:**
- *How do you do it without recursion?* A stack: push the array, pop an item, if it is an array push its items back in reverse, else put it in the result.
- *What does `flat()` do with holes?* It removes empty slots in sparse arrays.
- *What about objects that contain arrays?* The task changes: it needs a path walk. I ask what the output should be.

**Trap:** `[].concat(...arr)`, which flattens exactly one level, presented as the full answer.

### Live task, 10 min: group an array of test results by status.

Topic: js-core | Core | id: q1023

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Partial<Record<K, T[]>> {
  // your code here
}

type Result = { test: string; status: 'passed' | 'failed' | 'skipped' };

const results: Result[] = [
  { test: 'login', status: 'passed' },
  { test: 'cart', status: 'failed' },
  { test: 'search', status: 'passed' },
];

const byStatus = groupBy(results, (r) => r.status);
assert.deepEqual(byStatus.passed?.map((r) => r.test), ['login', 'search']);
assert.deepEqual(byStatus.failed?.map((r) => r.test), ['cart']);
// add your own edge cases
console.log('groupby: ok');
```

**Say:** I loop once and push each item into the bucket for its key. The key comes from a function, so the same code groups by status, by suite or by anything else. I type it as a generic with `K extends PropertyKey`, so the key must be a string, number or symbol, and the result is `Partial<Record<K, T[]>>`, because a key that never occurred does not exist. The one-line modern way is `Object.groupBy`, available in current Node, and I mention `Map.groupBy` for keys that are not strings.

**Full process:**
1. Write the loop with `groups[key] ??= []` and then `push`.
2. Show the use on a list of results grouped by `status`, a union type.
3. Asserts: normal, a status that does not occur is `undefined`, the empty input.
4. Show `Object.groupBy` giving the same result. It needs `lib: es2024` in the compiler options.

```ts
import assert from 'node:assert/strict';

export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {};
  for (const item of items) {
    const key = keyOf(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}

type Result = { test: string; status: 'passed' | 'failed' | 'skipped' };

const results: Result[] = [
  { test: 'login', status: 'passed' },
  { test: 'cart', status: 'failed' },
  { test: 'search', status: 'passed' },
];

const byStatus = groupBy(results, (r) => r.status);
assert.deepEqual(byStatus.passed?.map((r) => r.test), ['login', 'search']);
assert.deepEqual(byStatus.failed?.map((r) => r.test), ['cart']);
assert.equal(byStatus.skipped, undefined);
assert.deepEqual(groupBy([], (x: number) => x), {});

const native = Object.groupBy(results, (r) => r.status);
assert.deepEqual(native.passed?.length, 2);
console.log('groupby: ok');
```

**Follow-ups:**
- *Why `Partial`?* Because `groups.skipped` may not exist. Without `Partial` the type claims every key exists and hides the bug.
- *When do you use `Map.groupBy`?* When keys are objects or you need to keep the insertion order for the groups.
- *How do you count per group instead of listing?* Use `reduce` or a `Map` of counts. The same key function applies.

**Trap:** `reduce` with a spread of the accumulator in each step, `{...acc, [k]: [...]}`. It copies the object each time and makes the algorithm O(n squared).

### Live task, 5 min: FizzBuzz.

Topic: js-core | Standard | id: q1024

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function fizzBuzz(n: number): string[] {
  // your code here
}

assert.deepEqual(fizzBuzz(15), [
  '1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz',
]);
console.log('fizzbuzz: ok');
```

**Say:** I check 15 first, because a number that divides by 15 divides by both 3 and 5 and I would otherwise print only Fizz. I return an array of strings instead of printing, so I can assert on it. Then I add the checks for 15 and for zero. It is a warm-up, so I do it calmly and I keep the code tidy.

**Full process:**
1. Return `string[]` for a given `n`.
2. Order of the branches: 15, then 3, then 5, then the number.
3. Asserts: the first 15 values, `n = 0`, and the 30th value.

```ts
import assert from 'node:assert/strict';

export function fizzBuzz(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i += 1) {
    if (i % 15 === 0) out.push('FizzBuzz');
    else if (i % 3 === 0) out.push('Fizz');
    else if (i % 5 === 0) out.push('Buzz');
    else out.push(String(i));
  }
  return out;
}

assert.deepEqual(fizzBuzz(15), [
  '1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz',
]);
assert.deepEqual(fizzBuzz(0), []);
assert.equal(fizzBuzz(30)[29], 'FizzBuzz');
console.log('fizzbuzz: ok');
```

**Follow-ups:**
- *How would you make the rules configurable?* An array of `[divisor, word]` pairs. For each number, join the words of the divisors that fit, or use the number if none did.
- *What would you test?* The boundaries: 1, 3, 5, 15, 0 and a negative number, if the spec allows it.
- *How is it related to testing?* It is a small decision table, which is a test design technique.

**Trap:** Testing 3 and 5 before 15, which prints "Fizz" for 15.

### Live task, 10 min: check if two strings are anagrams.

Topic: js-core | Standard | id: q1025

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function isAnagram(a: string, b: string): boolean {
  // your code here
}

assert.equal(isAnagram('listen', 'silent'), true);
assert.equal(isAnagram('abc', 'abd'), false);
// add your own edge cases
console.log('anagram: ok');
```

**Say:** I ask whether case, spaces and punctuation count. I decide that only letters and digits count, case does not, and accents are ignored by normalising to NFD. The fast way counts characters in a `Map`: add for the first string, subtract for the second, and fail if anything goes below zero. That is O(n), against O(n log n) for sorting both strings. I add a length check first, as a quick exit.

**Full process:**
1. Write `normalise`, which lower-cases and removes non-letters.
2. Count the first string, then walk the second and decrement. Return false when a count is missing or zero.
3. Because the lengths are equal after normalising, no leftovers are possible, so no final check is needed. I say why.
4. Asserts: classic pair, phrase with spaces, one letter different, same letters with different counts, empty strings.

```ts
import assert from 'node:assert/strict';

const normalise = (text: string): string[] =>
  [...text.normalize('NFD').toLowerCase()].filter((ch) => /[\p{L}\p{N}]/u.test(ch));

export function isAnagram(a: string, b: string): boolean {
  const left = normalise(a);
  const right = normalise(b);
  if (left.length !== right.length) return false;
  const counts = new Map<string, number>();
  for (const ch of left) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const ch of right) {
    const remaining = counts.get(ch);
    if (!remaining) return false;
    counts.set(ch, remaining - 1);
  }
  return true;
}

assert.equal(isAnagram('listen', 'silent'), true);
assert.equal(isAnagram('Dormitory', 'dirty room'), true);
assert.equal(isAnagram('abc', 'abd'), false);
assert.equal(isAnagram('aab', 'abb'), false);
assert.equal(isAnagram('', ''), true);
assert.equal(isAnagram('a', 'aa'), false);
console.log('anagram: ok');
```

**Follow-ups:**
- *What about the sorting version?* `[...a].sort().join('') === [...b].sort().join('')`. It is shorter and fine for small input. I name its complexity.
- *Unicode?* NFD splits an accented letter into a letter and a combining mark. My filter keeps only letters and digits, and the combining marks are dropped, so `é` equals `e`. I say that this is a decision.
- *How do you group a list of words into anagram sets?* Use the sorted letters as the key in a `Map` and push the words.

**Trap:** Comparing only the sets of characters. `aab` and `abb` have the same set and are not anagrams.

### Live task, 10 min: find the first non-repeating character in a string.

Topic: js-core | Standard | id: q1026

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function firstNonRepeating(text: string): string | undefined {
  // your code here
}

assert.equal(firstNonRepeating('swiss'), 'w');
assert.equal(firstNonRepeating('aabbcc'), undefined);
// add your own edge cases
console.log('first-unique: ok');
```

**Say:** Two passes. First I count each character in a `Map`. Then I walk the string again in the original order and return the first character with a count of one. The second pass over the string, and not over the map, is the key point, because I need the order of the input. It is O(n) time and O(k) space for k distinct characters. If there is none I return `undefined`, and I say that the type tells the caller.

**Full process:**
1. Spread the string into an array once, so the two passes see the same code points.
2. Count, then `find` over the array.
3. Asserts: `swiss` gives `w`, all repeating gives `undefined`, empty string, case sensitivity.

```ts
import assert from 'node:assert/strict';

export function firstNonRepeating(text: string): string | undefined {
  const counts = new Map<string, number>();
  const chars = [...text];
  for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return chars.find((ch) => counts.get(ch) === 1);
}

assert.equal(firstNonRepeating('swiss'), 'w');
assert.equal(firstNonRepeating('aabbcc'), undefined);
assert.equal(firstNonRepeating(''), undefined);
assert.equal(firstNonRepeating('aabbc'), 'c');
assert.equal(firstNonRepeating('Aa'), 'A');
console.log('first-unique: ok');
```

**Follow-ups:**
- *What if the input is a stream?* Keep the counts and a queue of candidates in arrival order. Drop from the front of the queue while its count is above one.
- *Is it case sensitive?* In my version yes: `A` and `a` differ. I would ask the interviewer.
- *Why not `indexOf` and `lastIndexOf` in a loop?* It works and is O(n squared). It is a good first answer, and the `Map` is the improvement.

**Trap:** Deciding on a character before the whole string is counted, which gives a wrong answer for input like `aab`. The count must be complete before the search starts.

### Live task, 15 min: write a function that polls until a condition is true or a timeout ends.

Topic: js-core | Standard | id: q1027

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export type PollOptions = { timeoutMs: number; intervalMs: number };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollUntil<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  { timeoutMs, intervalMs }: PollOptions,
): Promise<T> {
  // your code here
}

async function main(): Promise<void> {
  let calls = 0;
  const status = async (): Promise<string> => {
    calls += 1;
    return calls >= 3 ? 'done' : 'pending';
  };
  assert.equal(await pollUntil(status, (s) => s === 'done', { timeoutMs: 500, intervalMs: 10 }), 'done');
  assert.equal(calls, 3);

  await assert.rejects(
    pollUntil(async () => 'pending', (s) => s === 'done', { timeoutMs: 50, intervalMs: 10 }),
    /timed out after 50 ms, last value: "pending"/,
  );
  console.log('poll: ok');
}

void main();
```

**Say:** Take a `read` function, a predicate, and the timeout and interval. Loop: read, check, and if not done and there is time left, sleep for the interval. When time runs out, throw an error that includes the last value seen, because "timed out" alone is useless in a CI log. Compute a deadline once from the start time, so slow reads do not stretch the total. In a Playwright test, one would use `expect.poll` and not a custom helper, and say that.

**Full process:**
1. Compute `deadline = Date.now() + timeoutMs`.
2. Loop: `await read()`, return if `isDone`, throw if the next sleep would pass the deadline, sleep otherwise.
3. Generic over the value type, so `pollUntil(getStatus, s => s === 'done', ...)` returns a `string`.
4. Asserts: becomes done on the third call, and a timeout whose message contains the last value.

```ts
import assert from 'node:assert/strict';

export type PollOptions = { timeoutMs: number; intervalMs: number };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollUntil<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  { timeoutMs, intervalMs }: PollOptions,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  for (;;) {
    last = await read();
    if (isDone(last)) return last;
    if (Date.now() + intervalMs > deadline) {
      throw new Error(`pollUntil timed out after ${timeoutMs} ms, last value: ${JSON.stringify(last)}`);
    }
    await sleep(intervalMs);
  }
}

async function main(): Promise<void> {
  let calls = 0;
  const status = async (): Promise<string> => {
    calls += 1;
    return calls >= 3 ? 'done' : 'pending';
  };
  assert.equal(await pollUntil(status, (s) => s === 'done', { timeoutMs: 500, intervalMs: 10 }), 'done');
  assert.equal(calls, 3);

  await assert.rejects(
    pollUntil(async () => 'pending', (s) => s === 'done', { timeoutMs: 50, intervalMs: 10 }),
    /timed out after 50 ms, last value: "pending"/,
  );
  console.log('poll: ok');
}

void main();
```

**Follow-ups:**
- *What is the Playwright version?* `await expect.poll(() => getStatus(), { intervals: [100, 250, 500], timeout: 10_000 }).toBe('done')`. It retries the function and the assertion until it passes or the timeout ends.
- *Why not `setInterval`?* It starts the next call even when the previous read is still running. A loop with `await` and a sleep never overlaps.
- *Linear or growing interval?* Growing intervals (backoff) put less load on a slow system. Short at first and then slower is the usual choice.

**Trap:** A loop with no deadline, or a `while (true)` that waits forever when the condition never comes true.

### Live task, 15 min: implement `debounce` with a `cancel` method.

Topic: js-core | Standard | id: q1028

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';
import { mock } from 'node:test';

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void } {
  // your code here
}

mock.timers.enable({ apis: ['setTimeout'] });

const calls: string[] = [];
const search = debounce((q: string) => calls.push(q), 300);

search('p');
mock.timers.tick(200);
search('pl');
mock.timers.tick(200);
search('play');
assert.deepEqual(calls, []);
mock.timers.tick(299);
assert.deepEqual(calls, []);
mock.timers.tick(1);
assert.deepEqual(calls, ['play']);

search('again');
search.cancel();
mock.timers.tick(1000);
assert.deepEqual(calls, ['play']);

mock.timers.reset();
console.log('debounce: ok');
```

**Say:** Debounce delays a call until a quiet period passed. Each new call clears the previous timer and starts a new one, and only the last call's arguments run. I type it generically with `A extends unknown[]`, so the debounced function accepts the same arguments as the original. I add `cancel` for cleanup, for example when a component goes away. To test it without waiting I use fake timers from `node:test`, and I tick 299 ms and then 1 ms to prove the boundary.

**Full process:**
1. Keep one `timer` in the closure. On each call `clearTimeout(timer)` and set a new one.
2. Return the function with a `cancel` property. The `&` type adds `cancel` to the function type.
3. Test with `mock.timers.enable({ apis: ['setTimeout'] })`. Call three times, tick 299 ms with no call, then 1 ms and exactly one call with the last argument. Then cancel and check nothing runs.
4. Reset the mock at the end.

```ts
import assert from 'node:assert/strict';
import { mock } from 'node:test';

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };
  debounced.cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}

mock.timers.enable({ apis: ['setTimeout'] });

const calls: string[] = [];
const search = debounce((q: string) => calls.push(q), 300);

search('p');
mock.timers.tick(200);
search('pl');
mock.timers.tick(200);
search('play');
assert.deepEqual(calls, []);
mock.timers.tick(299);
assert.deepEqual(calls, []);
mock.timers.tick(1);
assert.deepEqual(calls, ['play']);

search('again');
search.cancel();
mock.timers.tick(1000);
assert.deepEqual(calls, ['play']);

mock.timers.reset();
console.log('debounce: ok');
```

**Follow-ups:**
- *Debounce versus throttle?* Debounce runs after the calls stop. Throttle runs at most once per interval while calls keep coming.
- *Leading edge?* Some libraries can call at the first call and ignore the rest. It is an option flag. I would add it only when asked.
- *How do you test a debounced search in the browser?* With `page.clock`: install it, type, run 299 ms and assert no request, run 1 ms and assert one request.

**Trap:** Forgetting `clearTimeout`, which makes every call fire. Also keeping the arguments of the first call and not the last.

### Live task, 20 min: write a deep equality function.

Topic: js-core | Standard | id: q1029

**Starter:** What an interview tool such as CoderPad usually shows when the task opens. Type only where it says `// your code here`.

```ts
import assert from 'node:assert/strict';

export function deepEqual(a: unknown, b: unknown): boolean {
  // your code here
}

assert.equal(deepEqual(1, 1), true);
assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
// add your own edge cases
console.log('deepequal: ok');
```

**Say:** I start with `Object.is`, which handles equal primitives and `NaN`. Then anything that is not an object is unequal, because it already failed `Object.is`. For objects I check the prototype, so an array does not equal a plain object. I handle dates by time value, arrays by length and each item, and objects by key count and each key, using `Object.hasOwn`, so `{a: 1}` does not equal `{a: 1, b: undefined}`. I say what I leave out: `Map`, `Set`, functions, and circular references, and how I would add them.

**Full process:**
1. `Object.is(a, b)` first. `NaN` equals `NaN` there, and `+0` differs from `-0`. Say that is a choice.
2. Reject non-objects and `null`. Compare prototypes.
3. Date, array, then plain object branches. Recurse with `deepEqual`.
4. Asserts: nested equal, key order does not matter, extra key with `undefined` is not equal, array against object, `NaN`, `null`, dates.

```ts
import assert from 'node:assert/strict';

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
}

assert.equal(deepEqual(1, 1), true);
assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
assert.equal(deepEqual({ a: undefined }, { b: undefined }), false);
assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
assert.equal(deepEqual([], {}), false);
assert.equal(deepEqual(NaN, NaN), true);
assert.equal(deepEqual(null, {}), false);
assert.equal(deepEqual(new Date(5), new Date(5)), true);
assert.equal(deepEqual(new Date(5), new Date(6)), false);
console.log('deepequal: ok');
```

**Follow-ups:**
- *Circular references?* Keep a `WeakMap` of pairs already being compared, and treat a repeated pair as equal.
- *How is this different from `JSON.stringify(a) === JSON.stringify(b)`?* Key order changes the string, `undefined` and functions vanish, and dates become strings. It is a shortcut for simple data only.
- *Which assertion does Playwright use?* `toEqual` ignores `undefined` properties and `toStrictEqual` does not. Knowing which one the test needs is the point.

**Trap:** Comparing with `==` or `JSON.stringify` and presenting that as deep equality.

## Live coding: SQL at a whiteboard

All five tasks use the same two tables. Say the schema out loud before writing anything, and ask about keys and nulls. The queries were run on SQLite 3.54 with this data. SQLite has window functions, so the logic is the same as in PostgreSQL and MySQL 8, but they were not run on PostgreSQL or MySQL here. The date functions are the main difference between engines, and each task names what to change. State that one would check the plan with `EXPLAIN` on a real database.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO customers (id, name, email, country) VALUES
  (1, 'Ann', 'ann@example.com', 'PL'),
  (2, 'Bob', 'bob@example.com', 'DE'),
  (3, 'Cleo', 'cleo@example.com', 'PL'),
  (4, 'Dan', 'ann@example.com', 'PL'),
  (5, 'Eve', 'eve@example.com', 'FR');
INSERT INTO orders (id, customer_id, status, total, created_at) VALUES
  (1, 1, 'paid',      100, '2026-09-03'),
  (2, 1, 'paid',      250, '2026-10-05'),
  (3, 1, 'cancelled',  80, '2026-10-20'),
  (4, 2, 'paid',       40, '2026-10-02'),
  (5, 2, 'new',        60, '2026-11-01'),
  (6, 3, 'shipped',   300, '2026-10-15'),
  (7, 3, 'paid',      300, '2026-11-02'),
  (8, 3, 'paid',       20, '2026-11-03');
```

Data facts that matter: customer 4 (Dan) and customer 1 (Ann) share an email, customer 4 and 5 have no orders, customer 3 has two orders with the same total of 300, and order 3 is cancelled.

### Whiteboard task, 10 min: list customers who have never placed an order.

Topic: sql-core | Core | id: q1030

**Starter:** The two tables the interviewer shows. Write your query under them.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

-- your query here
```

**Say:** Use a `LEFT JOIN` from customers to orders and keep the rows where the order side is `NULL`, which are the customers with no match. The equivalent is `NOT EXISTS` with a correlated subquery, and one would pick it when the intent needs to read clearly. Avoid `NOT IN (SELECT customer_id ...)`, because one `NULL` in the subquery makes the whole condition return nothing. Then run the result on the sample data: Dan and Eve.

**Full process:**
1. Ask: "Does a cancelled order count as an order?" Here yes. If not, the status filter belongs in the `ON` clause of the join, not in `WHERE`, or the left join turns into an inner join.
2. Version one, `LEFT JOIN`:

```sql answer
SELECT c.id, c.name
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id
WHERE o.id IS NULL
ORDER BY c.id;
```

3. Version two, `NOT EXISTS`. Same result, and it stops at the first matching order for each customer:

```sql
SELECT c.id, c.name
FROM customers AS c
WHERE NOT EXISTS (SELECT 1 FROM orders AS o WHERE o.customer_id = c.id)
ORDER BY c.id;
```

4. Result for both: customers 4 (Dan) and 5 (Eve).
5. The `NOT IN` trap, checked: `SELECT 1 WHERE 5 NOT IN (1, NULL)` returns zero rows, because `5 <> NULL` is unknown, not true.

**Follow-ups:**
- *Which one is faster?* Modern planners in PostgreSQL and MySQL 8 turn `NOT EXISTS` and the `LEFT JOIN ... IS NULL` form into the same anti-join. I would look at `EXPLAIN` and not guess.
- *How do you test this query?* A customer with no orders, one with one, one with many, and a `NULL` foreign key case if the column allows it.
- *What index helps?* An index on `orders.customer_id`. Most databases do not create one for a foreign key automatically (MySQL InnoDB does, PostgreSQL does not).

**Trap:** `NOT IN` with a nullable column, and filtering the joined table in `WHERE`, which silently drops the customers you wanted.

### Whiteboard task, 15 min: for each customer, return their latest order.

Topic: sql-core | Core | id: q1031

**Starter:** The two tables the interviewer shows. Write your query under them.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

-- your query here
```

**Say:** This is the "top one per group" pattern. I number each customer's orders from newest to oldest with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC, id DESC)` and keep row number one. I add `id` as a tie-break, because two orders can share a date, and without it the result is not deterministic. A window function cannot be filtered in the same `WHERE`, so I wrap it in a subquery. The older approach is a join to `MAX(created_at)`, which returns two rows on a tie.

**Full process:**
1. Clarify "latest": by date, with ties broken by id. Say the rule.
2. The query:

```sql answer
SELECT customer_id, id AS order_id, total, created_at
FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC, id DESC) AS rn
  FROM orders AS o
) AS ranked
WHERE rn = 1
ORDER BY customer_id;
```

3. Result on the sample data: customer 1 gets order 3 (2026-10-20, the cancelled one, so I ask if cancelled counts), customer 2 gets order 5, customer 3 gets order 8. Customers 4 and 5 are absent because they have no orders. Use a `LEFT JOIN` from customers if they must appear with `NULL`.
4. PostgreSQL has `DISTINCT ON (customer_id) ... ORDER BY customer_id, created_at DESC`. MySQL needs the window function (version 8 and later) or a join.

**Follow-ups:**
- *`ROW_NUMBER`, `RANK` or `DENSE_RANK`?* `ROW_NUMBER` gives exactly one row. `RANK` returns all tied rows with number one. For "latest" I want one row, so `ROW_NUMBER` with a tie-break.
- *How do you get the top 3 orders per customer?* Change `rn = 1` to `rn <= 3`.
- *What if the table has 100 million rows?* An index on `(customer_id, created_at DESC)` lets the engine read only the newest rows per customer.

**Trap:** `GROUP BY customer_id` with `MAX(created_at)` and then selecting other columns. Other columns come from an unspecified row, or the query is rejected, depending on the engine and its settings.

### Whiteboard task, 15 min: find duplicate emails, then delete the duplicates and keep the oldest row.

Topic: sql-core | Core | id: q1032

**Starter:** The two tables the interviewer shows. Write your query under them.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

-- your query here
```

**Say:** To find them, group by email and keep the groups with a count above one. To delete them, keep the row with the smallest id of each group and delete all others. Run the select first, with the same condition, to see what would go. State that a delete is destructive, so run it in a transaction on a copy first. And state that the real fix is a unique constraint on the column, so the duplicates cannot come back.

**Full process:**
1. Find them:

```sql
SELECT email, COUNT(*) AS copies
FROM customers
GROUP BY email
HAVING COUNT(*) > 1;
```

2. Result: `ann@example.com` appears 2 times (customers 1 and 4).
3. Delete and show what is left. Customers 1, 2, 3 and 5 stay, customer 4 goes:

```sql answer
DELETE FROM customers
WHERE id NOT IN (
  SELECT MIN(id) FROM customers GROUP BY email
);
SELECT id, name, email FROM customers ORDER BY id;
```

4. In MySQL, deleting from a table while selecting from the same table in a subquery fails with error 1093. The workaround is to wrap the subquery in a derived table, or to use a multi-table `DELETE` with a self-join. PostgreSQL accepts the SQLite form above, and also `DELETE ... USING` or a `ctid`-based form.
5. Then add the constraint: `ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email)`. Note that `orders` of the deleted customer must be moved first, or the foreign key blocks the delete.

**Follow-ups:**
- *What about the orders of customer 4?* They reference a customer I am deleting. I would first move them to customer 1 with an `UPDATE`, in the same transaction, or the foreign key rejects the delete.
- *Case differences like `Ann@Example.com`?* Group by `LOWER(email)`. A unique index on `LOWER(email)` works in PostgreSQL. In MySQL the default collation is already case-insensitive.
- *How is this different from `DELETE` versus `TRUNCATE`?* `DELETE` removes the rows you choose with `WHERE`. `TRUNCATE` empties the whole table fast, and a foreign key that points at the table blocks it (PostgreSQL allows it with `CASCADE`). PostgreSQL can roll a `TRUNCATE` back inside a transaction, while MySQL commits it at once.

**Trap:** Running the delete without a `WHERE`-checked select first, and keeping `MAX(id)` when the business wants the oldest.

### Whiteboard task, 15 min: revenue per month for the last months, only paid or shipped orders, only months with at least 300 revenue.

Topic: sql-core | Core | id: q1033

**Starter:** The two tables the interviewer shows. Write your query under them.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

-- your query here
```

**Say:** I filter rows with `WHERE`: status and date. I group by month and aggregate with `COUNT` and `SUM`. Then I filter the groups with `HAVING`, because the sum does not exist yet at `WHERE` time. That difference is the main point. In SQLite I get the month with `strftime('%Y-%m', created_at)`. In PostgreSQL I use `date_trunc('month', created_at)`, in MySQL `DATE_FORMAT(created_at, '%Y-%m')`. The result: October 590 with 3 orders and November 320 with 2 orders. September is dropped by `HAVING`, because its only counted order is 100.

**Full process:**
1. Clarify: which statuses count, which time zone the dates are in, and whether months with no sales must appear with zero (that needs a calendar table and a `LEFT JOIN`).
2. The query:

```sql answer ordered
SELECT strftime('%Y-%m', created_at) AS month,
       COUNT(*) AS paid_orders,
       SUM(total) AS revenue
FROM orders
WHERE status IN ('paid', 'shipped')
  AND created_at >= '2026-09-01'
GROUP BY strftime('%Y-%m', created_at)
HAVING SUM(total) >= 300
ORDER BY month;
```

3. Check by hand: October paid or shipped orders are 250 (order 2), 40 (order 4) and 300 (order 6), which is 590. The cancelled order 3 is excluded. November is 300 (order 7) plus 20 (order 8), which is 320. Order 5 is `new`, so it is excluded.
4. Say the evaluation order: `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`.

**Follow-ups:**
- *Why not use the alias `month` in `GROUP BY`?* PostgreSQL and MySQL allow it, SQLite allows it, but the standard does not. Repeating the expression is the portable form.
- *`WHERE` or `HAVING` for the status filter?* `WHERE`. It removes rows before grouping, so it is cheaper and clear.
- *What about the timestamps with time zones?* The month boundary depends on the zone. Convert to the business zone before truncating.

**Trap:** Putting `SUM(total) >= 300` in `WHERE`, which is an error, and counting cancelled orders into revenue.

### Whiteboard task, 15 min: per customer, show a running total of their orders and the change from the previous order, ignoring cancelled orders.

Topic: sql-core | Core | id: q1034

**Starter:** The two tables the interviewer shows. Write your query under them.

```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL CHECK (status IN ('new', 'paid', 'shipped', 'cancelled')),
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL
);

-- your query here
```

**Say:** Window functions let me keep the rows and add a calculation next to each. `SUM(total) OVER (PARTITION BY customer_id ORDER BY created_at, id)` is the running total, because with an `ORDER BY` the default frame runs from the first row of the partition up to the current row. `LAG(total)` reads the previous row in the same order, and the difference is the change. The first order of each customer has no previous row, so `LAG` returns `NULL`. I filter the cancelled orders in `WHERE`, before the windows are computed. For equal dates the `id` tie-break keeps the order stable.

**Full process:**
1. Choose the partition (per customer) and the order (date, then id).
2. The query:

```sql answer ordered
SELECT customer_id, id AS order_id, created_at, total,
       SUM(total) OVER (PARTITION BY customer_id ORDER BY created_at, id) AS running_total,
       total - LAG(total) OVER (PARTITION BY customer_id ORDER BY created_at, id) AS change_from_previous
FROM orders
WHERE status <> 'cancelled'
ORDER BY customer_id, created_at, id;
```

3. Result for customer 3: 300, then 600 (change 0 because both are 300), then 620 (change -280). Customer 1 skips the cancelled order 3, so it ends at 350.
4. Name the default frame: with `ORDER BY` it is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which treats rows with an equal ordering value as peers. Because `id` was added, there are no peers. One could write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` to be explicit.
5. Bonus, customers with at least two paid or shipped orders and what they spent, to show `HAVING` with a join:

```sql
SELECT c.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id AND o.status IN ('paid', 'shipped')
GROUP BY c.id, c.name
HAVING COUNT(o.id) >= 2
ORDER BY spent DESC;
```

   Cleo has 3 orders and 620. Ann has 2 orders and 350. Putting the status in the `ON` clause keeps customers without matching orders in the join, and `HAVING` then drops the small ones.

**Follow-ups:**
- *`LAG` with a default?* `LAG(total, 1, 0)` returns 0 instead of `NULL` for the first row.
- *Window function or self-join?* A window function reads the data once. A self-join is longer and slower, so the window is my first choice.
- *Where can the result of a window function not be used?* In `WHERE` and `GROUP BY` of the same query, so a filter on it needs a subquery or a CTE.

**Trap:** Forgetting the `PARTITION BY`, which makes one running total across all customers.

## Live coding: test design at a whiteboard

Each task asks for test cases, not code, but the worked solutions below include a short TypeScript check that was run, so the technique is not just a table on a slide. Say the technique's name, apply it to the example, and then say what it does not cover. All files run with `node file.ts` and compile under `strict`.

### Whiteboard task, 10 min: an age field accepts 18 to 65. Design the test cases.

Topic: test-design | Core | id: q1035

**Say:** I split the input into equivalence classes: below 18 is invalid, 18 to 65 is valid, above 65 is invalid, and then non-numbers. Every value in a class should behave the same, so I need one from each. Bugs live at the edges, so I add boundary values: 17, 18, 19 and 64, 65, 66. Then I add the nasty ones the classes do not cover: zero, a negative number, a decimal, empty, text, a very large number. I ask first whether 18 and 65 are inclusive, because the whole table depends on it.

**Full process:**
1. Ask: "Inclusive? Integers only? What happens on a bad value, an error message or a blocked field?"
2. Write the classes: invalid low (below 18), valid (18 to 65), invalid high (above 65), invalid type (text, empty, decimal).
3. Boundary values (two-value method uses 17, 18, 65, 66; the three-value method adds 19 and 64).
4. Turn the table into a data-driven test. The check below ran with 11 cases:

```ts
import assert from 'node:assert/strict';

export function isEligible(age: number): boolean {
  return Number.isInteger(age) && age >= 18 && age <= 65;
}

const cases: { name: string; age: number; expected: boolean }[] = [
  { name: 'just below the lower boundary', age: 17, expected: false },
  { name: 'lower boundary', age: 18, expected: true },
  { name: 'just above the lower boundary', age: 19, expected: true },
  { name: 'typical valid value', age: 40, expected: true },
  { name: 'just below the upper boundary', age: 64, expected: true },
  { name: 'upper boundary', age: 65, expected: true },
  { name: 'just above the upper boundary', age: 66, expected: false },
  { name: 'zero', age: 0, expected: false },
  { name: 'negative', age: -1, expected: false },
  { name: 'decimal', age: 18.5, expected: false },
  { name: 'not a number', age: Number.NaN, expected: false },
];

for (const { name, age, expected } of cases) {
  assert.equal(isEligible(age), expected, name);
}
console.log(`bva: ${cases.length} cases ok`);
```

5. Say which cases hit the UI and which hit the API. The same table works for both, and the unit test is the cheapest place for most of it.

**Follow-ups:**
- *Why is equivalence partitioning alone not enough?* It picks any value in the class, usually 30. Defects cluster at boundaries, such as `>` written for `>=`.
- *How does the table change for a two-field range, such as from-age and to-age?* I add the relation between the fields: from greater than to, from equal to to, and each field at its boundary while the other is valid.
- *What do you do if the requirement is not clear?* I ask and write the assumption in the test name, because an undocumented boundary is a requirements defect.

**Trap:** Giving only 17, 18, 65, 66 and nothing for the types of bad input. The other trap is not asking if the boundary is inclusive.

### Whiteboard task, 15 min: shipping and discount rules depend on membership, order total and a coupon. Design the tests with a decision table.

Topic: test-design | Core | id: q1036

**Say:** When several conditions combine, a decision table makes sure no combination is forgotten. The rules: members and orders from 100 get free shipping, and a coupon gives 10 percent, or 15 percent for members. Three conditions with two values each give 8 rules. I list all 8 columns, write the expected result for each, and then merge rules only if the result is the same and I can say why. Then I add boundary tests on the total, 99.99 and 100, because "from 100" is a boundary, and I give each rule a test.

**Full process:**
1. List the conditions: member (yes or no), total at least 100 (yes or no), coupon (yes or no).
2. List all combinations (2 to the power of 3 is 8) and the actions: free shipping, discount percent.
3. Fill in the table:

| Rule | Member | Total at least 100 | Coupon | Free shipping | Discount |
|---|---|---|---|---|---|
| 1 | yes | yes | yes | yes | 15% |
| 2 | yes | yes | no | yes | 0% |
| 3 | yes | no | yes | yes | 15% |
| 4 | yes | no | no | yes | 0% |
| 5 | no | yes | yes | yes | 10% |
| 6 | no | yes | no | yes | 0% |
| 7 | no | no | yes | no | 10% |
| 8 | no | no | no | no | 0% |

4. Optimise: the total does not change the result for members, so rules 1 and 3, and rules 2 and 4, can be merged ("total: do not care"). I keep them separate if the cost of a test is small, because requirements change.
5. Add the boundary rows for the total (100 and 99.99), then run the table as a data-driven test. 10 rules ran green:

```ts
import assert from 'node:assert/strict';

export type Input = { member: boolean; total: number; coupon: boolean };
export type Result = { freeShipping: boolean; discountPercent: number };

export function price(input: Input): Result {
  const big = input.total >= 100;
  return {
    freeShipping: input.member || big,
    discountPercent: input.coupon ? (input.member ? 15 : 10) : 0,
  };
}

const rules: { rule: number; input: Input; expected: Result }[] = [
  { rule: 1, input: { member: true, total: 150, coupon: true }, expected: { freeShipping: true, discountPercent: 15 } },
  { rule: 2, input: { member: true, total: 150, coupon: false }, expected: { freeShipping: true, discountPercent: 0 } },
  { rule: 3, input: { member: true, total: 50, coupon: true }, expected: { freeShipping: true, discountPercent: 15 } },
  { rule: 4, input: { member: true, total: 50, coupon: false }, expected: { freeShipping: true, discountPercent: 0 } },
  { rule: 5, input: { member: false, total: 150, coupon: true }, expected: { freeShipping: true, discountPercent: 10 } },
  { rule: 6, input: { member: false, total: 150, coupon: false }, expected: { freeShipping: true, discountPercent: 0 } },
  { rule: 7, input: { member: false, total: 50, coupon: true }, expected: { freeShipping: false, discountPercent: 10 } },
  { rule: 8, input: { member: false, total: 50, coupon: false }, expected: { freeShipping: false, discountPercent: 0 } },
  { rule: 9, input: { member: false, total: 100, coupon: false }, expected: { freeShipping: true, discountPercent: 0 } },
  { rule: 10, input: { member: false, total: 99.99, coupon: false }, expected: { freeShipping: false, discountPercent: 0 } },
];

for (const { rule, input, expected } of rules) {
  assert.deepEqual(price(input), expected, `rule ${rule}`);
}
console.log(`decision table: ${rules.length} rules ok`);
```

**Follow-ups:**
- *When is a decision table the wrong tool?* With one condition, or with conditions that depend on order or history. A state model fits those.
- *What do you do when the table explodes (10 conditions)?* Merge do-not-care cells, test risky combinations first, or use pairwise.
- *What does the table find in review?* Missing rules. If two columns have no defined result, the requirement has a hole, and I raise it before any code exists.

**Trap:** Testing only the happy rule and one "negative" rule. The second trap is skipping the boundary on the total.

### Whiteboard task, 15 min: an order goes through new, paid, shipped, delivered and can be cancelled. Design the tests with a state transition model.

Topic: test-design | Core | id: q1037

**Say:** I draw the states as boxes and the events as arrows: pay, ship, deliver and cancel. Valid transitions are new to paid, paid to shipped, shipped to delivered, and cancel from new or paid. That is 5 valid ones. Then I build the full table of every state and event: 5 states times 4 events is 20 pairs, so 15 are invalid, and each invalid one must be rejected without changing the state. Most teams only test the valid path, and the invalid ones are where the defects are, such as shipping a cancelled order.

**Full process:**
1. State the states: new, paid, shipped, delivered, cancelled. Delivered and cancelled are final.
2. State the events and the allowed transitions.
3. Cover levels: every state at least once, every valid transition at least once, a path from start to a final state (new, paid, shipped, delivered), and every invalid pair.
4. Run the model as a check. It asserts 5 valid transitions and 15 illegal ones, and a full path:

```ts
import assert from 'node:assert/strict';

export type State = 'new' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type Event = 'pay' | 'ship' | 'deliver' | 'cancel';

const transitions: Record<State, Partial<Record<Event, State>>> = {
  new: { pay: 'paid', cancel: 'cancelled' },
  paid: { ship: 'shipped', cancel: 'cancelled' },
  shipped: { deliver: 'delivered' },
  delivered: {},
  cancelled: {},
};

export function next(state: State, event: Event): State {
  const target = transitions[state][event];
  if (!target) throw new Error(`illegal: ${event} in ${state}`);
  return target;
}

const states = Object.keys(transitions) as State[];
const events: Event[] = ['pay', 'ship', 'deliver', 'cancel'];

let valid = 0;
let invalid = 0;
for (const state of states) {
  for (const event of events) {
    if (transitions[state][event]) {
      valid += 1;
      assert.equal(next(state, event), transitions[state][event]);
    } else {
      invalid += 1;
      assert.throws(() => next(state, event), /illegal/);
    }
  }
}
assert.equal(valid, 5);
assert.equal(invalid, 15);

let state: State = 'new';
for (const event of ['pay', 'ship', 'deliver'] as Event[]) state = next(state, event);
assert.equal(state, 'delivered');
console.log(`state: ${valid} valid and ${invalid} invalid pairs ok`);
```

5. For the real system, each invalid pair is an API call that must return an error, such as 409, and the order must stay in its old state. The UI test would check that the Ship button is not shown.

**Follow-ups:**
- *What do you test beyond single transitions?* Sequences, such as pay twice (idempotency) and cancel after a refund, and concurrent events, such as two users pressing pay and cancel together.
- *What side effects belong to a transition?* An email, a stock change, a payment capture. Each is an assertion on the transition, and cancel after pay needs a refund check.
- *Where does the model live in your tests?* As data, with the transition table next to the product's own, and the test generates the cases from it.

**Trap:** Testing the valid chain only. The second trap is not checking that a rejected event leaves the state, the stock and the money untouched.

### Whiteboard task, 15 min: the checkout runs on 3 browsers, 3 operating systems, 3 payment methods and 2 languages. You cannot run 54 combinations. What do you run?

Topic: test-design | Core | id: q1038

**Say:** I use pairwise testing. Most defects come from one factor or from the interaction of two, so I choose a small set of runs where every pair of values appears at least once. For these factors 9 runs cover every pair, instead of 54. That is the minimum possible here, since two factors with 3 values already need 9 combinations. I generate the set with a small script or a tool, and then I add by hand the combinations that carry risk: Safari with the payment method that opens a popup, for example. I say what it misses: a defect that needs three factors together.

**Full process:**
1. List the factors and values: browser (Chrome, Firefox, Safari), OS (Windows, macOS, Linux), payment (card, BLIK, PayPal), language (pl, en).
2. Count the pairs to cover: the pairs of values from two different factors.
3. Greedy algorithm: build all combinations, pick the one that covers the most uncovered pairs, mark them covered, repeat. Tools such as PICT do this and handle constraints. This script ran and printed `pairwise: 9 rows instead of 54, every pair covered`, and the check inside verifies every pair:

```ts
import assert from 'node:assert/strict';

type Factors = Record<string, string[]>;
type Row = Record<string, string>;

export function pairwise(factors: Factors): Row[] {
  const names = Object.keys(factors);
  const key = (a: string, va: string, b: string, vb: string): string => `${a}=${va}|${b}=${vb}`;

  const uncovered = new Set<string>();
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      for (const va of factors[names[i]]) {
        for (const vb of factors[names[j]]) uncovered.add(key(names[i], va, names[j], vb));
      }
    }
  }

  const rowPairs = (row: Row): string[] => {
    const pairs: string[] = [];
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        pairs.push(key(names[i], row[names[i]], names[j], row[names[j]]));
      }
    }
    return pairs;
  };

  const all: Row[] = names.reduce<Row[]>(
    (rows, name) => rows.flatMap((row) => factors[name].map((value) => ({ ...row, [name]: value }))),
    [{}],
  );

  const result: Row[] = [];
  while (uncovered.size > 0) {
    let best = all[0];
    let bestGain = -1;
    for (const row of all) {
      const gain = rowPairs(row).filter((p) => uncovered.has(p)).length;
      if (gain > bestGain) {
        best = row;
        bestGain = gain;
      }
    }
    for (const p of rowPairs(best)) uncovered.delete(p);
    result.push(best);
  }
  return result;
}

const factors: Factors = {
  browser: ['Chrome', 'Firefox', 'Safari'],
  os: ['Windows', 'macOS', 'Linux'],
  payment: ['card', 'BLIK', 'PayPal'],
  language: ['pl', 'en'],
};

const rows = pairwise(factors);
const fullProduct = 3 * 3 * 3 * 2;
assert.ok(rows.length < fullProduct);
assert.ok(rows.length >= 9);

const names = Object.keys(factors);
for (let i = 0; i < names.length; i += 1) {
  for (let j = i + 1; j < names.length; j += 1) {
    for (const va of factors[names[i]]) {
      for (const vb of factors[names[j]]) {
        assert.ok(rows.some((r) => r[names[i]] === va && r[names[j]] === vb), `${va} + ${vb} missing`);
      }
    }
  }
}
console.log(`pairwise: ${rows.length} rows instead of ${fullProduct}, every pair covered`);
```

4. Add constraints: Safari does not run on Linux or Windows in a normal setup, so the real set must drop those pairs. I say that the script has no constraint support, and a tool does.
5. Add risk-based extras: the most used combination in analytics, and any combination that failed before.

**Follow-ups:**
- *Where does pairwise not work?* When a defect needs three values together, and for conditions with ordering. Then I use a 3-wise set, which is larger, or a decision table.
- *How do you choose the browsers in the first place?* From the analytics of the product and the contract, not from a list in a book.
- *How do you run this in Playwright?* Generate the rows into a JSON file, loop over them to create a test for each row at the top level of the file, or use projects for browsers and parameterise the rest.

**Trap:** Saying "I would test everything" or "I would test only Chrome". The other trap is calling pairwise random sampling.

### Whiteboard task, 15 min: "Test a file upload on a profile page." No requirements are given.

Topic: test-design | Core | id: q1039

**Say:** Do not start with cases. Ask four questions: what files are allowed, how big, what happens to the file afterwards, and who can see it. Then think in groups: the file itself, the upload process, the result, and security. Put the risks first: a wrong type accepted, a huge file, a failed upload that looks like a success, and a file that can be run or viewed by the wrong person. Turn that into a short list of test ideas with the priority. If there are no requirements, write assumptions down and send them to the product owner, so the gaps become questions.

**Full process:**
1. Clarify, in this order: allowed types and size, single or multiple files, preview and storage, who can access it.
2. Group the ideas:
   - File: allowed types, a wrong extension with the right content, the right extension with wrong content, 0 bytes, exactly the maximum size, one byte over, a long or unicode filename, two files with the same name.
   - Process: cancel during upload, lose the network in the middle, a slow connection, upload twice quickly, close the tab during upload, session expiry.
   - Result: the new image appears, the old one is replaced, the page keeps it after reload, other pages (header avatar) update, an error message says what went wrong.
   - Security: a script inside an SVG, a file larger than the limit sent directly to the API, the file URL guessed by another user, a double extension, metadata in photos.
   - Accessibility: the upload control is reachable by keyboard and has a name, the error is announced.
3. Priority: security and data loss first, then the main flow, then the edges.
4. Say which are automated: the type and size limits at the API level, the main flow in one E2E test with a file from `setInputFiles`, and the rest as exploratory sessions with a charter.
5. In Playwright the upload step is `await page.getByLabel('Upload photo', { exact: true }).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer })`, which needs no file on disk.

**Follow-ups:**
- *What is the first test you automate?* The valid file end to end: upload, see the result, reload, still there. It protects the main value.
- *How do you test the size limit without a huge file?* Build the buffer in memory with `Buffer.alloc(maxSize)` and send it through `setInputFiles` or the API.
- *What if the developer says the check is only in the frontend?* Then the API test is the important one, because anyone can skip the frontend. I would raise it as a defect.

**Trap:** A flat list of 40 cases with no questions and no priority. The interviewer is judging how you think, so show the structure first.
## Home tasks: Playwright

A home task is judged twice: on the code, and on how you present it. Open the call with what you covered, what you left out and why, and how you would run it in CI. The "Say" part is that presentation.

### Home task: shop with add to cart and a cart counter. Write the tests with a sensible `test.describe` structure.

Topic: pw-general | Core | id: q1040

**What you receive:** A repository with Playwright installed and configured, and the shop page (`shopHtml` in `tests/support/shop.ts`). No tests yet.

**Say:** I group by feature: one top-level `describe` for the cart, nested ones for adding and removing. The page is opened in `beforeEach`, and nothing else lives in a hook. I find the Add to cart button inside the right product card by filtering the card by its heading, so I do not need `nth` or `first`. I assert the counter text and the list of items, so a wrong count and a wrong product both fail. I include a duplicate add and a remove, because those are where cart bugs live.

**Full process:**
1. Brief as given: "Open the shop, add a product, check the cart count. Structure it the way you would in a real suite."
2. Write a helper `addToCart(page, product)` that returns the locator. It is a small function, not a class, because one helper does not need a page object yet.
3. Structure: `describe('Cart')` holds `beforeEach` and the "starts empty" test. Nested `describe('adding')` and `describe('removing')` hold the cases. Nested hooks run after the outer ones.
4. Use `toHaveText` with an array on the list items: it checks both the count and the order.

```ts
import { test, expect, type Page } from '@playwright/test';
import { shopHtml } from './support/shop';

const addToCart = (page: Page, product: string) =>
  page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: product, exact: true }) })
    .getByRole('button', { name: 'Add to cart', exact: true });

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(shopHtml);
  });

  test('starts empty', async ({ page }) => {
    await expect(page.getByRole('status')).toHaveText('Cart: 0 items');
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test.describe('adding', () => {
    test('one product updates the count and lists it', async ({ page }) => {
      await addToCart(page, 'Blue Mug').click();

      await expect(page.getByRole('status')).toHaveText('Cart: 1 item');
      await expect(page.getByRole('listitem')).toHaveText(['Blue Mug Remove Blue Mug']);
    });

    test('the same product twice counts twice', async ({ page }) => {
      await addToCart(page, 'Red Cap').click();
      await addToCart(page, 'Red Cap').click();

      await expect(page.getByRole('status')).toHaveText('Cart: 2 items');
      await expect(page.getByRole('listitem')).toHaveCount(2);
    });
  });

  test.describe('removing', () => {
    test('removes only the chosen product', async ({ page }) => {
      await addToCart(page, 'Blue Mug').click();
      await addToCart(page, 'Green Bag').click();
      await page.getByRole('button', { name: 'Remove Blue Mug', exact: true }).click();

      await expect(page.getByRole('status')).toHaveText('Cart: 1 item');
      await expect(page.getByRole('listitem')).toHaveText(['Green Bag Remove Green Bag']);
    });
  });
});
```

**Follow-ups:**
- *Why filter the article by heading instead of `nth(1)`?* If the product order changes, an index test silently clicks the wrong product or still passes. The heading ties the button to its product.
- *Where would the helper go when the suite grows?* Into a `ShopPage` page object that holds the locators, and the page object comes in through a fixture. See the page object task below.
- *What about the price total?* Assert it with a value built from the data, not typed by hand, and use several carts, not one.

**Trap:** Sharing a `let` cart or product list between tests, or running tests in the order they are written and relying on the cart from the previous test. Each test must start empty and pass alone.

### Home task: test a search box that waits for the user to stop typing (debounce). Prove only one request goes out.

Topic: pw-network | Core | id: q1041

**What you receive:** A repository with Playwright installed and configured, and the search page (`searchHtml`). There is no backend, so you mock `/api/search` yourself.

**Say:** The risk with debounce is that every keystroke sends a request, so I record the queries the page really sends. I serve the page and the API from `page.route`, so the test controls the data and counts the requests. I type fast with `pressSequentially`, wait for the results to appear, and then assert the recorded list is exactly the final text. A second test uses Playwright's clock: I stop time, fast-forward 299 ms and see no request, then one more millisecond and see it. That checks the delay without any real waiting.

**Full process:**
1. Brief as given: "The search box calls `/api/search?q=...` 300 ms after the last keystroke. Write a test that shows it is debounced."
2. Serve the page at `https://shop.test/` with `page.route`, and fulfil `/api/search*` with data filtered by the query. Push every query into an array in the handler.
3. Test one: `pressSequentially('play')` is fast, so the debounce timer restarts for each key. Assert the list items with `toHaveText([...])`, then `expect(queries).toEqual(['play'])`. If the page had no debounce, the array would be `['p','pl','pla','play']` and the test would fail.
4. Test two: `await page.clock.install()` before `goto` so the page uses the fake clock. After typing, `await page.clock.runFor(299)` runs timers for 299 ms and no request exists. `runFor(1)` crosses 300 ms and the request goes out.
5. Run: `npx playwright test tests/t03-debounce.spec.ts`. Both pass in about one second.

```ts
import { test, expect, type Page } from '@playwright/test';

const searchHtml = `<!doctype html>
<html lang="en"><body>
<label for="q">Search</label><input id="q" type="search" autocomplete="off">
<ul id="results" aria-label="Results"></ul>
<script>
  const input = document.getElementById('q');
  const list = document.getElementById('results');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const res = await fetch('/api/search?q=' + encodeURIComponent(input.value));
      const items = await res.json();
      list.innerHTML = '';
      for (const name of items) {
        const li = document.createElement('li');
        li.textContent = name;
        list.append(li);
      }
    }, 300);
  });
</script>
</body></html>`;

const catalog = ['Playwright book', 'Playmobil set', 'Plain mug'];

async function openSearch(page: Page): Promise<string[]> {
  const queries: string[] = [];
  await page.route('https://shop.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: searchHtml }),
  );
  await page.route('https://shop.test/api/search*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    queries.push(q);
    const hits = catalog.filter((name) => name.toLowerCase().startsWith(q.toLowerCase()));
    await route.fulfill({ json: hits });
  });
  await page.goto('https://shop.test/');
  return queries;
}

test('typing fast sends one request for the final text', async ({ page }) => {
  const queries = await openSearch(page);

  await page.getByLabel('Search', { exact: true }).pressSequentially('play');

  await expect(page.getByRole('listitem')).toHaveText(['Playwright book', 'Playmobil set']);
  expect(queries).toEqual(['play']);
});

test('nothing is sent before the debounce delay ends', async ({ page }) => {
  await page.clock.install();
  const queries = await openSearch(page);

  await page.getByLabel('Search', { exact: true }).pressSequentially('pla');
  await page.clock.runFor(299);
  expect(queries).toEqual([]);

  await page.clock.runFor(1);
  await expect(page.getByRole('listitem')).toHaveText(['Playwright book', 'Playmobil set', 'Plain mug']);
  expect(queries).toEqual(['pla']);
});
```

**Follow-ups:**
- *What about a slow response arriving after a newer one?* That is a race in the product: an old answer can overwrite the new list. I would delay the first response with a gate promise in the route handler and assert the list shows the final query.
- *Why not `waitForTimeout(300)`?* It tests nothing deterministic and slows the suite. The clock makes the delay exact.
- *Why check the requests array after the results appear?* The results are the signal that the last request finished, so by then every earlier request would already be in the array.

**Trap:** Asserting only the final list. A page without debounce also shows the right list, only after sending four requests. The request count is the real contract.

### Home task: test a sortable table. Check that sorting is right, not only that something moved.

Topic: pw-general | Core | id: q1042

**What you receive:** A repository with Playwright installed and configured, and the table page (`tableHtml`).

**Say:** A sort test must catch the classic bug: prices sorted as text, so 10 comes before 9. I use data where text order and number order differ, 9, 10, 15 and 100. I click the header, wait for `aria-sort` to change, and then assert the whole column with an array, so order and count are both checked. I click again for descending. A second test sorts by name and checks that each price stayed with its name, because a sort that moves only one column is also a bug.

**Full process:**
1. Brief as given: "This table sorts when you click a header. Write a test for sorting by price and by name."
2. Choose the assertion target: the column cells. `getByRole('cell').filter({ hasText: /^\d+$/ })` picks the numeric cells, so it works without a class name.
3. Click the header button, then wait on the state flag `aria-sort`. Then assert the array. `toHaveText([...])` retries until the whole list matches.
4. For the row test, assert the full row text so a name and its price stay glued together.

```ts
import { test, expect } from '@playwright/test';

const tableHtml = `<!doctype html>
<html lang="en"><body>
<table>
  <caption>Products</caption>
  <thead><tr>
    <th scope="col" aria-sort="none"><button data-key="name">Name</button></th>
    <th scope="col" aria-sort="none"><button data-key="price">Price</button></th>
  </tr></thead>
  <tbody id="rows"></tbody>
</table>
<script>
  const data = [
    { name: 'Mug', price: 9 }, { name: 'Bag', price: 100 },
    { name: 'Cap', price: 15 }, { name: 'Pen', price: 10 },
  ];
  const state = { key: null, dir: 1 };
  const body = document.getElementById('rows');
  const draw = () => {
    const rows = [...data];
    if (state.key) rows.sort((a, b) => (a[state.key] > b[state.key] ? 1 : -1) * state.dir);
    body.innerHTML = rows.map((r) => '<tr><td>' + r.name + '</td><td>' + r.price + '</td></tr>').join('');
    document.querySelectorAll('th').forEach((th) => {
      const k = th.querySelector('button').dataset.key;
      th.setAttribute('aria-sort', k !== state.key ? 'none' : state.dir === 1 ? 'ascending' : 'descending');
    });
  };
  document.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
    state.dir = state.key === b.dataset.key ? -state.dir : 1;
    state.key = b.dataset.key;
    draw();
  }));
  draw();
</script>
</body></html>`;

test.describe('Sortable table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(tableHtml);
  });

  test('sorts prices as numbers, ascending then descending', async ({ page }) => {
    const priceCells = page.getByRole('cell').filter({ hasText: /^\d+$/ });
    const priceHeader = page.getByRole('columnheader', { name: 'Price', exact: true });

    await page.getByRole('button', { name: 'Price', exact: true }).click();
    await expect(priceHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(priceCells).toHaveText(['9', '10', '15', '100']);

    await page.getByRole('button', { name: 'Price', exact: true }).click();
    await expect(priceHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(priceCells).toHaveText(['100', '15', '10', '9']);
  });

  test('sorts names alphabetically and keeps each price with its name', async ({ page }) => {
    await page.getByRole('button', { name: 'Name', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toHaveAttribute('aria-sort', 'ascending');

    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    await expect(rows).toHaveText(['Bag100', 'Cap15', 'Mug9', 'Pen10']);
  });
});
```

**Follow-ups:**
- *Why not read the cells and sort them in the test?* That copies the product logic into the test. A fixed expected list is simple and cannot share the product's bug. If the data is random, I compute the expectation with an independent rule, and I say so.
- *What else belongs in a sort test?* Equal values (is the order stable?), empty cells, negative numbers, mixed case names, and a sort after the data refreshes.
- *Why wait for `aria-sort` first?* It is a user-facing state, and it proves the click was handled before the cells are read.

**Trap:** Reading the cells with `allTextContents()` right after the click and comparing at once. That reads the old order if the sort is asynchronous. Use a web-first assertion on the locator, which retries.

### Home task: this raw test works but is messy. Turn it into page objects and fixtures.

Topic: fw-pom | Core | id: q1043

**What you receive:** A repository with Playwright installed and configured, the shop page and the raw test from step 2. You add the page object and fixture files.

**Say:** First I read what the raw test does and list the repeated parts: opening the page, brittle selectors like `nth-child` and `#count`, and the same steps in both tests. I make one page object that holds locators and user actions, and no assertions, so the test still shows what it checks. Then I give the page object to the tests through a fixture, so opening the page is not repeated in each test. I keep the diff small: same two tests, same checks, better locators.

**Full process:**
1. Brief as given: "Refactor this. You may create files."
2. The raw test, which passes but is brittle (position-based CSS and ids):

```ts
import { test, expect } from '@playwright/test';
import { shopHtml } from '../support/shop';

test('add mug', async ({ page }) => {
  await page.setContent(shopHtml);
  await page.locator('article:nth-child(1) button').click();
  await expect(page.locator('#count')).toHaveText('Cart: 1 item');
});

test('add mug and cap then remove mug', async ({ page }) => {
  await page.setContent(shopHtml);
  await page.locator('article:nth-child(1) button').click();
  await page.locator('article:nth-child(2) button').click();
  await expect(page.locator('#count')).toHaveText('Cart: 2 items');
  await page.locator('#cart li:nth-child(1) button').click();
  await expect(page.locator('#count')).toHaveText('Cart: 1 item');
});
```

3. Create `ShopPage`. It holds `Locator` objects, not element handles, and methods for user actions. Methods take the product name, so the action reads like the user's intent.

```ts
import type { Locator, Page } from '@playwright/test';
import { shopHtml } from '../support/shop';

export class ShopPage {
  readonly cartStatus: Locator;
  readonly cartItems: Locator;

  constructor(private readonly page: Page) {
    this.cartStatus = page.getByRole('status');
    this.cartItems = page.getByRole('listitem');
  }

  async open(): Promise<void> {
    await this.page.setContent(shopHtml);
  }

  async addToCart(product: string): Promise<void> {
    await this.page
      .getByRole('article')
      .filter({ has: this.page.getByRole('heading', { name: product, exact: true }) })
      .getByRole('button', { name: 'Add to cart', exact: true })
      .click();
  }

  async removeFromCart(product: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remove ${product}`, exact: true }).click();
  }
}
```

4. Create a fixture file. The fixture constructs the page object, opens the page, and hands it over with `use`. Re-export `expect` so tests import from one place.

```ts
import { test as base } from '@playwright/test';
import { ShopPage } from './shop-page';

type Fixtures = { shopPage: ShopPage };

export const test = base.extend<Fixtures>({
  shopPage: async ({ page }, use) => {
    const shopPage = new ShopPage(page);
    await shopPage.open();
    await use(shopPage);
  },
});

export { expect } from '@playwright/test';
```

5. Rewrite the tests. Assertions stay in the test.

```ts
import { test, expect } from './fixtures';

test('add a product', async ({ shopPage }) => {
  await shopPage.addToCart('Blue Mug');

  await expect(shopPage.cartStatus).toHaveText('Cart: 1 item');
});

test('add two products then remove one', async ({ shopPage }) => {
  await shopPage.addToCart('Blue Mug');
  await shopPage.addToCart('Red Cap');
  await expect(shopPage.cartStatus).toHaveText('Cart: 2 items');

  await shopPage.removeFromCart('Blue Mug');

  await expect(shopPage.cartStatus).toHaveText('Cart: 1 item');
  await expect(shopPage.cartItems).toHaveText(['Red Cap Remove Red Cap']);
});
```

6. Run raw and refactored tests together: both pass, so the refactor kept behaviour. Then delete the raw file.

**Follow-ups:**
- *Why no assertions in the page object?* A test is a contract. When the check is hidden in a helper, a reader cannot see what is verified, and someone can weaken it without touching the test.
- *When is a page object too much?* For a one-off flow. A helper function is enough until the second use. Large page classes with one method per click are the other failure.
- *Where do component objects fit?* A header, a modal or a chat widget that appears on many pages becomes its own class, and a page object composes it.

**Trap:** Wrapping every Playwright call in a method (`click(selector)`, `type(selector, text)`). That adds a layer and removes the auto-wait and error messages. A second trap is storing element handles instead of locators.

### Home task: the page calls `/api/orders`. Test it with the API mocked: data, empty list, server error, network failure, slow response.

Topic: pw-network | Core | id: q1044

**What you receive:** A repository with Playwright installed and configured, and the orders page (`ordersHtml`). There is no backend, so every API answer comes from your mocks.

**Say:** I serve the page from `page.route` and fulfil the API call there, so the test needs no backend and controls the response. I cover the states a user can see: a list, an empty state, a 500, a dropped connection, and loading. For the loading state I hold the response behind a promise and release it when I have asserted, so I never sleep. I register routes before `goto`, because a route set afterwards misses the first request. I say plainly that a mock test checks how the UI handles a response, not whether the real API works, so I keep at least one test against the real backend.

**Full process:**
1. Brief as given: "Mock the orders API and test the page."
2. `page.route(url, handler)` intercepts matching requests. `route.fulfill({ json })` sets the body and the content type. `status: 500` simulates an error. `route.abort('failed')` simulates a network failure.
3. Serve the HTML from a route at `https://shop.test/`, so the page has a real origin and a relative `fetch('/api/orders')` resolves to the mocked URL.
4. Loading state: the handler does `await gate` before `fulfill`. The test asserts the loading text, calls `release()`, then asserts the list.
5. Run it: five tests pass in about 0.5 s with no network.

```ts
import { test, expect, type Page } from '@playwright/test';

const ordersHtml = `<!doctype html>
<html lang="en"><body>
<h1>Orders</h1>
<p id="state" role="status">Loading orders...</p>
<ul id="list" aria-label="Orders"></ul>
<script>
  fetch('/api/orders')
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then((orders) => {
      document.getElementById('state').textContent = orders.length ? '' : 'No orders yet';
      document.getElementById('list').innerHTML =
        orders.map((o) => '<li>' + o.id + ': ' + o.total + ' EUR</li>').join('');
    })
    .catch(() => {
      document.getElementById('state').textContent = '';
      document.body.insertAdjacentHTML('beforeend', '<p role="alert">Could not load orders</p>');
    });
</script>
</body></html>`;

async function servePage(page: Page): Promise<void> {
  await page.route('https://shop.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: ordersHtml }),
  );
}

test.describe('Orders page with a mocked API', () => {
  test('lists the orders from the API', async ({ page }) => {
    await servePage(page);
    await page.route('https://shop.test/api/orders', (route) =>
      route.fulfill({ json: [{ id: 'A-1', total: 25 }, { id: 'A-2', total: 40 }] }),
    );
    await page.goto('https://shop.test/');

    await expect(page.getByRole('listitem')).toHaveText(['A-1: 25 EUR', 'A-2: 40 EUR']);
  });

  test('shows the empty state', async ({ page }) => {
    await servePage(page);
    await page.route('https://shop.test/api/orders', (route) => route.fulfill({ json: [] }));
    await page.goto('https://shop.test/');

    await expect(page.getByRole('status')).toHaveText('No orders yet');
  });

  test('shows an error when the server answers 500', async ({ page }) => {
    await servePage(page);
    await page.route('https://shop.test/api/orders', (route) =>
      route.fulfill({ status: 500, json: { message: 'boom' } }),
    );
    await page.goto('https://shop.test/');

    await expect(page.getByRole('alert')).toHaveText('Could not load orders');
  });

  test('shows an error when the network fails', async ({ page }) => {
    await servePage(page);
    await page.route('https://shop.test/api/orders', (route) => route.abort('failed'));
    await page.goto('https://shop.test/');

    await expect(page.getByRole('alert')).toHaveText('Could not load orders');
  });

  test('shows the loading state until the response arrives', async ({ page }) => {
    await servePage(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('https://shop.test/api/orders', async (route) => {
      await gate;
      await route.fulfill({ json: [{ id: 'A-1', total: 25 }] });
    });
    await page.goto('https://shop.test/');

    await expect(page.getByRole('status')).toHaveText('Loading orders...');
    release();
    await expect(page.getByRole('listitem')).toHaveText(['A-1: 25 EUR']);
    await expect(page.getByRole('status')).toHaveText('');
  });
});
```

**Follow-ups:**
- *How do you change only part of a real response?* `const response = await route.fetch()`, edit the JSON, then `route.fulfill({ response, json })`. That keeps real data and changes one field.
- *Does `page.route` see requests from `request.get()`?* No. The `request` fixture bypasses the page, so use a real server or a mock server for API tests.
- *Route on the page or on the context?* The context route covers every page, including popups. The page route covers one page.

**Trap:** Mocking everything and trusting the green run. The risk is that the mock drifts from the real contract. Keep the mock data typed or generated from the schema, and keep a few tests on the real stack.

### Home task: record network traffic into a HAR file and replay it in a test. Describe the whole process.

Topic: pw-network | Core | id: q1045

**What you receive:** A repository with Playwright installed and configured, and a small local site with one API call. You record its traffic once, then replay it.

**Say:** A HAR file is a recording of requests and responses. I record it once against the real service with `page.routeFromHAR(path, { update: true })`, run the flow, and close the context, because that is when Playwright writes the file. Later the same call without `update` serves the responses from the file, and `notFound: 'abort'` fails any request that is not in it. I prove it works by stopping the server before the replay. The trade-off is that a HAR goes stale when the API changes, so I record only the calls I need with the `url` option and I re-record on purpose.

**Full process:**
1. Brief as given: "How would you record a HAR and use it in a test?" Say each step, then type it.
2. Record from the command line (works for any site): `npx playwright open --save-har=flow.har --save-har-glob="**/api/**" https://your.app/`. Click through the flow and close the window. The file is written when the context closes.
3. Record from code, which is repeatable: `await page.routeFromHAR(harPath, { update: true, updateContent: 'embed' })`. `update: true` sends requests to the real network and writes them down. `updateContent: 'embed'` stores bodies inside the file, `'attach'` stores them as separate files.
4. `await context.close()` writes the file. Without that call the file may be missing or empty.
5. Replay: `await page.routeFromHAR(harPath, { notFound: 'abort' })`. Requests found in the file are answered from it. `notFound: 'fallback'` would send misses to the real network instead.
6. Narrow it with `url: '**/api/**'` so the page and static files still come from the real server.
7. The test below runs a local server so it works offline. It records, checks the HAR contains the request, stops the server, and replays. The server hit counter stays at 1, which proves the replay did not touch it.

```ts
import { test as base, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';

const pageHtml = `<!doctype html>
<html lang="en"><body>
<h1>Products</h1>
<ul aria-label="Products"></ul>
<script>
  fetch('/api/products').then((r) => r.json()).then((items) => {
    document.querySelector('ul').innerHTML = items.map((p) => '<li>' + p.name + '</li>').join('');
  });
</script>
</body></html>`;

type Site = { origin: string; hits: () => number; stop: () => Promise<void> };

const test = base.extend<{ site: Site }>({
  site: async ({}, use) => {
    let apiHits = 0;
    const server: Server = createServer((req, res) => {
      if (req.url === '/api/products') {
        apiHits += 1;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify([{ name: 'Mug' }, { name: 'Cap' }]));
        return;
      }
      res.setHeader('content-type', 'text/html');
      res.end(pageHtml);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const stop = () => new Promise<void>((resolve) => (server.listening ? server.close(() => resolve()) : resolve()));
    await use({
      origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      hits: () => apiHits,
      stop,
    });
    await stop();
  },
});

test('record a HAR once, then replay it with the server stopped', async ({ browser, site }, testInfo) => {
  const harPath = testInfo.outputPath('products.har');

  const recording = await browser.newContext();
  const recordPage = await recording.newPage();
  await recordPage.routeFromHAR(harPath, { update: true, updateContent: 'embed' });
  await recordPage.goto(site.origin);
  await expect(recordPage.getByRole('listitem')).toHaveText(['Mug', 'Cap']);
  await recording.close();
  expect(site.hits()).toBe(1);

  const har = JSON.parse(await readFile(harPath, 'utf8')) as { log: { entries: { request: { url: string } }[] } };
  expect(har.log.entries.map((e) => e.request.url)).toContain(`${site.origin}/api/products`);

  await site.stop();

  const replaying = await browser.newContext();
  const replayPage = await replaying.newPage();
  await replayPage.routeFromHAR(harPath, { notFound: 'abort' });
  await replayPage.goto(site.origin);
  await expect(replayPage.getByRole('listitem')).toHaveText(['Mug', 'Cap']);
  await replaying.close();
  expect(site.hits()).toBe(1);
});
```

**Follow-ups:**
- *How do you update a stale HAR?* Run the recording again with `update: true`, review the diff in git, and commit it. I treat it like a snapshot, with a review.
- *HAR or `page.route` with hand-made JSON?* Hand-made JSON for small, readable cases where the data matters to the test. HAR for a large flow with many calls that I want as-is.
- *What about dynamic values such as tokens and timestamps?* A HAR replays the recorded value. If the page sends a changing query parameter, the match fails, so I narrow the match with `url` or use `page.route` for that call.

**Trap:** Forgetting that the file is only written on `context.close()`, and recording secrets into a file that goes to git. Check the HAR for tokens and cookies before committing it.

### Home task: this test is flaky. Find the reasons and fix it.

Topic: fw-flaky | Core | id: q1046

**What you receive:** A repository with Playwright installed and configured, the notes page (`notesHtml`) and the flaky test from step 1.

**Say:** I do not guess. I list what in the code depends on timing: two fixed sleeps, an `isVisible()` check that does not wait, and CSS locators. The banner appears after 400 ms, so `isVisible()` after 100 ms says "no" and the test carries on with the banner still to come. The toast appears 200 ms after a 150 ms response, so a 300 ms sleep is too short. I replace each guess with something observable: click the button the page will always show, wait for the save response in the same `Promise.all` as the click, then assert the toast and the list with web-first assertions. Then I run it many times to prove the fix, because one green run proves nothing.

**Full process:**
1. Brief as given: "This test fails on CI about half of the time. Fix it." The flaky version (save it as its own file: it is meant to fail):

```ts
import { test, expect, type Page } from '@playwright/test';

export const notesHtml = `<!doctype html>
<html lang="en"><body>
<div id="banner" hidden><p>We use cookies</p><button id="ok">Accept cookies</button></div>
<h1>Notes</h1>
<button id="save">Save note</button>
<ul id="notes" aria-label="Notes"></ul>
<div id="toast" role="status"></div>
<script>
  setTimeout(() => { document.getElementById('banner').hidden = false; }, 400);
  document.getElementById('ok').onclick = () => { document.getElementById('banner').hidden = true; };
  document.getElementById('save').onclick = async () => {
    await fetch('/api/notes', { method: 'POST' });
    const li = document.createElement('li');
    li.textContent = 'Note saved';
    document.getElementById('notes').append(li);
    setTimeout(() => { document.getElementById('toast').textContent = 'Saved'; }, 200);
  };
</script>
</body></html>`;

export async function open(page: Page, apiDelayMs: number): Promise<void> {
  await page.route('https://notes.test/', (r) => r.fulfill({ contentType: 'text/html', body: notesHtml }));
  await page.route('https://notes.test/api/notes', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, apiDelayMs));
    await r.fulfill({ status: 201, json: { ok: true } });
  });
  await page.goto('https://notes.test/');
}

test('FLAKY: save a note', async ({ page }) => {
  await open(page, 150);
  await page.waitForTimeout(100);
  if (await page.locator('#banner').isVisible()) {
    await page.locator('#ok').click();
  }
  await page.locator('#save').click();
  await page.waitForTimeout(300);
  const text = await page.locator('#toast').textContent();
  expect(text).toBe('Saved');
  expect(await page.locator('#notes li').count()).toBe(1);
});
```

2. Triage by cause, as the failure report would show it:
   - `waitForTimeout(100)` and `waitForTimeout(300)`: a guess about speed, wrong on a slow machine.
   - `if (await ...isVisible())`: `isVisible()` returns at once and does not wait, so the branch decides on a race. Here the banner is always shown to a new browser context, so the right fix is to click it without a condition.
   - `count()` right after the action reads the list before it changed. Use `toHaveCount` or `toHaveText`.
   - `#toast`, `#ok`, `#save`: ids are an implementation detail. Use role and name.
3. Fixed version. The save request is awaited together with the click, the status code is asserted, and the UI is asserted with retrying assertions:

```ts
import { test, expect, type Page } from '@playwright/test';

const notesHtml = `<!doctype html>
<html lang="en"><body>
<div id="banner" hidden><p>We use cookies</p><button id="ok">Accept cookies</button></div>
<h1>Notes</h1>
<button id="save">Save note</button>
<ul id="notes" aria-label="Notes"></ul>
<div id="toast" role="status"></div>
<script>
  setTimeout(() => { document.getElementById('banner').hidden = false; }, 400);
  document.getElementById('ok').onclick = () => { document.getElementById('banner').hidden = true; };
  document.getElementById('save').onclick = async () => {
    await fetch('/api/notes', { method: 'POST' });
    const li = document.createElement('li');
    li.textContent = 'Note saved';
    document.getElementById('notes').append(li);
    setTimeout(() => { document.getElementById('toast').textContent = 'Saved'; }, 200);
  };
</script>
</body></html>`;

async function open(page: Page): Promise<void> {
  await page.route('https://notes.test/', (r) => r.fulfill({ contentType: 'text/html', body: notesHtml }));
  await page.route('https://notes.test/api/notes', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await r.fulfill({ status: 201, json: { ok: true } });
  });
  await page.goto('https://notes.test/');
}

test('save a note', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Accept cookies', exact: true }).click();

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/notes') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save note', exact: true }).click(),
  ]);

  expect(response.status()).toBe(201);
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect(page.getByRole('listitem')).toHaveText(['Note saved']);
});
```

4. Measure. `npx playwright test t09-flaky-fixed --repeat-each 30` passed 30 of 30. The flaky version failed 10 of 10, because the sleeps were shorter than the page's delays. On a slower or faster machine it can fail only some runs, which is exactly what makes it flaky. One would also run the fixed test with `--workers=1` and with several workers, because load changes the timing.

**Follow-ups:**
- *Would you add a retry?* No. A retry hides the race and I would not know if it comes back. A retry is only for a named test with a written reason.
- *What if the banner only appears sometimes?* Then I make it deterministic in the test: set the consent in the browser storage before the page loads with `addInitScript` or a stored `storageState`, so the banner never shows. I do not branch on `isVisible()`.
- *How do you classify a flaky failure?* Race, ambiguous locator, overlay, environment or a real product bug. I read the trace first, and I reproduce it with `--trace on --workers=1`. A product bug must not be hidden by a test change.

**Trap:** Replacing `waitForTimeout(300)` with `waitForTimeout(1000)`. It is slower and still a guess. A second trap is removing the assertion that fails, which turns the test into a pass that proves nothing.

### Home task: two users chat. Write a test where one user sends a message and the other sees it.

Topic: pw-websockets | Core | id: q1047

**What you receive:** A repository with Playwright installed and configured, and the chat page (`chatHtml`). You may start a small server for the messages.

**Say:** Two users need two isolated browser contexts, because one context shares cookies and storage between its pages. I create one context per user, each with its own page, and I put that in a fixture so it is closed even when the test fails. Ann sends, and I assert on Bob's page with a web-first assertion that waits for the message. Then Bob replies and I assert on Ann's page. I never sleep to wait for delivery. In this example the chat polls a small local server, and the same test works for WebSocket because the assertion waits on the screen, not on the transport.

**Full process:**
1. Brief as given: "Test a two-person chat. You may start a small server."
2. A test-scoped fixture `chatUrl` starts a Node `http` server on port 0 (the OS picks a free port), keeps messages in memory and serves the page. The fixture stops the server after the test, so parallel tests never share a server.
3. A fixture `users` makes two contexts with `browser.newContext()`, one page each, opens `?user=Ann` and `?user=Bob`, and closes both contexts after `use`.
4. A helper `send(page, text)` fills the field and clicks Send.
5. Assert on the receiving side with the role `log` and its name.
6. Run it: it passes in under a second.

```ts
import { test as base, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type Message = { from: string; text: string };

const chatHtml = `<!doctype html>
<html lang="en"><body>
<h1 id="title"></h1>
<div role="log" aria-label="Messages"></div>
<label for="msg">Message</label><input id="msg">
<button id="send">Send</button>
<script>
  const me = new URLSearchParams(location.search).get('user');
  document.getElementById('title').textContent = 'Chat as ' + me;
  const log = document.querySelector('[role=log]');
  document.getElementById('send').onclick = async () => {
    const input = document.getElementById('msg');
    await fetch('/messages', { method: 'POST', body: JSON.stringify({ from: me, text: input.value }) });
    input.value = '';
  };
  setInterval(async () => {
    const msgs = await (await fetch('/messages')).json();
    log.innerHTML = msgs.map((m) => '<p>' + m.from + ': ' + m.text + '</p>').join('');
  }, 50);
</script>
</body></html>`;

type Users = { ann: Page; bob: Page };

const test = base.extend<{ chatUrl: string; users: Users }>({
  chatUrl: async ({}, use) => {
    const messages: Message[] = [];
    const server: Server = createServer((req, res) => {
      if (req.url === '/messages' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
          messages.push(JSON.parse(body) as Message);
          res.end('{}');
        });
        return;
      }
      if (req.url === '/messages') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(messages));
        return;
      }
      res.setHeader('content-type', 'text/html');
      res.end(chatHtml);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  },
  users: async ({ browser, chatUrl }, use) => {
    const annContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const ann = await annContext.newPage();
    const bob = await bobContext.newPage();
    await ann.goto(`${chatUrl}/?user=Ann`);
    await bob.goto(`${chatUrl}/?user=Bob`);
    await use({ ann, bob });
    await annContext.close();
    await bobContext.close();
  },
});

async function send(page: Page, text: string): Promise<void> {
  await page.getByLabel('Message', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

test('a message from Ann reaches Bob, and his reply reaches Ann', async ({ users }) => {
  const { ann, bob } = users;
  await expect(ann.getByRole('heading', { name: 'Chat as Ann', exact: true })).toBeVisible();
  await expect(bob.getByRole('heading', { name: 'Chat as Bob', exact: true })).toBeVisible();

  await send(ann, 'Hi Bob');
  await expect(bob.getByRole('log', { name: 'Messages', exact: true })).toHaveText('Ann: Hi Bob');

  await send(bob, 'Hi Ann');
  await expect(ann.getByRole('log', { name: 'Messages', exact: true })).toHaveText('Ann: Hi BobBob: Hi Ann');
});
```

**Follow-ups:**
- *Why not two pages in one context?* They share cookies and local storage, so both are the same logged-in user. Two users need two contexts.
- *How would you test it with real WebSockets?* The same test. Optionally I also use `page.on('websocket')` to look at frames, or `page.routeWebSocket` to mock the server. The user-visible assertion stays the main check.
- *How do you test a user who goes offline?* `context.setOffline(true)` on that user's context, send from the other user, switch back with `setOffline(false)`, and assert the message arrives.

**Trap:** Using `page.waitForTimeout(1000)` "for the message to arrive", or using one context for two users. Both pass on the developer's machine and fail for the wrong reason.

### Home task: fixtures or `let` variables in hooks? Show the difference on the cart tests.

Topic: pw-fixtures | Core | id: q1048

**What you receive:** A repository with Playwright installed and configured, and the cart tests written with `let` and `beforeEach` from step 1.

**Say:** Variables assigned in hooks have three problems. They are typed as possibly unset, so I need `!` or a guard. They run for every test in the scope, even tests that do not use them. And when I share one page through `beforeAll`, state leaks from one test to the next. A fixture is set up only for the tests that ask for it, it has setup and teardown in one place around `use`, it is fully typed, and fixtures can depend on each other. So I move the page object and the "cart with a mug" state into fixtures and let the tests list what they need.

**Full process:**
1. Brief as given: "Our cart tests use `let` and `beforeEach`. A colleague says fixtures are better. Show me why." The `let` version with a page shared in `beforeAll` is the worst case:

```ts
import { test, expect, type Locator, type Page } from '@playwright/test';
import { shopHtml } from './support/shop';

let page: Page;
let status: Locator;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.setContent(shopHtml);
  status = page.getByRole('status');
});

test.afterAll(async () => {
  await page.close();
});

test('adds a mug', async () => {
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await expect(status).toHaveText('Cart: 1 item');
});

test('expects an empty cart, but the page is shared', async () => {
  await expect(status).toHaveText('Cart: 0 items');
});
```

2. Run it with one worker. `adds a mug` passes. `expects an empty cart` fails with `Expected: "Cart: 0 items"` and `Received: "Cart: 1 item"`, because the second test inherits the first test's page. It only passes when run alone, so it is also order dependent.
3. The common softer version is `let cart: Cart;` assigned in `beforeEach`. That one does not leak state, but it is still typed as possibly unset in strict mode, and it runs for every test in the file.
4. The fixture version. `cart` builds the page object after opening the page. `cartWithMug` depends on `cart` and puts one mug in it. A test asks for exactly the state it needs. The third test does not use `cart` at all, so no shop is opened for it.

```ts
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { shopHtml } from './support/shop';

class Cart {
  readonly status: Locator;

  constructor(private readonly page: Page) {
    this.status = page.getByRole('status');
  }

  async add(product: string): Promise<void> {
    await this.page
      .getByRole('article')
      .filter({ has: this.page.getByRole('heading', { name: product, exact: true }) })
      .getByRole('button', { name: 'Add to cart', exact: true })
      .click();
  }
}

export const test = base.extend<{ cart: Cart; cartWithMug: Cart }>({
  cart: async ({ page }, use) => {
    await page.setContent(shopHtml);
    await use(new Cart(page));
  },
  cartWithMug: async ({ cart }, use) => {
    await cart.add('Blue Mug');
    await expect(cart.status).toHaveText('Cart: 1 item');
    await use(cart);
  },
});

test('an empty cart', async ({ cart }) => {
  await expect(cart.status).toHaveText('Cart: 0 items');
});

test('a second product makes two items', async ({ cartWithMug }) => {
  await cartWithMug.add('Red Cap');
  await expect(cartWithMug.status).toHaveText('Cart: 2 items');
});

test('a test that needs no shop does not pay for one', async ({ page }) => {
  await page.setContent('<p>plain</p>');
  await expect(page.getByText('plain', { exact: true })).toBeVisible();
});
```

5. All three fixture tests pass, in any order and in parallel.

**Follow-ups:**
- *When do you still use `beforeEach`?* For a small, uniform step that every test in a `describe` needs, such as opening one page. I put anything with teardown or with dependencies into a fixture.
- *When does a fixture run?* Lazily, the first time a test, a hook or another fixture asks for it. Add `auto: true` to run it for every test even if unused, for example to collect console errors.
- *What is the teardown order?* Code after `use` runs after the test, in the reverse order of setup, and it still runs when the test fails.

**Trap:** Sharing a `page` created in `beforeAll` across tests to save time. It saves milliseconds and costs isolation. The failure shows up as "flaky" tests that fail only in a certain order.

### Home task: a form posts JSON to `/api/orders`. Test the request payload and the error from the server.

Topic: pw-network | Core | id: q1049

**What you receive:** A repository with Playwright installed and configured, and the order form page (`formHtml`). There is no backend, so you answer `/api/orders` yourself.

**Say:** The user-visible result is not enough here, because the page can show success while sending the wrong body. So I check both: the request that left the browser and the message on screen. I start `waitForRequest` in the same `Promise.all` as the click, because the request is fired by the click and I could miss it otherwise. I read the body with `postDataJSON()`. Then a second test makes the server answer 422 and checks that the user sees the message. I use `exact: true` on the labels and the button, and no ids.

**Full process:**
1. Brief as given: "When the user submits, the page POSTs the order. Verify what is sent and what happens on 422."
2. In `beforeEach`, serve the page from a route and open it.
3. Success test: mock `/api/orders` with 201 and `{ id: 'A-7' }`. Fill the form. Then `Promise.all([page.waitForRequest(...), click])`. The predicate checks URL and method, so a stray GET cannot match.
4. Assert `request.postDataJSON()` equals `{ name: 'Ann', quantity: 3 }`. Note `quantity` is a number: a string `'3'` would be a bug the UI cannot show.
5. Error test: mock 422 with an error message. Use `waitForResponse` the same way and assert the status and the visible text.
6. Run: both pass.

```ts
import { test, expect } from '@playwright/test';

const formHtml = `<!doctype html>
<html lang="en"><body>
<form id="f">
  <label for="name">Name</label><input id="name">
  <label for="qty">Quantity</label><input id="qty" type="number">
  <button type="submit">Place order</button>
</form>
<p id="result" role="status"></p>
<script>
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: document.getElementById('name').value, quantity: Number(document.getElementById('qty').value) }),
    });
    const body = await res.json();
    document.getElementById('result').textContent = res.ok ? 'Order ' + body.id + ' placed' : 'Rejected: ' + body.error;
  });
</script>
</body></html>`;

test.beforeEach(async ({ page }) => {
  await page.route('https://shop.test/', (r) => r.fulfill({ contentType: 'text/html', body: formHtml }));
  await page.goto('https://shop.test/');
});

test('submitting sends the right JSON and shows the order id', async ({ page }) => {
  await page.route('https://shop.test/api/orders', (r) => r.fulfill({ status: 201, json: { id: 'A-7' } }));
  await page.getByLabel('Name', { exact: true }).fill('Ann');
  await page.getByLabel('Quantity', { exact: true }).fill('3');

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().endsWith('/api/orders') && req.method() === 'POST'),
    page.getByRole('button', { name: 'Place order', exact: true }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({ name: 'Ann', quantity: 3 });
  expect(request.headers()['content-type']).toBe('application/json');
  await expect(page.getByRole('status')).toHaveText('Order A-7 placed');
});

test('a 422 from the server is shown to the user', async ({ page }) => {
  await page.route('https://shop.test/api/orders', (r) =>
    r.fulfill({ status: 422, json: { error: 'quantity must be positive' } }),
  );
  await page.getByLabel('Name', { exact: true }).fill('Ann');
  await page.getByLabel('Quantity', { exact: true }).fill('0');

  const [response] = await Promise.all([
    page.waitForResponse('https://shop.test/api/orders'),
    page.getByRole('button', { name: 'Place order', exact: true }).click(),
  ]);

  expect(response.status()).toBe(422);
  await expect(page.getByRole('status')).toHaveText('Rejected: quantity must be positive');
});
```

**Follow-ups:**
- *Why a predicate and not just a URL string?* The URL alone also matches an OPTIONS preflight or a GET. The method makes the match exact.
- *What if the page sends the request twice?* Count the requests in the route handler and assert the count. That finds double submits.
- *Where do you keep the order shape?* In a shared TypeScript type used by the test and the mock, so a contract change breaks compilation, not production.

**Trap:** Calling `await click()` and then `page.waitForRequest()`. The request may already be gone. Also checking only the success message, which cannot see a wrong request body.

### Home task: log in once and reuse the session in all other tests (storage state).

Topic: pw-auth | Core | id: q1050

**What you receive:** A repository with Playwright installed and configured, and the app page with a login form (`appHtml`). You add the setup that logs in once.

**Say:** Logging in through the UI before every test is slow and fails for reasons that are not the feature under test. So I add a setup project that logs in once, saves the browser state to a file with `storageState`, and the main project depends on it and loads that file. Every test then starts signed in. A test that needs a signed-out user overrides the state with an empty one. I keep one real UI login test elsewhere, because the setup is not a test of login. The state file holds a live session, so it goes in `.gitignore`.

**Full process:**
1. Brief as given: "Tests need a logged-in user. Do it so we do not log in 200 times."
2. Config with two projects. `setup` matches `auth.setup.ts`. `chromium` has `use: { storageState: '.auth/user.json' }` and `dependencies: ['setup']`, so setup always runs first.
3. The setup file logs in through the UI, asserts the dashboard, then calls `page.context().storageState({ path })`. The file holds cookies and local storage. In this demo the token lives in local storage.
4. Tests do nothing special. They open the page and are signed in.
5. A signed-out test uses `test.use({ storageState: { cookies: [], origins: [] } })`.
6. Run with `npx playwright test -c playwright.auth.config.ts`. Setup runs first, then the two tests, all three pass.
7. Add `.auth` to `.gitignore`.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './auth',
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});
```

```ts
import type { Page } from '@playwright/test';

const appHtml = `<!doctype html>
<html lang="en"><body>
<main id="main"></main>
<script>
  const main = document.getElementById('main');
  const token = localStorage.getItem('token');
  if (token) {
    main.innerHTML = '<h1>Dashboard</h1><p>Signed in as ' + localStorage.getItem('user') + '</p>';
  } else {
    main.innerHTML = '<h1>Sign in</h1><label for="u">Username</label><input id="u">' +
      '<label for="p">Password</label><input id="p" type="password"><button id="go">Sign in</button>';
    document.getElementById('go').onclick = async () => {
      const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({
        user: document.getElementById('u').value, password: document.getElementById('p').value }) });
      if (!res.ok) return;
      const body = await res.json();
      localStorage.setItem('token', body.token);
      localStorage.setItem('user', document.getElementById('u').value);
      location.reload();
    };
  }
</script>
</body></html>`;

export async function mountApp(page: Page): Promise<void> {
  await page.route('https://app.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: appHtml }),
  );
  await page.route('https://app.test/api/login', (route) =>
    route.fulfill({ json: { token: 'abc123' } }),
  );
}
```

```ts
import { test as setup, expect } from '@playwright/test';
import { mountApp } from './app-mock';

export const authFile = '.auth/user.json';

setup('log in once and save the state', async ({ page }) => {
  await mountApp(page);
  await page.goto('https://app.test/');
  await page.getByLabel('Username', { exact: true }).fill('ann');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```

```ts
import { test, expect } from '@playwright/test';
import { mountApp } from './app-mock';

test('starts already signed in', async ({ page }) => {
  await mountApp(page);
  await page.goto('https://app.test/');

  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByText('Signed in as ann', { exact: true })).toBeVisible();
});

test.describe('a test that needs a signed-out user', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sees the sign in form', async ({ page }) => {
    await mountApp(page);
    await page.goto('https://app.test/');

    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  });
});
```

**Follow-ups:**
- *What if tests change the user's data?* Then one shared account causes conflicts across workers. I create one account per worker with a worker-scoped fixture, and save a state file per worker.
- *What if the token expires during the run?* I log in through the API in setup and refresh the file when it is older than the token life, or use a fixture that checks expiry.
- *Why a project dependency and not `globalSetup`?* A setup project appears in the HTML report and the trace, uses fixtures such as `page`, and retries like any test.

**Trap:** Committing the state file, or using one stored session for tests that change the account's settings in parallel.

## Home tasks: TypeScript

These run like the live TypeScript tasks: standalone files, `node name.ts`, asserts at the bottom.

### Home task: write a `retry` helper with exponential backoff and a typed result.

Topic: js-core | Standard | id: q1051

**What you receive:** A TypeScript file with the `retry` signature and the `RetryOptions` type. You write the body and the asserts.

**Say:** I take an async operation and options: number of retries, base delay, optional cap, and a predicate that says if an error is worth retrying. Delay doubles each time, and I add jitter, so many clients do not retry at the same moment. The function is generic, so the result keeps the type of the operation. I let the caller pass in the `sleep` function, which makes the test instant and deterministic. I do not retry errors like a 400 that will never succeed, and I rethrow the last error when I give up.

**Full process:**
1. Signature: `retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T>`.
2. Loop with the attempt number. On error: if attempts are used up or `shouldRetry` says no, rethrow. Otherwise sleep `min(base * 2 ** attempt, max)` with jitter.
3. Test with a fake `sleep` that records delays: three calls (two failures), two delays inside their jitter ranges, always failing gives three calls and the error, a non-retryable error gives one call.
4. Run the file: it prints `retry: ok`.

```ts
import assert from 'node:assert/strict';

export type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, baseDelayMs, maxDelayMs = Infinity, shouldRetry = () => true, sleep = realSleep } = options;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(delay * (0.5 + Math.random() / 2));
    }
  }
}

async function main(): Promise<void> {
  const delays: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    delays.push(ms);
  };

  let calls = 0;
  const flaky = async (): Promise<string> => {
    calls += 1;
    if (calls < 3) throw new Error('boom');
    return 'ok';
  };
  assert.equal(await retry(flaky, { retries: 5, baseDelayMs: 100, sleep }), 'ok');
  assert.equal(calls, 3);
  assert.equal(delays.length, 2);
  assert.ok(delays[0] >= 50 && delays[0] <= 100);
  assert.ok(delays[1] >= 100 && delays[1] <= 200);

  let failing = 0;
  await assert.rejects(
    retry(async () => { failing += 1; throw new Error('always'); }, { retries: 2, baseDelayMs: 1, sleep }),
    /always/,
  );
  assert.equal(failing, 3);

  let notRetried = 0;
  await assert.rejects(
    retry(async () => { notRetried += 1; throw new Error('400 bad request'); }, {
      retries: 5, baseDelayMs: 1, sleep, shouldRetry: (e) => !(e instanceof Error && e.message.startsWith('400')),
    }),
  );
  assert.equal(notRetried, 1);
  console.log('retry: ok');
}

void main();
```

**Follow-ups:**
- *Why jitter?* Without it, clients that failed together retry together and overload the server again. This is the thundering herd.
- *Where would a test engineer use it?* Around a flaky external call in setup or seeding code. I would not wrap UI assertions in it, because Playwright assertions already retry, and a retry loop around them hides real races.
- *What about timeouts and cancellation?* Pass an `AbortSignal` into the operation and into the sleep, and check it before each attempt.

**Trap:** Retrying every error, including a 4xx, and swallowing the final error. The other trap is a real `setTimeout` in the test, which makes the test slow.

### Home task: parse a log file and count the errors per service.

Topic: js-core | Standard | id: q1052

**What you receive:** The question and a few sample log lines. Ask about the format before you write code.

**Say:** I define the line format first, then one regular expression with capture groups for time, level, service and message. I give the level a union type, so `ERROR` is checked by the compiler. Lines that do not match are counted as skipped, not thrown away silently and not allowed to crash the run, because a real log always has junk lines. Then a second function turns the entries into a `Map` of error counts per service. I keep parsing and counting apart, so each can be tested alone.

**Full process:**
1. Ask: "Format? Are there multi-line stack traces? How big is the file?" For a big file I would read it as a stream, line by line, and not load it whole.
2. Write the regular expression `^(\S+)\s+(INFO|WARN|ERROR)\s+\[([^\]]+)\]\s+(.*)$`.
3. `parseLog` returns `{ entries, skipped }`, `errorsPerService` returns a `Map`.
4. Asserts on a sample with a garbage line and an empty line: five entries, one skipped, `payment` has 2 errors and `search` has 1.

```ts
import assert from 'node:assert/strict';

export type Level = 'INFO' | 'WARN' | 'ERROR';
export type LogEntry = { time: string; level: Level; service: string; message: string };

const LINE = /^(\S+)\s+(INFO|WARN|ERROR)\s+\[([^\]]+)\]\s+(.*)$/;

export function parseLog(text: string): { entries: LogEntry[]; skipped: number } {
  const entries: LogEntry[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const match = LINE.exec(line);
    if (!match) {
      skipped += 1;
      continue;
    }
    const [, time, level, service, message] = match;
    entries.push({ time, level: level as Level, service, message });
  }
  return { entries, skipped };
}

export function errorsPerService(entries: readonly LogEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.level === 'ERROR') counts.set(e.service, (counts.get(e.service) ?? 0) + 1);
  }
  return counts;
}

const sample = `2026-11-05T10:00:01Z INFO [checkout] Cart created id=42
2026-11-05T10:00:02Z ERROR [payment] Card declined id=42
this line is garbage
2026-11-05T10:00:03Z WARN [checkout] Slow response 1200ms

2026-11-05T10:00:04Z ERROR [payment] Timeout id=43
2026-11-05T10:00:05Z ERROR [search] Index missing`;

const { entries, skipped } = parseLog(sample);
assert.equal(entries.length, 5);
assert.equal(skipped, 1);
assert.deepEqual(entries[1], {
  time: '2026-11-05T10:00:02Z', level: 'ERROR', service: 'payment', message: 'Card declined id=42',
});
assert.deepEqual([...errorsPerService(entries)], [['payment', 2], ['search', 1]]);
console.log('parse-log: ok');
```

**Follow-ups:**
- *How would you read a 2 GB file?* `readline` over `createReadStream`, one line at a time, with the same line parser. Memory stays constant.
- *What would you add for a test report?* The first error time per service, the top messages by frequency, and a time window filter.
- *Would you script it or use the shell?* For a one-off look, `grep` and `sort | uniq -c` on the command line. A script is better when a test must check the result.

**Trap:** Splitting on spaces and indexing, which breaks when the message has spaces, and a parser that throws on the first bad line.

## Home tasks: API with Playwright

These tasks use a tiny in-memory API that starts inside the test run, so they need no network and no account. Save it once as `tests/support/api.ts`. It has `POST /auth/login`, `GET /users` with `page` and `pageSize`, `GET /users/:id`, `POST /users` and `DELETE /users/:id`. All except login need the header `Authorization: Bearer secret-token-123`. A worker-scoped fixture `api` starts the server once for each worker and gives the tests its URL. In a real interview you test the company's API and skip this file.

```ts
import { test as base } from '@playwright/test';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type User = { id: number; email: string; name: string; role: 'admin' | 'user' };

const TOKEN = 'secret-token-123';

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {}));
  });
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function startApi(): Promise<{ server: Server; url: string }> {
  const users: User[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
    role: i === 0 ? 'admin' : 'user',
  }));
  let nextId = 26;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';

    if (method === 'POST' && url.pathname === '/auth/login') {
      const body = await readJson(req);
      if (body.email === 'admin@example.com' && body.password === 'correct-horse') {
        return send(res, 200, { token: TOKEN, expiresIn: 3600 });
      }
      return send(res, 401, { error: 'invalid credentials' });
    }

    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { error: 'missing or invalid token' });
    }

    if (method === 'GET' && url.pathname === '/users') {
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '10');
      const data = users.slice((page - 1) * pageSize, page * pageSize);
      return send(res, 200, { data, page, pageSize, total: users.length });
    }

    const one = /^\/users\/(\d+)$/.exec(url.pathname);
    if (one && method === 'GET') {
      const user = users.find((u) => u.id === Number(one[1]));
      return user ? send(res, 200, user) : send(res, 404, { error: 'not found' });
    }
    if (one && method === 'DELETE') {
      const index = users.findIndex((u) => u.id === Number(one[1]));
      if (index === -1) return send(res, 404, { error: 'not found' });
      users.splice(index, 1);
      return send(res, 204);
    }

    if (method === 'POST' && url.pathname === '/users') {
      const body = await readJson(req);
      if (typeof body.email !== 'string' || !body.email.includes('@') || typeof body.name !== 'string' || body.name === '') {
        return send(res, 422, { error: 'validation failed', fields: ['email', 'name'] });
      }
      if (users.some((u) => u.email === body.email)) return send(res, 409, { error: 'email taken' });
      const user: User = { id: nextId, email: body.email, name: body.name, role: 'user' };
      nextId += 1;
      users.push(user);
      return send(res, 201, user, { location: `/users/${user.id}` });
    }

    return send(res, 404, { error: 'no such route' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

export const test = base.extend<{}, { api: { url: string; token: string } }>({
  api: [
    async ({}, use) => {
      const { server, url } = await startApi();
      await use({ url, token: TOKEN });
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
```

### Home task: test a REST endpoint with Playwright's `request`: read, create, validation errors, not found.

Topic: pw-api | Core | id: q1053

**What you receive:** A repository with Playwright installed and configured, and the local users API from `tests/support/api.ts` with its `api` fixture.

**Say:** I use the `request` fixture, which sends real HTTP without a browser, so the tests are fast. For each endpoint I check the status code first, then the headers that matter, then the body. A create call returns 201 with a `Location` header, so I check both and I fetch the new resource to prove it exists. Invalid input is a table of cases, one test per row, each expecting 422. I also test the unhappy paths: 404, and 409 for a duplicate. One thing I say aloud is that the status code alone is a weak assertion.

**Full process:**
1. Brief as given: "Here is the users API. Write tests for it."
2. Set the auth header once with `test.use({ extraHTTPHeaders: {...} })` inside the `describe`. Every request from the `request` fixture then carries it.
3. Read: `request.get(url)`. Assert `status()`, the `content-type` header and the whole body with `toEqual`.
4. Create: `request.post(url, { data })`. `data` is serialised as JSON and the content type is set for you. Use a unique email each time, so a rerun does not hit 409.
5. Read back with the id from the response and compare.
6. Validation: a loop over invalid bodies, each its own test, so one failure names the case.
7. Run: 7 tests pass in about 0.2 s.

```ts
import { test, expect } from './support/api';

test.describe('Users API', () => {
  test.use({ extraHTTPHeaders: { authorization: 'Bearer secret-token-123' } });

  test('GET /users/1 returns the user', async ({ request, api }) => {
    const response = await request.get(`${api.url}/users/1`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({
      id: 1,
      email: 'user1@example.com',
      name: 'User 1',
      role: 'admin',
    });
  });

  test('GET an unknown user returns 404 with an error body', async ({ request, api }) => {
    const response = await request.get(`${api.url}/users/99999`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
  });

  test('POST /users creates a user and returns 201 with a Location header', async ({ request, api }) => {
    const email = `new-${Date.now()}@example.com`;
    const response = await request.post(`${api.url}/users`, { data: { email, name: 'New Person' } });

    expect(response.status()).toBe(201);
    const created = (await response.json()) as { id: number; email: string };
    expect(created).toMatchObject({ email, name: 'New Person', role: 'user' });
    expect(response.headers()['location']).toBe(`/users/${created.id}`);

    const fetched = await request.get(`${api.url}/users/${created.id}`);
    expect(fetched.status()).toBe(200);
    expect(await fetched.json()).toEqual(created);
  });

  const invalidBodies = [
    { name: 'no email', data: { name: 'No Email' } },
    { name: 'email without @', data: { email: 'nope', name: 'Bad Email' } },
    { name: 'empty name', data: { email: 'x@example.com', name: '' } },
  ];
  for (const { name, data } of invalidBodies) {
    test(`POST /users rejects ${name} with 422`, async ({ request, api }) => {
      const response = await request.post(`${api.url}/users`, { data });

      expect(response.status()).toBe(422);
      expect(await response.json()).toMatchObject({ error: 'validation failed' });
    });
  }

  test('POST /users with a taken email returns 409', async ({ request, api }) => {
    const response = await request.post(`${api.url}/users`, { data: { email: 'user2@example.com', name: 'Copy' } });

    expect(response.status()).toBe(409);
  });
});
```

**Follow-ups:**
- *What else would you test on this endpoint?* Idempotency of retries, field length limits, unicode names, case of the email, concurrent creates with the same email, and that a normal user cannot read or delete an admin.
- *Where does the base URL go?* In the config as `use: { baseURL }`, and then the tests call `request.get('/users/1')`. My fixture builds the URL because the port is random.
- *What is `request` and what is `page.request`?* Both are an `APIRequestContext`. The `request` fixture has its own cookie jar. `page.request` shares cookies with the page, so it is useful to call the API as the logged-in browser user.

**Trap:** Asserting only `response.ok()`. A 200 with the wrong body, or a 201 without the stored resource, passes. Another trap is using a fixed email, so the second run fails with 409 and the test looks flaky.

### Home task: the API needs a token. Log in, then call a protected endpoint. Chain the calls.

Topic: pw-auth | Core | id: q1054

**What you receive:** A repository with Playwright installed and configured, and the local users API from `tests/support/api.ts` with its `api` fixture, plus the login email and password.

**Say:** I log in once through the API, take the token from the response, and build a second request context that sends the token in a header on every call. I put it in a fixture, so a test just asks for `authed` and gets a client that is already signed in, and the fixture disposes both contexts at the end. I also test the other side: no token gives 401, and a wrong password gives 401 and no token in the body. I check the login status before I read the body, so a failed login shows up as a failed login and not as a confusing parse error.

**Full process:**
1. Brief as given: "Log in with email and password, then fetch a user with the token."
2. Create an anonymous context with `playwright.request.newContext({ baseURL })`.
3. `post('/auth/login', { data })`, assert `200`, then read `token` from the JSON.
4. Dispose the anonymous context. Create the second context with `extraHTTPHeaders: { authorization: 'Bearer ' + token }`.
5. `await use(authed)`, then `dispose()` after the test.
6. Negative tests use an anonymous context to prove 401.
7. Run: 3 tests pass.

```ts
import type { APIRequestContext } from '@playwright/test';
import { test as base, expect } from './support/api';

type AuthFixtures = { authed: APIRequestContext };

const test = base.extend<AuthFixtures>({
  authed: async ({ playwright, api }, use) => {
    const anonymous = await playwright.request.newContext({ baseURL: api.url });
    const login = await anonymous.post('/auth/login', {
      data: { email: 'admin@example.com', password: 'correct-horse' },
    });
    expect(login.status()).toBe(200);
    const { token } = (await login.json()) as { token: string };
    await anonymous.dispose();

    const authed = await playwright.request.newContext({
      baseURL: api.url,
      extraHTTPHeaders: { authorization: `Bearer ${token}` },
    });
    await use(authed);
    await authed.dispose();
  },
});

test('the token from login opens a protected endpoint', async ({ authed }) => {
  const response = await authed.get('/users/1');

  expect(response.status()).toBe(200);
});

test('the same endpoint without a token returns 401', async ({ playwright, api }) => {
  const anonymous = await playwright.request.newContext({ baseURL: api.url });

  const response = await anonymous.get('/users/1');

  expect(response.status()).toBe(401);
  await anonymous.dispose();
});

test('a wrong password returns 401 and no token', async ({ playwright, api }) => {
  const anonymous = await playwright.request.newContext({ baseURL: api.url });

  const response = await anonymous.post('/auth/login', { data: { email: 'admin@example.com', password: 'wrong' } });

  expect(response.status()).toBe(401);
  expect(await response.json()).not.toHaveProperty('token');
  await anonymous.dispose();
});
```

**Follow-ups:**
- *Where do you keep the credentials?* In environment variables read by the config or the fixture, never in the repository. The demo password here is a placeholder.
- *How do you avoid logging in for every test?* Use a worker-scoped fixture so each worker logs in once, or save the state to a file in a setup project. The token must outlive the run, or the fixture must refresh it.
- *OAuth or a JWT?* The chain is the same: get a token from the token endpoint, send `Authorization: Bearer`. For a JWT I can decode the payload in a test to check the expiry and the claims, but I do not trust the decoded data without the server verifying the signature.

**Trap:** Copying a token from the browser into the test file. It expires, and it ends up in git.

### Home task: verify the response schema, not just a few fields.

Topic: pw-api | Core | id: q1055

**What you receive:** A repository with Playwright installed and configured, and the local users API from `tests/support/api.ts` with its `api` fixture.

**Say:** A schema test catches the changes a field-by-field test misses: a field that changed type, a missing field, and a field that should not be there at all. I write a type guard that checks each field's type and the exact set of keys, so a leaked `password` field fails the test. Then I apply it to one user and to every user in a list. For the list envelope I use `expect.any(Array)` and `expect.any(Number)` for values I cannot predict. In a real project I would generate the validation from the OpenAPI document, so the schema has one source.

**Full process:**
1. Brief as given: "Check the shape of the user response."
2. Write `isUser(value: unknown): value is User`. Parse from `unknown`, never `any`, so the compiler forces each check.
3. `Object.keys(v).length === 4` fails on any extra field.
4. Test a single user, then a list of 25 (`pageSize=25`). Filtering the invalid ones and comparing with `[]` prints the bad items in the failure.
5. Test the envelope with asymmetric matchers inside `toEqual`.
6. Run: 3 tests pass.

```ts
import { test, expect } from './support/api';

type User = { id: number; email: string; name: string; role: 'admin' | 'user' };

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isInteger(v.id) &&
    typeof v.email === 'string' &&
    v.email.includes('@') &&
    typeof v.name === 'string' &&
    (v.role === 'admin' || v.role === 'user') &&
    Object.keys(v).length === 4
  );
}

test.use({ extraHTTPHeaders: { authorization: 'Bearer secret-token-123' } });

test('GET /users/1 matches the User schema and leaks no extra fields', async ({ request, api }) => {
  const body: unknown = await (await request.get(`${api.url}/users/1`)).json();

  expect(isUser(body)).toBe(true);
  expect(body).not.toHaveProperty('password');
});

test('every user in the list matches the schema', async ({ request, api }) => {
  const body = (await (await request.get(`${api.url}/users?pageSize=25`)).json()) as { data: unknown[] };

  expect(body.data).toHaveLength(25);
  expect(body.data.filter((u) => !isUser(u))).toEqual([]);
});

test('the list envelope has the documented shape', async ({ request, api }) => {
  const response = await request.get(`${api.url}/users?page=2&pageSize=5`);

  expect(await response.json()).toEqual({
    data: expect.any(Array),
    page: 2,
    pageSize: 5,
    total: expect.any(Number),
  });
});
```

**Follow-ups:**
- *Which library would you use?* Ajv or Zod. Ajv validates the JSON Schema or the OpenAPI schema directly. Zod is nice when the type is also needed in TypeScript. I would pick the one the team already has.
- *How do you handle optional and nullable fields?* The schema must say which. A test that accepts both `null` and missing hides a change, so I pin the documented one.
- *What is contract testing, then?* A schema test checks one side against a document. Contract testing with a consumer-driven tool such as Pact checks both sides. OpenAPI contract tests have been used, not Pact.

**Trap:** `expect(body.name).toBeTruthy()` for every field. A number `1` and a string `"1"` both pass.

### Home task: the page calls a GraphQL endpoint. Mock it and test a success and an error.

Topic: api-graphql | Niche | id: q1056

**What you receive:** A repository with Playwright installed and configured, and the profile page (`appHtml`). There is no backend, so you mock the GraphQL endpoint.

**Say:** GraphQL goes through one URL with POST, so I cannot route by path. I read the body: `operationName` tells me which query it is. I fulfil the one I care about and `fallback()` for the rest. I also record every body that the page sent and assert the operation name and the variables, because a page that asks for the wrong user shows the wrong data. The second test returns HTTP 200 with an `errors` array and no data, which is how GraphQL reports many failures, and checks that the page shows it. If you have not run a GraphQL service in production, say so, then explain that the transport is plain HTTP and it can be tested the same way.

**Full process:**
1. Brief as given: "The profile page loads a user through GraphQL. Test it without the backend."
2. Serve the page from a route at `https://app.test/`.
3. `page.route('https://app.test/graphql', handler)`. In the handler, `route.request().postDataJSON()` gives `{ operationName, query, variables }`.
4. For `GetUser` fulfil `{ data: { user: { name: 'Ann' } } }`. For anything else, `route.fallback()` passes it on to the next matching handler or the network.
5. Assert the screen and the captured request bodies.
6. Error test: `{ data: null, errors: [{ message: 'User not found' }] }` with status 200. A GraphQL error is not an HTTP error, so the status is not the signal.
7. Run: 2 tests pass.

```ts
import { test, expect } from '@playwright/test';

const appHtml = `<!doctype html>
<html lang="en"><body>
<h1>Profile</h1>
<p id="out" role="status">Loading...</p>
<script>
  fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationName: 'GetUser', query: 'query GetUser($id: ID!) { user(id: $id) { name } }', variables: { id: '7' } }),
  })
    .then((r) => r.json())
    .then((payload) => {
      const out = document.getElementById('out');
      if (payload.errors) out.textContent = 'Error: ' + payload.errors[0].message;
      else out.textContent = 'Hello, ' + payload.data.user.name;
    });
</script>
</body></html>`;

type GraphQLBody = { operationName: string; variables: { id: string } };

test.beforeEach(async ({ page }) => {
  await page.route('https://app.test/', (r) => r.fulfill({ contentType: 'text/html', body: appHtml }));
});

test('the page sends GetUser with the id and shows the name', async ({ page }) => {
  const seen: GraphQLBody[] = [];
  await page.route('https://app.test/graphql', async (route) => {
    const body = route.request().postDataJSON() as GraphQLBody;
    seen.push(body);
    if (body.operationName === 'GetUser') {
      await route.fulfill({ json: { data: { user: { name: 'Ann' } } } });
    } else {
      await route.fallback();
    }
  });
  await page.goto('https://app.test/');

  await expect(page.getByRole('status')).toHaveText('Hello, Ann');
  expect(seen).toEqual([expect.objectContaining({ operationName: 'GetUser', variables: { id: '7' } })]);
});

test('a GraphQL error comes with HTTP 200 and the page shows it', async ({ page }) => {
  await page.route('https://app.test/graphql', (route) =>
    route.fulfill({ status: 200, json: { data: null, errors: [{ message: 'User not found' }] } }),
  );
  await page.goto('https://app.test/');

  await expect(page.getByRole('status')).toHaveText('Error: User not found');
});
```

**Follow-ups:**
- *What if the client sends several operations in one request (batching)?* The body is an array, so the handler maps over it and returns an array in the same order.
- *How do you test a GraphQL API directly?* `request.post('/graphql', { data: { query, variables } })`, then assert `data` and that `errors` is undefined. Both the status and `errors` matter.
- *Introspection or schema?* I would validate queries against the schema in CI, so a removed field breaks the build, not the page.

**Trap:** Mocking by URL only and answering every POST the same way, so the test passes for the wrong query. Another trap is treating status 200 as success.

### Home task: test the full life of a resource and pagination, and clean up after yourself.

Topic: pw-api | Core | id: q1057

**What you receive:** A repository with Playwright installed and configured, and the local users API from `tests/support/api.ts` with its `api` fixture.

**Say:** Two things here. First the life cycle: create, read, delete, read again and expect 404. The created user comes from a fixture, which also deletes it afterwards, so a failing test does not leave data behind. Second, pagination: I walk the pages until one is empty, collect the ids, and check that there are no duplicates. That catches an off-by-one between pages, which is the common bug. I use unique data and never depend on what other tests left behind.

**Full process:**
1. Brief as given: "Test create and delete, and check that paging returns everything once."
2. Fixture `createdUser`: POST with a unique email (time and random suffix), assert 201, `use(created)`, then DELETE. The teardown runs even when the test fails, and a 404 there (because the test already deleted it) does not matter.
3. Test one: read gives 200, delete gives 204, read again gives 404.
4. Test two: loop `page = 1, 2, 3...` until `data.length === 0`. `new Set(ids).size` equals `ids.length` proves no duplicates.
5. Run: 2 tests pass.

```ts
import { test as base, expect } from './support/api';

type Created = { id: number; email: string };

const test = base.extend<{ createdUser: Created }>({
  createdUser: async ({ request, api }, use) => {
    const email = `fixture-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const response = await request.post(`${api.url}/users`, { data: { email, name: 'Temp' } });
    expect(response.status()).toBe(201);
    const created = (await response.json()) as Created;
    await use(created);
    await request.delete(`${api.url}/users/${created.id}`);
  },
});

test.use({ extraHTTPHeaders: { authorization: 'Bearer secret-token-123' } });

test('create, read, delete, read again', async ({ request, api, createdUser }) => {
  const read = await request.get(`${api.url}/users/${createdUser.id}`);
  expect(read.status()).toBe(200);

  const removed = await request.delete(`${api.url}/users/${createdUser.id}`);
  expect(removed.status()).toBe(204);

  const gone = await request.get(`${api.url}/users/${createdUser.id}`);
  expect(gone.status()).toBe(404);
});

test('walking all pages returns every user exactly once', async ({ request, api }) => {
  const ids: number[] = [];
  let page = 1;
  for (;;) {
    const response = await request.get(`${api.url}/users?page=${page}&pageSize=10`);
    const body = (await response.json()) as { data: { id: number }[]; total: number };
    if (body.data.length === 0) break;
    ids.push(...body.data.map((u) => u.id));
    page += 1;
  }

  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBeGreaterThanOrEqual(25);
});
```

**Follow-ups:**
- *What else is wrong with paging in real APIs?* Items added or removed while you walk the pages cause duplicates or gaps. Cursor-based paging avoids it, and I test that by inserting an item between two page calls.
- *Why is cleanup in a fixture and not in `afterEach`?* The fixture sits next to the creation, so the two cannot drift apart, and it only runs for tests that used it.
- *What if the delete in teardown fails?* A failing cleanup should be loud, because it leaves data behind. I would assert the status unless 404 is expected.

**Trap:** Tests that depend on data from a previous test, or on the total count of the shared environment. Both break when the order or the data changes.
