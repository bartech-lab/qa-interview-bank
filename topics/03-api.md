# APIs, HTTP, auth, contracts, integrations and messaging

How to study this file: read the sections in order, because later answers lean on earlier ones. Start with "HTTP methods and REST basics" and "Status codes", since PUT vs PATCH and 201 vs 202 come up in real screenings. For each entry, say the **Say** paragraph out loud first, then read **Full process** and type the code once by hand. Every Playwright snippet assumes `baseURL` is set in `playwright.config.ts` and uses the built-in `request` fixture.

## HTTP methods and REST basics

### What is the difference between PUT and PATCH?

Topic: api-rest | Core | id: q0308

**Say:** PUT replaces the whole resource. I send the full object, and any field I leave out is cleared or reset, or the server rejects the request. PATCH changes only the fields I send, and everything else stays as it was. PUT is idempotent by definition: sending it twice leaves the same state. PATCH is not guaranteed to be idempotent, because a patch can say "add 1 to the counter" or "append to the list". As a tester, the PUT check is "did the omitted field disappear or get rejected", and the PATCH check is "did the omitted fields keep their values".

**Full process:** how I test both on a `users` resource, step by step.
1. Create a user with three fields through the API, so the test owns its data.
2. PATCH one field. Expect 200 (or 204 if the API returns no body).
3. GET the user. The changed field has the new value and the two other fields are unchanged. This is the real PATCH assertion.
4. PUT the full object with one value changed. Expect 200 or 204, and GET shows exactly what I sent.
5. PUT again with a field missing. Read the API contract: it either rejects with 400 or 422, or resets the field to its default. A test that pins this catches a PUT that silently behaves like PATCH.
6. Repeat step 4 with the same body. Expect the same state again. That is the idempotency check.

```ts
import { test, expect } from '@playwright/test';

test('PATCH keeps omitted fields, PUT replaces them', async ({ request }) => {
  const created = await request.post('/api/users', {
    data: { name: 'Ann', email: 'ann@example.com', phone: '111' },
  });
  expect(created.status()).toBe(201);
  const user = await created.json();
  const url = `/api/users/${user.id}`;

  const patched = await request.patch(url, { data: { phone: '222' } });
  expect(patched.ok()).toBeTruthy();
  expect(await (await request.get(url)).json()).toMatchObject({
    name: 'Ann',
    email: 'ann@example.com',
    phone: '222',
  });

  const full = { name: 'Ann B', email: 'ann@example.com', phone: '333' };
  expect((await request.put(url, { data: full })).ok()).toBeTruthy();
  expect(await (await request.get(url)).json()).toMatchObject(full);

  const partialPut = await request.put(url, { data: { name: 'Only name' } });
  expect([400, 422]).toContain(partialPut.status());

  await request.delete(url);
});
```

What it produces: three requests that prove the difference, and a cleanup call at the end. The status list in the last assertion depends on the API, so read its spec first.

**Follow-ups:**
- *Is PUT always a full replace?* By the HTTP spec yes: the body is the new state of the resource. Some real APIs accept a partial PUT, which is really a PATCH, so I check the API documentation and test what it does.
- *What formats does PATCH use?* Either a plain partial JSON body, which is JSON Merge Patch (RFC 7396, where `null` removes a field), or JSON Patch (RFC 6902), a list of operations such as `{"op":"replace","path":"/phone","value":"222"}`. Merge Patch cannot set a field to `null` on purpose, and cannot change one array item. JSON Patch can.
- *When is PATCH not idempotent?* When an operation depends on the current state, such as "increment the counter" or "append to the array". Sending it twice gives a different result.
- *Which one would you use for changing only a status?* PATCH, so I do not overwrite fields another client changed in the meantime. For protection against lost updates I add `If-Match` with an ETag.

**Trap:** Saying "PUT updates, PATCH also updates" with no difference, or saying "PATCH is for small updates". The point is replace versus partial change, and the idempotency consequence. A second trap is "PATCH is never idempotent". It is not guaranteed to be, and a PATCH that sets a field to a value usually is.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods/PATCH

### What is the difference between 201 and 202?

Topic: api-rest | Core | id: q0309

**Say:** 201 Created means the work is done: the resource exists now. 202 Accepted means the server took the request and will process it later, so it may still fail, and the resource may not exist yet. After a 201 I can read the resource right away. After a 202 my test has to wait and poll a status URL until the job reaches a final state. The common mistake in tests is to assert the final result straight after a 202, which is a race.

**Full process:** testing an endpoint that returns 202, for example an export or a bulk import.
1. Send the request. Assert 202, not 200.
2. Read the status URL from the `Location` header, or from the body (often `statusUrl` or `jobId`). A 202 does not define a body, so I check the API docs for where the link is.
3. Poll that URL with `expect.poll`, with growing intervals and a hard timeout, until the status is `done` or `failed`.
4. Assert the final state, then assert the real result: the file exists, the rows are in the database or the list endpoint.
5. Test the failure path too: send invalid input and assert that the job ends as `failed` with a reason, not as `done`.

```ts
import { test, expect } from '@playwright/test';

test('export job finishes', async ({ request }) => {
  const accepted = await request.post('/api/exports', { data: { type: 'bookings' } });
  expect(accepted.status()).toBe(202);
  const statusUrl = accepted.headers()['location'];
  expect(statusUrl).toBeTruthy();

  await expect
    .poll(async () => (await (await request.get(statusUrl)).json()).status, {
      intervals: [500, 1_000, 2_000],
      timeout: 30_000,
      message: 'export job did not finish',
    })
    .toBe('done');

  const finished = await (await request.get(statusUrl)).json();
  expect(finished.downloadUrl).toBeTruthy();
});
```

What it produces: one POST, then a series of GETs spaced 0.5 s, 1 s and then 2 s apart, up to 30 s. It fails with the message if the job never reaches `done`. The status request needs `await` at every level, so I keep the arrow function small.

**Follow-ups:**
- *What does the client do when the job is done?* Either the status URL returns the result, or it answers 303 See Other pointing to the result URL. Some APIs also tell the client how long to wait with `Retry-After`.
- *Why not just `waitForTimeout`?* A fixed sleep is either too short and flaky, or too long and slow. Polling returns as soon as the state is right.
- *Is 202 a promise that the work will happen?* No. The spec says the processing may not be acted upon. A 202 only says the request was accepted for processing, and the server cannot send a later HTTP response about it.

**Trap:** Treating 202 as "success, done". It means "accepted". The other wrong answer is "201 and 202 are both just success codes, use either". The test and the client behave differently after each.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/202

### What does a 201 response return?

Topic: api-rest | Core | id: q0310

**Say:** 201 means the request created a resource. The response should point to the new resource: the standard way is the `Location` header with its URL. Many APIs also return the created resource in the body, with the server-generated fields such as `id` and `createdAt`. HTTP does not require a body, so what the body holds is the API's choice. In a test I assert 201, the `Location` header, the body fields, and then I fetch the Location URL and check that it returns the same resource.

**Full process:**
1. POST a valid body. Assert status exactly 201, not just `ok()`, because a 200 would also pass `ok()`.
2. Assert `Location` exists and has the expected shape. It can be absolute or relative, so I do not hard-code the host.
3. Assert the body: it contains what I sent, plus server fields. The `id` has the expected type, and `createdAt` is a valid date.
4. GET the `Location` URL and compare. This proves the resource really exists and is locatable.
5. Delete it in the end, so the data does not pile up.

```ts
import { test, expect } from '@playwright/test';

test('POST /bookings returns 201 with Location', async ({ request }) => {
  const res = await request.post('/api/bookings', { data: { roomId: 7, nights: 2 } });
  expect(res.status()).toBe(201);

  const location = res.headers()['location'];
  expect(location).toMatch(/\/api\/bookings\/[\w-]+$/);

  const created = await res.json();
  expect(created).toMatchObject({ roomId: 7, nights: 2 });
  expect(created.id).toBeTruthy();

  const fetched = await request.get(location);
  expect(fetched.status()).toBe(200);
  expect(await fetched.json()).toEqual(created);

  await request.delete(location);
});
```

What it produces: a create, a read-back and a delete. Header names in `res.headers()` are lower case.

**Follow-ups:**
- *What if the API returns 200 for a create?* It works, but it is less precise, and clients that check for 201 break. I report it as a contract mismatch against the spec, and I do not change the test to accept both unless the spec says so.
- *Can a 201 have no body?* Yes. The spec requires only that the new resource is locatable by the request URL or by `Location`. Then the Location GET is my only way to see the resource.
- *What about creating the same resource twice?* A plain POST creates two resources with two `Location` values. If the API is meant to prevent that, it should answer 409 for a duplicate, or use an idempotency key.

**Trap:** Saying "201 returns the created object, always". The object in the body is common, but the header is the standard part. Another trap is checking only `response.ok()`, which lets 200, 202 and 204 pass as well.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/201

### What are the HTTP methods and what does each one do?

Topic: api-rest | Core | id: q0311

**Say:** GET reads a resource and changes nothing. POST creates a resource or triggers an action, and it is not idempotent. PUT replaces a resource at a known URL. PATCH changes part of one. DELETE removes it. HEAD is a GET without the body, useful for checking existence and headers. OPTIONS asks what the server allows, and the browser uses it for CORS preflight. A newer `QUERY` method exists for a safe search with a request body, but it is not common yet.

**Full process:** I check the methods per endpoint with a small table in the test plan, then test the ones that should not work.
1. For each endpoint list the allowed methods from the OpenAPI spec.
2. Happy path for each allowed method.
3. For the methods not allowed, send them and expect 405 with an `Allow` header listing what works.
4. `OPTIONS` on the endpoint, to see the `Allow` header and the CORS headers.
5. HEAD on a GET endpoint: same status and headers as GET, empty body.

```ts
import { test, expect } from '@playwright/test';

test('unsupported method gets 405 with Allow', async ({ request }) => {
  const res = await request.delete('/api/health');
  expect(res.status()).toBe(405);
  expect(res.headers()['allow']).toContain('GET');
});

test('HEAD matches GET without a body', async ({ request }) => {
  const head = await request.head('/api/bookings/1');
  expect(head.status()).toBe(200);
  expect(await head.text()).toBe('');
});
```

What it produces: proof that the server rejects methods it does not support, and that HEAD has no body. Some servers answer 404 or 501 instead of 405, so I compare with the API's documented behaviour.

**Follow-ups:**
- *Can GET have a body?* The spec does not forbid it, but it has no defined meaning, and caches and proxies may drop it. That is why the `QUERY` method was added (RFC 10008, June 2026): a safe, idempotent request that carries a body.
- *Which methods are safe?* GET, HEAD, OPTIONS and TRACE. They should not change server state.
- *Where does a "verb" like "cancel booking" go?* Either `POST /bookings/42/cancel` as an action, or `PATCH /bookings/42` with `{ "status": "cancelled" }`. Both exist in real APIs, so I follow the API's own convention.

**Trap:** Saying "POST creates, PUT updates" as the full story. PUT can also create when the client chooses the URL, and POST is used for any action that does not fit the other methods.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods

### What is a safe method and what is an idempotent method?

Topic: api-rest | Core | id: q0312

**Say:** Safe means the request is not meant to change anything on the server: GET, HEAD and OPTIONS. Idempotent means that sending the same request several times has the same effect on the server as sending it once: GET, HEAD, PUT and DELETE, and also OPTIONS. All safe methods are idempotent, but not the other way around: PUT and DELETE change data. POST and PATCH are not guaranteed to be idempotent. Idempotency matters because a client can retry an idempotent request safely when it does not know if the first one arrived.

**Full process:** proving idempotency in a test.
1. Send a PUT with a fixed body and save the response.
2. Send the identical PUT again. Expect the same final state: a GET after the first and a GET after the second are equal.
3. Do the same with DELETE: the first call returns 204 (or 200), the second returns 404. The responses differ, but the server state is the same, so DELETE is still idempotent.
4. Do the same with POST and show that it creates two resources. That is the contrast.

```ts
import { test, expect } from '@playwright/test';

test('PUT twice gives the same state, POST twice does not', async ({ request }) => {
  const first = await (await request.post('/api/notes', { data: { text: 'a' } })).json();
  const url = `/api/notes/${first.id}`;

  const body = { text: 'b' };
  await request.put(url, { data: body });
  const afterOne = await (await request.get(url)).json();
  await request.put(url, { data: body });
  const afterTwo = await (await request.get(url)).json();
  expect(afterTwo).toEqual(afterOne);

  const second = await (await request.post('/api/notes', { data: { text: 'a' } })).json();
  expect(second.id).not.toBe(first.id);

  await request.delete(url);
  await request.delete(`/api/notes/${second.id}`);
});
```

What it produces: a passing test that documents the difference. If the second PUT changed something (a version counter, a `updatedAt` field), I decide whether that is a bug or an expected server detail.

**Follow-ups:**
- *Is the response of an idempotent call always the same?* No. Idempotency is about the effect on the server. The first DELETE returns 204 and the second returns 404.
- *Does idempotent mean no side effects at all?* No. The server may log the request or update a timestamp. It means the intended effect of the client is the same.
- *Does the server have to follow this?* The spec asks for it, but a server can break it. A GET that deletes data is a real bug I have seen described, and a good test catches it by checking the state after a repeat.

**Trap:** Mixing the two words up, or saying "idempotent means safe". PUT is idempotent and not safe.

**Source:** https://developer.mozilla.org/en-US/docs/Glossary/Idempotent

### What is the difference between POST and PUT?

Topic: api-rest | Standard | id: q0313

**Say:** POST sends data to a collection and the server decides what to do. For a create, the server picks the ID and answers 201 with the new URL. PUT targets one exact URL that the client already knows and puts the full state there: it replaces the resource, or creates it if the client is allowed to choose the ID. POST is not idempotent, so a retry may make a duplicate. PUT is idempotent, so a retry is harmless.

**Full process:**
1. POST to `/bookings`, expect 201 and a new `id`.
2. POST the same body again, expect a second booking with another `id`, unless the API blocks duplicates.
3. PUT to `/bookings/{id}` twice, expect the same resource both times.
4. PUT to a URL that does not exist: the API either creates it with 201 or answers 404. The behaviour is the API's decision, so I read the spec and test that.

```bash
curl -i -X POST https://api.example.com/bookings \
  -H 'Content-Type: application/json' \
  -d '{"roomId":7,"nights":2}'

curl -i -X PUT https://api.example.com/bookings/42 \
  -H 'Content-Type: application/json' \
  -d '{"roomId":7,"nights":3}'
```

The first returns `201` with a `Location`. The second returns `200` or `204` and changes booking 42.

**Follow-ups:**
- *Why do payment APIs use POST and an idempotency key?* Because creating a payment is not naturally idempotent. The key tells the server that a repeat is the same operation.
- *Can POST update?* Yes, it is used for actions and for forms. It is the general-purpose method.

**Trap:** "POST is create and PUT is update", with no mention of who chooses the ID and idempotency.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods

### Is DELETE idempotent if the second call returns 404?

Topic: api-rest | Standard | id: q0314

**Say:** Yes. Idempotent is about the server state, not the response. After the first DELETE the resource is gone. After the second the resource is still gone, so the state is the same. The first call returns 200 or 204, and the second typically returns 404. A well-designed API may also return 204 both times, and either is acceptable. In a test I assert the state with a GET, and I do not require the second response code to equal the first.

**Full process:**
1. Create a resource.
2. DELETE it, expect 204 (or 200 with a body).
3. GET it, expect 404.
4. DELETE again, expect 404 or 204 as documented, and expect no error 500.
5. Check dependent data: a deleted parent should not leave orphans, or should be rejected with 409 if children exist.

**Follow-ups:**
- *Soft delete?* The row stays with a `deletedAt` flag. A GET then returns 404 (or 410 Gone), and I check that lists exclude it and that restoring works, if that exists.
- *What does DELETE with related data do?* It depends on the API rule: 409 if children exist, or cascade. I test both the allowed and the blocked case.

**Trap:** "DELETE is not idempotent because the second call fails." The call result differs, but the state does not.

**Source:** https://developer.mozilla.org/en-US/docs/Glossary/Idempotent

### What makes an API RESTful?

Topic: api-rest | Standard | id: q0315

**Say:** REST is an architectural style where the API exposes resources as URLs, such as `/bookings/42`, and clients act on them with standard HTTP methods. The server is stateless: each request carries everything needed, so no server session is required for the request to make sense. Responses state their cacheability, and the client does not care about the server's internals. In practice most "REST APIs" are JSON over HTTP with resource-style URLs, and few follow the full style, including links in responses (HATEOAS). As a tester I care about the practical parts: consistent URLs, correct methods and status codes, and predictable error bodies.

**Full process:** what I check in an API review.
1. URLs use nouns, and plural collections: `/bookings`, `/bookings/42`, `/bookings/42/payments`.
2. Methods match meaning: GET does not change state, POST creates.
3. Status codes match the outcome (201 for create, 404 for missing, 409 for conflict).
4. Errors have one shape across the whole API, for example `{ "code": "...", "message": "..." }`.
5. Pagination, filtering and sorting work the same way on every list endpoint.

**Follow-ups:**
- *What does stateless mean for a test?* Each request is independent, so I can run any request alone and in any order, as long as I send the credentials.
- *Is GraphQL REST?* No. It uses one endpoint, and the client chooses the fields.

**Trap:** Saying REST is "JSON over HTTP". REST is the style. JSON is only a common format.

**Source:** https://www.rfc-editor.org/rfc/rfc9110.html

### What is the difference between path parameters, query parameters, headers and body?

Topic: api-rest | Standard | id: q0316

**Say:** The path identifies the resource: `/bookings/42`. Query parameters filter, sort or page a list: `/bookings?status=paid&page=2`. Headers carry metadata, such as `Authorization`, `Content-Type` and `Accept`. The body carries the data for POST, PUT and PATCH. I test each with its own cases: a path ID that does not exist (404), a malformed ID (400), unknown or invalid query values, a missing required header, and a body with missing, extra and wrong-type fields.

**Full process:**
1. Path: valid ID, nonexistent ID (404), wrong format such as `abc` for an integer (400), another user's ID (403 or 404).
2. Query: valid filter, no results (200 with an empty list), invalid value (400), repeated parameter, very large `limit`.
3. Headers: missing `Authorization` (401), wrong `Content-Type` (415).
4. Body: missing required field, null, wrong type, too long, extra unknown field.

```ts
import { test, expect } from '@playwright/test';

test('query parameters filter the list', async ({ request }) => {
  const res = await request.get('/api/bookings', {
    params: { status: 'paid', page: 2 },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  for (const booking of body.items) {
    expect(booking.status).toBe('paid');
  }
});
```

What it produces: a call to `/api/bookings?status=paid&page=2`. Playwright builds the query string from `params`.

**Follow-ups:**
- *Where do you put a search with many filters?* Usually in the query. If it is too large or sensitive for a URL, some APIs use a POST search endpoint.
- *Why not put a secret in the query?* URLs end up in logs, history and proxies.

**Trap:** Testing only the body. Many bugs sit in query handling and in path IDs.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods

### What is in an HTTP request and response?

Topic: api-rest | Standard | id: q0317

**Say:** A request has a method, a URL (path and query), headers, and an optional body. A response has a status code, headers and an optional body. HTTP is stateless text on top of TCP (or QUIC for HTTP/3), and HTTPS adds TLS so the traffic is encrypted. For a tester, the useful habit is to read all four parts of both sides, not only the status and the JSON body.

**Full process:** how I look at one in practice.
1. `curl -i -v https://api.example.com/health` shows the request line, request headers, response status line, response headers and body.
2. In the browser DevTools Network tab I see the same, with timing.
3. In Charles or a proxy I see it for a mobile app.

```
POST /api/bookings HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
Content-Type: application/json

{"roomId":7,"nights":2}

HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/bookings/91

{"id":91,"roomId":7,"nights":2}
```

**Follow-ups:**
- *HTTP/1.1 vs HTTP/2?* HTTP/2 sends many requests over one connection and compresses headers. The semantics (methods, status codes) are the same, so my API tests do not change.

**Trap:** Looking only at the JSON body. Many bugs are in headers: a wrong `Content-Type`, a missing `Cache-Control`, a wrong `Location`.

**Source:** https://www.rfc-editor.org/rfc/rfc9110.html

## Status codes

### Which status codes do you expect and test for, and what do they mean?

Topic: api-rest | Standard | id: q0318

**Say:** 2xx is success: 200 OK, 201 Created, 202 Accepted and 204 No Content. 3xx is redirection or "not modified". 4xx means the client made a mistake: 400 bad request, 401 not authenticated, 403 not allowed, 404 not found, 409 conflict, 422 invalid content, 429 too many requests. 5xx means the server failed: 500, 502, 503 and 504. In a test I assert the exact code the spec promises, and never just "not an error". A 500 on bad input is a bug, because bad input should give a 4xx.

**Full process:** my default checklist for one endpoint.
1. Happy path: the exact success code.
2. Missing or invalid input: 400 or 422, with an error body that names the field.
3. No token: 401. Wrong role: 403.
4. Unknown ID: 404.
5. Duplicate or wrong state: 409.
6. Too many requests: 429, if limits exist.
7. Assert that no case in steps 2 to 6 returns 500.

```ts
import { test, expect } from '@playwright/test';

test('invalid body is a client error, not a 500', async ({ request }) => {
  const res = await request.post('/api/bookings', { data: { roomId: 'not-a-number' } });
  expect([400, 422]).toContain(res.status());
  const error = await res.json();
  expect(error.message).toBeTruthy();
});
```

What it produces: one call and two assertions. The allowed codes depend on the API's contract.

**Follow-ups:**
- *Do you test the status text?* No. HTTP/2 has no status text, and it is not part of the contract. I test the code.
- *What if the API returns 200 with `{ "error": ... }`?* That is a design smell. I report it, because clients, caches and monitoring rely on the code. GraphQL is a known case where it is by design.

**Trap:** `expect(res.ok()).toBeTruthy()` as the only check. `ok()` is true for any 2xx, so it passes on the wrong code.

**Source:** https://www.rfc-editor.org/rfc/rfc9110.html

### What is the difference between 200, 201, 202 and 204?

Topic: api-rest | Standard | id: q0319

**Say:** 200 OK means success and the response normally has a body. 201 Created means a new resource exists, and it comes with `Location`. 202 Accepted means the work was accepted and will happen later. 204 No Content means success with no body at all, common after DELETE or an update that returns nothing. I assert the exact one, and for 204 I also assert that the body is empty.

**Full process:**
1. GET returns 200 with a body.
2. POST create returns 201 and `Location`.
3. A long job returns 202 with a status link.
4. DELETE returns 204, and `await res.text()` is an empty string.

```ts
const del = await request.delete(`/api/bookings/${id}`);
expect(del.status()).toBe(204);
expect(await del.text()).toBe('');
```

A common bug is calling `await res.json()` on a 204. It throws a parse error and hides the real status, so I check the status first and parse second.

**Follow-ups:**
- *Why might a PUT return 204?* The client already has the new state, so the server does not need to send it back.

**Trap:** Parsing JSON before checking the status. On a 204 or an HTML error page, `.json()` throws and hides what actually happened.

**Source:** https://www.rfc-editor.org/rfc/rfc9110.html

### What is the difference between 401 and 403?

Topic: api-rest | Standard | id: q0320

**Say:** 401 means the server does not know who I am: the token is missing, expired or invalid, so authentication failed. It should come with a `WWW-Authenticate` header. 403 means the server knows who I am and I am not allowed to do this. Logging in again does not fix a 403. A server may return 404 instead of 403 when it does not want to reveal that a resource exists. I test both: no token gives 401, a valid token of a user without the right role gives 403.

**Full process:**
1. Request without an `Authorization` header: expect 401.
2. Request with a garbage token and one with an expired token: expect 401.
3. Request with a valid token for a low-privilege user to an admin endpoint: expect 403.
4. Request for another user's resource: expect 403 or 404, as the API documents it.

```ts
import { test, expect, request as pwRequest } from '@playwright/test';

test('401 without a token, 403 for the wrong role', async ({ baseURL }) => {
  const anonymous = await pwRequest.newContext({ baseURL });
  expect((await anonymous.get('/api/admin/users')).status()).toBe(401);

  const member = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.MEMBER_TOKEN}` },
  });
  expect((await member.get('/api/admin/users')).status()).toBe(403);

  await anonymous.dispose();
  await member.dispose();
});
```

What it produces: two separate request contexts, one without credentials and one with a member token. I dispose both at the end.

**Follow-ups:**
- *What status when the token is valid but expired?* 401, because authentication fails. The client should refresh the token and retry.
- *Why is the name "Unauthorized" confusing?* The name says "unauthorized", but the meaning is "unauthenticated".

**Trap:** Swapping them. 401 is authentication, and 403 is authorization.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401

### What is the difference between 400 and 422?

Topic: api-rest | Standard | id: q0321

**Say:** 400 Bad Request means the request itself is malformed: broken JSON, a wrong type, a missing required header. 422 Unprocessable Content means the request is well-formed and the server understood it, but the content fails a rule, such as an end date before the start date. APIs differ, and many use 400 for both. I read the API contract and assert what it promises, and I check that the error body names the problem field.

**Full process:**
1. Send broken JSON (`{"roomId":`): expect 400.
2. Send a valid JSON with a wrong type (`"nights": "two"`): 400 or 422.
3. Send valid JSON that breaks a business rule (`nights: -1`, or checkout before checkin): 422 or 400.
4. Assert the error body: field name and a message a user can understand.

```ts
const broken = await request.post('/api/bookings', {
  headers: { 'Content-Type': 'application/json' },
  data: '{"roomId":',
});
expect(broken.status()).toBe(400);
```

What it produces: a raw string body with an explicit JSON content type, so the server cannot parse it.

**Follow-ups:**
- *Should a client retry a 422?* No. The same request fails the same way. The user must fix the data.

**Trap:** Insisting that one is always right. The spec of the API decides, and the test should be consistent with it.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422

### What do 409 and 412 mean, and how do you test lost updates?

Topic: api-rest | Standard | id: q0322

**Say:** 409 Conflict means the request conflicts with the current state of the resource: a duplicate email, or a booking for a slot that is already taken. 412 Precondition Failed means a condition I sent in the request failed, usually `If-Match` with an ETag that no longer matches. That is optimistic locking: two clients read version 1, the first saves, and the second save gets 412 instead of silently overwriting. I test it with two clients that update the same resource.

**Full process:**
1. GET the resource, note the `ETag`.
2. Client A updates with `If-Match: <etag>` and succeeds. The ETag changes.
3. Client B updates with the old ETag and gets 412 (or 409 if the API uses version numbers instead).
4. GET again and confirm client A's change is still there.

```ts
import { test, expect } from '@playwright/test';

test('stale ETag is rejected', async ({ request }) => {
  const first = await request.get('/api/notes/1');
  const etag = first.headers()['etag'];

  const a = await request.put('/api/notes/1', {
    headers: { 'If-Match': etag },
    data: { text: 'from A' },
  });
  expect(a.ok()).toBeTruthy();

  const b = await request.put('/api/notes/1', {
    headers: { 'If-Match': etag },
    data: { text: 'from B' },
  });
  expect(b.status()).toBe(412);
  expect((await (await request.get('/api/notes/1')).json()).text).toBe('from A');
});
```

What it produces: proof that the second writer cannot overwrite the first. It only works if the API supports ETags on the resource.

**Follow-ups:**
- *What if the API has no ETag?* Then it may use a `version` field in the body, and a conflict gives 409. Without any protection, the last write wins, and I report that as a risk.

**Trap:** Using 409 for every validation error. 409 is about state, and a bad value is 400 or 422.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409

### What do the 3xx codes mean, and what is 304?

Topic: api-rest | Standard | id: q0323

**Say:** 301 and 308 are permanent redirects. 302 and 307 are temporary. 307 and 308 keep the method and body, while 301 and 302 historically let clients change a POST into a GET. 303 See Other tells the client to fetch another URL with GET. 304 Not Modified is not a redirect: it answers a conditional GET (`If-None-Match` or `If-Modified-Since`), says the cached copy is still valid, and has no body. In a test I check where a redirect points, and that an API does not redirect a POST in a way that loses the body.

**Full process:**
1. Send the request with redirects off, to see the redirect itself: `maxRedirects: 0`.
2. Assert the status and the `Location` header.
3. Then follow it and assert the final response.

```ts
const res = await request.get('/old-path', { maxRedirects: 0 });
expect(res.status()).toBe(301);
expect(res.headers()['location']).toContain('/new-path');
```

What it produces: Playwright does not follow the redirect, so I see the 301 itself. The default is up to 20 redirects.

**Follow-ups:**
- *Why does a browser DevTools list 304s I never asked for?* The browser sends conditional requests on its own to revalidate cached files.

**Trap:** Testing only the final page after redirects, and missing a redirect chain or a redirect to HTTP.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/307

### What is the difference between 500, 502, 503 and 504?

Topic: api-rest | Standard | id: q0324

**Say:** 500 means the server hit an unexpected error: usually a bug in the application. 502 Bad Gateway means a gateway or proxy got an invalid answer from the service behind it. 503 Service Unavailable means the server cannot handle the request right now, because of maintenance or overload, and it may send `Retry-After`. 504 Gateway Timeout means the gateway waited too long for the service behind it. For a test, 500 on bad input is my bug report. 502 to 504 point to infrastructure or a slow dependency, and a client may retry them, if the request is safe to repeat.

**Full process:**
1. Reproduce with the same request and note the status, the `x-request-id` header if present, and the time.
2. 500: search the application log by that ID, and find the stack trace.
3. 502 or 504: check the service behind the gateway, its health and latency, and the gateway timeout.
4. 503: check for a deployment or a restart at that time.
5. Repeat the request several times to see if it is constant or intermittent.

**Follow-ups:**
- *When do you retry?* On 502, 503 and 504 for idempotent requests, with backoff. Never blindly on a POST without an idempotency key.
- *Do you test 5xx on purpose?* I do not break production services. In UI tests I mock a 500 with `page.route` to check that the UI shows an error state.

**Trap:** Calling every 5xx "a backend bug". 502 and 504 are often infrastructure.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503

## Headers, caching, cookies and CORS

### What is the difference between Content-Type and Accept?

Topic: api-rest | Standard | id: q0325

**Say:** `Content-Type` says what format the body I send is in, for example `application/json`. `Accept` says what formats I am willing to receive back. This is content negotiation. If the server cannot produce what I accept it may answer 406 Not Acceptable. If it cannot read the format I sent, it answers 415 Unsupported Media Type. I test the wrong content type and the missing one, because many APIs crash on those.

**Full process:**
1. POST JSON with `Content-Type: application/json`: expect 201.
2. POST the same JSON with `Content-Type: text/plain`: expect 415.
3. GET with `Accept: application/xml` on a JSON-only API: expect 406, or the default JSON, as documented.
4. Assert the response `Content-Type` is what the spec says, including the charset.

```ts
const wrong = await request.post('/api/bookings', {
  headers: { 'Content-Type': 'text/plain' },
  data: '{"roomId":7}',
});
expect(wrong.status()).toBe(415);

const xml = await request.get('/api/bookings/1', { headers: { Accept: 'application/xml' } });
expect([200, 406]).toContain(xml.status());
```

What it produces: two negative checks. When `data` is an object, Playwright sets the JSON content type for me, so for this test I pass a string.

**Follow-ups:**
- *Other negotiation headers?* `Accept-Language` for language, `Accept-Encoding` for compression such as gzip.
- *Why does the response say `Vary: Accept`?* So caches keep a separate copy per value of that header.

**Trap:** Mixing them up. The first describes what I send, the second what I want back.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation

### Which request and response headers do you check in API tests?

Topic: api-rest | Standard | id: q0326

**Say:** Request side: `Authorization`, `Content-Type`, `Accept`, `If-Match` and `If-None-Match`, `Idempotency-Key`, and a correlation ID. Response side: `Content-Type`, `Location` after a create, `Cache-Control` and `ETag`, `Retry-After` on 429 and 503, `WWW-Authenticate` on 401, `Allow` on 405, the CORS headers, and `Set-Cookie`. I also check for security headers such as `Strict-Transport-Security` and `X-Content-Type-Options`, and for headers that leak too much, like a detailed `Server` version.

**Full process:**
1. Call the endpoint and print `await res.allHeaders()` the first time to see what exists.
2. Assert the headers that are part of the contract.
3. Assert the absence of what should not be there.

```ts
const res = await request.get('/api/bookings/1');
const headers = res.headers();
expect(headers['content-type']).toContain('application/json');
expect(headers['cache-control']).toBeTruthy();
expect(headers['x-powered-by']).toBeUndefined();
```

What it produces: lower-case header names. `res.headers()` lower-cases every name, so I always read lower-case keys.

**Follow-ups:**
- *What is a correlation ID for?* One ID that travels through all services, so a failed request can be found in logs. The standard form is the W3C `traceparent` header. Many teams use `X-Request-ID`.
- *Can a test read `cookie` from a recorded request?* In Playwright `request.headers()` leaves out some security headers such as `cookie`, so I use `await request.allHeaders()`.

**Trap:** Checking only the body. Missing `Cache-Control` on a private response has leaked user data through shared caches.

**Source:** https://www.rfc-editor.org/rfc/rfc9110.html

### How does HTTP caching work, and what is the difference between no-cache and no-store?

Topic: api-rest | Standard | id: q0327

**Say:** The server sends `Cache-Control` to say how long a response may be reused and by whom. `max-age=60` allows reuse for 60 seconds. `private` allows only the browser to store it, and `public` allows shared caches such as a CDN. `no-cache` does not mean "do not cache": it means the cache may store the response but must check with the server before reuse. `no-store` means do not store it at all. For sensitive pages I expect `no-store`. In tests, stale cache is a top cause of "the API changed but the UI shows old data".

**Full process:** checking cache behaviour.
1. Call the endpoint and read `Cache-Control`, `ETag`, `Last-Modified` and `Vary`.
2. Call again with `If-None-Match: <etag>`. Expect 304 with no body if unchanged.
3. Change the data, call again with the old ETag, and expect 200 with a new body and a new ETag.
4. For personal data, assert `private` or `no-store`, never `public`.

```ts
import { test, expect } from '@playwright/test';

test('conditional GET returns 304 until the data changes', async ({ request }) => {
  const first = await request.get('/api/bookings/1');
  const etag = first.headers()['etag'];
  expect(etag).toBeTruthy();

  const again = await request.get('/api/bookings/1', { headers: { 'If-None-Match': etag } });
  expect(again.status()).toBe(304);

  await request.patch('/api/bookings/1', { data: { nights: 5 } });
  const changed = await request.get('/api/bookings/1', { headers: { 'If-None-Match': etag } });
  expect(changed.status()).toBe(200);
});
```

What it produces: a 304 with an empty body, then a 200 after the change. It only works if the API supports ETags.

**Follow-ups:**
- *What is `Vary`?* It lists the request headers that change the response, such as `Accept-Language`, so caches store separate copies.
- *Why is a stale cache a testing problem?* The browser may serve the old response without asking the server, so a test sees old data.

**Trap:** "no-cache means no caching". It means revalidate. `no-store` means do not store.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching

### What are ETags and conditional requests used for?

Topic: api-rest | Standard | id: q0328

**Say:** An ETag is an identifier for a version of a resource. It serves two goals. For caching: the client sends `If-None-Match` with the ETag it has, and the server answers 304 with no body if nothing changed, which saves bandwidth. For concurrency: the client sends `If-Match` on an update, and the server answers 412 if somebody changed the resource since, which prevents lost updates. A weak ETag starts with `W/` and means "semantically the same", not byte for byte.

**Full process:** the two tests are in the caching and the 409 and 412 answers above. The short version: GET, read `ETag`, repeat with `If-None-Match` and expect 304, then update with a stale `If-Match` and expect 412.

**Follow-ups:**
- *Who generates the ETag?* The server, often a hash of the content or a version number. A new version must produce a new ETag.

**Trap:** Thinking ETag is only for caching. It is also the standard guard against two people overwriting each other.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag

### Cookies vs tokens: how do they differ and which do you test?

Topic: api-rest | Standard | id: q0329

**Say:** A session cookie holds an ID that the server maps to session data, and the browser sends it automatically on every request to that site. A token, such as a JWT, is a value the client stores and sends itself, usually in the `Authorization: Bearer` header. The cookie is sent automatically, so it needs CSRF protection and `SameSite`, and with `HttpOnly` JavaScript cannot read it. A token in `localStorage` is not sent automatically, so CSRF is not an issue, but any XSS can steal it. I test what the app really uses: cookie attributes, expiry, logout invalidation, and behaviour with an expired or tampered credential.

**Full process:**
1. Log in, and read `Set-Cookie`. Assert `HttpOnly`, `Secure`, `SameSite` and a sensible lifetime.
2. Call a protected endpoint with the cookie: 200. Without it: 401.
3. Log out. Replay the old cookie or token: expect 401, which proves server-side invalidation. A stateless JWT may still work until it expires, and I report that as a risk.
4. Tamper with the value (change one character): expect 401.

```ts
import { test, expect } from '@playwright/test';

test('session cookie is hardened and dies on logout', async ({ request }) => {
  const login = await request.post('/api/login', {
    data: { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const setCookie = login.headers()['set-cookie'];
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('Secure');
  expect(setCookie).toMatch(/SameSite=(Lax|Strict)/i);

  expect((await request.get('/api/me')).status()).toBe(200);
  await request.post('/api/logout');
  expect((await request.get('/api/me')).status()).toBe(401);
});
```

What it produces: the `request` fixture keeps cookies between calls, like a browser. A server may send several `Set-Cookie` headers, and `headers()` joins them in one string.

**Follow-ups:**
- *What does `SameSite` do?* It controls whether the browser sends the cookie on cross-site requests. `Strict` and `Lax` limit it, and `None` needs `Secure`.
- *Where would you store a token in a SPA?* An `HttpOnly` cookie is safer against XSS. If the token is in memory or storage, the app needs a strict content security policy.

**Trap:** Saying tokens are "more secure" than cookies. Each has a different weak point.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie

### What are the cookie attributes and what do they do?

Topic: api-rest | Standard | id: q0330

**Say:** `HttpOnly` hides the cookie from JavaScript. `Secure` sends it only over HTTPS. `SameSite` controls cross-site sending: `Strict`, `Lax` or `None`. `Domain` and `Path` set the scope. `Expires` or `Max-Age` set the lifetime, and without them it is a session cookie that dies when the browser closes. A session cookie without `HttpOnly` and `Secure` is a finding I report.

**Full process:** read `Set-Cookie` from the login response, then check each attribute, as in the test above. In Playwright for a browser test, `await context.cookies()` returns each cookie with `httpOnly`, `secure`, `sameSite` and `expires`.

```ts
const cookies = await page.context().cookies();
const session = cookies.find((c) => c.name === 'session');
expect(session?.httpOnly).toBe(true);
expect(session?.secure).toBe(true);
```

**Follow-ups:**
- *What is a third-party cookie issue in tests?* Embedded widgets across sites may lose cookies under `SameSite` rules, so I test the embedded flow in the real cross-site setup.

**Trap:** Forgetting that `HttpOnly` cookies cannot be read in the browser by page scripts, so a test must read them through the context.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie

### What is CORS and how does it affect testing?

Topic: api-rest | Standard | id: q0331

**Say:** CORS is a browser rule. A page from `https://app.example.com` may not read a response from `https://api.example.com` unless the API sends `Access-Control-Allow-Origin` that allows that origin. Only the browser enforces it. curl, Postman and Playwright `request` ignore it, so an API call can work there and fail in the page. For "non-simple" requests, such as PUT, or a JSON POST with custom headers, the browser first sends a preflight `OPTIONS` request, and sends the real one only if the answer allows it. I test CORS by sending `Origin` and the preflight headers and checking the response headers.

**Full process:**
1. Send the preflight by hand: `OPTIONS` with `Origin`, `Access-Control-Request-Method` and `Access-Control-Request-Headers`.
2. Assert the answer: 204 or 200, and `Access-Control-Allow-Origin` equals my origin (or `*`), `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` include what the page uses.
3. Send a real request with `Origin` from a not allowed site, and assert the allow header is absent or a different origin.
4. With cookies (`credentials: 'include'`), the server must send `Access-Control-Allow-Credentials: true` and an exact origin, not `*`.

```ts
import { test, expect } from '@playwright/test';

test('preflight allows the app origin only', async ({ request }) => {
  const preflight = await request.fetch('/api/bookings', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://app.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });
  expect(preflight.status()).toBeLessThan(300);
  const h = preflight.headers();
  expect(h['access-control-allow-origin']).toBe('https://app.example.com');
  expect(h['access-control-allow-methods']).toContain('POST');

  const evil = await request.fetch('/api/bookings', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
  });
  expect(evil.headers()['access-control-allow-origin']).not.toBe('https://evil.example');
});
```

What it produces: two server-side checks. Real browser behaviour I confirm in a UI test, where a CORS failure shows up as a failed network request in the console, and the response body is not readable.

**Follow-ups:**
- *Why does it work in Postman and fail in the browser?* Postman is not a browser, so it skips CORS. The fix is on the server, never in the test.
- *Does CORS protect the API?* No. It protects the user's browser from other sites. An attacker can call the API directly, so authentication is still needed.

**Trap:** Saying "CORS is a server error" or "I fix it in the frontend". The server must send the headers, and the browser enforces them.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

## API design topics: pagination, versioning, limits, retries, async

### How do you test pagination?

Topic: api-rest | Standard | id: q0332

**Say:** First I learn which style the API uses. Offset or page style (`?page=2&limit=20`) is simple, but if data changes between pages, items can be skipped or repeated. Cursor style (`?cursor=abc`) returns a token for the next page and is stable with changing data. I test the first page, a middle page, the last page, a page beyond the end (an empty list, not an error), the limit boundaries, and that walking all pages gives every item exactly once, in the documented order.

**Full process:**
1. Create a known number of items, for example 45, so the test owns the data.
2. Request page size 20, walk all pages until there is no next link or cursor.
3. Collect the IDs. Assert 45 IDs, no duplicates, and the expected sort order.
4. Boundaries: `limit=0`, `limit=-1`, `limit=1000` (capped or rejected), a page after the last (empty list with 200).
5. Total count field, if present, equals 45.

```ts
import { test, expect } from '@playwright/test';

test('walking all pages returns each item once', async ({ request }) => {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await request.get('/api/bookings', {
      params: cursor ? { limit: 20, cursor } : { limit: 20 },
    });
    expect(res.status()).toBe(200);
    const page = await res.json();
    expect(page.items.length).toBeLessThanOrEqual(20);
    ids.push(...page.items.map((i: { id: string }) => i.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  expect(new Set(ids).size).toBe(ids.length);
});
```

What it produces: a loop of GETs that ends when `nextCursor` is missing. A bug in the cursor makes it loop forever, so I also cap the loop count in real tests.

**Follow-ups:**
- *Offset or cursor?* Cursor for large or changing data. Offset is simpler and fine for small stable lists, but deep offsets get slow in the database.
- *Where does the next link live?* In the body, or in a `Link` header (RFC 8288).
- *What about sorting?* Pagination needs a stable sort with a tie-breaker such as `id`. Without it, items with equal values can move between pages.

**Trap:** Testing only page 1. Most pagination bugs are at the boundaries and with sorting.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods

### How do you test API versioning?

Topic: api-rest | Standard | id: q0333

**Say:** Versioning lets the API change without breaking old clients. Common forms are the URL (`/v1/bookings`), a header, or the media type. My tests cover three things. The old version still works the same after a new release. The new version has the documented changes. A removed or deprecated version answers as documented, for example with a `Sunset` header or a clear error. Mobile apps make this matter more, because old app versions stay in use for months.

**Full process:**
1. Keep a regression suite that runs against `/v1` and is not edited when `/v2` ships.
2. Run the same business scenario against both versions and compare the differences with the changelog.
3. Check the deprecation signals: `Sunset` header (RFC 8594) and docs.
4. Call a nonexistent version and assert 404 with a clear message.

**Follow-ups:**
- *What is a breaking change?* Removing or renaming a field, changing a type, making an optional field required, or changing the meaning of a status code. Adding an optional field is usually safe.
- *How do mobile apps affect it?* The backend must support old app versions, so I keep tests for the oldest supported version.

**Trap:** Only testing the newest version.

**Source:** https://spec.openapis.org/oas/latest.html

### How do you test rate limiting?

Topic: api-rest | Standard | id: q0334

**Say:** Rate limiting caps how many requests a client may send in a time window, and the server answers 429 Too Many Requests, often with `Retry-After`. I test it in two places. For the API: I send requests past the limit on a test environment and assert the 429, the header, and that the limit resets after the window. For a client or a UI: I mock a 429 and check that the client backs off and shows a sensible message. I never hammer a shared or production environment.

**Full process:**
1. Read the documented limit, for example 10 requests per 10 seconds per token.
2. Use a dedicated test token, so other tests are not affected.
3. Send limit plus one requests, quickly, and assert that the last one is 429 and has `Retry-After`.
4. Wait the `Retry-After` time, and assert that the next request succeeds.
5. Assert that a different token is not blocked.

```ts
import { test, expect } from '@playwright/test';

test('11th request in the window gets 429 with Retry-After', async ({ request }) => {
  const statuses: number[] = [];
  let last;
  for (let i = 0; i < 11; i++) {
    last = await request.get('/api/ping');
    statuses.push(last.status());
  }
  expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
  expect(statuses[10]).toBe(429);
  expect(Number(last?.headers()['retry-after'])).toBeGreaterThan(0);
});
```

What it produces: eleven sequential calls and one 429. It only works when the limit applies to this token and the environment is not shared with other tests in parallel.

**Follow-ups:**
- *How do you test the UI side?* `page.route('**/api/**', route => route.fulfill({ status: 429, headers: { 'retry-after': '2' } }))`, then assert the message or the retry.
- *Which headers show the remaining quota?* Many APIs send `X-RateLimit-*`. An IETF draft defines `RateLimit` headers, so I follow the API's own docs.

**Trap:** Running a load loop on the shared dev environment and blocking the whole team's tests.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429

### What is a safe way to retry a failed API call?

Topic: api-rest | Standard | id: q0335

**Say:** Retry only when it makes sense: network errors, 429, 502, 503 and 504. Never retry a 4xx such as 400, 401, 403 or 404, because the same request fails the same way. Retry only idempotent requests, or a POST that carries an idempotency key. Wait between attempts with exponential backoff and random jitter, respect `Retry-After`, and cap the number of attempts. Without those rules, retries turn a small outage into a retry storm.

**Full process:** a small client helper and how I test it.
1. Retry on the listed codes only, up to 3 attempts.
2. Delay: 200 ms, 400 ms, 800 ms plus a random part. If `Retry-After` exists, use it.
3. Test with `page.route` or a stub server that returns 503 twice and 200 on the third call. Assert 3 calls and the final success.
4. Test that a 400 is not retried: the stub counts exactly 1 call.

```ts
import { test, expect } from '@playwright/test';

test('client retries a 503 and succeeds', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/bookings', async (route) => {
    calls += 1;
    if (calls < 3) {
      await route.fulfill({ status: 503, headers: { 'retry-after': '1' } });
    } else {
      await route.fulfill({ status: 200, json: { items: [] } });
    }
  });
  await page.goto('/bookings');
  await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();
  expect(calls).toBe(3);
});
```

What it produces: the app sees two failures and then a success, and the test counts the calls. Playwright's own `maxRetries` on `request` retries only `ECONNRESET`, and never HTTP status codes.

**Follow-ups:**
- *What is jitter?* A random part of the delay, so that many clients do not retry at the same moment.
- *Why is a POST retry dangerous?* The first one may have succeeded and the response was lost, so the retry creates a duplicate.

**Trap:** "Retry everything three times." That duplicates payments and hides real 4xx bugs.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

### What is an idempotency key and how do you test it?

Topic: api-rest | Standard | id: q0336

**Say:** An idempotency key is a unique value, often a UUID, that the client sends in a header with a POST. The server stores the key with the result of the first request. If the same key comes again, the server returns the stored result and does not repeat the action. This makes a POST safe to retry, which matters for payments and orders. The `Idempotency-Key` header is still an IETF draft, but it is widely used in payment APIs. My test sends the same request twice with the same key and checks that only one resource exists.

**Full process:**
1. Generate one UUID.
2. POST with `Idempotency-Key: <uuid>`. Expect 201.
3. POST the same body and the same key again. Expect the same result (the same `id`, the same status or a documented replay response), and no second resource.
4. POST the same key with a different body. Expect an error, commonly 422 or 409, because the key belongs to another request.
5. POST with a new key and the same body. Expect a new resource.
6. List the resources and count them.

```ts
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('same idempotency key creates one payment', async ({ request }) => {
  const key = randomUUID();
  const body = { amount: 1500, currency: 'PLN' };

  const first = await request.post('/api/payments', {
    headers: { 'Idempotency-Key': key },
    data: body,
  });
  expect(first.status()).toBe(201);

  const replay = await request.post('/api/payments', {
    headers: { 'Idempotency-Key': key },
    data: body,
  });
  expect((await replay.json()).id).toBe((await first.json()).id);

  const other = await request.post('/api/payments', {
    headers: { 'Idempotency-Key': key },
    data: { amount: 9999, currency: 'PLN' },
  });
  expect([409, 422]).toContain(other.status());
});
```

What it produces: proof of replay safety. The exact code for the replay and for the mismatch is defined by the API, so I read its docs.

**Follow-ups:**
- *How long does the server keep keys?* Usually 24 hours or so. I ask the team, and test the key after a different time only when it is testable.
- *What about two identical requests at the same moment?* A good server locks on the key, so one waits or gets 409. I send both with `Promise.all` and assert one resource.

**Trap:** Saying "POST is idempotent if you add an id". The key must be enforced by the server.

**Source:** https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/

### How do you test an asynchronous API that uses polling?

Topic: api-rest | Standard | id: q0337

**Say:** I send the request, assert 202 and a status link, and then poll the status resource until it reaches a final state, with a timeout. I use `expect.poll` in Playwright, with growing intervals, and I never use a fixed sleep. I test the three outcomes: success, failure with a reason, and a timeout case where the job never ends and my test fails with a clear message. I also assert the real result at the end, not only the status field.

**Full process:** the full code is in the 201 vs 202 answer. Extra points:
1. Make the poll function return the status field only, so the failure message shows the last status.
2. Set the timeout above the real worst case on CI. Do not just raise it when a test is flaky, because a slow job is a finding.
3. Start the poll right after the 202, not after a pause.
4. Clean up the job result at the end.

**Follow-ups:**
- *Why not wait in the UI?* If a UI shows the result, I can assert on the UI with a web-first assertion. If there is no UI, I poll the API.
- *What about webhooks instead of polling?* Then the server calls me, and the test needs a receiver. See the webhook answers.
- *The write goes through a queue and takes 5 seconds to 2 minutes. Is a 2xx enough?* No. The 2xx says the request was accepted, not that the resource was written. In Playwright I read the resource in `expect.poll(fn, { intervals, timeout })` for one value, or in `expect(async () => { ... }).toPass({ intervals, timeout })` for several assertions, with the timeout a little above the slowest real write.

**Trap:** `await page.waitForTimeout(5000)` then a single check.

**Source:** https://playwright.dev/docs/api-testing

### How do you test file upload through an API?

Topic: api-rest | Standard | id: q0338

**Say:** A file upload usually uses `multipart/form-data`. I send a small file with the right field name, and I assert the status, the returned metadata, and that the file can be downloaded with the same content. Then the negative cases: a wrong type, a file over the size limit, an empty file, a missing field, and a file with a dangerous name such as `../x`. In Playwright `request.post` takes a `multipart` option, and it sets the content type with the boundary for me.

**Full process:**
1. Create the file content in memory with a `Buffer`.
2. POST with `multipart`.
3. Assert 201 and the metadata: name, size, MIME type, URL.
4. GET the URL and assert the bytes are equal.
5. Negative: an oversized file gets 413, a wrong type gets 415 or 422.

```ts
import { test, expect } from '@playwright/test';

test('upload and download the same bytes', async ({ request }) => {
  const content = Buffer.from('hello,world\n1,2\n');
  const upload = await request.post('/api/files', {
    multipart: {
      file: { name: 'data.csv', mimeType: 'text/csv', buffer: content },
      folder: 'reports',
    },
  });
  expect(upload.status()).toBe(201);
  const meta = await upload.json();
  expect(meta.size).toBe(content.length);

  const download = await request.get(meta.url);
  expect(Buffer.compare(await download.body(), content)).toBe(0);
});
```

What it produces: one multipart request and one download. I do not set the `Content-Type` header by hand, because the boundary is generated.

**Follow-ups:**
- *Several files in one request?* Use `FormData` and append each file under the same field name.
- *What do you check for security?* The server checks the real type and not only the extension, and it does not run uploaded content.

**Trap:** Setting `Content-Type: multipart/form-data` manually. Without the boundary the server cannot parse the body.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

## Testing an endpoint, and UI versus API

### What do you test on an API endpoint?

Topic: api-rest | Standard | id: q0339

**Say:** I test the contract and the behaviour. Contract: the status code, the response schema, the headers, and the error format. Behaviour: the business rules, and the real side effect, for example the row in the database or the message that was sent. Then access: no token, wrong role, another user's data. Then input: missing, wrong type, empty, too long, boundary values, special characters. Then reliability: repeat the call (idempotency), run two at once (concurrency), and the dependency failure case. I start from the spec and the risks, not from the list of fields.

**Full process:** my order for one new `POST /bookings` endpoint.
1. Read the spec or the OpenAPI file and the acceptance criteria. Note the required fields, limits and rules.
2. Happy path: the exact status, `Location`, body, and a GET to confirm it exists.
3. Schema: validate the response with JSON Schema.
4. Negative input: each required field missing, null, wrong type, too long, below and above each boundary.
5. Auth: 401 without a token, 403 for the wrong role, 403 or 404 for another user's resource.
6. State rules: duplicate gives 409, a booking on a past date gives 422.
7. Side effects: the database row, the email or event that should be sent, and no extra rows after a failed request.
8. Repeat and race: the same request twice, and two parallel requests for the last free slot.
9. Cleanup: delete what I created.

```ts
import { test, expect } from '@playwright/test';

const invalidBodies = [
  { name: 'missing roomId', body: { nights: 2 } },
  { name: 'zero nights', body: { roomId: 7, nights: 0 } },
  { name: 'too many nights', body: { roomId: 7, nights: 366 } },
  { name: 'wrong type', body: { roomId: 7, nights: 'two' } },
];

for (const { name, body } of invalidBodies) {
  test(`rejects ${name}`, async ({ request }) => {
    const res = await request.post('/api/bookings', { data: body });
    expect([400, 422]).toContain(res.status());
    expect((await res.json()).message).toBeTruthy();
  });
}
```

What it produces: one test per invalid body, so a failure names the exact case. This is a data-driven test: the loop creates separate tests at load time.

**Follow-ups:**
- *How do you choose boundary values?* From the rules: the minimum, minimum minus one, the maximum, maximum plus one, and one typical value.
- *How do you check the database?* With a read-only query in the test, or through a read endpoint that the UI also uses. A failed request must leave no row behind.
- *How do you decide what is enough?* By risk: money, permissions and data loss first, then the frequently used paths.

**Trap:** Testing only "status is 200 and the field exists". That passes while the data in the database is wrong.

**Source:** https://playwright.dev/docs/api-testing

### How do you assert a response that has dynamic values like IDs and timestamps?

Topic: api-rest | Standard | id: q0340

**Say:** I assert the shape and the stable fields exactly, and I use matchers for the dynamic ones. In Playwright's `expect`, I use `expect.any(String)` for an ID, `expect.stringMatching` for a timestamp pattern, and `toMatchObject` so extra fields do not break the test. I do not compare the whole body to a saved JSON file with a timestamp in it. When I must compare two responses, I remove the dynamic fields first.

**Full process:**
1. Decide which fields are stable (name, status) and which are dynamic (id, createdAt, token).
2. Assert stable fields by value, and dynamic fields by type or pattern.
3. For a deep compare of two responses, delete the dynamic keys from both copies and compare the rest.

```ts
import { test, expect } from '@playwright/test';

test('created booking has the expected shape', async ({ request }) => {
  const res = await request.post('/api/bookings', { data: { roomId: 7, nights: 2 } });
  const body = await res.json();
  expect(body).toEqual({
    id: expect.any(String),
    roomId: 7,
    nights: 2,
    status: 'pending',
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  });
  await request.delete(res.headers()['location']);
});
```

What it produces: an exact match on the full set of fields. If the API adds a field, `toEqual` fails, which is what I want for a strict contract. For a looser check I use `toMatchObject`.

**Follow-ups:**
- *Why compare timestamps at the same precision?* A system that stores seconds and one that stores milliseconds give false mismatches.
- *Big IDs?* `JSON.parse` rounds integers above 2^53, so two large IDs can collide. I read such IDs as strings.

**Trap:** Hard-coding a created ID or a timestamp from an earlier run.

**Source:** https://playwright.dev/docs/api-testing

### How do you test an API when there is no UI yet?

Topic: api-rest | Standard | id: q0341

**Say:** I test from the spec. I read the OpenAPI file or the requirements, then build requests in Postman, Bruno or curl, and write down the expected status, schema and rules before the first call. For a regular suite I move them to Playwright `request` tests or a Postman collection run in CI. This shifts testing earlier: the frontend and backend can then agree on the contract before the UI exists, and I find the defects before the UI hides them.

**Full process:**
1. Get the OpenAPI spec, or ask the developer for example requests.
2. Import it into Postman or Bruno, which creates a request per endpoint.
3. Set up an environment (base URL, token) and a happy path request chain: create, read, update, delete.
4. Add negative and boundary cases from the rules.
5. When the UI arrives, keep the API tests and add a few UI end-to-end flows on top.

**Follow-ups:**
- *What if there is no spec?* I explore the API with the developer, write down what I learn as a collection, and ask the team to confirm the rules. Exploratory testing on an undocumented API works the same way.
- *What do you do about missing dependencies?* I mock them, or use a sandbox.

**Trap:** Waiting for the UI. By then the cheapest moment to find the defect has passed.

**Source:** https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/

### When do you test through the UI and when through the API?

Topic: api-rest | Standard | id: q0342

**Say:** I test business rules and data validation through the API, because it is faster, more stable and more precise. I use the UI for what only the UI does: rendering, navigation, forms, accessibility and the full user flow. I also use the API inside UI tests for setup and checks: create the data through the API, then open the page, and afterwards confirm the stored result through the API. That keeps UI tests short and less flaky. A few end-to-end tests then prove that the UI and backend work together.

**Full process:** a UI test that uses the API for preconditions and postconditions.
1. Create the booking through the API, so the test does not click through creation.
2. Open the page and assert what the user sees, with a web-first assertion.
3. Perform the one UI action under test.
4. Check the post-condition through the API.
5. Delete the data through the API.

```ts
import { test, expect } from '@playwright/test';

test('user cancels a booking in the UI', async ({ page, request }) => {
  const created = await request.post('/api/bookings', { data: { roomId: 7, nights: 2 } });
  const booking = await created.json();

  await page.goto(`/bookings/${booking.id}`);
  await expect(page.getByRole('heading', { name: 'Booking details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel booking', exact: true }).click();
  await expect(page.getByText('Booking cancelled', { exact: true })).toBeVisible();

  const after = await (await request.get(`/api/bookings/${booking.id}`)).json();
  expect(after.status).toBe('cancelled');
  await request.delete(`/api/bookings/${booking.id}`);
});
```

What it produces: one UI action, and three API calls around it. The `request` fixture and the `page` do not share cookies, so if the API needs login, I send the token in `extraHTTPHeaders`, or use `page.request`, which shares the page's cookies.

**Follow-ups:**
- *What is the downside of UI-only tests?* They are slow, and a failure does not say whether the UI or the backend broke.
- *What is the downside of API-only tests?* They do not prove that the UI sends the right request.

**Trap:** Saying "API tests replace UI tests". They check different risks.

**Source:** https://playwright.dev/docs/api-testing

### How do you troubleshoot a 4xx or 5xx response?

Topic: api-rest | Standard | id: q0343

**Say:** I read the status and the error body first, and I do not guess. For a 4xx I compare my request with the spec: method, URL, headers, token, body. For a 5xx I capture the request ID, repeat the call to see if it is constant or intermittent, and find the matching log entry or stack trace. Then I reduce the case: the smallest request that fails, in curl, so a developer can reproduce it in one line. I report the request, the response, the time and the environment.

**Full process:**
1. Reproduce with curl `-i -v`, and copy the exact request from the DevTools Network tab ("Copy as cURL") if it came from the UI.
2. 4xx: check each part. Is the token expired (401)? Is the role right (403)? Is the body valid (400, 422)? Is the ID right (404)? Is the content type right (415)?
3. 5xx: note the `x-request-id`, search the logs (Kibana, Sentry), and look at the time of a deploy.
4. Try a second environment or a second account to see if the problem is data-specific.
5. Write the bug with the curl command, the full response and the log link.

```bash
curl -i -sS https://api.example.com/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"roomId":7,"nights":2}'
```

What it produces: the status line, all response headers and the body, in one paste-ready block. I never paste a real token into a ticket.

**Follow-ups:**
- *What if it works in Postman and fails in the app?* Compare the two requests header by header. Usual causes: a different token, CORS, cookies, or a different `Content-Type`.
- *What if the error is intermittent?* Repeat it many times, record the failure rate, and find what differs between the failing and passing calls.

**Trap:** "I reported that the API returns 500" with no request, response, or time.

**Source:** https://curl.se/docs/manpage.html

### The API returns 200 but the UI shows old data. What do you check?

Topic: api-rest | Standard | id: q0344

**Say:** I find out which side is wrong before I touch anything. First I open the Network tab and look at the exact request the UI makes: is it the same endpoint I tested, and is it served from cache (a 304, "disk cache", or a service worker)? Then I call that same URL with curl and compare the body. If the API body is correct and the UI is old, the cause is a cache or a UI that did not refetch. If the API body is old too, the cause is the backend: a read replica lagging, a cache layer, or an asynchronous job that is not finished. The fix differs for each, so I narrow it down first.

**Full process:**
1. Network tab: find the request, and read the status, the size column ("from disk cache"), and the response body. Check `Cache-Control` and `ETag`.
2. Repeat the request with curl using the same token. Add `Cache-Control: no-cache` to rule out a cache between us.
3. Compare the body with the database, if I have access.
4. If the API is right and the UI is wrong: check whether the page fetches once on load and never again, a client cache such as React Query with a long stale time, or an old service worker. Hard reload and compare.
5. If the API is old: check the replica lag, a CDN cache, and whether the write was a 202 that is still processing. Wait and call again after the job finishes.
6. In an automated test: poll the same endpoint the UI uses until the record exists, then open the view. I do not add a sleep.

```ts
import { test, expect } from '@playwright/test';

test('new order shows up in the list', async ({ page, request }) => {
  const created = await request.post('/api/orders', { data: { sku: 'A-1', qty: 1 } });
  const { id } = await created.json();

  await expect
    .poll(async () => (await request.get(`/api/orders/${id}`)).status(), {
      intervals: [250, 500, 1_000],
      timeout: 15_000,
    })
    .toBe(200);

  await page.goto('/orders');
  await expect(page.getByRole('link', { name: `Order ${id}`, exact: true })).toBeVisible();
});
```

What it produces: the test waits until the backend has the order, so the page load does not race the write.

**Follow-ups:**
- *What if the API is eventually consistent?* Then a short delay is by design, and the test polls for it. If the UI promises "instant", the delay is a bug.
- *How do you tell a browser cache from a server cache?* A request answered "from disk cache" never reached the server. A curl call with `Cache-Control: no-cache` shows what the server holds.

**Trap:** Adding `waitForTimeout` until the test passes. It hides the cause and fails again on a slower runner.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching

### The POST returned 201, but the GET does not show the new item. Why?

Topic: api-rest | Standard | id: q0345

**Say:** The create worked, but the read side has not caught up, or it reads a different place. Typical causes: a read replica with lag, a search index or cache that updates asynchronously, a GET with a filter that hides the new item, such as a different user or a default date range, or a list cache. I confirm with GET by ID on the `Location` URL, then the list. If GET by ID works and the list does not, it is the index or cache. If neither works, the write is not committed, and I look at the transaction and the response.

**Full process:**
1. GET the `Location` URL. 200 means the resource exists.
2. Call the list with and without filters, and as the same user.
3. Poll the list for up to the documented delay.
4. If it never appears, check the database and the logs, and report the exact timing.

**Follow-ups:**
- *Is the delay always a bug?* No. Search indexes are often eventually consistent. It becomes a bug when the UI promises immediate visibility.

**Trap:** Assuming the 201 proves the item is visible everywhere.

**Source:** https://microservices.io/patterns/data/saga

### A user clicks "Submit" twice and gets two records. How do you test and prevent it?

Topic: api-rest | Standard | id: q0346

**Say:** This is a duplicate-request bug. The fix is on two levels: the client disables the button after the first click, and the server makes the create idempotent with an idempotency key or a unique constraint. I test the server directly by sending the same request twice at the same moment, because a UI test depends on timing. I assert that only one record exists, and that the second request returns the same result or a 409.

**Full process:**
1. Build one request body.
2. Send two requests in parallel with `Promise.all`.
3. List the records and count.
4. Assert exactly one, and that no response is a 500.
5. In the UI, double click the button and assert that the request count is one, using `page.on('request')` or a route counter.

```ts
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('two parallel submits create one record', async ({ request }) => {
  const key = randomUUID();
  const send = () =>
    request.post('/api/orders', { headers: { 'Idempotency-Key': key }, data: { sku: 'A-1', qty: 1 } });
  const [a, b] = await Promise.all([send(), send()]);

  expect([a.status(), b.status()].every((s) => s < 500)).toBe(true);
  const list = await (await request.get('/api/orders', { params: { sku: 'A-1' } })).json();
  expect(list.items).toHaveLength(1);
});
```

What it produces: a race test on the server. It needs a clean state for `sku: 'A-1'`, so I create a unique SKU per run.

**Follow-ups:**
- *Is disabling the button enough?* No. A retry, a second tab or a script bypasses it.

**Trap:** Only testing the double click in the UI. That depends on the browser timing and can pass by luck.

**Source:** https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/

### An API test passes locally and fails in CI. What do you check?

Topic: api-rest | Standard | id: q0347

**Say:** I find the difference between the two runs and do not rerun until it passes. I check the environment (base URL, version deployed, data), the credentials, the timing (CI is slower and runs in parallel), and shared data that other tests change. Then I reproduce in the same conditions as CI: the same image, the same workers, the same retries. One run proves nothing, so I measure by volume, for example 200 repeats, before and after a fix.

**Full process:**
1. Read the CI failure: status, body, request, and the trace or the report attachment.
2. Compare the environment: is the deployed commit the one I expect, is the environment up (dev environments may be down by design).
3. Look for shared state: two tests use the same user or record.
4. Reproduce with the same settings and `--repeat-each`.
5. Fix the cause (isolate data, assert the state not the time) and run the repeat again.

```bash
npx playwright test api/bookings.spec.ts --repeat-each=200 --workers=4
```

**Follow-ups:**
- *Should you add retries?* A retry is acceptable for a named test with a reason. Global retries hide real defects.
- *How do you know it is the product and not the test?* A failure that also appears on the shared main branch in the same time window is not caused by my change.

**Trap:** Rerunning the pipeline until it is green.

**Source:** https://playwright.dev/docs/api-testing

### The access token expires during a long test run and you get 401. What do you do?

Topic: api-auth | Niche | id: q0348

**Say:** I create the token per test or per worker, close to where it is used, and I do not share one token for the whole run. For a long suite I fetch a fresh token when the old one is near expiry, or I call the refresh endpoint. I also test the expiry on purpose: an expired token must give 401, and the client must refresh and retry once. If tests fail with 401 after a fixed time, I look at the token lifetime before suspecting the product.

**Full process:**
1. Log in through the API in a fixture, with a short lived token.
2. Put it in `extraHTTPHeaders` for that fixture's request context.
3. Read `exp` from the payload to refresh it, if the lifetime is shorter than the test.
4. For the negative test, use a token that is already expired (from a test auth server, or a token I sign with the test key).

```ts
import { test as base, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ baseURL }, use) => {
    const anonymous = await pwRequest.newContext({ baseURL });
    const login = await anonymous.post('/api/login', {
      data: { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD },
    });
    const { accessToken } = await login.json();
    await anonymous.dispose();

    const api = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });
    await use(api);
    await api.dispose();
  },
});

test('profile loads', async ({ api }) => {
  expect((await api.get('/api/me')).status()).toBe(200);
});
```

What it produces: a fresh logged-in client per test that is disposed afterwards. A per-test login adds one request, and avoids a stale token and shared state.

**Follow-ups:**
- *Why not one token in global setup?* It can expire mid-run, and a state shared across tests creates test coupling.

**Trap:** Hard-coding a long-lived token in the repository.

**Source:** https://playwright.dev/docs/api/class-apirequest

## Playwright `request` in practice

### How do you do API testing in Playwright?

Topic: api-rest | Standard | id: q0349

**Say:** Playwright has a built-in `APIRequestContext`. In a test I take the `request` fixture and call `request.get`, `post`, `put`, `patch`, `delete` or `fetch`. It respects `baseURL` and `extraHTTPHeaders` from the config, sends JSON when I pass an object in `data`, and keeps cookies between calls. I assert with the same `expect`, and `expect(response).toBeOK()` checks for a 2xx. It does not need a browser, so these tests are fast, and the same project can mix API and UI tests.

**Full process:**
1. Set `baseURL` and default headers in `playwright.config.ts`.
2. Write a test with `{ request }` and call the API.
3. Check the status first, then the headers, then the body.
4. Use fixtures for login and for test data with cleanup.
5. Run it: `npx playwright test api/`.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.API_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
  },
});
```

```ts
import { test, expect } from '@playwright/test';

test('GET /health', async ({ request }) => {
  const res = await request.get('/health');
  await expect(res).toBeOK();
  expect(res.headers()['content-type']).toContain('application/json');
  expect(await res.json()).toMatchObject({ status: 'ok' });
});
```

What it produces: a test report with the request and response failure details. By default `request` does not throw on 4xx or 5xx, so my assertions decide. Setting `failOnStatusCode: true` makes it throw on non-2xx and 3xx.

**Follow-ups:**
- *What can you send?* `data` for JSON or raw, `form` for URL-encoded, `multipart` for files, `params` for the query string, and `headers`.
- *Default timeout?* 30 seconds per request, and `0` disables it.

**Trap:** Forgetting `await` on `request.post(...)` or on `res.json()`. The test then asserts on a promise.

**Source:** https://playwright.dev/docs/api-testing

### What is the difference between the `request` fixture, `page.request` and `request.newContext()`?

Topic: api-rest | Standard | id: q0350

**Say:** The `request` fixture is a ready API client for the test, set up from the config. It is separate from the browser, so it has its own cookies. `page.request` and `context.request` are the API client of the browser context: they share cookies with the page, so a login in the browser works for API calls and the other way round. `request.newContext()` (from `playwright.request`) creates a new client where I choose `baseURL`, headers, proxy and storage state, and I dispose it myself. I use `newContext` when I need a different user or a different service in one test.

**Full process:** choosing one.
1. Plain API test: the `request` fixture.
2. API call that must run as the logged-in browser user: `page.request`.
3. Two users in one test, for example admin and member: two `newContext` calls with different headers.
4. Always `await ctx.dispose()` for a context I create.

```ts
import { test, expect, request as pwRequest } from '@playwright/test';

test('admin sees what member cannot', async ({ baseURL }) => {
  const admin = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  });
  const member = await pwRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.MEMBER_TOKEN}` },
  });
  expect((await admin.get('/api/audit-log')).status()).toBe(200);
  expect((await member.get('/api/audit-log')).status()).toBe(403);
  await admin.dispose();
  await member.dispose();
});
```

What it produces: a role comparison in one test, with two independent cookie jars.

**Follow-ups:**
- *Can you save and reuse a login?* Yes, `await ctx.storageState()` saves cookies and local storage, and `storageState` in `newContext` or the config loads it.

**Trap:** Expecting the `request` fixture to be logged in because the page is.

**Source:** https://playwright.dev/docs/api/class-apirequest

### How do you mock an API response in a UI test?

Topic: api-rest | Standard | id: q0351

**Say:** I use `page.route` to intercept the request and `route.fulfill` to answer it. That lets me test states that are hard to produce for real: a 500, a 429, an empty list, a slow response, or a huge list. For many realistic responses I record a HAR file and replay it with `routeFromHAR`. I use a mock to test the UI's reaction. I do not use it as proof that the backend works, so I keep real API tests for that.

**Full process:**
1. Register the route before the action that triggers the request.
2. Fulfil with a status and a JSON body.
3. Trigger the action and assert on the UI state.
4. Optionally assert that the request body is what the UI should send, with `route.request().postDataJSON()`.

```ts
import { test, expect } from '@playwright/test';

test('shows an error state when the API fails', async ({ page }) => {
  await page.route('**/api/bookings', (route) =>
    route.fulfill({ status: 500, json: { message: 'Server error' } }),
  );
  await page.goto('/bookings');
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
});
```

What it produces: the page loads and receives the 500 for that URL only. Other requests go to the real network.

**Follow-ups:**
- *When is a mock wrong?* When the real API changed and the mock did not. That is why contract tests exist.
- *Can you change a real response?* Yes: `await route.fetch()` gets the real one, and `route.fulfill({ response, json: modified })` returns a changed version.

**Trap:** Mocking everything and then claiming the feature is tested end to end.

**Source:** https://playwright.dev/docs/api-testing

### How do you validate a response with a JSON Schema in Playwright?

Topic: api-contract | Niche | id: q0352

**Say:** I describe the response in a JSON Schema: required fields, types, formats, allowed values. I compile it once with Ajv and run it against every response in the test. If the validation fails, the test prints the Ajv errors, so I see which field is wrong. This catches a missing field, a number that became a string, or a null where the contract says a value. Schema checks are my first assertion, then I add value checks for the business rules.

**Full process:**
1. `npm install ajv ajv-formats`.
2. Write the schema, or take it from the OpenAPI file.
3. Compile once at module level, because compiling is slow and a compiled function is fast.
4. Validate in the test and fail with `ajv.errorsText`.

```ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { test, expect } from '@playwright/test';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const bookingSchema = {
  type: 'object',
  required: ['id', 'roomId', 'nights', 'status', 'createdAt'],
  properties: {
    id: { type: 'string' },
    roomId: { type: 'integer' },
    nights: { type: 'integer', minimum: 1 },
    status: { enum: ['pending', 'paid', 'cancelled'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
} as const;

const validateBooking = ajv.compile(bookingSchema);

test('GET /bookings/1 matches the schema', async ({ request }) => {
  const res = await request.get('/api/bookings/1');
  expect(res.status()).toBe(200);
  const body = await res.json();
  const valid = validateBooking(body);
  expect(valid, ajv.errorsText(validateBooking.errors)).toBe(true);
});
```

What it produces: a failure message like `data/nights must be integer`. Ajv overwrites its `errors` property on every call, so I read it right after the call.

**Follow-ups:**
- *What does `additionalProperties: false` do?* It rejects fields not in the schema. It is strict, so an additive change (a new field) fails the test. I use it for strict contracts, and leave it out when the API may add fields.
- *Why not rely on TypeScript types?* Types exist only at compile time. A response typed as `Booking` is not checked at runtime.

**Trap:** Writing the schema from one sample response. It then encodes accidents, such as a field that happened to be present.

**Source:** https://ajv.js.org/guide/getting-started.html

## API tools: Postman, Bruno, Swagger and OpenAPI, Charles, curl

### How do you organise Postman collections and environments?

Topic: api-tools | Core | id: q0353

**Say:** A collection is a group of requests, organised in folders by feature, with shared auth and scripts set once at the collection or folder level. An environment is a set of variables per target, such as `dev`, `staging` and `local`, with `baseUrl`, credentials and IDs. The requests use `{{baseUrl}}`, so the same collection runs against any environment. Secrets go in the environment's secret or current value fields, not in the shared collection. Variables have scopes: local, data, environment, collection and global, and the narrower one wins.

**Full process:** building a collection from a spec.
1. Create the collection, and import the OpenAPI file if there is one. This creates folders and requests.
2. Set collection-level auth (for example a Bearer token with `{{token}}`), so each request inherits it.
3. Create an environment per target with `baseUrl` and the credentials.
4. Add a login request first. Its post-response script saves the token into the environment.
5. Add tests to each request (status, schema, key fields) and name them in plain words.
6. Order the folders as a flow (create, read, update, delete), so the Collection Runner runs them in sequence.
7. Export the collection and environment, or keep them in the team workspace under version control.

**Follow-ups:**
- *Which scope wins?* The narrowest: local, then data (from a file), then environment, then collection, then global.
- *How do you keep secrets safe?* Use the secret type or the current value, and never commit exported environments that contain tokens.

**Trap:** Hard-coding the URL and the token in every request.

**Source:** https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/

### How do you write tests and chain requests in Postman?

Topic: api-tools | Core | id: q0354

**Say:** Tests are JavaScript in the Post-response script tab. `pm.test("name", fn)` defines a test, and `pm.expect(...)` or `pm.response.to.have.status(201)` makes the assertion. To chain requests, a script saves a value with `pm.environment.set("bookingId", id)`, and the next request uses `{{bookingId}}` in its URL. A pre-request script runs before the request and can prepare data, such as a timestamp or a signature. The scripts run in the Postman Sandbox, which is based on Node.js.

**Full process:** the create then read chain.
1. Request 1 `POST {{baseUrl}}/bookings` with a JSON body. Post-response script:

```js
pm.test('created', () => {
  pm.response.to.have.status(201);
  pm.expect(pm.response.headers.get('Location')).to.match(/\/bookings\/\w+$/);
});

const body = pm.response.json();
pm.test('has an id', () => pm.expect(body.id).to.be.a('string'));
pm.environment.set('bookingId', body.id);
```

2. Request 2 `GET {{baseUrl}}/bookings/{{bookingId}}`. Post-response script:

```js
pm.test('same booking', () => {
  pm.response.to.have.status(200);
  pm.expect(pm.response.json().id).to.eql(pm.environment.get('bookingId'));
});
```

3. Run the collection with the Collection Runner, and read the pass or fail per test.

What it produces: a green or red line per `pm.test`, and an environment variable that links the two requests. A failed assertion inside `pm.test` does not stop later tests, so I put one idea per test.

**Follow-ups:**
- *How do you validate a schema?* `pm.response.to.have.jsonSchema(schema)`.
- *How do you change the order of requests?* With `setNextRequest` in a script, or by ordering the folder. I prefer the folder order, because it is easier to read.
- *How do you avoid leftover data?* A last request deletes what the flow created.

**Trap:** Putting all assertions in one `pm.test`. The first failure hides the others.

**Source:** https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/

### How do you run Postman tests from the command line and in CI?

Topic: api-tools | Core | id: q0355

**Say:** With Newman, the open-source command-line runner for Postman collections. Export the collection and the environment as JSON, and run `newman run collection.json -e env.json`. A failed assertion makes Newman exit with code 1, so the CI job fails; it was run on Newman 6.2.3 to confirm. The Postman docs mention the exit code only under `--bail`, which stops the run at the first failure, so it can be added to fail fast. Add a reporter such as JUnit so the CI shows the results. Check the exit code in the pipeline once, with a deliberately failing test. Postman now says Newman will not receive updates and points to its own Postman CLI, so for a new pipeline that should be checked first.

**Full process:**
1. `npm install -g newman`. It needs Node.js 16 or later.
2. Export `collection.json` and `staging.json` from Postman, or keep them in the repository.
3. Run: `newman run collection.json -e staging.json --bail -r cli,junit --reporter-junit-export results.xml`.
4. In GitLab CI, a job runs that command in a Node image and keeps `results.xml` as a report artifact.
5. Pass secrets as environment variables with `--env-var "token=$API_TOKEN"`, and never keep them in the exported file.

```bash
newman run collection.json -e staging.json \
  --env-var "token=$API_TOKEN" \
  --bail -r cli,junit --reporter-junit-export results.xml
echo "exit code: $?"
```

What it produces: a console summary table, a JUnit XML file, and a non-zero exit code when an assertion fails.

**Follow-ups:**
- *Does Newman support OAuth 2.0 auth helpers?* No. Postman staff say the OAuth 2.0 helper does not run in Newman or the Postman CLI, so a token must be fetched in a request or passed in as a variable.
- *Why run it in CI?* The collection becomes a smoke or regression gate after each deployment.

**Trap:** Never checking that a failing test really turns the pipeline red. Prove it once with a deliberate failure.

**Source:** https://learning.postman.com/docs/collections/using-newman-cli/newman-options/

### How do you run a data-driven test in Postman?

Topic: api-tools | Core | id: q0356

**Say:** I put the test data in a CSV or JSON file, one row per case, and run the collection with it in the Collection Runner or in Newman. The runner repeats the whole collection once per row, and each column becomes a data variable I use as `{{email}}` in the request, or `pm.iterationData.get("email")` in a script. This suits validation rules, because one request covers many invalid inputs. I include the expected status in the file, so the test is generic.

**Full process:**
1. Create `cases.csv`:

```csv
name,nights,expectedStatus
valid,2,201
zero,0,422
negative,-1,422
too_many,366,422
```

2. In the request body use `{"roomId": 7, "nights": {{nights}}}`.
3. In the post-response script:

```js
pm.test(`case ${pm.iterationData.get('name')}`, () => {
  pm.response.to.have.status(Number(pm.iterationData.get('expectedStatus')));
});
```

4. Run: `newman run collection.json -d cases.csv`. Newman runs 4 iterations.

What it produces: one result per row. A data variable shadows an environment variable with the same name, because the data scope is narrower.

**Follow-ups:**
- *How is this in Playwright?* A loop over an array of cases creates one test per case, as in the endpoint answer above.

**Trap:** Cleaning up only after the last iteration, so the failed ones leave data behind.

**Source:** https://learning.postman.com/docs/collections/using-newman-cli/newman-options/

### Postman or Playwright for API tests? When would you use each?

Topic: api-tools | Core | id: q0357

**Say:** Postman is best for exploring an API, quick checks, sharing requests with the team, and for people who do not write code. Playwright `request` is best for a regression suite that lives in the repository: it is code, so it has code review, version history, types, fixtures, parallel runs and the same runner as the UI tests, and one report. Explore in Postman or Bruno, then automate the stable checks in Playwright. If you have used both, say how each served different needs: Postman for exploration and team sharing, Playwright for automated API tests and setup.

**Full process:**
1. Explore the endpoint in Postman or Bruno to learn the behaviour.
2. Decide which checks are stable and valuable.
3. Write them as Playwright tests, with fixtures for auth and data.
4. Keep the collection as documentation, or drop it when it duplicates the code.

**Follow-ups:**
- *What about the maintenance cost of two tools?* Duplicated coverage is a cost. Example: removed OpenAPI-based tests that duplicated what the API repository already tested.
- *Can Postman run in CI?* Yes, with Newman or the Postman CLI.

**Trap:** Saying one is always better. It depends on who maintains the tests and where they run.

**Source:** https://playwright.dev/docs/api-testing

### What is Bruno and how does it compare with Postman?

Topic: api-tools | Standard | id: q0358

**Say:** Bruno is an open-source API client. It stores each request as a plain text `.bru` file in a normal folder, so a collection is a directory that lives in git, with readable diffs and merge requests, and no account is required. Postman keeps collections in its own workspace and cloud, though it has added Git features. The Bruno CLI, `bru run`, runs a collection or a folder from the terminal, with environments, CSV or JSON data files and JUnit, JSON or HTML reports. Tests use a Chai style: `expect(res.getStatus()).to.equal(200)`.

**Full process:** running a Bruno collection in CI.
1. Keep the collection folder in the repository.
2. Install the CLI: `npm install -g @usebruno/cli`.
3. Run from the collection folder: `bru run --env local`, or one folder with `bru run users`.
4. For data-driven runs: `bru run --csv-file-path cases.csv`.
5. Write a report, for example a JUnit file, for the CI.

```js
test('returns the booking', function () {
  expect(res.getStatus()).to.equal(200);
  expect(res.getBody()).to.have.property('id');
});
```

What it produces: a pass or fail per `test`, in the app or in the CLI output. From Bruno CLI v3, scripts run in Safe Mode by default, and a collection that needs npm packages or file access needs `--sandbox=developer`.

**Follow-ups:**
- *Can it import from Postman or OpenAPI?* Yes, it imports Postman collections, and `bru import` creates a collection from an OpenAPI or WSDL file.
- *Why choose it?* Git-friendly collections and a lighter tool. The price is a smaller ecosystem than Postman.

**Trap:** Saying Bruno is "just free Postman". The main difference is the file-based, git-first storage.

**Source:** https://docs.usebruno.com/bru-cli/overview

### What is the difference between Swagger and OpenAPI?

Topic: api-tools | Standard | id: q0359

**Say:** OpenAPI is the specification: a standard format, in YAML or JSON, that describes an HTTP API with its paths, methods, parameters, request and response schemas and auth. Swagger is the name of the earlier version of the spec (2.0) and of the tools around it: Swagger UI shows the spec as interactive documentation with a "Try it out" button, Swagger Editor edits it, and Codegen generates code. The current OpenAPI version is 3.2.0, published in September 2025. As a tester I use the spec as the source of truth for what the API should do.

**Full process:** using an OpenAPI spec.
1. Open Swagger UI for the service, and read the endpoints, schemas and examples.
2. Try a call from the UI to learn the behaviour quickly.
3. Import the spec into Postman or Bruno to get a request per endpoint.
4. Use the response schemas in contract tests, so a changed response fails a test.
5. Compare spec versions to find breaking changes.

```yaml
paths:
  /bookings:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewBooking'
      responses:
        '201':
          description: Created
          headers:
            Location:
              schema: { type: string }
```

**Follow-ups:**
- *What if the spec and the API disagree?* That is a finding. Either the code or the spec is wrong, and I raise it with the team.
- *What changed in 3.1?* It aligned the schema objects with JSON Schema 2020-12, so for example a nullable field is `type: ["string", "null"]` and no longer `nullable: true`.

**Trap:** Using the two words as if they were two different tools. OpenAPI is the standard, and Swagger is the older name and the tooling.

**Source:** https://spec.openapis.org/oas/latest.html

### How do you use an OpenAPI spec for testing?

Topic: api-tools | Standard | id: q0360

**Say:** The spec gives me four things. First, the list of endpoints, so I can build a coverage table. Second, the schemas, so I can validate real responses against them. Third, a quick way to generate requests for exploration, by importing into Postman or Bruno. Fourth, a base for comparing versions to find breaking changes. The main risk is a spec that drifts from the real API, so I run contract tests that check the real responses against the spec in CI.

**Full process:**
1. List each path and method in the spec, and mark which ones have tests.
2. For each, take the response schema and validate real responses with Ajv, as in the JSON Schema answer.
3. Run it against a deployed test environment on every merge.
4. When the spec changes, diff the old and new files and test every change that breaks existing clients.

**Follow-ups:**
- *Do you generate tests from the spec?* Generated tests are a good start for schema and status checks, but they do not know the business rules, so I add those by hand.

**Trap:** Trusting the spec without testing it. A wrong spec misleads every client.

**Source:** https://spec.openapis.org/oas/latest.html

### What is Charles Proxy and how do you use it?

Topic: api-tools | Standard | id: q0361

**Say:** Charles is a web debugging proxy. It sits between the app and the internet, so I can see every request and response, including HTTPS when I enable SSL Proxying and trust Charles's root certificate. It acts as a man in the middle: the app sees a certificate Charles made, and Charles talks to the real server. I use it to see what a mobile or web app really sends, and to change traffic on the way: Map Local to return a saved response, Breakpoints to edit a request or response, Rewrite rules, and Throttle to simulate a slow network.

**Full process:** inspecting HTTPS traffic of a browser or a device.
1. Start Charles. It listens on port 8888 by default.
2. Install and trust the Charles root certificate on the machine or the device.
3. In Proxy Settings, SSL tab, add the host you want to decrypt, for example `api.example.com`. Without this step, HTTPS shows only the host, with no content.
4. Run the flow in the app and read the request list, with the structure view grouped by host.
5. To fake a response, right click a request, choose Map Local, and point to a file with the body I want. The app now gets my response.
6. To test a slow network, turn on Throttle, and run the flow again.
7. Turn the proxy settings off when done, so nothing keeps routing through it.

**Follow-ups:**
- *How do you use it with a phone?* Put the phone and the computer on the same Wi-Fi, set the Wi-Fi proxy on the phone to the computer's IP and port 8888, accept the connection in Charles, and install the Charles certificate on the phone. On iOS you also enable full trust for it in the certificate trust settings. On Android 7 and later, apps do not trust user-installed certificates by default, so I need a debug build that allows it.
- *Charles or DevTools?* DevTools for web pages. Charles for mobile apps, other processes, and for changing traffic.

**Trap:** Forgetting to add the host to SSL Proxying, then saying "Charles cannot see the body".

**Source:** https://www.charlesproxy.com/documentation/proxying/ssl-proxying/

### How do you use curl for API testing?

Topic: api-tools | Standard | id: q0362

**Say:** curl is the command-line HTTP client. It is the fastest way to reproduce a request, and a command is easy to paste into a bug report. I use `-i` to show the response headers, `-v` for the full conversation, `-X` for the method, `-H` for headers and `-d` for the body. `--json` sends a JSON body with the right headers. `-sS` hides the progress bar but keeps errors. With `-w '%{http_code}'` I print only the status, which is handy in scripts.

**Full process:** the requests I use most.
1. GET with a header: `curl -i https://api.example.com/bookings/42 -H "Authorization: Bearer $TOKEN"`.
2. POST JSON: `curl -i https://api.example.com/bookings --json '{"roomId":7,"nights":2}' -H "Authorization: Bearer $TOKEN"`.
3. PUT, PATCH and DELETE: add `-X PUT`, `-X PATCH` or `-X DELETE`.
4. Only the status: `curl -s -o /dev/null -w '%{http_code}\n' https://api.example.com/health`.
5. Time of the request: `curl -s -o /dev/null -w '%{time_total}\n' ...`.
6. Form data: `-F 'file=@data.csv'` sends multipart. `-d 'a=1&b=2'` sends a URL-encoded form.
7. Follow a redirect: `-L`.

```bash
TOKEN=$(curl -sS https://api.example.com/login --json '{"email":"a@example.com","password":"..."}' | jq -r .accessToken)
curl -i -sS https://api.example.com/api/me -H "Authorization: Bearer $TOKEN"
```

What it produces: the first command prints a token into a variable, and the second prints the full response. The token stays in a shell variable, so I do not paste it into a ticket.

**Follow-ups:**
- *How do you copy a request from the browser?* In DevTools Network, right click a request and choose "Copy as cURL", then run it in the terminal.
- *What does `--fail` do?* It makes curl exit non-zero on an HTTP error, which helps in scripts.
- *Why does a URL with `&` break?* The shell treats `&` as an operator. I quote the URL.

**Trap:** Pasting a command with a real token into a ticket or chat.

**Source:** https://curl.se/docs/manpage.html

## Authentication and authorization

### What is the difference between authentication and authorization?

Topic: api-auth | Niche | id: q0363

**Say:** Authentication answers "who are you": logging in with a password, a token or a certificate. Authorization answers "what may you do": the roles and permissions that decide whether this user can read, change or delete a given resource. They fail differently: a failed authentication is a 401, and a failed authorization is a 403. I test both separately, because a system can have a solid login and still let a normal user call an admin endpoint.

**Follow-ups:**
- *Where do mistakes happen most?* In authorization: missing checks on a single endpoint, or checking the role but not the owner of the resource.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401

### What is the difference between a session and a JWT?

Topic: api-auth | Niche | id: q0364

**Say:** With a session, the server stores the login state and gives the browser a random session ID in a cookie. Every request carries the ID, and the server looks the session up. Logging out deletes the session, so it takes effect at once. A JWT is a signed token that carries the claims itself: user ID, roles, expiry. The server only verifies the signature, so it needs no lookup and scales easily across services. The cost is revocation: a JWT stays valid until it expires, unless the server keeps a denylist, so I expect short expiry plus a refresh token. For a tester this changes what logout means: with a session the old cookie must fail at once, and with a JWT I check how long the old token still works.

**Full process:** testing logout in both models.
1. Log in and save the credential (cookie or token).
2. Call a protected endpoint: 200.
3. Log out.
4. Replay the old credential. A session should return 401 immediately. For a JWT, record whether it still works, and for how long, then compare with the design.

**Follow-ups:**
- *Which is better?* Neither always. Sessions give easy revocation. JWTs suit stateless APIs and many services. Many systems use a short JWT with a revocable refresh token.

**Trap:** Saying a JWT is encrypted. The payload is only base64url encoded, and anyone can read it.

**Source:** https://datatracker.ietf.org/doc/html/rfc8725

### What is the structure of a JWT and what do you validate?

Topic: api-auth | Niche | id: q0365

**Say:** A JWT has three parts separated by dots: a header (the signing algorithm and key ID), a payload (the claims) and a signature. The first two are base64url JSON, so I can decode and read them, and the signature proves nobody changed them. Common claims are `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiry), `nbf` (not before), `iat` (issued at) and `jti` (token ID). A server must verify the signature with the expected algorithm and key, then check `exp`, `nbf`, `iss` and `aud`. The standard best-practice guidance, RFC 8725, warns against trusting the `alg` in the header.

**Full process:** decoding a token in a test, and checking the claims.

```ts
import { test, expect } from '@playwright/test';

function decodePart(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

test('access token has the expected claims', async ({ request }) => {
  const login = await request.post('/api/login', {
    data: { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD },
  });
  const { accessToken } = await login.json();
  const [header, payload] = accessToken.split('.').map(decodePart);

  expect(header.alg).toBe('RS256');
  expect(payload.iss).toBe('https://auth.example.com');
  expect(payload.aud).toBe('bookings-api');
  expect(payload.exp - payload.iat).toBeLessThanOrEqual(900);
  expect(payload).not.toHaveProperty('password');
});
```

What it produces: a decoded header and payload. I do not check the signature in the test, because the server does that. I check the lifetime, the audience, and that the token has no sensitive data, since anyone can read the payload.

**Follow-ups:**
- *HS256 or RS256?* HS256 uses one shared secret for signing and verifying. RS256 uses a private key to sign and a public key to verify, so services can verify without being able to create tokens.
- *What is `kid`?* The key ID in the header, which tells the verifier which public key to use. Keys are often published at a JWKS URL.

**Trap:** Putting private data in a JWT because "it is a token".

**Source:** https://datatracker.ietf.org/doc/html/rfc8725

### How do you test JWT handling on the server?

Topic: api-auth | Niche | id: q0366

**Say:** I send tokens that should be rejected and assert 401 for each. An expired token. A token with one character changed in the signature. A token whose payload I edited, for example the role changed to `admin`, with the old signature. A token with `"alg":"none"` and no signature. A token with the wrong audience or issuer. And a request with no token. Any 200 on these is a serious security finding.

**Full process:**
1. Get a valid token with a normal login.
2. Make the forged variants in the test.
3. Call a protected endpoint with each, and assert 401.

```ts
import { test, expect } from '@playwright/test';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

test('forged tokens are rejected', async ({ request, baseURL }) => {
  const login = await request.post('/api/login', {
    data: { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD },
  });
  const { accessToken } = await login.json();
  const [h, p, s] = accessToken.split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));

  const tokens = {
    tamperedPayload: [h, b64({ ...payload, role: 'admin' }), s].join('.'),
    tamperedSignature: [h, p, s.slice(0, -2) + 'AA'].join('.'),
    algNone: [b64({ alg: 'none', typ: 'JWT' }), p, ''].join('.'),
    garbage: 'not.a.token',
  };

  for (const [name, token] of Object.entries(tokens)) {
    const res = await fetch(`${baseURL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status, name).toBe(401);
  }
});
```

What it produces: four negative checks with the case name in the failure message. I use the global `fetch` here, so these calls carry no cookie from the logged-in `request`. A server that accepts a payload I changed does not verify the signature.

**Follow-ups:**
- *How do you test an expired token?* Ask the test auth server for a token with a very short life and wait for it with a poll, or use a token signed with the test key and an `exp` in the past.

**Trap:** Testing only the happy login. The valuable cases are the ones that must fail.

**Source:** https://datatracker.ietf.org/doc/html/rfc8725

### What are the OAuth 2.0 flows and when is each used?

Topic: api-auth | Niche | id: q0367

**Say:** OAuth 2.0 lets an app get limited access to an API on a user's behalf without seeing the password. The main grant types: Authorization Code with PKCE for web, single-page and mobile apps where a user logs in; Client Credentials for server-to-server calls with no user; Device Code for devices without a keyboard, like a TV; and Refresh Token to get a new access token. The Implicit flow and the Password grant are legacy, and OAuth 2.1 drops them. As a tester I need to know which flow the app uses, because each has its own failure cases.

**Follow-ups:**
- *What do you test?* Wrong or reused authorization code, a missing or wrong `state`, a redirect URI that does not match exactly, an expired or revoked refresh token, and scopes: the token must only allow what was granted.

**Source:** https://oauth.net/2/grant-types/

### How does the Authorization Code flow with PKCE work?

Topic: api-auth | Niche | id: q0368

**Say:** The app sends the user to the authorization server with a `code_challenge`, a hash of a random secret, the `code_verifier`, that it keeps. The user logs in and approves. The server redirects back to the app with a short-lived authorization code. The app sends that code and the original `code_verifier` to the token endpoint. The server hashes the verifier, compares it with the challenge, and only then returns tokens. PKCE means a stolen code is useless without the verifier, which matters for apps that cannot keep a client secret. OAuth 2.1 requires PKCE for all authorization code clients.

**Full process:** the steps in order.
1. App creates a random `code_verifier` and the `code_challenge` (its SHA-256, base64url).
2. Redirect: `GET /authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...&code_challenge=...&code_challenge_method=S256`.
3. User logs in and consents.
4. Redirect back to `redirect_uri?code=...&state=...`. The app checks `state` equals what it sent.
5. `POST /token` with `grant_type=authorization_code`, the `code`, the `redirect_uri` and the `code_verifier`.
6. Response: `access_token`, maybe `refresh_token` and `id_token`.

**Follow-ups:**
- *What is `state` for?* It ties the response to the request and blocks CSRF on the login redirect.

**Trap:** Mixing it up with the Implicit flow, where the token comes straight back in the URL. That flow is legacy.

**Source:** https://oauth.net/2.1/

### What is OpenID Connect and how is it different from OAuth 2.0?

Topic: api-auth | Niche | id: q0369

**Say:** OAuth 2.0 is about authorization: it gives an app an access token to call an API. OpenID Connect (OIDC) is a thin identity layer on top of OAuth 2.0 that adds authentication: it returns an ID token, a JWT that says who the user is, plus a UserInfo endpoint and standard scopes such as `openid` and `profile`. "Log in with Google" is OIDC. SSO setups use OIDC or SAML. The access token is for the API, and the ID token is for the app.

**Follow-ups:**
- *Where does the app find the endpoints?* In the discovery document at `/.well-known/openid-configuration`.

**Source:** https://openid.net/specs/openid-connect-core-1_0.html

### What is the difference between an access token and a refresh token?

Topic: api-auth | Niche | id: q0370

**Say:** The access token is short-lived, often minutes, and is sent with every API call. The refresh token is long-lived, is sent only to the token endpoint, and is used to get a new access token without asking the user to log in again. If an access token leaks, the damage is limited by its short life. A refresh token is more sensitive, so good systems rotate it and revoke it on logout. I test that a used or revoked refresh token fails, and that an expired access token gives 401 and then a successful refresh.

**Follow-ups:**
- *What does rotation mean?* Each refresh returns a new refresh token and invalidates the old one, so a stolen one is detected when both are used.

**Source:** https://datatracker.ietf.org/doc/html/rfc9700

### How do API keys work and how do you test them?

Topic: api-auth | Niche | id: q0371

**Say:** An API key is a long random string that identifies the calling application, not a person. It goes in a header such as `X-API-Key`, and never in the URL, where logs and proxies keep it. It is simple, but it has no expiry or user context by default. I test a missing key (401), a wrong key (401), a revoked key, a key that lacks the scope for the endpoint (403), and that the key never appears in a response, a log or an error message.

**Follow-ups:**
- *How should keys be handled?* Stored as secrets, rotated regularly, scoped to the least access, and never committed to git.

**Source:** https://datatracker.ietf.org/doc/html/rfc9700

### How do you test authorization and role permissions?

Topic: api-auth | Niche | id: q0372

**Say:** I build a permission matrix: roles on one axis, endpoints and actions on the other, with the expected result in each cell (200, 403, 404). Then I run it from a test, with one logged-in client per role. The cases that matter most are the vertical ones, where a lower role calls a higher role's endpoint, and the horizontal ones, where user A reads or changes user B's resource by changing the ID. That second kind is called broken object level authorization, and it is the top item in the OWASP API Security list. I do role-permission checks as basic security testing, not as a full security audit.

**Full process:**
1. List the roles (for example admin, agent, viewer) and the endpoints.
2. Write the expected status for each pair.
3. Create one API client per role, with that role's token.
4. Loop over the matrix, and assert the status.
5. For the horizontal check: create a resource as user A, then GET, PUT and DELETE its URL as user B. Expect 403 or 404, and confirm the data is unchanged afterwards.

```ts
import { test, expect, request as pwRequest } from '@playwright/test';

const matrix = [
  { role: 'admin', method: 'GET', path: '/api/users', expected: 200 },
  { role: 'agent', method: 'GET', path: '/api/users', expected: 403 },
  { role: 'viewer', method: 'DELETE', path: '/api/users/1', expected: 403 },
] as const;

for (const { role, method, path, expected } of matrix) {
  test(`${role} ${method} ${path} is ${expected}`, async ({ baseURL }) => {
    const ctx = await pwRequest.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${process.env[`TOKEN_${role.toUpperCase()}`]}` },
    });
    const res = await ctx.fetch(path, { method });
    expect(res.status()).toBe(expected);
    await ctx.dispose();
  });
}
```

What it produces: one named test per cell, so a failure shows which role and endpoint is wrong.

**Follow-ups:**
- *Is the UI hiding a button enough?* No. A hidden button does not stop a direct API call, so I test the API.

**Trap:** Testing permissions only through the UI.

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/403

### How do you test a login flow that uses OAuth or a JWT in an E2E test?

Topic: api-auth | Niche | id: q0373

**Say:** For the login itself I test the real flow once or twice through the UI, so the redirect, the cookie or token storage and the logout are covered. For all the other tests I log in through the API in a fixture, get the token or the cookie, and start the browser already logged in, because clicking through a login in every test is slow and flaky. The state is per test, so tests do not share a session. I never put real passwords in the repository. They come from environment variables.

**Full process:**
1. A fixture calls the login endpoint with `request`, per test.
2. For a cookie session, move the cookies to the browser with `context.addCookies`, or use the `request` storage state in `browser.newContext({ storageState })`.
3. Open the page, and assert a logged-in element, such as the user menu, with a web-first assertion.
4. A separate test covers the real login page and the failure states: a wrong password, a locked account.

```ts
import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page, request }, use) => {
    const login = await request.post('/api/login', {
      data: { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const state = await request.storageState();
    await page.context().addCookies(state.cookies);
    await use(page);
  },
});

test('logged-in user sees the menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});
```

What it produces: a page that starts logged in. This works for cookie sessions. If the app keeps a token in `localStorage` or `sessionStorage`, I set it with `page.addInitScript`, because `storageState` does not save `sessionStorage`.

**Follow-ups:**
- *What if the login uses an external identity provider?* In tests I use a test tenant, or a token endpoint, and I do not automate the provider's page.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

## Contract testing

### What is contract testing and why do it?

Topic: api-contract | Niche | id: q0374

**Say:** A contract is the agreement between two services about the requests and responses between them: paths, fields, types, status codes. Contract testing checks that each side keeps its part of it, without running both services together. Its goal is to catch a breaking change early, such as a renamed field, before the consumer breaks in an integration environment or in production. It is cheaper and faster than a full end-to-end test, and it finds a different kind of defect.

**Full process:** a minimal contract check.
1. Take the contract: the OpenAPI schema for the endpoint.
2. Call the real provider in a test environment.
3. Validate status, headers and body against the schema.
4. Run it on every provider change, so a breaking change fails the build.

**Follow-ups:**
- *What does it not cover?* Business logic, and the full behaviour of the whole system. It checks the shape of the messages.

**Source:** https://docs.pact.io/

### What are consumer-driven contracts and Pact?

Topic: api-contract | Niche | id: q0375

**Say:** If you have not used Pact in a project, say so, and explain how it works. In a consumer-driven contract the consumer, such as a frontend or another service, writes down what it needs from the provider. Pact runs the consumer's tests against a mock provider and records each interaction in a contract file. The provider then replays those interactions against the real service to verify it. A broker stores the contracts and verification results, and a `can-i-deploy` check tells a team whether a version is safe to release. I would start with the one or two consumers whose breaks hurt most.

**Follow-ups:**
- *Pact or OpenAPI contract tests?* OpenAPI checks the provider against its own published spec. Pact checks the provider against what the real consumers use, so it finds unused-field removals that are safe and flags the real breaking ones.

**Trap:** Claiming experience you do not have. Say: not used in production, I know the model.

**Source:** https://docs.pact.io/

### What OpenAPI contract tests have you written?

Topic: api-contract | Niche | id: q0376

**Say:** OpenAPI contract tests check API responses against the OpenAPI definition, so a changed field type or a missing field fails the test. It is also common to remove tests that duplicate what the API repository already tested, because a duplicate only adds cost and flakiness. If you have not used Pact, say so.

**Follow-ups:**
- *What would you check first for a new endpoint?* The success response schema, then the error response schema, since clients often rely on the error shape.

**Source:** https://spec.openapis.org/oas/latest.html

### What is the difference between contract, integration and end-to-end tests?

Topic: api-contract | Niche | id: q0377

**Say:** A contract test checks the shape of the messages between two services, one side at a time, and runs fast. An integration test runs two or more real parts together and checks that they cooperate, for example a service with its database. An end-to-end test runs the whole system through the UI as a user would, and is the slowest and the most fragile. I choose the lowest layer that can catch the defect: a field rename is a contract test, a wrong SQL query is an integration test, a broken checkout flow is end-to-end.

**Follow-ups:**
- *What goes wrong if you only have E2E?* Failures are slow to find, and the same bug appears in many tests.

**Source:** https://docs.pact.io/

### What is a breaking change in an API and how do you catch it?

Topic: api-contract | Niche | id: q0378

**Say:** A breaking change makes a working client fail: removing or renaming a field, changing a type, making an optional field required, tightening validation, or changing the meaning of a status code. Adding a new optional field is normally safe. I catch them by comparing the old and new OpenAPI files, by running the old contract tests against the new build, and by keeping a regression suite for the previous version. With Pact, the provider verification fails when a real consumer breaks.

**Follow-ups:**
- *What does `additionalProperties: false` do to this?* A strict schema turns the safe change of adding a field into a failing test. I use strict schemas deliberately, and loose ones when the API is expected to grow.

**Source:** https://json-schema.org/understanding-json-schema/about

### What are common JSON Schema mistakes in API tests?

Topic: api-contract | Niche | id: q0379

**Say:** Writing the schema from one sample, so accidental fields become required. Forgetting that a number can be an integer or a float. Using `nullable: true` in a 3.1 file, where the type is written `["string", "null"]`. Making the schema too strict with `additionalProperties: false` when the API may add fields. And validating the shape but never the values, so a response with the right types and the wrong data passes. A schema check is the first gate, and not a replacement for assertions on business rules.

**Follow-ups:**
- *Which tool do you use?* Ajv in a TypeScript test, as in the Playwright answer above. The Bruno `jsonSchema` assertion also uses Ajv.

**Source:** https://json-schema.org/understanding-json-schema/about

## Integrations and webhooks

### What is a webhook and how do you test one?

Topic: api-integration | Core | id: q0380

**Say:** A webhook is a reverse API call: instead of me polling a service, the service sends an HTTP POST to a URL I registered when something happens, such as a payment succeeded or an order was created. Testing has two sides. When I own the receiver, I post sample events to it and check the response and the effect. When I own the sender, I point it at a receiver I control and check what arrives. Both sides need checks for signatures, retries, duplicates and order.

**Full process:** testing a receiver.
1. Get a sample payload from the provider's docs or the test mode.
2. POST it to the endpoint with a valid signature header. Expect a fast 2xx.
3. Check the effect: the order is marked paid, the record exists.
4. POST an invalid signature: expect 400 or 401 and no effect.
5. POST the same event ID again: expect 2xx and no second effect.
6. POST events in a wrong order, for example "updated" before "created", and check the system recovers.
7. Make the downstream fail (mock a 500) and check the handler returns a non-2xx, so the sender retries.

```ts
import { createHmac, randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

const secret = process.env.WEBHOOK_SECRET!;

function signed(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return { 'X-Signature': `t=${timestamp},v1=${signature}`, 'Content-Type': 'application/json' };
}

test('paid event marks the order paid once', async ({ request }) => {
  const order = await (await request.post('/api/orders', { data: { sku: 'A-1', qty: 1 } })).json();
  const body = JSON.stringify({ id: randomUUID(), type: 'payment.succeeded', orderId: order.id });

  const first = await request.post('/webhooks/payments', { headers: signed(body), data: body });
  expect(first.status()).toBe(200);
  const replay = await request.post('/webhooks/payments', { headers: signed(body), data: body });
  expect(replay.status()).toBe(200);

  const after = await (await request.get(`/api/orders/${order.id}`)).json();
  expect(after.status).toBe('paid');
  expect(after.payments).toHaveLength(1);

  const forged = await request.post('/webhooks/payments', {
    headers: { ...signed(body), 'X-Signature': 't=1,v1=bad' },
    data: body,
  });
  expect([400, 401]).toContain(forged.status());
});
```

What it produces: one valid delivery, a replay with the same event ID, and a forged signature. The header name and the signing scheme here are an example in the style of Stripe (`t=...,v1=...` over `timestamp.body`). I use the provider's real scheme from its docs.

**Follow-ups:**
- *Why must the receiver answer fast?* The sender waits for a 2xx and times out after a few seconds, then retries. The receiver should store the event, answer 2xx, and process it asynchronously.
- *What status means "retry"?* Any non-2xx, or a timeout. Providers retry with backoff for a limited period.

**Trap:** Testing only that the endpoint returns 200. The effect, the duplicate and the signature are where the bugs are.

**Source:** https://docs.stripe.com/webhooks

### How do you verify a webhook signature, and how do you test it?

Topic: api-integration | Core | id: q0381

**Say:** The sender computes an HMAC, usually SHA-256, over the exact raw request body, often with a timestamp, using a shared secret, and sends it in a header. The receiver recomputes it from the raw body and compares the values in constant time. If they differ, it rejects the request. The timestamp lets the receiver reject old requests, which stops replay attacks, and Stripe's libraries use a default tolerance of 5 minutes. The common bug is parsing the JSON first and signing the re-serialised body, which changes whitespace or key order and breaks verification. My tests send a valid, a tampered, an old-timestamp and a missing-signature request.

**Full process:**
1. Valid signature and a fresh timestamp: 2xx.
2. Same body, one changed character: 400 or 401.
3. Valid signature with a timestamp older than the tolerance: rejected.
4. Missing header: 400 or 401.
5. Wrong secret: rejected.

**Follow-ups:**
- *Why constant-time comparison?* A normal string compare can leak, through timing, how many characters matched. In Node the function is `crypto.timingSafeEqual`.
- *Why is the raw body needed?* Because the signature covers the exact bytes. Any framework step that parses and re-serialises it breaks the check.

**Trap:** Verifying the signature on the parsed object.

**Source:** https://docs.stripe.com/webhooks

### How do you handle duplicate and out-of-order webhooks in tests?

Topic: api-integration | Core | id: q0382

**Say:** Providers deliver at least once, so the same event can arrive twice, and events can arrive out of order. The receiver must be idempotent: it stores the processed event IDs and skips a repeat. For order, it should not rely on arrival time, and instead use the event's own timestamp or version, or fetch the current state from the provider's API. In tests I send the same event twice and assert one effect, and I send "updated" before "created" and assert the system ends in the right state.

**Full process:**
1. Send event E1 twice with the same ID. Assert one effect (one payment row).
2. Send two different events for the same object in reverse order. Assert the final state matches the newest event.
3. Send two copies at the same moment with `Promise.all`. Assert one effect, which tests the race.

**Follow-ups:**
- *How does the receiver store the IDs?* A table with a unique constraint on the event ID, so a concurrent duplicate fails at the database.

**Trap:** Deduping on arrival time or on payload content. Two real events can have identical payloads, and a retried delivery carries the same event ID. Use the provider's event ID for the check.

**Source:** https://docs.stripe.com/webhooks

### How do you test that your own system sends webhooks correctly?

Topic: api-integration | Core | id: q0383

**Say:** I point the webhook at a receiver I control, trigger the event, and assert what the receiver got: the URL, the headers, the signature, the body, and how many times. Then I check retries by making the receiver return a 500 for the first call and a 200 for the next, and assert that the sender retries and then stops. I also check the delivery log or the status the product shows, and the effect of a permanently failing endpoint, such as the endpoint being disabled after too many failures.

**Full process:**
1. Start a small HTTP server in the test that records each request.
2. Register its URL as the webhook target through the product API. The product must be able to reach it, so on CI I use a host reachable from the environment, or a hosted request catcher.
3. Trigger the event, for example create an order.
4. Poll the recorded list until one request arrives, with a timeout.
5. Assert the method, headers, signature validity and body.
6. Make the receiver answer 500 once, and assert the retry arrives.

```ts
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';

function startReceiver() {
  const received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.writeHead(200).end();
    });
  });
  return new Promise<{ url: string; received: typeof received; stop: () => void }>((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://localhost:${(server.address() as AddressInfo).port}/hook`,
        received,
        stop: () => server.close(),
      }),
    ),
  );
}

test('creating an order sends one signed webhook', async ({ request }) => {
  const receiver = await startReceiver();
  const hook = await (await request.post('/api/webhooks', {
    data: { url: receiver.url, events: ['order.created'] },
  })).json();

  const order = await (await request.post('/api/orders', { data: { sku: 'A-1', qty: 1 } })).json();

  await expect.poll(() => receiver.received.length, { timeout: 15_000 }).toBe(1);
  const [hit] = receiver.received;
  expect(hit.headers['x-signature']).toBeTruthy();
  expect(JSON.parse(hit.body)).toMatchObject({ type: 'order.created', orderId: order.id });

  await request.delete(`/api/webhooks/${hook.id}`);
  receiver.stop();
});
```

What it produces: a local receiver on a free port, one delivery recorded and asserted. This only works when the product under test can reach `localhost` of the test machine. In a shared CI environment I use a reachable host instead.

**Follow-ups:**
- *What if the product is remote?* A tunnel or a hosted request catcher works for a manual check. For CI I prefer a receiver inside the same network.

**Trap:** Asserting only that the webhook is configured, not that a delivery happened.

**Source:** https://docs.stripe.com/webhooks

### How do you test an integration with a third party such as Shopify?

Topic: api-integration | Core | id: q0384

**Say:** I split it by layer. For my own code's logic I use a test double of the third party, so the tests are fast and deterministic. For the real behaviour I use the provider's sandbox or a development store, and a small set of end-to-end checks. For the contract I validate against the provider's published schema. And I always test the failure side: slow answers, a 429, a 5xx, a malformed body, an expired credential. I keep real third-party calls out of the main suite as much as possible, because they are slow, rate limited and can change without notice.

**Full process:**
1. Map the integration points: what we call, what calls us (webhooks), and what data flows each way.
2. Unit and component tests with doubles for the logic.
3. A few contract checks against the provider's schema.
4. A small smoke suite against the real sandbox or dev store, run on a schedule and before releases.
5. Failure tests with mocked 429, 5xx, timeouts, and a revoked token.
6. Monitoring in production: error rates and delivery logs.

**Follow-ups:**
- *What breaks most often?* Credentials expiring, rate limits, schema changes, and shared test accounts that accumulate old data.
- *How do you keep a real-store test clean?* The test creates what it needs and removes it, so the account is empty after each run.

**Trap:** Running the whole regression suite against the real third party.

**Source:** https://docs.stripe.com/webhooks

### What are test doubles and which do you use for APIs?

Topic: api-integration | Standard | id: q0385

**Say:** A test double replaces a real dependency in a test. A stub returns canned answers. A mock also checks how it was called. A spy records calls on the real thing. A fake is a working but simplified version, such as an in-memory database. A dummy just fills a parameter. For APIs I mostly use stubs, with a check of the request that was sent, through Playwright's `page.route` for browser tests, HAR replay for many realistic responses, and a small local HTTP server as a fake service. If you have not used WireMock or similar server tools in a project, say so.

**Full process:** a stub with a request check in Playwright.

```ts
import { test, expect } from '@playwright/test';

test('checkout sends the right body to the payment API', async ({ page }) => {
  let sent: unknown;
  await page.route('**/api/payments', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: 'pay_1', status: 'succeeded' } });
  });

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Pay now', exact: true }).click();

  await expect(page.getByText('Payment successful', { exact: true })).toBeVisible();
  expect(sent).toMatchObject({ amount: 1500, currency: 'PLN' });
});
```

What it produces: the UI works against my stub, and the test verifies both the UI result and the request body.

**Follow-ups:**
- *Risk of doubles?* They drift from the real service. A contract test or a periodic real-sandbox check keeps them honest.

**Trap:** Calling every double a "mock". The words differ: a stub gives answers, a mock verifies calls.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

### What are sandboxes and test modes in third-party APIs, and what are their limits?

Topic: api-integration | Standard | id: q0386

**Say:** A sandbox or test mode is a copy of the provider's API with fake data and no real money or messages, such as Stripe's test keys or a Shopify development store. It lets me run real calls safely. The limits: it may differ from production in behaviour, limits and speed, it may be down or reset without warning, and some features exist only in production. So I treat a green sandbox run as strong evidence, not as proof, and I keep a small set of checks that confirm production configuration.

**Follow-ups:**
- *What do you do about shared sandbox state?* Create what the test needs, give it a unique name, and clean up after.

**Trap:** Treating a green sandbox run as proof for production. Configuration that exists only in production, such as live keys and a webhook endpoint registered for live mode, is never exercised there.

**Source:** https://docs.stripe.com/webhooks

### How do you test what happens when a third party is slow or down?

Topic: api-integration | Standard | id: q0387

**Say:** I never wait for the real service to fail. I simulate it. In a browser test I use `page.route` to return a 500, a 429, an empty body, a broken JSON, or a response delayed by several seconds, and I check the user sees a clear error and can retry, and that nothing is half-saved. For server code I check the timeout, the retry with backoff, and the circuit breaker, which stops calls to a failing service for a while. The key question is always what the user sees and what state the data is left in.

**Full process:**
1. Delay the response: `route.fulfill` after `await new Promise(r => setTimeout(r, 5000))` inside the handler, or abort with `route.abort('timedout')`.
2. Assert the loading state, then the error state, with web-first assertions.
3. Assert that the data was not saved twice, and that a retry works.

```ts
await page.route('**/api/shipping-rates', (route) => route.abort('timedout'));
await page.goto('/checkout');
await expect(page.getByRole('alert')).toContainText('Shipping rates are unavailable');
await expect(page.getByRole('button', { name: 'Pay now', exact: true })).toBeDisabled();
```

What it produces: the page sees a network failure for that call only.

**Follow-ups:**
- *What is a circuit breaker?* After several failures it opens and fails fast for a period, then lets a trial request through. This protects the failing service and the caller's threads.

**Trap:** Testing only the happy path of an integration. Third parties fail more often than your own code.

**Source:** https://playwright.dev/docs/api/class-apirequestcontext

### How do you handle expiring credentials and signed requests in integration tests?

Topic: api-integration | Standard | id: q0388

**Say:** I treat the credential's lifetime as part of the test design. A token or a signature that expires will break the suite on a schedule, so the test environment should rotate it automatically, well before expiry, and fail with a clear message if it cannot. I also attach third-party credentials only in the tests that need them, never in global setup. A test that fails because a secret expired is an infrastructure signal, and it should be named that way.

**Full process:**
1. Store the credential in the secret store of the CI, never in the repository.
2. Read its expiry, and check it at the start of the run.
3. Rotate it automatically before it expires.
4. Fail early with "credential expires in N days" instead of a confusing 401 mid-run.

**Follow-ups:**
- *How do you test the rotation?* Run the rotation job against the sandbox and assert that the old credential stops working and the new one works.

**Trap:** Letting every parallel worker refresh the same token. If the provider rotates refresh tokens, the first refresh can invalidate the others, so get the token once per run and share it. Signed requests with a timestamp also fail when the runner clock drifts.

**Source:** https://datatracker.ietf.org/doc/html/rfc9700

## GraphQL

### What is GraphQL and how does it differ from REST?

Topic: api-graphql | Niche | id: q0389

**Say:** GraphQL is a query language for APIs with a typed schema. There is usually one endpoint, `/graphql`, and the client sends a query that names exactly the fields it wants, so it gets no more and no less, and can fetch related data in one round trip. REST has many URLs with fixed responses. Reads are queries, writes are mutations, and live updates are subscriptions. Testing GraphQL APIs involves checking these queries against the schema.

**Follow-ups:**
- *What is the downside?* Caching is harder because requests are usually a POST to one URL, and a client can send an expensive query, so servers limit depth and cost.

**Source:** https://www.graphql.org/learn/serving-over-http/

### How do you test a GraphQL API, and why is a 200 not enough?

Topic: api-graphql | Niche | id: q0390

**Say:** A GraphQL request is usually a POST with a JSON body holding `query` and `variables`. The response has `data` and, when something went wrong, an `errors` array. Many servers return HTTP 200 even when `errors` is present, because the spec says a response with non-null `data` should use a 2xx code. So my first assertion is that `errors` is absent, and the second is on `data`. The newer `application/graphql-response+json` media type lets servers use 4xx and 5xx for request errors. I also test variables, auth, a query for a field that does not exist, and partial data.

**Full process:**
1. POST `{ "query": "...", "variables": {...} }` with `Content-Type: application/json`.
2. Assert the HTTP status.
3. Assert `body.errors` is undefined for a success case.
4. Assert `body.data` shape and values.
5. Negative cases: an invalid query (an error before execution, usually 400), a missing variable, no token (an auth error in `errors`, or a 401), and a user asking for another user's data.

```ts
import { test, expect } from '@playwright/test';

const query = /* GraphQL */ `
  query Account($id: ID!) {
    account(id: $id) { id name country }
  }
`;

test('account query returns data and no errors', async ({ request }) => {
  const res = await request.post('/graphql', { data: { query, variables: { id: 'acc-1' } } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.errors).toBeUndefined();
  expect(body.data.account).toMatchObject({ id: 'acc-1', name: expect.any(String) });
});

test('unknown field is an error, not data', async ({ request }) => {
  const res = await request.post('/graphql', { data: { query: '{ account(id: "acc-1") { nope } }' } });
  const body = await res.json();
  expect(body.errors?.length).toBeGreaterThan(0);
  expect(body.data).toBeFalsy();
});
```

What it produces: a success check and an error check. The error status code depends on the server, so I assert the `errors` array and not only the code.

**Follow-ups:**
- *What is introspection?* A query that returns the schema. It is useful for exploration, and often disabled in production.
- *How do you protect against heavy queries?* Depth, complexity and rate limits, which I test with a deeply nested query.

**Trap:** Checking only `res.ok()`. A failed GraphQL operation can still be a 200.

**Source:** https://graphql.github.io/graphql-over-http/draft/

### What is `operationName`, and why does it matter in tests?

Topic: api-graphql | Niche | id: q0391

**Say:** `operationName` is the name of the operation in a GraphQL request, such as `GetCart` or `AddToCart`. Everything usually goes to one URL, so that name is how you tell the requests apart. In Playwright I read it from the request body to mock one operation and let the others through. It's also what you filter on in DevTools or in logs. And if one document holds several operations, the name is required, because the server has to know which one to run.

**Follow-ups:**
- *What happens if a document has two operations and no name?* The server returns an error and runs nothing. graphql-js says "Must provide operation name if query contains multiple operations."

**Trap:** Mocking by URL only. On a single `/graphql` endpoint that catches every operation, so the page gets the wrong response for the others.

**Source:** https://spec.graphql.org/October2021/#GetOperation

### The response has both `data` and `errors`. What does that mean, and how do you test it?

Topic: api-graphql | Niche | id: q0392

**Say:** That's a partial response, and it's normal in GraphQL. One field failed, the rest worked, and the HTTP status is often still 200. Each error has a `path` that says which field failed. So I test two levels. In the API, I assert the `errors` array and the `path`, not only the status. In the UI, I mock that response and check the page shows what it has and handles the missing part, rather than crashing or showing a blank screen.

**Full process:** Run on graphql-js 17.1.0, with a resolver that throws:
1. A nullable field fails (`price: Int`): `data.product` stays, with `price: null`, and `errors[0].path` is `["product","price"]`.
2. A non-null field fails (`name: String!`): the null moves up to the parent, so `data.product` is `null`, and the fields that worked are lost too.
3. A non-null item in a list fails (`[Product!]`): the whole `list` becomes `null`, even though the other items were fine.

**Follow-ups:**
- *Why does the null move up?* A `!` field promises it is never null. If it can't keep that promise, the nearest nullable parent becomes null instead. So one failing `String!` can blank a whole section of the page.

**Trap:** "A 200 with `data` means success." You have to check `errors` as well, and a `null` field may be a failure, not an empty value.

**Source:** https://graphql.org/learn/schema-design/

### The backend removes a field. How do you catch that before it breaks the frontend?

Topic: api-graphql | Niche | id: q0393

**Say:** Removing a field is a breaking change, and it fails hard: a query that asks for the field fails validation, so the whole query returns an error and no `data` at all. The cheap way to catch it is a schema diff in CI: compare the new schema with the old one and fail on breaking changes. Adding a field is safe, because clients only get what they ask for, and that's why GraphQL APIs usually avoid versions. The normal path is to mark the field `@deprecated` first, and remove it once nobody uses it. On the test side I'd also run the frontend's real queries against the new schema, not hand-written ones.

**Follow-ups:**
- *What other changes are breaking?* Making a nullable argument required, removing an enum value the client uses, and making a non-null field nullable, because clients may not handle the null.

**Trap:** Trusting mocks here. A mock keeps returning the removed field, so the UI tests stay green while production breaks.

**Source:** https://graphql.org/learn/schema-design/

### Why can the UI show old data after a GraphQL mutation?

Topic: api-graphql | Niche | id: q0394

**Say:** Usually it's the client cache. Apollo Client, for example, keeps a normalized cache, where each object is stored under its `__typename` and `id`. If a mutation returns that same object with its `id` and the changed fields, the cache updates and the page follows. If it returns only a success flag, or no `id`, the cache doesn't know what changed and the old value stays on screen. That's a real bug class on a cart or a profile page. So after a mutation I assert the visible UI, and then check it again after a reload to see that the server really saved it.

**Follow-ups:**
- *Same object in the cart and the header, updated in one place only?* With a normalized cache one update reaches both. If one stays stale, I check whether the object has an `id` and whether the query asks for it.

**Trap:** Checking only the mutation response. The API can be right while the page still shows the cached value.

**Source:** https://www.apollographql.com/docs/react/caching/overview

### How do you do performance testing on a GraphQL API?

Topic: api-graphql | Niche | id: q0395

**Say:** I set a baseline: send realistic queries, such as the ones the app really makes, at a known load with JMeter, and record response time percentiles and the error rate. Then I repeat the run after a change and compare against the baseline. I look at the heaviest queries, since GraphQL lets a client ask for a lot, and check that errors do not hide inside 200 responses, so the load test also asserts on the `errors` field. If you have not done deep bottleneck hunting or used k6, say so.

**Follow-ups:**
- *What numbers do you report?* p50, p95 and p99 latency, the error rate and the throughput, with the load level and the environment.

**Source:** https://www.graphql.org/learn/serving-over-http/

## SOAP and gRPC

### What is SOAP and how would you test it?

Topic: api-soap | Niche | id: q0396

**Say:** SOAP is an older XML protocol: each message is an XML envelope sent over HTTP, usually POST to one endpoint, and the service is described by a WSDL file. Errors come back as a SOAP Fault element, typically with HTTP 500. If you have not worked with it in production, say so. You would import the WSDL into SoapUI or Postman, check the envelope and the faults, and validate the XML against the schema.

**Source:** https://www.w3.org/TR/soap12-part1/

### What is gRPC and how is it different from REST?

Topic: api-soap | Niche | id: q0397

**Say:** gRPC is a remote procedure call framework from Google. The API is defined in a `.proto` file, messages are binary Protocol Buffers, and it runs on HTTP/2, which gives it streaming. It is fast and strictly typed, but a browser cannot call it directly without a proxy, and it uses its own status codes, such as `NOT_FOUND` and `INVALID_ARGUMENT`, and not HTTP ones. If you have not used it in a project, say so. You would test it with a tool like grpcurl or Postman, which supports gRPC, and assert on the status code and the message.

**Source:** https://grpc.io/docs/guides/status-codes/

## Messaging

### What are message queues and event streaming, and why are they used?

Topic: messaging | Niche | id: q0398

**Say:** A message queue, such as RabbitMQ or SQS, lets one service send a message that another processes later, so the two are decoupled and the sender does not wait. Kafka is an event log: producers append events to a topic, split into partitions, and consumers read them at their own pace using offsets. If you have not used Kafka in a project, say so, and explain the concepts. The main thing for a tester is that delivery is usually at-least-once, so a consumer can see the same message twice.

**Follow-ups:**
- *Queue or Kafka, what is the difference for a test?* A queue message is usually removed once a consumer acknowledges it. A Kafka event stays in the log for the retention time, so a consumer can re-read it from an earlier offset.
- *What breaks most often?* Duplicates and ordering. A consumer that is not idempotent applies the same message twice.

**Source:** https://docs.confluent.io/kafka/design/delivery-semantics.html

### What are at-most-once, at-least-once and exactly-once delivery?

Topic: messaging | Niche | id: q0399

**Say:** At-most-once means a message may be lost but is never repeated. At-least-once means it is never lost but may be delivered more than once, and this is the usual default. Exactly-once means each message has its effect once, and it is hard: Kafka offers it inside Kafka with transactions, and for other systems the practical answer is at-least-once delivery with an idempotent consumer. In a test I send the same message twice and assert one effect.

**Follow-ups:**
- *What is an idempotent consumer?* One that gives the same result whether a message arrives once or twice, for example by storing the message ID and skipping IDs it has already processed.
- *Which one would you pick for payments?* At-least-once with an idempotent consumer: losing a payment is worse than a duplicate the consumer can skip.

**Source:** https://docs.confluent.io/kafka/design/delivery-semantics.html

### How do you test an asynchronous, message-based flow?

Topic: messaging | Niche | id: q0400

**Say:** I trigger the action, such as an API call that publishes an event, and then I poll for the result with a timeout and no fixed sleep. I assert the final state or the outgoing message, and I test the failure paths: a duplicate message gives one effect, a bad message goes to a dead-letter queue and does not block the others, and a failing consumer retries and then gives up. Ordering matters only inside a partition or a queue, so I check it only where the design promises it. I would ask the team for a way to read the queue or topic in the test environment.

**Full process:**
1. Call the API that should emit the event. Expect 202 or 201.
2. Poll the read side (an endpoint or a database row) until the effect appears.
3. Send the same event twice, and assert one effect.
4. Send a malformed event, and assert it lands in the dead-letter queue, and the next valid event still works.

**Follow-ups:**
- *How long do you poll?* As long as the documented processing time plus a margin, with `expect.poll` or `toPass` and a clear timeout message. Never a fixed sleep.
- *What if you cannot read the queue?* Assert the effect on the read side (API or database) and ask for a test hook or a consumer that records messages in the test environment.

**Source:** https://microservices.io/patterns/data/transactional-outbox

### What is a dead-letter queue and what is a poison message?

Topic: messaging | Niche | id: q0401

**Say:** A poison message is one the consumer can never process, such as a malformed payload. If the consumer keeps retrying it, it blocks the queue. After a set number of attempts the broker moves it to a dead-letter queue, where people can inspect it. A test sends a bad message and asserts that it ends up there, and that later messages are processed normally.

**Follow-ups:**
- *How many retries before the dead-letter queue?* It is a broker or consumer setting, such as `maxReceiveCount` in SQS. I take the value from the configuration and test one below and at the limit.
- *What happens to messages in the dead-letter queue?* Someone must alert on it and replay or drop them. I check that an alert exists, not only the queue.

**Source:** https://docs.confluent.io/kafka/design/delivery-semantics.html

## Microservices

### What is a microservice architecture and what does it change for testing?

Topic: microservices | Niche | id: q0402

**Say:** It splits an application into small services, each owning one business capability and its own data, deployed independently and talking over HTTP or messages. For testing it means more network calls, more failure modes, and a need for contract tests between services. Example: a test run on a microservice-based product testing through the apps and the GraphQL APIs on top of it.

**Follow-ups:**
- *What is the first thing you check when an E2E fails in a microservices system?* The correlation or trace ID in the logs, to find which service failed, because the UI only shows the symptom.

**Source:** https://martinfowler.com/articles/microservices.html

### What is eventual consistency and how does it affect tests?

Topic: microservices | Niche | id: q0403

**Say:** When each service owns its data and updates happen through events, other services learn about a change a little later, so for a short time they disagree. That is eventual consistency. In a test, I must not assert the other service's view right after the write. I poll for it with a timeout, and I treat a delay beyond the documented limit as a bug. A UI that promises instant results on top of such a flow is a risk to report.

**Follow-ups:**
- *How do you assert on it without a sleep?* Poll for the final state with a timeout, for example `expect.poll` in Playwright, so the test waits only as long as needed and fails with a clear message.

**Source:** https://microservices.io/patterns/data/saga

### How do you test across microservices without running them all?

Topic: microservices | Niche | id: q0404

**Say:** I use layers. Each service gets its own tests, with doubles for its neighbours. Contract tests check that each pair agrees on the messages. A small number of end-to-end tests cover the critical flows across the real system. And I rely on logs, a correlation ID and tracing to find which service failed. If you have not used Pact in a project, say so, and suggest it for the pairs that break most often.

**Follow-ups:**
- *What is the risk of stubbing the other services?* The stub drifts from the real service, so contract checks or a small E2E layer have to cover that gap.

**Source:** https://docs.pact.io/

### What are the saga and the transactional outbox patterns?

Topic: microservices | Niche | id: q0405

**Say:** A saga is a business transaction across services made of local transactions, each followed by an event, with compensating steps to undo the earlier ones if a later step fails. The transactional outbox writes the event into a table in the same database transaction as the data change, and a separate process publishes it, so the data and the event cannot get out of step. The relay can publish twice, so consumers must be idempotent. In a test I check the compensation path and the duplicate delivery.

**Follow-ups:**
- *What would you test for a saga?* That a failure in a later step runs the compensating steps, so no half-finished state stays, and that a repeated message does not apply twice.

**Source:** https://microservices.io/patterns/data/transactional-outbox

## More scenarios

### The request works in Postman but fails in the browser. Why?

Topic: api-rest | Standard | id: q0406

**Say:** Postman is not a browser, so it skips CORS and sends only the headers I set. The usual causes are CORS (the server does not allow the page's origin, so the browser blocks the response), a cookie or token the page does not send, a different `Content-Type`, or a mixed-content block when an HTTPS page calls an HTTP API. I copy the real request from the DevTools Network tab as cURL, run it, and compare it header by header with my Postman request. If curl works too, the problem is CORS or the page's own code.

**Full process:**
1. Open the console: a CORS error names the missing header.
2. Network tab: check whether a preflight `OPTIONS` request failed.
3. Copy as cURL and run it in the terminal.
4. Send the preflight by hand, as in the CORS answer, and read the `Access-Control-*` headers.
5. Report to the backend team with the origin, the request headers and the response headers.

**Follow-ups:**
- *Do you fix it in the test?* No. The server must send the headers, and the test should keep failing until it does.

**Trap:** Saying "the API is fine, it works in Postman".

**Source:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

### An API test fails with 500 only sometimes. How do you investigate?

Topic: api-rest | Standard | id: q0407

**Say:** I measure first. I repeat the exact request many times and record the failure rate, then find what differs between a failing call and a passing one: the data, the time, the instance behind the load balancer, or a parallel request. I capture the request ID of a failing call and find its stack trace in the logs. I report the rate, the request and the log link. I do not add a retry to make it green, because a retry hides a real defect.

**Full process:**
1. `npx playwright test api/orders.spec.ts --repeat-each=200` and count failures.
2. Log the status and `x-request-id` of each failure.
3. Search the logs (Sentry, Kibana) by that ID.
4. Try with one worker and with many, to test for a race.

**Follow-ups:**
- *When is a retry acceptable?* On a named test, with a written reason, and never for a 500 from the product.

**Trap:** Calling it flaky and re-running until it passes. A 500 is a server response, so the test did its job, and a passing re-run is not a fix.

**Source:** https://playwright.dev/docs/api-testing

### What happens when you open an HTTPS URL, and what does HTTPS protect?

Topic: api-rest | Standard | id: q0408

**Say:** The browser resolves the domain to an IP address with DNS, opens a TCP connection (or QUIC for HTTP/3), and does a TLS handshake where the server proves its identity with a certificate and both sides agree on keys. Then it sends the HTTP request and gets the response. HTTPS encrypts the traffic and checks the server identity, so nobody on the network can read or change it. It does not make the application safe: a SQL injection still works over HTTPS. Proxies like Charles work by installing their own trusted certificate.

**Follow-ups:**
- *What can fail in tests?* An expired or self-signed certificate. Playwright `request` has `ignoreHTTPSErrors` for test environments, and it defaults to false.

**Trap:** Saying HTTPS makes a site secure or hides everything. It protects data in transit only. The host name is typically still visible to the network (DNS query and the TLS server name), and the server still receives and can misuse all data.

**Source:** https://www.charlesproxy.com/documentation/proxying/ssl-proxying/

## Rare tools from the ads

### What is OData, and how would you test an OData API?

Topic: api-providers | Niche | id: q0409

**Say:** If OData is new to you, say so, then explain the idea. It is a standard way of building REST APIs where the client shapes the query in the URL, with options like `$filter`, `$select`, `$top` and `$expand`, and the service describes itself at `$metadata`. I'd test each query option against known data, invalid filters, paging limits, and that `$metadata` matches what the API returns.

**Source:** https://www.odata.org/documentation/

### What are Auth0 and Keycloak, and how do they change API testing?

Topic: api-providers | Niche | id: q0410

**Say:** If you have not used either one, say so. Both are identity providers: they log the user in and issue tokens, Auth0 as a hosted service and Keycloak as open-source software you run yourself. For tests I'd get a token through the API instead of the login page, so the suite stays fast. Then I'd check that the API rejects a missing, expired or tampered token, a token for another audience, and a role that lacks the permission.

**Source:** https://www.keycloak.org/documentation and https://auth0.com/docs/get-started/authentication-and-authorization-flow

### What is NestJS, and what does it mean for testing?

Topic: api-providers | Niche | id: q0411

**Say:** If you have not tested a NestJS service, say so. It is a TypeScript framework for Node backends, built from modules, controllers and providers, and it runs on Express or Fastify. Because of dependency injection, a test can replace one provider with a mock. Its docs use a testing module for that, and Supertest to call the HTTP layer. So I'd expect fast tests below the API and my end-to-end checks on top.

**Source:** https://docs.nestjs.com/fundamentals/testing

### How do you test a file exchange over SFTP or S3?

Topic: messaging | Niche | id: q0412

**Say:** I'd treat a file drop as an asynchronous integration. I check a correct file first, then the failure cases: a partly uploaded file, an empty one, a wrong format or encoding, the same file sent twice, and a file that arrives late. The system should process a duplicate once, reject a bad file with a clear error, and keep the bad file for investigation. I'd also check the retry when the connection drops midway.

**Follow-ups:**
- *How do you stop the system picking up a half-uploaded file?* A common pattern is upload under a temporary name, then rename, or a marker file when the upload is done. I test that a file still uploading is not processed.
- *How do you test it in CI?* A local SFTP server container or a local S3-compatible store, never the partner's real server.

**Source:** https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-family.html
