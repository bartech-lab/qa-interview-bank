# TypeScript, JavaScript, async, unit frameworks, React, Python, Java and C#

How to study this file. Read the TypeScript section first and type every example into a scratch file with `npx tsc --noEmit` running next to it. The first entries start from zero and build up: values and types, then generics, then utility types, then narrowing. Say each **Say** block out loud twice. After the TypeScript and async sections, do the 20 tasks at the end with the answers covered. Every code block was written to compile under `strict` with TypeScript 7.0.2 (checked 2026-11-05), and the printed outputs of the tasks were run on Node 26.

## TypeScript (ts-core)

### What changed in TypeScript 7? Is it still the same language?

Topic: ts-core | Core | id: q0173

**Say:** TypeScript 7.0 came out on 2026-07-08. The compiler was ported from JavaScript to Go, so it runs as native code with shared-memory parallelism. Full builds are typically 8 to 12 times faster. The language itself did not change: the type checker is structurally the same as in 6.0, so `typeof`, generics and utility types work as before. Example: a candidate aligned the E2E toolchain with the native TypeScript 7 type-check.

**Full process:**
1. Install it like any release: `npm install -D typescript`. You get a `tsc` executable, run with `npx tsc`. During the preview phase the package was `@typescript/native-preview` and the executable was `tsgo`. Old CI scripts may still say `tsgo`.
2. Type-check without emitting files: `npx tsc --noEmit -p tsconfig.json`. Playwright does not type-check tests when it runs them, so this is a separate CI step.
3. TypeScript 7.0 ships no programmatic API. Tools that import `typescript` (typescript-eslint is the example the release notes give) need TypeScript 6.0 next to it. The release notes show an npm alias for that: `"typescript": "npm:@typescript/typescript6@^6.0.2"` and `"@typescript/native": "npm:typescript@^7.0.2"`. The 6.0 package gives a `tsc6` executable. A new API is expected in 7.1.
4. Tuning flags that exist now: `--checkers` (type-checker workers, default 4), `--builders` (parallel project-reference builds), `--singleThreaded` (debugging).
5. The defaults changed in 6.0, the bridge release, and 7.0 builds on them: `strict` is on by default, `module` defaults to `esnext`, `target` floats to the latest (`es2025` at the time), `types` defaults to `[]` (so list `"types": ["node"]` if you use Node globals), and `rootDir` defaults to the folder of the `tsconfig.json`. Removed or deprecated: `target: es5`, `outFile`, `moduleResolution: node10`, `baseUrl` as a lookup root, `amd`/`umd`/`systemjs` modules.

**Follow-ups:**
- *Why does a test engineer care?* CI type-check and editor feedback get much faster. The release notes report roughly 12.8 s to 1.47 s on the Playwright repository itself. Faster feedback means people actually run the type-check.
- *What breaks when you upgrade?* Mostly config: a missing `"types"` entry (Node globals such as `process` disappear), deprecated options that now fail, and tools that need the old API.
- *Is the output identical to 6.0?* Checking semantics are meant to be identical. Printing order of union members can differ, because 7.0 sorts types deterministically for parallel checking.

**Trap:** saying "TypeScript was rewritten, so the language is different". Only the compiler implementation changed. Also do not claim the speed numbers as your own measurement: they are from the Microsoft announcement.

**Source:** https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ and https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

### What is the difference between `typeof` and `keyof`?

Topic: ts-core | Core | id: q0174

**Say:** They work on different things. `typeof` takes a value, like a variable or a config object, and gives you its type. `keyof` takes a type and gives you a union of its property names. So if I have `const user = { id: 1, name: 'Ann' }`, then `typeof user` is `{ id: number; name: string }` and `keyof typeof user` is the union `'id' | 'name'`. I use the combination to build a type from an object I already have, so I do not write the same list twice.

**Full process:**
1. Start with a value. Types are written in a different "world" than values, and `typeof` in a type position is the bridge from value to type.
2. Type it into a scratch file:

```ts
const user = { id: 1, name: 'Ann', role: 'admin' };

type User = typeof user;             // { id: number; name: string; role: string }
type UserKey = keyof User;           // 'id' | 'name' | 'role'
type SameThing = keyof typeof user;  // the same union, in one step

const key: UserKey = 'name';         // ok
// @ts-expect-error 'email' is not a key of User
const bad: UserKey = 'email';
```

3. Hover over each type alias in the editor. It shows what each operator produced. A type alias produces nothing at runtime: it is erased when the file is compiled.
4. Add the second `typeof`, the JavaScript one, so you can separate them out loud: in an expression, `typeof user` is a plain JavaScript operator that returns a string such as `'object'` at runtime. In a type position (after `type X =` or after a colon), the same word is the TypeScript type operator.

**Follow-ups:**
- *What does `keyof typeof SOME_OBJECT` give with `as const`?* The union of the key names as literals. Without `as const`, the keys are still literal names (keys are always literal), but the values widen to `string` or `number`.
- *Can you use `keyof` on a value?* No. `keyof user` is an error, because `user` is a value. Write `keyof typeof user`.
- *Where have you seen it in test code?* Typing a helper that takes the name of a field: `function sortBy(rows: Row[], key: keyof Row)`. A typo in the field name becomes a compile error.

**Trap:** answering only with the JavaScript `typeof` (returns `'string'`, `'object'`) and missing that the question is about the type operator. Another wrong answer is "`keyof` gets the keys of an object value". It works on a type, not a value.

**Source:** https://www.typescriptlang.org/docs/handbook/2/typeof-types.html and https://www.typescriptlang.org/docs/handbook/2/keyof-types.html

### Why TypeScript at all, and what is the difference between compile time and runtime?

Topic: ts-core | Core | id: q0175

**Say:** TypeScript is JavaScript plus a type system that runs before the code does. It catches a wrong field name or a wrong argument in the editor and in CI, not at the moment the test fails. The important limit is that types are erased. After compile there is only JavaScript, so nothing checks that an API response really has the shape I typed. For that I validate the response at runtime, for example against a JSON Schema or with a schema library. In a Playwright suite the types mostly help with page objects, fixtures and test data, because refactors become safe.

**Full process:**
1. Write a typed fetch helper and notice what the compiler does and does not know:

```ts
interface Todo { id: number; title: string; done: boolean }

async function getTodo(id: number): Promise<Todo> {
  const res = await fetch(`https://example.test/todos/${id}`);
  return (await res.json()) as Todo; // the compiler trusts this cast
}
```

2. `res.json()` returns `Promise<any>` in the DOM and Node typings, so the `as Todo` is a promise from you, not a check. If the server sends `{ "id": "7" }`, the code compiles and the first wrong value surfaces later, far from the cause.
3. Add the runtime check. For a QA suite that is a schema assertion on the response, a hand-written guard function (see the type guard entry), or a schema library. Then the type and the check agree.
4. Run the compile-time step on its own in CI: `npx tsc --noEmit`. Run the tests after it. Two different failures, two different messages.

**Follow-ups:**
- *Does Playwright check the types when running tests?* No. It transforms TypeScript to JavaScript and runs it, even with type errors. The docs say to run `tsc` separately, so that is a CI step.
- *Does Node run TypeScript directly?* Node 22.18 and later (and 23.6 and later) strip types by default, for erasable syntax only, with no type-check. Enums and constructor parameter properties are not supported in that mode.
- *Is `any` a type check?* No, it turns the check off for that value.

**Trap:** "TypeScript validates the data coming from the API." It cannot, because the types do not exist at runtime.

**Source:** https://playwright.dev/docs/test-typescript and https://nodejs.org/api/typescript.html

### Explain generics. I have never used them.

Topic: ts-core | Core | id: q0176

**Say:** A generic is a type parameter, a placeholder for a type, like a function parameter but for types. It lets me write one function or one type that works for many types and still keeps the type information. For example `first<T>(items: T[]): T | undefined` returns a number for a number array and a string for a string array. Without it I would pick `any` and lose the checks. In test code I meet generics in `test.extend<...>` fixtures, in `Promise<T>`, in `Array<T>`, and in helper types like `ApiResponse<T>`.

**Full process:**
1. Start with the problem. This function works for numbers only:

```ts
function firstNumber(items: number[]): number | undefined {
  return items[0];
}
```

2. Replace `number` with a placeholder name, by convention `T`, and declare it in angle brackets after the function name:

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const a = first([1, 2, 3]);       // a: number | undefined
const b = first(['x', 'y']);      // b: string | undefined
const c = first<boolean>([true]); // you can also pass T by hand
```

3. TypeScript infers `T` from the argument, so you rarely write `<number>` yourself. When it cannot infer (an empty array, a function that returns a Promise), you pass it by hand.
4. Generic types work the same way. A reusable response wrapper:

```ts
interface ApiResponse<T> {
  status: number;
  data: T;
}

interface Todo { id: number; title: string }

function ok<T>(data: T): ApiResponse<T> {
  return { status: 200, data };
}

const res = ok<Todo>({ id: 1, title: 'write tests' }); // res.data.title is a string
```

5. Read it out loud: "`ApiResponse` of `Todo`" means "an `ApiResponse` where `T` is `Todo`".

**Follow-ups:**
- *Why not just use `any`?* With `any` the result is `any`, so the next line gets no autocomplete and no error on a typo. With `T` the result keeps its type.
- *Name a generic you use daily without writing one.* `Promise<Response>`, `Array<string>`, `Record<string, number>`, `Locator[]` is an array of `Locator`.
- *Can a generic have a default?* Yes: `interface Page<T = unknown>`. Callers who skip the argument get `unknown`.

**Trap:** describing generics as "a way to accept any type". The point is the opposite: the type is kept and linked between input and output.

**Source:** https://www.typescriptlang.org/docs/handbook/2/generics.html

### What are generic constraints?

Topic: ts-core | Core | id: q0177

**Say:** A constraint limits what `T` can be, with `extends`. Plain `T` means anything, so inside the function I can do almost nothing with it. `T extends { length: number }` says "any type that has a numeric length", so I can read `.length`. A common version is `K extends keyof T`, which means K must be one of the property names of T. That makes `getProp(user, 'nmae')` a compile error.

**Full process:**
1. Without a constraint this fails:

```ts
// @ts-expect-error Property 'length' does not exist on type 'T'
function bad<T>(x: T): number { return x.length; }
```

2. Add the constraint:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest('abc', 'de');      // string
longest([1, 2], [1, 2, 3]); // number[]
// @ts-expect-error number has no length
longest(1, 2);
```

3. The key-of-object pattern, used for typed field helpers:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: 'Ann' };
const name = getProp(user, 'name');   // string
const id = getProp(user, 'id');       // number
// @ts-expect-error 'nmae' is not a key of the user object
getProp(user, 'nmae');
```

4. Read `T[K]` as "the type of property K on T". That is an indexed access type. It is why `name` is `string` and `id` is `number`: the return type follows the key.

**Follow-ups:**
- *What is `extends` here, inheritance?* No. In a generic it means "is assignable to", a condition on the type.
- *Can you constrain to a class or interface?* Yes: `T extends HasId`, where `HasId` is any type with an `id`.
- *How is this useful in tests?* A `waitForRow<T extends { id: number }>(rows: T[], id: number)` helper works for any row type that has an id.

**Trap:** forgetting that `K extends keyof T` and `T[K]` appear together. Without the link, the result type is a union of all property types or `any`.

**Source:** https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints

### How do you use generics in Playwright fixtures or typed test helpers?

Topic: ts-core | Standard | id: q0178

**Say:** `test.extend<T>()` takes a type that lists my fixtures and their types. Then every test that destructures `loginPage` gets autocomplete and a type error on misuse. I would write the type of the fixtures once, next to the fixture, and export the extended `test`. Test files import that `test` instead of the one from `@playwright/test`.

**Full process:**
1. Create `fixtures.ts`:

```ts
import { test as base, expect, type Page, type Locator } from '@playwright/test';

class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel('Email', { exact: true });
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: 'Sign in', exact: true });
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

type Fixtures = { loginPage: LoginPage };

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect };
```

2. In a spec: `import { test, expect } from './fixtures';` then `test('signs in', async ({ page, loginPage }) => { ... })`. Hover `loginPage` and you see `LoginPage`.
3. Worker-scoped fixtures take a second type argument: `base.extend<TestFixtures, WorkerFixtures>`. Test-scoped first, worker-scoped second.
4. Run `npx tsc --noEmit`. A typo such as `loginPage.logn(...)` fails here, not at test time.

**Follow-ups:**
- *Why is `use` called inside the fixture?* The code before `await use(...)` is setup, the code after is teardown. Playwright passes the value to the test while the fixture is suspended.
- *Where do assertions go?* In the tests, not in the page object. The page object holds `Locator` objects and user actions.

**Trap:** typing the fixture value with `any` to make an error go away. Then the editor stops helping in every test that uses it.

**Source:** https://playwright.dev/docs/test-fixtures#typescript-with-fixtures

### What are utility types? Name the ones you use.

Topic: ts-core | Standard | id: q0179

**Say:** Utility types are small generic types that TypeScript ships, for turning one type into another so I do not rewrite it. The ones I reach for in test code: `Partial<T>` for test data overrides, `Required<T>`, `Pick<T, K>` and `Omit<T, K>` to take or drop fields, `Record<K, V>` for lookup tables, `ReturnType<typeof fn>` and `Parameters<typeof fn>` to reuse a function's types, and `Awaited<T>` to unwrap a Promise. I read the type-level ones (mapped and conditional types) behind them but rarely write those.

**Full process:**
1. One base type for all the examples:

```ts
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
}
```

2. Each utility on it:

```ts
type Draft = Partial<User>;                 // every field optional
type Full = Required<Draft>;                // every field required again
type Frozen = Readonly<User>;               // fields cannot be reassigned
type Credentials = Pick<User, 'email' | 'role'>;  // keep only these
type NewUser = Omit<User, 'id'>;            // drop these (server assigns id)
type RolePermissions = Record<User['role'], string[]>; // { admin: string[]; member: string[] }
```

3. Function-based ones:

```ts
async function createUser(input: NewUser): Promise<User> {
  return { id: 1, ...input };
}

type CreateUserReturn = ReturnType<typeof createUser>;   // Promise<User>
type CreateUserResult = Awaited<CreateUserReturn>;       // User
type CreateUserParams = Parameters<typeof createUser>;   // [input: NewUser]
```

4. A test data builder that uses `Partial`:

```ts
function buildUser(overrides: Partial<User> = {}): User {
  return { id: 1, email: 'ann@example.test', name: 'Ann', role: 'member', ...overrides };
}

const admin = buildUser({ role: 'admin' });
```

**Follow-ups:**
- *`Pick` vs `Omit`: when each?* `Pick` when you want a few fields of many. `Omit` when you want almost everything and drop one or two.
- *Does `Partial<User>` allow `{ email: undefined }`?* Yes in default settings: optional means the key may be missing or `undefined`. The option `exactOptionalPropertyTypes` makes it stricter.
- *Is `Record<string, number>` the same as an interface?* It is an object type with any string key and number values. Use a union of keys, as above, when the keys are known, so a missing key becomes an error.

**Trap:** saying `Omit` works like a mapped type that keeps unions intact. `Omit` on a union type collapses it into the common fields. Distributive behaviour is a senior edge case.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html

### What does `Partial<T>` do, and how would you implement it yourself?

Topic: ts-core | Standard | id: q0180

**Say:** `Partial<T>` makes every property of `T` optional. It is a mapped type: it loops over the keys of `T` and puts a `?` on each. Writing it is a good way to understand the syntax, even though the built-in already exists. I would read `[K in keyof T]?: T[K]` as "for each key K of T, an optional property with the same type".

**Full process:**
1. The syntax, one piece at a time:

```ts
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

type MyRequired<T> = {
  [K in keyof T]-?: T[K]; // -? removes the optional flag
};

type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

interface User { id: number; name: string }
const u: MyPartial<User> = { name: 'Ann' }; // id is optional now
const p: MyPick<User, 'id'> = { id: 1 };
```

2. `keyof T` is the union of keys, `in` loops over that union, `T[K]` is the original property type. The `?` and `readonly` are modifiers that can be added, or removed with a minus sign.
3. `Omit<T, K>` in the standard library is `Pick<T, Exclude<keyof T, K>>`.

**Follow-ups:**
- *What is a mapped type?* A new object type built by looping over the keys of another type, optionally changing each property.
- *Do you write mapped types in test code?* Rarely. I read them in library types and use the built-ins.

**Trap:** thinking `Partial` is deep. It only makes the top-level properties optional. Nested objects stay required.

**Source:** https://www.typescriptlang.org/docs/handbook/2/mapped-types.html

### Explain conditional types and `infer` at a reading level.

Topic: ts-core | Standard | id: q0181

**Say:** A conditional type is an if-else for types: `T extends U ? X : Y`. If `T` is assignable to `U` the result is `X`, otherwise `Y`. `infer` lets me capture a part of a type in the "true" branch. `ReturnType` and `Awaited` are written this way. I read them to understand what a utility gives me. I do not write them in test code.

**Full process:**
1. Basic form:

```ts
type IsString<T> = T extends string ? 'yes' : 'no';
type A = IsString<'hello'>; // 'yes'
type B = IsString<42>;      // 'no'
```

2. With `infer`, capturing what a function returns:

```ts
type MyReturnType<F> = F extends (...args: never[]) => infer R ? R : never;

function makeUser() {
  return { id: 1, name: 'Ann' };
}

type U = MyReturnType<typeof makeUser>; // { id: number; name: string }
```

3. Unwrapping a Promise, a simplified `Awaited`:

```ts
type Unwrap<T> = T extends Promise<infer V> ? V : T;
type X = Unwrap<Promise<number>>; // number
type Y = Unwrap<string>;          // string
```

4. Conditional types distribute over unions: `IsString<string | number>` is `'yes' | 'no'`.

**Follow-ups:**
- *What is the `never` doing in `: never`?* It marks "this branch cannot happen".
- *Why is the built-in `Awaited` more complex than `Unwrap`?* It also handles nested promises and thenables.

**Trap:** claiming conditional types run at runtime. They exist only in the type checker.

**Source:** https://www.typescriptlang.org/docs/handbook/2/conditional-types.html

### What does `Awaited<T>` do, and where does it show up?

Topic: ts-core | Standard | id: q0182

**Say:** `Awaited<Promise<User>>` is `User`. It models what `await` produces, even through nested promises. I use it to get the result type of an async helper without writing the interface twice: `Awaited<ReturnType<typeof loginViaApi>>`.

**Full process:**
1. Type it:

```ts
async function loginViaApi(email: string): Promise<{ token: string; userId: number }> {
  return { token: `t-${email}`, userId: 1 };
}

type Session = Awaited<ReturnType<typeof loginViaApi>>; // { token: string; userId: number }
```

2. Without `Awaited`, `ReturnType<typeof loginViaApi>` is `Promise<{...}>`, and a variable declared with it would hold a promise.
3. `Promise.all` is typed with it: `await Promise.all([a(), b()])` gives a tuple of the unwrapped values.

**Follow-ups:**
- *Does `Awaited<number>` work?* Yes, it returns `number`. It leaves non-promises alone.

**Trap:** Thinking `Awaited` waits for anything at run time. It is a type-only helper and is erased. The usual mistake is to declare a variable as `ReturnType<typeof fn>` for an async function: that type is the `Promise`, not the resolved value.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html#awaitedtype

### What are `Exclude`, `Extract` and `NonNullable`?

Topic: ts-core | Standard | id: q0183

**Say:** They filter union types. `Exclude<A, B>` removes members of A that are assignable to B. `Extract<A, B>` keeps only those. `NonNullable<T>` removes `null` and `undefined`. I use `NonNullable` after I check a value in a way the compiler cannot follow.

**Full process:**

```ts
type Status = 'draft' | 'sent' | 'failed';
type Active = Exclude<Status, 'draft'>;      // 'sent' | 'failed'
type OnlyFailed = Extract<Status, 'failed'>; // 'failed'
type Defined = NonNullable<string | null | undefined>; // string
```

**Follow-ups:**
- *How does `Omit` use `Exclude`?* `Omit<T, K>` is `Pick<T, Exclude<keyof T, K>>`: it removes the keys, then picks the rest.

**Trap:** Using `Exclude` to drop object properties. It filters the members of a union, so for keys of an object use `Omit`. Also, `NonNullable` removes only `null` and `undefined`, not `0` or `''`, and it checks nothing at run time.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html#excludeuniontype-excludedmembers

### What is the difference between `type` and `interface`?

Topic: ts-core | Standard | id: q0184

**Say:** For describing an object shape they are almost the same, and I pick one and stay consistent. The differences: `interface` can be extended with `extends` and merged when declared twice (declaration merging), and error messages for it are often clearer. `type` can name anything: a union like `'a' | 'b'`, a tuple, a mapped or conditional type, a primitive alias. A good rule: `interface` for object shapes that other code might extend, such as page objects or API models, `type` for unions and anything computed.

**Full process:**
1. Both describe an object:

```ts
interface UserI { id: number; name: string }
type UserT = { id: number; name: string };
```

2. Extending:

```ts
interface Admin extends UserI { permissions: string[] }
type AdminT = UserT & { permissions: string[] };
```

3. Only `type` can do this:

```ts
type Role = 'admin' | 'member';
type Pair = [number, string];
type Keys = keyof UserT;
```

4. Only `interface` merges. Two declarations with the same name combine, which is how libraries let you add to their types:

```ts
interface Settings { theme: string }
interface Settings { language: string }
const s: Settings = { theme: 'dark', language: 'pl' };
```

5. A classic place for merging in test code is extending a global type, for example adding a field to `Window` that your app sets for tests.

**Follow-ups:**
- *Can a class implement a `type`?* Yes, if it is an object type. It cannot implement a union.
- *Which is faster for the compiler?* The TypeScript docs say interface extension is usually cheaper than intersection with `&` in big projects, but that rarely matters in test code.

**Trap:** "interface is for objects and type is for everything else, so they are not interchangeable". For a plain object shape they are interchangeable. Say that.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces

### What is the difference between `any`, `unknown` and `never`?

Topic: ts-core | Standard | id: q0185

**Say:** `any` turns type checking off: you can do anything with it, and the unsafety spreads to everything it touches. `unknown` is the safe version: it can hold anything, but I must narrow it, for example with `typeof` or a type guard, before I use it. `never` is the type with no values. A function that always throws returns `never`, and a variable of type `never` in a `switch` default proves I covered every case. For data I do not trust, such as a parsed JSON response, `unknown` is right.

**Full process:**
1. `any` lets mistakes through:

```ts
const a: any = 'text';
a.toFixed(2); // compiles, throws at runtime: a.toFixed is not a function
```

2. `unknown` forces a check:

```ts
function describe(value: unknown): string {
  // @ts-expect-error Object is of type 'unknown'
  value.toUpperCase();

  if (typeof value === 'string') {
    return value.toUpperCase(); // narrowed to string here
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return 'something else';
}
```

3. `never` as a function result and an exhaustiveness check:

```ts
function fail(message: string): never {
  throw new Error(message);
}

type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.side ** 2;
    default: {
      const unreachable: never = s; // compile error if a new kind is added and not handled
      return fail(`unhandled ${JSON.stringify(unreachable)}`);
    }
  }
}
```

4. `catch (e)` is `unknown` with `strict` (option `useUnknownInCatchVariables`), so `e.message` needs a check such as `e instanceof Error`.

**Follow-ups:**
- *When is `any` acceptable?* A short-lived escape hatch with a reason, for example a untyped third-party module, ideally limited to one cast line. A strict rule: prefer `unknown`.
- *Is `object` the same as `unknown`?* No. `object` excludes primitives and also excludes `null` under strict settings.
- *Is `void` the same as `never`?* No. `void` means "returns nothing useful", `never` means "never returns".

**Trap:** saying `unknown` is "the same as any but stricter on assignment only". The real difference is that you cannot use an `unknown` value without narrowing it first.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html and https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown

### What is narrowing? Name the ways to narrow a type.

Topic: ts-core | Standard | id: q0186

**Say:** Narrowing is TypeScript following my `if` checks and treating a variable as a more specific type inside the block. The tools: `typeof x === 'string'`, `x instanceof Date`, `'field' in obj`, a truthiness check, equality (`x === null`), a discriminant property (`result.kind === 'ok'`), and my own type guard functions. Narrowing is how a union becomes usable. It is also how I make a response from an API safe to read.

**Full process:**
1. `typeof`, equality, truthiness:

```ts
function toLabel(value: string | number | null | undefined): string {
  if (value == null) return 'empty';        // narrows out null and undefined
  if (typeof value === 'number') return value.toFixed(1);
  return value.trim();                      // only string is left
}
```

2. `in` and `instanceof`:

```ts
interface Cat { meow(): void }
interface Dog { bark(): void }

function speak(pet: Cat | Dog): void {
  if ('meow' in pet) pet.meow();
  else pet.bark();
}

function when(input: string | Date): number {
  return input instanceof Date ? input.getTime() : Date.parse(input);
}
```

3. Narrowing is lost across function boundaries and mutation. Inside a callback, a `let` variable you checked earlier can be widened again. A `const` stays narrowed.
4. `Array.isArray(x)` narrows to an array.

**Follow-ups:**
- *Why does `if (value)` fail for `0` and `''`?* Truthiness removes them as well as `null`, so a valid `0` would be treated as missing. Use `value != null` or `value !== undefined`.
- *Does narrowing work in a `switch`?* Yes, on a discriminant property or with `typeof`.

**Trap:** using `as string` to force the type instead of narrowing. It compiles and hides the error.

**Source:** https://www.typescriptlang.org/docs/handbook/2/narrowing.html

### What is a user-defined type guard?

Topic: ts-core | Standard | id: q0187

**Say:** It is a function whose return type is a type predicate, like `value is User`. When it returns true, TypeScript narrows the argument to that type. I write one when I need to check an unknown response at runtime and then use it as a typed value. The check is my code, so it is as correct as I wrote it. TypeScript does not verify that the body matches the predicate.

**Full process:**

```ts
interface User { id: number; name: string }

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'number' &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`https://example.test/users/${id}`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body: unknown = await res.json();
  if (!isUser(body)) throw new Error('response is not a User');
  return body; // narrowed to User
}
```

A related form is an assertion function, `asserts value is User`, which throws instead of returning a boolean:

```ts
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) throw new Error('not a User');
}
```

**Follow-ups:**
- *What if the predicate lies?* The compiler believes it. A wrong guard silently breaks type safety, so keep guards small and test them.
- *A better option for big shapes?* A schema library or a JSON Schema validator generates the check and the type from one source.

**Trap:** returning `boolean` instead of `value is User`. The function works but does not narrow.

**Source:** https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates

### What is a discriminated union and why is it useful?

Topic: ts-core | Standard | id: q0188

**Say:** It is a union of object types that share one property with a literal value, the discriminant, such as `status: 'ok' | 'error'`. Checking that property narrows the whole object. It fits API results well: a success has `data`, an error has `message`, and the compiler stops me reading `data` on the error branch. Add a `never` check in `default` and a newly added variant becomes a compile error everywhere it is not handled.

**Full process:**

```ts
interface User { id: number; name: string }

type Result =
  | { status: 'ok'; data: User }
  | { status: 'error'; message: string; code: number };

function show(r: Result): string {
  if (r.status === 'ok') {
    return r.data.name;     // data exists only here
  }
  return `${r.code}: ${r.message}`;
}

function assertNever(x: never): never {
  throw new Error(`unexpected value ${JSON.stringify(x)}`);
}

function code(r: Result): number {
  switch (r.status) {
    case 'ok': return 200;
    case 'error': return r.code;
    default: return assertNever(r); // fails to compile when a third status is added
  }
}
```

**Follow-ups:**
- *How do you make a `switch` exhaustive?* With a `default` branch that assigns the value to `never` or calls `assertNever`.
- *Why not one type with optional `data?` and `message?`?* Then every use needs a null check and impossible states, such as both set, are allowed.
- *Test code example?* A helper that returns `{ ok: true, response } | { ok: false, error }` so the test must handle both.

**Trap:** using a plain `boolean` flag next to optional fields instead of a literal discriminant. The compiler cannot narrow that.

**Source:** https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions

### How do you shape a type for test data, and what do you pay attention to?

Topic: ts-core | Standard | id: q0189

**Say:** I describe the shape of the data with an object type: the field names and the kind of each value. For an object, `type` and `interface` do the same job, so I follow what the repository already uses. Then I add a factory function that returns a valid object by default and takes `Partial` of that type as overrides, so each test states only the field it is about. Values that must be unique, such as an email, are generated in the factory. I keep the field types wide, a plain `number` or `string`. The type says what the data looks like. It does not say which values are valid, because I need to send invalid ones too.

| Part | What it does | Example |
|---|---|---|
| Object type | names the fields and their kinds | `type BookingRequest = { nights: number }` |
| Factory with defaults | gives a valid object | `buildBooking()` |
| `Partial<T>` overrides | a test changes only what it tests | `buildBooking({ childAge: 19 })` |
| Generated values | no collisions between parallel tests | `qa-${randomUUID()}@example.com` |

```ts
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// The shape of one booking request. Wide types: any number, any string.
type BookingRequest = {
  email: string;
  destination: string;
  nights: number;
  childAge: number;
};

// A valid booking by default. A test overrides only the field it is about.
function buildBooking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    email: `qa-${randomUUID()}@example.com`,
    destination: 'Majorka',
    nights: 7,
    childAge: 5,
    ...overrides,
  };
}

test('a default booking is valid', async ({ request }) => {
  const response = await request.post('/travellers', { data: buildBooking() });
  expect(response.status()).toBe(201);
});

test('a child age above the range is rejected', async ({ request }) => {
  const response = await request.post('/travellers', { data: buildBooking({ childAge: 19 }) });
  expect(response.status()).toBe(422);
});
```

Run on Playwright 1.65.1 against a local backend that accepts a child age from 0 to 18: both pass, and the second fails when 19 is changed to 18.

**Follow-ups:**
- *`type` or `interface` here?* Either. Only `type` can also name a list of allowed values (`'adult' | 'child'`), and only `interface` can be declared twice and merged. For a plain data object the choice is the team's convention.
- *Why a factory and not one shared constant?* A shared object gets changed by one test and read by another. A factory returns a fresh object each time.

**Powiedz:** Kształt danych opisuję typem obiektu: nazwy pól i rodzaj wartości. Dla obiektu `type` i `interface` robią to samo, więc biorę to, co jest już w repo. Do tego robię fabrykę, czyli funkcję, która zwraca poprawny obiekt z wartościami domyślnymi i przyjmuje `Partial` tego typu jako nadpisania, żeby test podawał tylko to pole, o które mu chodzi. Wartości, które muszą być unikalne, jak email, generuję w fabryce. Typy pól zostawiam szerokie, zwykły `number` albo `string`. Typ mówi, jak dane wyglądają, a nie które wartości są poprawne, bo niepoprawne też muszę umieć wysłać.

**Trap:** One shared test-data object imported by many tests. It is shared state, and it breaks under parallel runs.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype

### Should the types of your test data implement business rules, for example a value from 0 to 18?

Topic: ts-core | Standard | id: q0190

**Say:** No. A type describes the shape: this field is a number. The business rule, a child age from 0 to 18, belongs to the product, and my tests check it. If I write the rule into the type, only valid values compile, so I can no longer write the tests that matter most: the negative ones and the boundaries, 19 and minus 1. Someone will then force the value through with `as any`, and the type protects nothing. So the type stays wide, and the rule lives in the test data: one row per equivalence class and per boundary, each with the result I expect. AI assistants tend to narrow such types because it looks precise, so I watch for it in review.

| | Rule in the type | Rule in the tests |
|---|---|---|
| Type | `childAge: 0 \| 1 \| ... \| 18` | `childAge: number` |
| Valid value 18 | compiles | compiles |
| Negative value 19 | compile error | compiles, and the test expects 422 |
| Boundary minus 1 | compile error | compiles, and the test expects 422 |
| Rule changes to 0 to 17 | the type and every test change | one row changes |
| Who checks the rule | the compiler, on my own test code | the test, on the product |

The narrow type, and what the compiler says (TypeScript 7.0.2):

```ts
// The business rule written into the type: only 0 to 18 compiles.
type ChildAge = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
type NarrowTraveller = { childAge: ChildAge };

const valid: NarrowTraveller = { childAge: 18 };
const tooOld: NarrowTraveller = { childAge: 19 };        // error TS2322: Type '19' is not assignable to type 'ChildAge'.
const negative: NarrowTraveller = { childAge: -1 };      // error TS2322: Type '-1' is not assignable to type 'ChildAge'.
const forced: NarrowTraveller = { childAge: 19 as any }; // compiles: the type no longer protects anything
```

The correct way: a wide type, and the rule as test rows.

```ts
import { test, expect } from '@playwright/test';

// The type describes the shape. The rule "0 to 18" stays in the product and in the tests.
type Traveller = { childAge: number };

const cases: { name: string; data: Traveller; status: number }[] = [
  { name: 'below the range', data: { childAge: -1 }, status: 422 },
  { name: 'lower boundary', data: { childAge: 0 }, status: 201 },
  { name: 'upper boundary', data: { childAge: 18 }, status: 201 },
  { name: 'above the range', data: { childAge: 19 }, status: 422 },
];

for (const { name, data, status } of cases) {
  test(`child age ${data.childAge}, ${name}, answers ${status}`, async ({ request }) => {
    const response = await request.post('/travellers', { data });
    expect(response.status()).toBe(status);
  });
}
```

Run on Playwright 1.65.1 against a local backend with that rule: four pass, and the 19 row fails when its expected status is changed to 201.

**Follow-ups:**
- *What happens to equivalence classes when the rule is in the type?* Only the valid class is left. The invalid classes, below 0 and above 18, cannot be written, so they are not tested.
- *Is a narrow type ever right?* Yes, for a closed list that is part of the shape, such as `type Board = 'all-inclusive' | 'breakfast'`. Even then the test that sends an unknown value builds its body as a plain object, not as that type.
- *How do you send a value of the wrong kind, such as text for the age?* As a plain object passed to the request, outside the type. That test is about the API contract, not about my data model.

**Powiedz:** Nie. Typ opisuje kształt danych: to pole jest liczbą. Reguła biznesowa, czyli wiek dziecka od 0 do 18, należy do produktu i to moje testy mają ją sprawdzać. Jeśli wpiszę regułę w typ, skompilują się tylko poprawne wartości, więc nie napiszę testów negatywnych ani wartości brzegowych, 19 i minus 1. Z klas równoważności zostaje mi tylko ta poprawna. Ktoś to potem obejdzie przez `as any` i typ przestaje cokolwiek chronić. Dlatego typ zostawiam szeroki, `number`, a regułę trzymam w danych testu: jeden wiersz na klasę równoważności i na wartość brzegową, każdy z oczekiwanym wynikiem. AI często zawęża takie typy, bo wygląda to precyzyjnie, więc pilnuję tego w review.

**Trap:** Answering "yes, types should say exactly what is allowed". That is right for product code. In test code it removes the negative tests.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types

### Enums or a union of string literals?

Topic: ts-core | Standard | id: q0191

**Say:** I prefer a union of string literals, or a const object with `as const`. They are erased at runtime, easy to print in logs and in test names, and work with Node's type stripping. A regular `enum` generates real JavaScript code, and it does not run under Node's type stripping or with `erasableSyntaxOnly`. Numeric enums also accept any number in older TypeScript versions. An enum is fine if the codebase already uses them. I follow the codebase.

**Full process:**

```ts
// union of literals
type Role = 'admin' | 'member' | 'guest';

// const object plus derived union: a value you can iterate and a type
const ROLES = ['admin', 'member', 'guest'] as const;
type RoleFromArray = (typeof ROLES)[number]; // 'admin' | 'member' | 'guest'

for (const role of ROLES) {
  console.log(role); // loop over every role in a data-driven test
}

// enum, for comparison
enum Status { Draft = 'draft', Sent = 'sent' }
const s: Status = Status.Sent;
```

**Follow-ups:**
- *Why do the literals help in data-driven tests?* Loop over the array to generate one test per role, and the type guarantees each role is valid.
- *What is `const enum`?* It is inlined at compile time. It causes trouble with single-file transpilers (Babel, esbuild, type stripping), so I avoid it.

**Trap:** "enums are always bad". They work. The honest point is the runtime footprint and the tooling limits.

**Source:** https://www.typescriptlang.org/docs/handbook/enums.html and https://nodejs.org/api/typescript.html

### What does `as const` do?

Topic: ts-core | Standard | id: q0192

**Say:** `as const` tells TypeScript to treat a value as the narrowest, read-only version of itself. Strings stay exact literals instead of widening to `string`, arrays become read-only tuples, and object properties become `readonly`. I use it for lists of roles, routes or test cases that I loop over, then derive a union type from them, so the data and the type cannot drift apart.

**Full process:**

```ts
const widened = ['admin', 'member'];            // string[]
const narrow = ['admin', 'member'] as const;    // readonly ['admin', 'member']

type Role = (typeof narrow)[number];            // 'admin' | 'member'

const ROUTES = {
  home: '/',
  settings: '/settings',
} as const;

type RouteName = keyof typeof ROUTES;           // 'home' | 'settings'
type RoutePath = (typeof ROUTES)[RouteName];    // '/' | '/settings'

// @ts-expect-error cannot assign to a read-only property
ROUTES.home = '/start';
```

Use in a data-driven test:

```ts
const cases = [
  { role: 'admin', canDelete: true },
  { role: 'member', canDelete: false },
] as const;

for (const c of cases) {
  console.log(`${c.role} can delete: ${c.canDelete}`);
}
```

**Follow-ups:**
- *Does it freeze the object at runtime?* No. It is a compile-time marker. `Object.freeze` is the runtime one.
- *`as const` vs `satisfies`?* They combine: `as const satisfies Config` keeps literals and also checks the shape.

**Trap:** thinking `as const` makes the object immutable at runtime.

**Source:** https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions

### What does `satisfies` do, and how is it different from a type annotation?

Topic: ts-core | Standard | id: q0193

**Say:** `satisfies` checks that a value matches a type but keeps the more specific type TypeScript inferred. A plain annotation, `const x: Config = ...`, widens the value to `Config`, so I lose the exact keys and literals. With `satisfies` I still get an error for a wrong field, and I keep the precise type, so autocomplete knows which keys exist. It arrived in TypeScript 4.9.

**Full process:**

```ts
type Env = { baseUrl: string; retries?: number };

const envs = {
  dev: { baseUrl: 'https://dev.example.test' },
  prod: { baseUrl: 'https://example.test', retries: 2 },
} satisfies Record<string, Env>;

envs.dev.baseUrl;   // ok, string
envs.prod.retries;  // number | undefined, exact
// envs.stage        // error: 'stage' does not exist (with a Record annotation this would be allowed)

const annotated: Record<string, Env> = envs;
annotated.stage;    // typed as Env, no error, even though it does not exist
```

1. With the annotation `Record<string, Env>`, any key is accepted and typed as `Env`.
2. With `satisfies`, only `dev` and `prod` exist, and a typo like `baseURL` is still an error.

**Follow-ups:**
- *Does it change runtime?* No, it is erased.
- *Does it work with Node's type stripping?* `satisfies` is erasable syntax, so yes.

**Trap:** confusing it with `as`. `as` overrides the checker. `satisfies` adds a check.

**Source:** https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator

### What are optional chaining `?.` and nullish coalescing `??`? How is `??` different from `||`?

Topic: ts-core | Standard | id: q0194

**Say:** `a?.b` reads `b` only if `a` is not null or undefined, otherwise the whole expression is `undefined`, so it does not throw. `a ?? b` returns `b` only when `a` is null or undefined. `||` replaces every falsy value, so `0`, `''` and `false` get replaced too. For a count that can legitimately be zero, `??` is the right one.

**Full process:**

```ts
interface Settings { retries?: number; user?: { name?: string } }

function retries(s: Settings): number {
  return s.retries ?? 3;        // 0 stays 0
}

function wrong(s: Settings): number {
  return s.retries || 3;        // 0 becomes 3, a bug
}

function userName(s: Settings): string {
  return s.user?.name ?? 'anonymous';
}

function run(cb?: () => void, list?: number[]): number | undefined {
  cb?.();                       // call only if it exists
  return list?.[0];             // optional index access
}
```

`??=` assigns only when the left side is null or undefined: `config.timeout ??= 5000`.

**Follow-ups:**
- *Does `?.` hide errors in tests?* It can. `row?.click()` passes silently when `row` is missing. Fix the missing element instead of chaining past it.
- *Can I mix `??` with `||` without brackets?* No, it is a syntax error. Use parentheses.

**Trap:** answering that `??` is "a better `||`". They differ on purpose. Pick by the values you want to keep.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing

### What does the non-null assertion `!` do and when is it acceptable?

Topic: ts-core | Standard | id: q0195

**Say:** `value!` tells the compiler "this is not null or undefined", and removes those from the type. It adds no runtime check: if I am wrong, I get a crash later. I avoid it in production code. In test code I accept it only where a failure would be a loud, clear test failure anyway, such as reading an environment variable set by the CI, and even then I prefer a small helper that throws a clear message.

**Full process:**
1. Compare the options:

```ts
const raw = process.env.BASE_URL;        // string | undefined

const unsafe: string = process.env.BASE_URL!;  // compiles, fails later if unset

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const safe = requireEnv('BASE_URL');     // string, with a clear failure
void raw; void unsafe; void safe;
```

2. A helper gives a precise error at the start of the run instead of `Cannot read properties of undefined` in the middle of a test.

**Follow-ups:**
- *Is `!` the same as `as string`?* Similar effect. `!` only removes null and undefined, `as` can assert another type only if it overlaps with the original, and `as unknown as T` forces any type.
- *Is there a lint rule?* Yes, `@typescript-eslint/no-non-null-assertion`. Playwright projects often turn it on.

**Trap:** using `!` on a locator result or `.find()` to silence the compiler, then getting a `TypeError` in CI.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#non-null-assertion-operator-postfix-

### What does `strict` mode turn on, and why use it?

Topic: ts-core | Standard | id: q0196

**Say:** `"strict": true` is a switch that turns on a family of checks: `strictNullChecks` (null and undefined are separate types), `noImplicitAny` (no silent `any`), `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `useUnknownInCatchVariables`, `alwaysStrict`, and `noImplicitThis`. It catches the most common bugs: reading a field of something that can be undefined, and untyped parameters. Since TypeScript 6.0 it is on by default, so a new project gets it without asking. For old suites I turn it on, then fix files gradually.

**Full process:**
1. A minimal strict `tsconfig.json` for a test project (the options are real, check the names against the tsconfig reference):

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["tests", "playwright.config.ts"]
}
```

2. Verify with `npx tsc --noEmit`. Zero output and exit code 0 means it passed.
3. `noUncheckedIndexedAccess` is not part of `strict`. It makes `array[0]` and record lookups include `undefined`, which catches off-by-one reads in tests.
4. To adopt strict in an old suite: turn it on, count the errors, fix by folder, and use `// @ts-expect-error` with a reason only for known leftovers.

**Follow-ups:**
- *What does `strictNullChecks` change in practice?* `string` no longer accepts `null` or `undefined`. A `Locator | undefined` must be checked before use.
- *What is `skipLibCheck`?* It skips type-checking `.d.ts` files in dependencies. It speeds up the run and hides errors in libraries you cannot fix.
- *`strictPropertyInitialization`?* A class property must be assigned in the constructor, or marked with `!` or `?`.

**Trap:** claiming strict is optional "because tests are not production". Tests that lie about types fail in confusing ways.

**Source:** https://www.typescriptlang.org/tsconfig/#strict

### Walk me through a tsconfig.json for a Playwright or Node test project.

Topic: ts-core | Standard | id: q0197

**Say:** I start from a small file. `target` and `lib` say which JavaScript features exist. `module` and `moduleResolution` say how imports resolve, and for a Node project that is `nodenext`, for a bundled app it is `bundler`. `strict` on. `include` lists what to check. `types` lists global typings, such as `node`. `paths` can alias imports, and Playwright honours it. `noEmit` because the tests run through Playwright, not through compiled output.

**Full process:**
1. Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node"],
    "paths": { "@pages/*": ["./tests/pages/*"] }
  },
  "include": ["tests/**/*.ts", "playwright.config.ts"]
}
```

2. With `paths`, `import { LoginPage } from '@pages/login'` works in Playwright, because it reads the tsconfig. Plain Node does not read `tsconfig.json`, so use Node subpath imports (`#...` in `package.json`) there.
3. Add a script `"typecheck": "tsc --noEmit -p tsconfig.json"` and run it in CI before the tests.
4. TypeScript 6.0 and 7.0 changed defaults and dropped old options (`moduleResolution: node10`, `baseUrl` as lookup root, `target: es5`, `outFile`). A config copied from an old blog may fail with a deprecation error. Fix the options. The temporary switch `ignoreDeprecations: "6.0"` works on 6.0 only.
5. With `nodenext`, relative imports in ESM files need a file extension (`./helpers.js` in the source, even though the file is `.ts`). Playwright handles the TypeScript extension for you at runtime, but `tsc` follows the Node rules.

**Follow-ups:**
- *What is `include` vs `files` vs `exclude`?* `include` is a glob list of files to check. `files` is an exact list. `exclude` removes from `include`.
- *Difference between `module` and `moduleResolution`?* `module` is the output format of imports. `moduleResolution` is how the compiler finds the file behind an import specifier.
- *What does `extends` do in tsconfig?* It inherits another config, so a monorepo keeps one base file.

**Trap:** adding `"types"` entries by trial and error. Since 6.0 the default is empty, so an omitted `node` entry makes `process` and `Buffer` disappear.

**Source:** https://www.typescriptlang.org/tsconfig/

### What is a declaration file (`.d.ts`) and what is `@types`?

Topic: ts-core | Standard | id: q0198

**Say:** A `.d.ts` file contains only types, no code. It describes the shape of JavaScript code that has no types of its own. `@types/node` and `@types/react` are packages of such files from DefinitelyTyped. Many libraries now ship their own types, so Playwright needs no `@types`. I write a small `.d.ts` when I need to say what a global looks like, for example a field my app adds to `window` that tests read.

**Full process:**
1. Install typings for a plain JavaScript package: `npm install -D @types/lodash`. The import then has types.
2. Add a global. Create `tests/globals.d.ts`:

```ts
export {};

declare global {
  interface Window {
    __appReady?: boolean;
  }
}
```

3. In a Playwright test, the page code runs in the browser, so typed access uses `page.evaluate`:

```ts
import type { Page } from '@playwright/test';

export async function isAppReady(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__appReady === true);
}
```

4. Make sure `tsconfig.json` `include` covers the `.d.ts`. A `.d.ts` outside `include` is ignored, and the error is "Property does not exist on type Window".

**Follow-ups:**
- *Who generates `.d.ts` files?* `tsc` with `declaration: true`, usually when you publish a library.
- *What if a package has no types at all?* `declare module 'name';` in a `.d.ts` makes every import `any`. Better to write the few signatures you use.

**Trap:** putting `declare global` in a file without any import or export. The file is then a script, not a module, and `declare global` is an error. Add `export {}`.

**Source:** https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html

### How do you type API responses in tests, and how do you keep the types honest?

Topic: ts-core | Standard | id: q0199

**Say:** I define an interface for the response next to the API helper, and the helper returns a promise of that type. I do not trust the type: the helper checks the status first, then parses, then validates the shape at runtime, because the compiler cannot see what the server really sent. For anything contract-like I use the OpenAPI schema or a JSON Schema check, so the type and the test come from the same source.

**Full process:**
1. A typed helper with the status check first:

```ts
import { request } from '@playwright/test';

interface Order { id: string; total: number; status: 'new' | 'paid' | 'shipped' }

function isOrder(value: unknown): value is Order {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.total === 'number' &&
    (o.status === 'new' || o.status === 'paid' || o.status === 'shipped')
  );
}

export async function getOrder(baseURL: string, id: string): Promise<Order> {
  const api = await request.newContext({ baseURL });
  try {
    const res = await api.get(`/orders/${id}`);
    if (!res.ok()) throw new Error(`GET /orders/${id} returned ${res.status()}`);
    const body: unknown = await res.json();
    if (!isOrder(body)) throw new Error(`GET /orders/${id} returned an unexpected shape`);
    return body;
  } finally {
    await api.dispose();
  }
}
```

2. The test then reads `order.status` with full typing and asserts the business rule, not the shape.
3. Mocked responses use the same type: `route.fulfill({ json: order satisfies Order })`, so a mock cannot drift from the real response type without a compile error.
4. For a big API, generate the types from the OpenAPI file with a generator, instead of writing them by hand, and keep the generated file out of reviews.

**Follow-ups:**
- *Why check `res.ok()` before `.json()`?* A 4xx or 5xx often returns HTML or an error body. Parsing first hides the real status.
- *Is a type guard enough as contract testing?* No. It checks shape, not the full contract, and only the fields you listed.

**Trap:** `const data = (await res.json()) as Order`. It compiles whatever the server sent.

**Source:** https://playwright.dev/docs/api-testing

### How would you type a page object?

Topic: ts-core | Standard | id: q0200

**Say:** A page object class takes `Page` in the constructor, keeps `Locator` fields readonly, and exposes methods for user actions that return `Promise<void>` or a next page object. Locators are created once from role and name. Assertions stay in the tests. TypeScript helps with the constructor parameter property, `readonly` locators, and return types, so a renamed method breaks every caller at compile time.

**Full process:**

```ts
import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly rows: Locator;
  readonly checkout: Locator;

  constructor(private readonly page: Page) {
    this.rows = page.getByRole('row').filter({ has: page.getByRole('cell') });
    this.checkout = page.getByRole('button', { name: 'Checkout', exact: true });
  }

  async open(): Promise<void> {
    await this.page.goto('/cart');
  }

  rowFor(product: string): Locator {
    return this.rows.filter({ hasText: product });
  }

  async remove(product: string): Promise<void> {
    await this.rowFor(product)
      .getByRole('button', { name: 'Remove', exact: true })
      .click();
  }
}
```

1. `private readonly page: Page` in the constructor declares and assigns the field in one line. It is a parameter property. Note: parameter properties are not erasable syntax, so plain Node type stripping rejects them. Playwright's own transform accepts them.
2. The test asserts: `await expect(cart.rowFor('Book')).toBeVisible();`. No `expect` inside the page object.
3. Return the `Locator` from `rowFor` and not an `ElementHandle`, so auto-waiting still works.

**Follow-ups:**
- *Why not return strings or booleans from the page object?* A `Locator` keeps auto-waiting and web-first assertions in the test.
- *Composition of page objects?* A page object can hold component objects (header, modal) as fields.

**Trap:** a page object method that includes `expect(...)` or `waitForTimeout`. It hides the test intent and mixes concerns.

**Source:** https://playwright.dev/docs/pom

### What is the difference between union and intersection types?

Topic: ts-core | Standard | id: q0201

**Say:** A union `A | B` means a value is either A or B, so I can use only what both share until I narrow. An intersection `A & B` means the value is both, so it has all properties of A and B. I use intersections to combine a base shape with extra fields, and unions for alternatives such as `'ok' | 'error'`.

**Full process:**

```ts
interface WithId { id: number }
interface WithName { name: string }

type Both = WithId & WithName;            // needs id and name
const x: Both = { id: 1, name: 'Ann' };

type Either = WithId | WithName;          // id or name (or both)
function show(e: Either): string {
  return 'id' in e ? String(e.id) : e.name;
}
```

**Follow-ups:**
- *What is `string & number`?* `never`, no value is both.

**Trap:** Reading `&` as "or" because it joins two types. An intersection means both, so `{ a: string } & { a: number }` has `a: never`. A union only lets you use the members all alternatives share until you narrow.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types

### What is structural typing? Why does an object with extra properties sometimes error?

Topic: ts-core | Standard | id: q0202

**Say:** TypeScript compares shapes, not names. If an object has the properties a type asks for, it fits, even if it was never declared as that type. The exception is a fresh object literal assigned directly to a typed target: TypeScript runs an excess property check and flags unknown keys, because that is usually a typo. The same object passed through a variable is accepted.

**Full process:**

```ts
interface Point { x: number; y: number }

const p3 = { x: 1, y: 2, z: 3 };
const ok: Point = p3;                       // fine, shape matches

// @ts-expect-error Object literal may only specify known properties
const err: Point = { x: 1, y: 2, z: 3 };    // excess property check on a fresh literal

class Meters { constructor(public value: number) {} }
class Seconds { constructor(public value: number) {} }
const m: Meters = new Seconds(5);            // allowed: same shape
void ok; void err; void m;
```

**Follow-ups:**
- *How to prevent mixing two number-like types?* A branded type: `type UserId = number & { readonly brand: 'UserId' }`.

**Trap:** Saying TypeScript is nominal, or that extra properties always error. The excess property check runs only on a fresh object literal assigned straight to a typed target. The same object passed through a variable is accepted.

**Source:** https://www.typescriptlang.org/docs/handbook/2/objects.html#excess-property-checks

### What is the difference between a type assertion (`as`) and a type annotation?

Topic: ts-core | Standard | id: q0203

**Say:** An annotation, `const x: User = value`, asks the compiler to check that the value fits. A type assertion, `value as User`, tells the compiler to trust me. It removes the check. It is allowed when the types overlap enough, and `as unknown as User` is the "force anything" form, which I treat as a code smell. I use assertions only where I know something the compiler cannot, and I prefer a type guard.

**Full process:**

```ts
interface User { id: number; name: string }

const fromJson = JSON.parse('{"id":"x"}') as User; // compiles, wrong at runtime
const annotated: User = { id: 1, name: 'Ann' };     // checked

// double assertion: defeats the type system
const forced = 'text' as unknown as number;
void fromJson; void annotated; void forced;
```

**Follow-ups:**
- *Is `as const` an assertion?* It uses the same syntax but is a different, safe feature.

**Trap:** Believing `as` converts or validates the value. It only changes what the compiler thinks, so `JSON.parse(text) as User` compiles and is still wrong when the data is. For data from outside, use a runtime check or a schema.

**Source:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions

### What is `readonly` and what does `Readonly<T>` do?

Topic: ts-core | Standard | id: q0204

**Say:** `readonly` on a property stops assignment in the type system. `Readonly<T>` applies it to every top-level property, and `readonly string[]` stops array mutation such as `push`. It documents "do not change this", for example shared test data. It does not freeze the object at runtime.

**Full process:**

```ts
interface Config { readonly baseUrl: string; timeout: number }
const c: Config = { baseUrl: 'https://example.test', timeout: 5000 };
// @ts-expect-error cannot assign to a read-only property
c.baseUrl = 'x';

const roles: readonly string[] = ['admin'];
// @ts-expect-error push does not exist on a readonly array
roles.push('guest');
```

**Follow-ups:**
- *Does `const` do the same?* `const` stops reassigning the variable, not changing the object inside.

**Trap:** Treating `readonly` as a runtime guarantee or as deep. `Readonly<T>` is shallow, so `Readonly<{ tags: string[] }>` still lets you `push` into `tags`. `as const` makes a literal deeply readonly in the type, and `Object.freeze` is shallow at run time.

**Source:** https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties

### How do you type functions: optional and default parameters, rest, overloads?

Topic: ts-core | Standard | id: q0205

**Say:** A parameter ending with `?` is optional and its type includes `undefined`. A default value makes it optional too. Rest parameters (`...args: string[]`) collect the remainder. Overloads give several call signatures over one implementation, and I use them rarely, mostly to read library typings. Always type the return value of exported helper functions, so a refactor cannot change the public type by accident.

**Full process:**

```ts
function waitFor(label: string, timeoutMs = 5000, verbose?: boolean): string {
  return `${label}:${timeoutMs}:${verbose ?? false}`;
}

function joinAll(sep: string, ...parts: string[]): string {
  return parts.join(sep);
}

function parse(value: string): number;
function parse(value: number): string;
function parse(value: string | number): number | string {
  return typeof value === 'string' ? Number(value) : String(value);
}

const n = parse('42'); // number
const s = parse(42);   // string
void waitFor; void joinAll; void n; void s;
```

**Follow-ups:**
- *Function type as a parameter?* `(row: Row) => boolean` for a predicate, written inline or as a `type`.

**Trap:** Putting a required parameter after an optional (`?`) one: that is a compile error. Another wrong belief is that the implementation signature of an overload is callable. Callers see only the overload signatures above it.

**Source:** https://www.typescriptlang.org/docs/handbook/2/functions.html

### How do tuples and index signatures work, and what is `noUncheckedIndexedAccess`?

Topic: ts-core | Standard | id: q0206

**Say:** A tuple is an array with a fixed length and a type per position, like `[number, string]`. An index signature, `{ [key: string]: number }`, says an object can have any string key. By default, reading `rows[0]` is typed as the item, even when the array is empty. The option `noUncheckedIndexedAccess` adds `undefined` to such reads, which forces a check and finds real bugs in tests.

**Full process:**

```ts
const pair: [number, string] = [1, 'a'];
const [num, text] = pair;

const prices: { [sku: string]: number } = { a: 10 };
const priceOfB = prices['b']; // type number by default, number | undefined with noUncheckedIndexedAccess

function firstTitle(titles: string[]): string {
  const t = titles[0];
  return t === undefined ? 'none' : t; // required when noUncheckedIndexedAccess is on
}
void num; void text; void priceOfB; void firstTitle;
```

**Follow-ups:**
- *`Record<string, number>` vs index signature?* Practically the same type.

**Trap:** Assuming `rows[0]` is typed `T | undefined` already. Without `noUncheckedIndexedAccess` it is typed `T`, so a read of an empty array compiles and fails at run time.

**Source:** https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess

### What are type-only imports, and does Node run TypeScript directly?

Topic: ts-core | Standard | id: q0207

**Say:** `import type { Page } from '@playwright/test'` imports only a type, so it disappears when compiled. In the setups where each file is transformed alone (Node type stripping, esbuild, Babel), TypeScript cannot always tell a type from a value, so a type import must be marked with `type`. Node 22.18 and later strip types by default. That works for erasable syntax only, so no enums and no parameter properties, and it does not type-check, so `tsc --noEmit` is still needed.

**Full process:**
1. Check your Node: `node -v`. Create `hello.ts` with `const x: number = 1; console.log(x);` and run `node hello.ts`. No compile step.
2. Set `"erasableSyntaxOnly": true` in `tsconfig.json` so `tsc` flags enums, namespaces with code, and parameter properties.
3. Imports need the real file extension in Node: `import { a } from './a.ts'`. Add `"allowImportingTsExtensions": true` for `tsc` to accept it with `noEmit`.
4. Mixed import: `import { fn, type FnParams } from './fn.ts'`.
5. Node does not read `tsconfig.json`, so `paths` aliases do not work. Use subpath imports with `#`.

**Follow-ups:**
- *Does Playwright need any of this?* No, it has its own transform. It matters for small scripts and for tools run directly with Node.

**Trap:** Saying "Node runs TypeScript, so I do not need `tsc`". Node removes the types without checking them, so a type error still runs. Keep `tsc --noEmit` in CI.

**Source:** https://nodejs.org/api/typescript.html

### What are template literal types and `Record`-based lookups, at a reading level?

Topic: ts-core | Standard | id: q0208

**Say:** A template literal type builds string types from other strings, like `` `get${Capitalize<Key>}` ``. I read them in library typings, for example event name types. In test code I might see `` `/api/${string}` `` to say "any path under /api".

**Full process:**

```ts
type Method = 'get' | 'post';
type Endpoint = `/api/${string}`;
type Handler = `on${Capitalize<Method>}`; // 'onGet' | 'onPost'

const url: Endpoint = '/api/users';
// @ts-expect-error missing /api/ prefix
const bad: Endpoint = '/users';
void url; void bad;
```

**Follow-ups:**
- *What are `Uppercase`, `Lowercase`, `Capitalize` and `Uncapitalize`?* Built-in string types that change the case of a string literal type: `Capitalize<'get'>` is `'Get'`.
- *Why is `Record<Status, string>` useful?* The object must have a key for every member of the union, so adding a new status without a label fails to compile.

**Trap:** Treating a template literal type as a run-time check. It exists only at compile time, and a value typed as plain `string` is not assignable to `` `/api/${string}` ``.

**Source:** https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html

### How do you extend a third-party type, for example add a custom `expect` matcher in Playwright?

Topic: ts-core | Standard | id: q0209

**Say:** I use `expect.extend` to register the matcher and declaration merging to tell the types about it. Playwright documents a pattern with `mergeTests` and `expect.extend` that returns a new typed `expect`, so matchers stay typed without global augmentation. If you have read this pattern but have not written many custom matchers, say so. A strict rule: assertions in tests are the standard web-first ones, and I add a custom matcher only when a repeated check deserves a name.

**Full process:**
1. In `fixtures.ts` create a typed `expect`:

```ts
import { expect as baseExpect, type Locator } from '@playwright/test';

export const expect = baseExpect.extend({
  async toHaveAmount(locator: Locator, expected: number) {
    const text = (await locator.textContent()) ?? '';
    const actual = Number(text.replace(/[^0-9.]/g, ''));
    return {
      pass: actual === expected,
      message: () => `expected amount ${expected}, got ${actual}`,
      name: 'toHaveAmount',
      expected,
      actual,
    };
  },
});
```

2. Import `expect` from this file in specs. `await expect(locator).toHaveAmount(10)` then type-checks.
3. Note this one reads the text once, so it does not auto-retry. Use `expect.poll` or build the check from web-first assertions when the value changes over time.

**Follow-ups:**
- *Why not write a plain helper function?* A matcher fits into `expect` chains and failure output.

**Trap:** Calling the new matcher through `(expect as any)` or importing the base `expect` in a test. The cast compiles but loses all typing. The base `expect` does not have the matcher at all, so import the extended `expect` from your fixtures file.

**Source:** https://playwright.dev/docs/test-assertions#add-custom-matchers-using-expectextend

### What are generics used for in a test data builder or factory?

Topic: ts-core | Standard | id: q0210

**Say:** A generic factory builds a default object and applies overrides, so the same function type-checks for any model. The overrides are `Partial<T>`, so the caller can set only what matters. The result is the full type `T`.

**Full process:**

```ts
function factory<T>(defaults: T) {
  return (overrides: Partial<T> = {}): T => ({ ...defaults, ...overrides });
}

interface User { id: number; email: string; role: 'admin' | 'member' }
interface Product { sku: string; price: number }

const buildUser = factory<User>({ id: 1, email: 'ann@example.test', role: 'member' });
const buildProduct = factory<Product>({ sku: 'SKU-1', price: 10 });

const admin = buildUser({ role: 'admin' });
const cheap = buildProduct({ price: 1 });
void admin; void cheap;
```

Add variation: random or counter-based values in `defaults` keep tests from sharing one sample.

**Follow-ups:**
- *Builder pattern vs factory function?* The function above covers most needs. A builder class fits when steps depend on each other (see the builder entry in the OOP section).

**Trap:** Believing `{ ...defaults, ...overrides }` is a full copy. It is shallow, so nested objects from `defaults` are shared between every result, and a test that changes one nested field changes the next test's data. Build nested defaults inside a function so each call creates new ones.

**Source:** https://www.typescriptlang.org/docs/handbook/2/generics.html

### What is an indexed access type, `T['key']`?

Topic: ts-core | Standard | id: q0211

**Say:** It reads the type of one property of another type, like reading a field but in the type world. `User['email']` is `string`. With a union of keys it gives a union of types, and `T[number]` gives the item type of an array type. I use it so a helper's parameter follows the model: if the field type changes, the helper changes with it.

**Full process:**

```ts
interface User { id: number; email: string; role: 'admin' | 'member' }

type Email = User['email'];                 // string
type IdOrEmail = User['id' | 'email'];      // number | string
type Role = User['role'];                   // 'admin' | 'member'

const users = [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }];
type Row = (typeof users)[number];          // { id: number; name: string }

function setRole(role: User['role']): string { return role; }
void setRole;
```

`typeof users` gives the array type, then `[number]` means "the type you get when you index it with a number".

**Follow-ups:**
- *Where does the `T[K]` of the constraint entry come from?* It is this feature, with `K` as a type parameter.

**Trap:** Treating it as a run-time lookup. It exists only in the type world and reads no value. An optional property gives a type with `undefined`, so `T['email']` for `email?: string` is `string | undefined`.

**Source:** https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html

### How do you type a mocked API response with `page.route()` so it matches the real API?

Topic: ts-core | Standard | id: q0212

**Say:** I reuse the same interface that the API helper returns, and I check the mock object against it with `satisfies`. Then if the real response type changes, the mock stops compiling instead of silently testing a response the server no longer sends. The mock is data typed by the contract, not a loose object literal.

**Full process:**

```ts
import { test, expect } from '@playwright/test';

interface Todo { id: number; title: string; done: boolean }

test('shows todos from a mocked API', async ({ page }) => {
  const todos = [
    { id: 1, title: 'write tests', done: false },
    { id: 2, title: 'review MR', done: true },
  ] satisfies Todo[];

  await page.route('**/api/todos', (route) => route.fulfill({ json: todos }));
  await page.goto('/todos');
  await expect(page.getByRole('listitem')).toHaveCount(todos.length);
});
```

1. Register the route before the action that triggers the request, here before `goto`.
2. `route.fulfill({ json })` sets the body, serialises it and adds a JSON content type.
3. `satisfies Todo[]` keeps the literal types of the mock while checking it against the interface.
4. A mock does not prove the real API sends this shape. A contract or API test does.

**Follow-ups:**
- *Why not `as Todo[]`?* It would accept a mock with a missing field, such as `[{ id: 1 }] as Todo[]`. `satisfies` rejects it.

**Trap:** Thinking a typed mock proves the real API matches. It proves the mock matches your interface. If a person wrote the interface by hand, it can drift from the server, so generate it from the OpenAPI spec or check the real response in an API test.

**Source:** https://playwright.dev/docs/mock

### What does `typeof` return at runtime in JavaScript, and what is its odd case?

Topic: ts-core | Standard | id: q0213

**Say:** At runtime `typeof x` returns a string: `'string'`, `'number'`, `'boolean'`, `'undefined'`, `'object'`, `'function'`, `'symbol'` or `'bigint'`. The odd cases: `typeof null` is `'object'`, which is an old bug kept for compatibility, and arrays are `'object'` as well, so I use `Array.isArray`. TypeScript uses the same `typeof` check for narrowing, so the two meet: `if (typeof x === 'string')` is real JavaScript that the compiler also understands.

**Full process:**

```ts
function kind(x: unknown): string {
  if (x === null) return 'null';             // check null first
  if (Array.isArray(x)) return 'array';
  return typeof x;
}

console.log(kind(null));       // null
console.log(kind([1]));        // array
console.log(kind(() => 1));    // function
console.log(kind(undefined));  // undefined
console.log(typeof NaN);       // number
```

**Follow-ups:**
- *Does `typeof undeclaredVariable` throw?* No, it returns `'undefined'`. A plain read of an undeclared variable throws a `ReferenceError`.

**Trap:** `typeof null === 'object'` used as a null check. It matches both objects and null.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof

### How do you handle errors in TypeScript, and what type is `e` in `catch (e)`?

Topic: ts-core | Standard | id: q0214

**Say:** Under `strict`, the caught value is `unknown`, because anything can be thrown in JavaScript. I narrow it, usually with `e instanceof Error`, before reading `.message`. In tests I let errors fail the test with a clear message instead of swallowing them. I never wrap an assertion in try/catch to make it pass.

**Full process:**

```ts
function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function tryOnce(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {            // e: unknown under strict
    return message(e);
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
void tryOnce; void HttpError;
```

A custom error with a `status` field lets a test helper throw something specific that callers can narrow with `instanceof HttpError`.

**Follow-ups:**
- *Can you annotate `catch (e: Error)`?* No, only `unknown` or `any`. Narrow inside.

**Trap:** Casting `(e as Error).message`. Anything can be thrown, so a thrown string or object gives `undefined` there and hides the real problem. Narrow with `instanceof Error` first.

**Source:** https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables

### How would you migrate a JavaScript test suite to TypeScript?

Topic: ts-core | Standard | id: q0215

**Say:** In small steps that keep the suite green. First rename config and helpers, add a `tsconfig.json` with `allowJs` and `checkJs` off, and add the `tsc --noEmit` step to CI. Then convert files one folder at a time, starting with the shared helpers and page objects, because their types help every test. Keep `strict` off at first and turn it on when the error count is small, or turn it on and fix by folder. Avoid a big-bang rename, because review of hundreds of files finds nothing.

**Full process:**
1. Install: `npm install -D typescript @types/node`. Playwright already reads `.ts` files with no extra loader.
2. `tsconfig.json` with `"allowJs": true`, `"noEmit": true`, `"strict": false` to begin.
3. Rename `helpers/*.js` to `.ts`, fix only the errors, do not redesign anything in the same merge request.
4. Replace `any` created by the first pass with real types, using `unknown` and guards for API data.
5. Turn `strict` on, folder by folder with a separate config extending the base, then merge into one.
6. Add the CI step `npx tsc --noEmit`, and lint rules for floating promises.

**Follow-ups:**
- *What do you measure?* The count of type errors and of `any` usages, going down. A visible number keeps the migration honest.

**Trap:** converting everything in one huge merge request. Large mechanical changes are skimmed, so real mistakes hide inside.

**Source:** https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html

## JavaScript (js-core)

### What is the difference between `var`, `let` and `const`?

Topic: js-core | Core | id: q0216

**Say:** `var` is function-scoped, is hoisted and initialised as `undefined`, and can be redeclared, which makes bugs. `let` and `const` are block-scoped, are hoisted but sit in a temporal dead zone until their line runs, and cannot be redeclared in the same scope. `const` forbids reassigning the variable, but the object it points to can still change. I use `const` by default, `let` when I must reassign, and never `var`.

**Full process:**
1. The loop that shows the scope difference. Run it with `node file.ts`:

```ts
const withVar: Array<() => number> = [];
for (var i = 0; i < 3; i++) withVar.push(() => i);
console.log(withVar.map((f) => f())); // [3, 3, 3]: one shared i

const withLet: Array<() => number> = [];
for (let j = 0; j < 3; j++) withLet.push(() => j);
console.log(withLet.map((f) => f())); // [0, 1, 2]: a new j per iteration
```

2. `const` does not make things immutable:

```ts
const list = [1, 2];
list.push(3);            // fine, the array changed
// @ts-expect-error cannot reassign a const
list = [];
```

3. A `var` declared in an `if` block is visible outside it. A `let` is not.

**Follow-ups:**
- *What is the temporal dead zone?* The span between the start of the scope and the line where a `let` or `const` is declared. Reading it throws `ReferenceError`, unlike `var`, which reads `undefined`.
- *Can you declare `const` without a value?* No, it needs an initialiser.
- *Which do you use in test code?* `const` nearly everywhere, `let` for a value assigned in `beforeEach` and read in tests.

**Trap:** "const makes the value constant". It makes the binding constant.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let

### What is hoisting?

Topic: js-core | Core | id: q0217

**Say:** Before running, JavaScript registers declarations in their scope, so they exist before their line is reached. Function declarations are hoisted completely, so I can call them above the definition. `var` is hoisted as `undefined`. `let`, `const` and `class` are hoisted but not usable until their line runs, and touching them early throws. Function expressions and arrow functions assigned to a variable follow the variable rule.

**Full process:**

```ts
console.log(add(1, 2)); // 3: declaration hoisted with its body
function add(a: number, b: number): number { return a + b; }

// @ts-expect-error used before its declaration
console.log(sub(5, 1)); // ReferenceError at runtime
const sub = (a: number, b: number): number => a - b;
```

Run it and the second line throws `ReferenceError: Cannot access 'sub' before initialization`.

**Follow-ups:**
- *Does hoisting move code to the top?* No. The engine records the names during the creation phase. The code stays where it is.

**Trap:** Saying `let` and `const` are not hoisted. They are hoisted but stay in the temporal dead zone until the line runs. That is why the error says "Cannot access before initialization" and not "is not defined".

**Source:** https://developer.mozilla.org/en-US/docs/Glossary/Hoisting

### What is a closure? Where do you see it in test code?

Topic: js-core | Core | id: q0218

**Say:** A closure is a function that remembers the variables of the scope where it was created, even after that scope has finished. A counter factory is the classic example: the inner function keeps `count` alive. In test code it appears all the time: a callback passed to `page.route` that uses a variable from the test, a helper that returns a function with a configured base URL, a `test.step` body using test variables, and a loop that creates one test per case.

**Full process:**

```ts
function makeCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

const a = makeCounter();
const b = makeCounter();
console.log(a(), a(), b()); // 1 2 1: each closure has its own count
```

A test-code version, counting requests that a mock saw:

```ts
import { test, expect } from '@playwright/test';

test('the page calls the API once', async ({ page }) => {
  let calls = 0;                      // captured by the route callback
  await page.route('**/api/items', async (route) => {
    calls += 1;
    await route.fulfill({ json: [] });
  });
  await page.goto('/items');
  await expect.poll(() => calls).toBe(1);
});
```

**Follow-ups:**
- *What goes wrong with closures in loops?* With `var` all callbacks share one variable (see the var entry). With `let` each iteration has its own.
- *Memory?* A closure keeps its captured variables alive, so a long-lived callback that captures a big object keeps it from garbage collection.

**Trap:** describing a closure as "a function inside a function". The key is that it keeps access to the outer variables after the outer function returned.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures

### How does `this` work in JavaScript?

Topic: js-core | Core | id: q0219

**Say:** `this` is decided by how a function is called, not where it is written. A method call `obj.method()` sets `this` to `obj`. A plain call has `this` as `undefined` in strict code (modules and classes). `call`, `apply` and `bind` set it by hand, and `new` makes a fresh object. Arrow functions have no `this` of their own, they use the one from the surrounding code. The common bug is passing a method as a callback, which loses `this`.

**Full process:**

```ts
class Counter {
  count = 0;
  inc(): number { this.count += 1; return this.count; }
  incArrow = (): number => { this.count += 1; return this.count; };
}

const c = new Counter();
console.log(c.inc());              // 1: called as a method

const detached = c.inc;
try {
  detached();                      // this is undefined here
} catch (e) {
  console.log(e instanceof TypeError); // true
}

const bound = c.inc.bind(c);
console.log(bound());              // 2
const arrow = c.incArrow;
console.log(arrow());              // 3: the arrow keeps this from the instance
```

**Follow-ups:**
- *What does `this` equal at the top of an ES module?* `undefined`. In a CommonJS file it is `module.exports`.
- *Where does this bite in tests?* Passing `page.goto` or `locator.click` as a bare callback, or a class method used as a handler.

**Trap:** "this is the object the function is defined in". A regular function gets `this` from how it is called. An arrow function takes `this` from the enclosing scope, which is not the object that holds it.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this

### Arrow functions vs regular functions: what are the differences?

Topic: js-core | Core | id: q0220

**Say:** An arrow function has shorter syntax, takes `this` and `arguments` from the outer scope, cannot be used with `new`, and has no `prototype`. I use arrows for callbacks and short helpers, and regular functions or class methods where `this` or hoisting matters. Arrow functions also have an implicit return when the body is a single expression, and returning an object literal needs parentheses.

**Full process:**

```ts
const double = (n: number): number => n * 2;               // implicit return
const makeUser = (name: string) => ({ name, active: true }); // object literal in parentheses
const noReturn = (n: number) => { n * 2; };                // braces: returns undefined

console.log(double(2), makeUser('Ann'), noReturn(3)); // 4 { name: 'Ann', active: true } undefined
```

**Follow-ups:**
- *Can an arrow be a constructor?* No. `new (() => {})` throws a `TypeError`.
- *Why prefer a named function for a long test helper?* The name shows in stack traces.

**Trap:** Using an arrow function as an object method and expecting `this` to be the object. In `{ name: 'a', hi: () => this.name }` the arrow takes `this` from the surrounding scope, not from the object.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions

### What is the prototype chain? Is JavaScript class-based?

Topic: js-core | Standard | id: q0221

**Say:** Every object has a hidden link to another object, its prototype. When I read a property, JavaScript looks on the object, then on its prototype, then up the chain until `null`. This is how methods are shared. The `class` keyword is syntax on top of this: `Dog extends Animal` links `Dog.prototype` to `Animal.prototype`. So JavaScript is prototype-based, and classes are a cleaner way to write the same thing.

**Full process:**

```ts
class Animal { speak(): string { return 'noise'; } }
class Dog extends Animal { fetch(): string { return 'ball'; } }

const d = new Dog();
console.log(d.speak());                                              // noise: found on Animal.prototype
console.log(Object.getPrototypeOf(d) === Dog.prototype);             // true
console.log(Object.getPrototypeOf(Dog.prototype) === Animal.prototype); // true
console.log(d instanceof Animal);                                    // true
console.log(Object.hasOwn(d, 'speak'));                              // false: not an own property

const base = { greet: () => 'hi' };
const child: { greet: () => string } = Object.create(base);
console.log(child.greet());                                          // hi, via the prototype
```

**Follow-ups:**
- *`__proto__` vs `prototype`?* `prototype` is a property on constructor functions and classes. `__proto__` (or `Object.getPrototypeOf`) is the link on an instance.
- *What is `instanceof` checking?* Whether the constructor's `prototype` appears in the object's chain.

**Trap:** "classes in JavaScript work like classes in Java". They are syntax over prototypes, with no separate class object model.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain

### Which array methods do you use daily, and which ones mutate?

Topic: js-core | Standard | id: q0222

**Say:** `map` transforms every item, `filter` keeps some, `find` returns the first match, `some` and `every` return a boolean, `reduce` folds to one value, `flatMap` maps and flattens, `includes` checks membership. `map`, `filter`, `slice` and `concat` return new arrays. `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` change the array in place. `toSorted`, `toReversed` and `toSpliced` are the non-mutating versions. In tests I use them to shape data, for example to extract all texts from a list of locators.

**Full process:**

```ts
const prices = [30, 10, 20];

const doubled = prices.map((p) => p * 2);               // [60, 20, 40]
const expensive = prices.filter((p) => p > 15);         // [30, 20]
const firstBig = prices.find((p) => p > 15);            // 30 (number | undefined)
const total = prices.reduce((sum, p) => sum + p, 0);    // 60
const anyFree = prices.some((p) => p === 0);            // false
const allPaid = prices.every((p) => p > 0);             // true
const sortedCopy = prices.toSorted((a, b) => a - b);    // [10, 20, 30], prices unchanged
console.log(doubled, expensive, firstBig, total, anyFree, allPaid, sortedCopy, prices);

console.log([10, 9, 1].sort());                         // [1, 10, 9]: default sort compares strings
```

In Playwright, `await locator.allTextContents()` returns `string[]`, then compare with `expect(texts).toEqual([...])`.

**Follow-ups:**
- *`find` vs `filter()[0]`?* `find` stops at the first match and says so. `find` is typed `T | undefined`. `filter()[0]` is typed `T` unless `noUncheckedIndexedAccess` is on, so an empty result compiles and gives `undefined` at run time.
- *`reduce` without an initial value?* It uses the first item as the start, and throws on an empty array.
- *`for...of` vs `forEach`?* `for...of` works with `await`, `break` and `continue`. `forEach` does not wait for async callbacks (see the async section).

**Trap:** `[10, 9, 1].sort()` without a comparator. It sorts as strings.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

### What are destructuring, spread and rest?

Topic: js-core | Standard | id: q0223

**Say:** Destructuring unpacks values from an array or object into variables: `const { id, name } = user`. Spread, `...x`, copies the items of an array or the properties of an object into a new one. Rest uses the same `...` in a parameter list or destructuring to collect the remainder. Spread and the object copy are shallow. Nested objects are still shared.

**Full process:**

```ts
const user = { id: 1, name: 'Ann', address: { city: 'Warsaw' } };

const { id, name: userName, role = 'member', ...rest } = user as typeof user & { role?: string };
console.log(id, userName, role, rest);   // 1 Ann member { address: { city: 'Warsaw' } }

const [first, , third = 0] = [10, 20];
console.log(first, third);               // 10 0

const copy = { ...user, name: 'Bob' };   // new object, override a field
console.log(copy.address === user.address); // true: shallow copy

function sum(...nums: number[]): number { return nums.reduce((s, n) => s + n, 0); }
console.log(sum(...[1, 2, 3]));          // 6
```

**Follow-ups:**
- *Deep copy?* `structuredClone(obj)` in Node 17 and later and in browsers. It throws a `DataCloneError` on a function.
- *Why does it matter in tests?* A test that mutates shared data (`defaults.items.push`) breaks the next test. Copy before change.

**Trap:** Believing a default in destructuring covers `null`. `const { role = 'member' } = user` applies only when the value is `undefined`, so `null` stays `null`. Also, spread is a shallow copy, and with `{ ...a, ...b }` the later object wins.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring

### What is the difference between `==` and `===`? What is truthy and falsy?

Topic: js-core | Standard | id: q0224

**Say:** `===` compares value and type with no conversion. `==` converts types first, with surprising results, so I use `===` always. The one accepted use of `==` is `x == null`, which matches both `null` and `undefined`. The falsy values are `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined` and `NaN`. Everything else is truthy, including `'0'`, `'false'`, `[]` and `{}`. `NaN` is not equal to itself, so I use `Number.isNaN`.

**Full process:**

```ts
console.log(0 === (false as unknown));     // false
console.log(0 == (false as unknown));      // true: conversion
console.log('' == (0 as unknown));         // true
console.log(null == (undefined as unknown)); // true
console.log(null === undefined);           // false
const notANumber = Number('x');
console.log(notANumber === notANumber);    // false
console.log(Number.isNaN(NaN));            // true
console.log(Object.is(NaN, NaN));          // true
const emptyList: unknown[] = [];
console.log(emptyList ? 'truthy' : 'falsy'); // truthy
console.log(0.1 + 0.2 === 0.3);            // false: floating point
console.log(Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON); // true
```

**Follow-ups:**
- *`null` vs `undefined`?* `undefined` means "not assigned". `null` means "intentionally empty". JSON has `null` but no `undefined`.
- *Where does truthiness hurt in tests?* `expect(count).toBeTruthy()` passes for 5 when you meant 1, and fails for a legitimate 0. Use the exact matcher.

**Trap:** `if (value)` to check "has a value" for numbers and strings, where `0` and `''` are valid.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness

### ESM vs CommonJS: what is the difference and how does Node decide?

Topic: js-core | Standard | id: q0225

**Say:** CommonJS uses `require` and `module.exports`, loads synchronously, and has `__dirname`. ES modules use `import` and `export`, are the language standard, are statically analysed, allow top-level `await`, and have no `require` or `__dirname`. Node treats a `.js` file as ESM when the nearest `package.json` has `"type": "module"`, or the file is `.mjs`. `.cjs` is always CommonJS. In ESM, relative imports need the file extension. Playwright works with both, and TypeScript settings must match what Node will do.

**Full process:**
1. ESM file `paths.ts` (with `"type": "module"` in `package.json`):

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const here = import.meta.dirname;                  // replaces __dirname (Node 20.11+/21.2+)
const file = path.join(here, 'data.json');
const text = await readFile(file, 'utf8');         // top-level await works in ESM
console.log(text.length);
```

2. The same idea in CommonJS: `const path = require('node:path'); const file = path.join(__dirname, 'data.json');`.
3. Mixed projects: `import()` loads ESM from CommonJS (it returns a promise). Recent Node versions can also `require()` a synchronous ES module.
4. JSON in ESM needs an import attribute: `import data from './data.json' with { type: 'json' }`.
5. In `tsconfig.json` choose `module: "nodenext"` for Node code, so TypeScript follows the same rules.

**Follow-ups:**
- *Why does `ERR_REQUIRE_ESM` or "Cannot use import statement outside a module" happen?* They are different errors. `ERR_REQUIRE_ESM` means CommonJS code called `require()` on an ES module (Node 22.12 and later allow that for modules without top-level `await`). "Cannot use import statement outside a module" means Node treated the file as CommonJS but it contains `import` (newer Node detects the syntax and runs it as a module). Add `"type": "module"` or rename the file to `.mjs`.
- *Default vs named exports in tests?* Named exports refactor better: the import name cannot drift.

**Trap:** forgetting `.js` or `.ts` extensions on relative ESM imports under `nodenext`.

**Source:** https://nodejs.org/api/esm.html

### What is Node.js, and which parts do you use for test automation?

Topic: js-core | Standard | id: q0226

**Say:** Node.js is a JavaScript runtime outside the browser, built on V8, with an event loop and APIs for files, network, processes and timers. For test automation I use it as the runner for Playwright, for scripts that prepare data, and for CLIs. I use `process.env` for configuration, `node:fs/promises` and `node:path` for files, `fetch` (built into Node) for quick API calls, and `node --test` for small unit tests. Node is single-threaded for JavaScript, with the work of I/O handled by the system and a thread pool.

**Full process:**
1. A small script `seed.ts` that reads config from the environment, calls an API and writes a file:

```ts
import { writeFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const res = await fetch(`${baseUrl}/api/health`);
  if (!res.ok) throw new Error(`health check failed with ${res.status}`);
  const body: unknown = await res.json();
  await writeFile('health.json', JSON.stringify(body, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;       // a failing script must fail CI
});
```

2. Run: `BASE_URL=https://staging.example.test node seed.ts` on a Node version with type stripping, or via `npx tsx seed.ts`.
3. The exit code is what CI sees. `process.exitCode = 1` sets it without cutting pending output.

**Follow-ups:**
- *Is Node multi-threaded?* The JavaScript runs on one thread. Worker threads and child processes exist for CPU-heavy work. Playwright runs tests in separate worker processes.
- *Built-in test runner?* `node --test` with `node:test` and `node:assert`. Fine for small utilities.

**Trap:** Calling Node a language or a framework, or saying async code runs in parallel on many threads. JavaScript runs on one thread, so a long synchronous loop blocks everything, including timers.

**Source:** https://nodejs.org/en/learn/getting-started/introduction-to-nodejs

### What do npm scripts and the lockfile do? What is the difference between `npm install` and `npm ci`?

Topic: js-core | Standard | id: q0227

**Say:** npm scripts are named commands in `package.json`, run with `npm run name`, and `test` and `start` also work without `run`. The lockfile, `package-lock.json`, records the exact version of every dependency, so every machine and CI run installs the same tree. `npm install` can update the lockfile. `npm ci` deletes `node_modules`, installs exactly what the lockfile says, and fails if `package.json` and the lockfile disagree. CI should use `npm ci`.

**Full process:**
1. `package.json` scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "pretest": "npm run typecheck"
  }
}
```

2. `npm test` runs `pretest` first, then `test`. Pass extra arguments after `--`: `npm test -- --project=chromium`.
3. Version ranges: `^1.4.2` allows minor and patch updates, `~1.4.2` allows patch only, `1.4.2` is exact. The lockfile freezes the actual choice.
4. CI: `npm ci`, then the test command. Commit the lockfile. Do not edit it by hand.
5. `devDependencies` are for tools like Playwright and TypeScript. `npm ci --omit=dev` skips them.

**Follow-ups:**
- *Why do two machines get different results without a lockfile?* A range such as `^1.4.2` resolves to the newest matching version at install time.
- *Lockfile conflict in a merge request?* Take the target branch's file and rerun `npm install`. Do not merge it by hand.

**Trap:** using `npm install` in CI, which can change the lockfile and hide drift.

**Source:** https://docs.npmjs.com/cli/v11/commands/npm-ci and https://docs.npmjs.com/cli/v11/using-npm/scripts

### How do you copy objects and arrays safely? What is a shallow vs deep copy?

Topic: js-core | Standard | id: q0228

**Say:** Objects and arrays are assigned by reference, so `b = a` makes two names for one object. Spread and `Object.assign` make a shallow copy: the top level is new, nested objects are shared. `structuredClone` makes a deep copy, but it cannot copy functions. In tests this matters for shared fixtures: if one test mutates the shared default data, the next test starts from changed data and fails for a reason that looks like flakiness.

**Full process:**

```ts
const defaults = { name: 'Ann', tags: ['a'] };

const same = defaults;
same.name = 'Bob';
console.log(defaults.name);        // Bob: same object

const shallow = { ...defaults };
shallow.tags.push('b');
console.log(defaults.tags);        // ['a', 'b']: nested array shared

const deep = structuredClone(defaults);
deep.tags.push('c');
console.log(defaults.tags);        // ['a', 'b']: unchanged by the deep copy
```

A safe pattern for test data is a function that returns a new object on each call, not a shared constant.

**Follow-ups:**
- *JSON round trip as a deep copy?* It loses `undefined`, functions and dates as dates. Prefer `structuredClone`.
- *`Object.freeze`?* Shallow too. It stops top-level writes only.

**Trap:** Calling `{ ...a }`, `slice()` or `Object.assign` a deep copy. Also, `structuredClone` returns plain objects, so a class instance loses its prototype and its methods.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone

### What are common number, string and date traps in JavaScript tests?

Topic: js-core | Standard | id: q0229

**Say:** Floating point: `0.1 + 0.2` is not `0.3`. `parseInt('08abc')` gives `8`, and `Number('08abc')` gives `NaN`. Dates are the worst: `new Date('2026-03-29')` is parsed as UTC, local getters use the machine's time zone, and daylight saving shifts make a day 23 or 25 hours long. Number formatting depends on the locale, so I build the expected text with `Intl.NumberFormat` and do not type it by hand.

**Full process:**

```ts
console.log(0.1 + 0.2);                     // 0.30000000000000004
console.log(parseInt('08abc', 10));         // 8
console.log(Number('08abc'));               // NaN
console.log(typeof (1234.5).toFixed(0));    // string: toFixed returns text

const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
console.log(money.format(12500));           // the group separator is a non-breaking space

const start = new Date('2026-03-28T00:00:00Z');
const next = new Date(start.getTime() + 24 * 60 * 60 * 1000);
console.log(next.toISOString());            // fine in UTC; local-day logic can differ across a DST change
```

**Follow-ups:**
- *How would you test DST logic?* Run a test in a time zone that observes DST, on the transition date, or set the browser clock to that date in an E2E test. A runner pinned to UTC never crosses a DST change.
- *`toFixed` returns what?* A string.

**Trap:** pinning `timezoneId` or the clock in the suite config to make a failing date test pass. It hides the real product bug.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat

### What are higher-order functions and callbacks? Implement `debounce`.

Topic: js-core | Standard | id: q0230

**Say:** A higher-order function takes a function as an argument or returns one. A callback is a function passed to be called later, such as the one given to `map` or `setTimeout`. `debounce` returns a new function that delays the call until a quiet period has passed, and it uses a closure to hold the timer. Typical use is a search box that should not call the API on every keystroke.

**Full process:**

```ts
function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

const log = debounce((text: string) => console.log('search for', text), 50);
log('a');
log('ab');
log('abc');                 // only this call prints, after 50 ms
```

1. The closure holds `timer`. Each call cancels the previous timer.
2. `A extends unknown[]` captures the argument list, so the returned function has the same parameters as `fn`. That is a generic with a constraint.
3. `ReturnType<typeof setTimeout>` avoids choosing between the Node and browser timer types.

**Follow-ups:**
- *Debounce vs throttle?* Debounce waits for silence. Throttle runs at most once per interval.
- *How do you test a debounced search in Playwright?* Type, then wait for the result or the request with a web-first assertion or `waitForResponse`. Never a fixed sleep.

**Trap:** Leaving out `clearTimeout`. Then every call still fires after the delay, and the function is only delayed, not debounced. Also create the debounced function once, because a new one per call has its own timer and debounces nothing.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions

### What is the difference between an array and a `Set`? How do you sort them, where does a new value go, and which is faster?

Topic: js-core | Standard | id: q0231

**Say:** An array is an ordered list: it allows duplicates and you access items by index. A `Set` holds only unique values, has no index, and checks membership with `has`, which is close to constant time, while an array's `includes` scans every item. Both keep insertion order: `push` and `add` put a new value at the end, but `add` silently ignores a duplicate, which stays where it was. To sort, I use the array's `sort` with a comparator, because without one it compares as strings; `sort` mutates, `toSorted` does not. A `Set` has no sort, so I spread it into an array first. Which is faster depends on the operation: `Set` for lookups in a big collection, array for index access and ordered work.

**Full process:**

```ts
import { test, expect } from '@playwright/test';

test('prices are sorted ascending', async ({ page }) => {
  await page.goto('/products?sort=price');
  const prices = (await page.getByTestId('price').allTextContents()).map(Number);
  expect(prices).toEqual(prices.toSorted((a, b) => a - b)); // number comparator, original untouched
});

test('Set keeps insertion order and ignores duplicates', () => {
  const visited = new Set<string>(['/home', '/cart']);
  visited.add('/home');     // duplicate: ignored, stays first
  visited.add('/checkout'); // new: goes to the end
  expect([...visited]).toEqual(['/home', '/cart', '/checkout']);
});

test('orders have unique ids', async ({ request }) => {
  const ids = ((await (await request.get('/api/orders')).json()) as { id: string }[]).map((o) => o.id);
  expect(new Set(ids).size).toBe(ids.length);
});
```

**Trap:** Saying "an array adds at the end and a `Set` does not". Both append; the difference is that `Set` drops duplicates. An array can also insert at the start (`unshift`) or the middle (`splice`).

**Trap:** `[10, 9, 1].sort()` without a comparator sorts as strings and puts 10 before 9.

**Trap:** A `Set` compares objects by reference, so two objects with the same content are both kept.

**Follow-ups:**
- *How do you remove duplicates from an array?* `[...new Set(arr)]`.
- *What is hoisting?* Declarations move to the top of their scope before the code runs: `var` reads as `undefined` early, `let` and `const` throw (temporal dead zone).

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set

### What is a constructor?

Topic: js-core | Standard | id: q0232

**Say:** A constructor is a special method of a class that runs when you create an object with `new`, and it sets up the object's initial state. A class has at most one. In tests I use it in page objects: it takes the Playwright `page` and defines the locators. A subclass must call `super()` before it uses `this`. TypeScript has a shorthand, `constructor(private readonly page: Page) {}`, that declares and assigns the field at once.

**Full process:**

```ts
import { test, expect, type Page, type Locator } from '@playwright/test';

class LoginPage {
  readonly emailInput: Locator;
  constructor(readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
  }
}

test('login page shows the email field', async ({ page }) => {
  const loginPage = new LoginPage(page); // the constructor runs here
  await page.goto('/login');
  await expect(loginPage.emailInput).toBeVisible();
});
```

**Trap:** Using `this` in a subclass constructor before `super()`. It throws a ReferenceError.

**Follow-ups:**
- *What does `new` do?* It creates an empty object linked to the class prototype, runs the constructor with `this` bound to it, and returns it.
- *Can a constructor be async?* No. Do async setup in a separate method or a static factory, such as `static async create()`.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/constructor

### How do `Map`, `Set`, `for...of`, `for...in` and `JSON` work in everyday code?

Topic: js-core | Standard | id: q0233

**Say:** `Map` holds key-value pairs with any key type and keeps insertion order. `Set` holds unique values. `for...of` iterates values of an iterable, and `for...in` iterates the enumerable string keys of an object, which I avoid on arrays. `JSON.stringify` and `JSON.parse` convert to and from text. `stringify` drops `undefined` and functions and turns dates into strings. I use `Set` to remove duplicates and check uniqueness in tests, for example that all ids in a list are different.

**Full process:**

```ts
const ids = [1, 2, 2, 3];
console.log(new Set(ids).size === ids.length);      // false: there is a duplicate
console.log([...new Set(ids)]);                     // [1, 2, 3]

const counts = new Map<string, number>();
for (const word of ['a', 'b', 'a']) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}
console.log(counts);                                // Map(2) { 'a' => 2, 'b' => 1 }

for (const [word, n] of counts) console.log(word, n);

console.log(JSON.stringify({ a: 1, b: undefined, d: new Date(0) }));
// {"a":1,"d":"1970-01-01T00:00:00.000Z"}
```

**Follow-ups:**
- *Object vs Map?* A Map accepts any key type, has `size` and does not clash with prototype keys. An object is simpler for fixed shapes.
- *Duplicates in an array of objects?* Compare by a key: `new Set(rows.map(r => r.id))`.

**Trap:** Using `for...in` on an array. It gives string keys (`'0'`, `'1'`) and can include inherited enumerable properties, so use `for...of`. Also, `JSON.stringify(new Map(...))` gives `'{}'` and a `Set` of objects compares references.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map

### How does JavaScript garbage collection work, and what causes memory leaks?

Topic: js-core | Standard | id: q0234

**Say:** The engine frees objects that can no longer be reached from any root, such as global variables or the running call stack. I do not free memory by hand. Leaks happen when something keeps a reference you forgot: a growing global array or cache, event listeners never removed, timers never cleared, and closures that capture large objects. In test suites a leak shows up as a worker that gets slower or runs out of memory over many tests.

**Full process:**
1. A leak by cache:

```ts
const cache: Array<{ id: number; payload: string }> = [];

export function remember(id: number): void {
  cache.push({ id, payload: 'x'.repeat(1_000_000) }); // never removed, grows forever
}
```

2. Fixes: bound the cache, use a `Map` with deletion, `WeakMap` for object-keyed data that should not keep the key alive, remove listeners with `removeEventListener`, and clear intervals.
3. Find it: run Node with `--inspect`, take two heap snapshots in Chrome DevTools, and compare them. In a Playwright suite, watch worker memory over a long run.

**Follow-ups:**
- *What is a `WeakMap`?* Keys are held weakly, so when the key object is unreachable, the entry can be collected.

**Trap:** Saying JavaScript cannot leak because it has garbage collection, or that you must set variables to `null`. The collector frees only unreachable objects. Data that is still reachable but forgotten, such as a global cache, stays forever.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management

## Async, Promises and the event loop (js-async)

### Is JavaScript asynchronous? How does the event loop work?

Topic: js-async | Core | id: q0235

**Say:** JavaScript runs my code on one thread, one piece at a time. It is asynchronous because slow work, such as timers, network and disk, is handed to the runtime, and when it finishes a callback is queued. The event loop picks the next queued job when the call stack is empty. Promise callbacks go to the microtask queue, which is emptied completely after each piece of code, before the next timer or I/O callback from the macrotask queue. That is why a resolved promise runs before a `setTimeout(..., 0)`.

**Full process:**
1. Call stack: the code running now. It must be empty before anything queued runs.
2. Microtask queue: promise reactions (`then`, `catch`, `finally`, the code after `await`) and `queueMicrotask`. Drained fully, including microtasks queued by microtasks.
3. Macrotask queue: timers (`setTimeout`, `setInterval`), I/O callbacks, UI events. One per loop turn, with microtasks drained in between.
4. Prove it with a script, then read the output order (the exercise entry below shows the answer):

```ts
console.log('A');
setTimeout(() => console.log('C timeout'), 0);
Promise.resolve().then(() => console.log('B promise'));
console.log('D');
// prints: A, D, B promise, C timeout
```

5. A long synchronous loop blocks everything, including timers and promise callbacks. In Node the same loop has phases (timers, poll, check) with `process.nextTick` handled before promise microtasks in CommonJS code. Do not rely on that order.

**Follow-ups:**
- *Is `async/await` multi-threaded?* No. `await` pauses the function, and the rest runs later as a microtask. Nothing runs in parallel in your JavaScript.
- *Why does `setTimeout(fn, 0)` not run immediately?* It queues a macrotask for after the current code and all microtasks. Browsers and Node also clamp the delay to a minimum.
- *Why does this matter for Playwright?* The test code runs in Node, the browser runs in another process, and every Playwright call is an async message between them. If I forget `await`, the next line runs before the browser has done the action.

**Trap:** "JavaScript is multi-threaded because it can do things in parallel". It has one thread for your code. The runtime does the waiting.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop and https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick

### What does this print? (microtasks vs macrotasks)

Topic: js-async | Core | id: q0236

**Say:** I go top to bottom. Synchronous code runs first, in order. Then the microtasks run in the order they were queued, and the `await` continuation counts as a microtask. Last come the timers. So: start, the async function body up to the first `await`, end, then the promise callback, the `queueMicrotask` callback, the code after the `await`, and finally the timeout.

**Full process:**
1. The code (ES module or CommonJS, without `nextTick`):

```ts
console.log('1 start');

setTimeout(() => console.log('2 timeout 0'), 0);

Promise.resolve().then(() => console.log('3 promise then'));

queueMicrotask(() => console.log('4 queueMicrotask'));

(async () => {
  console.log('5 async body start');
  await null;
  console.log('6 after await');
})();

console.log('7 end');
```

2. Output, checked on Node 26.13:

```text
1 start
5 async body start
7 end
3 promise then
4 queueMicrotask
6 after await
2 timeout 0
```

3. Why: lines 1, 5, 7 are synchronous (the async function runs synchronously until its first `await`). The microtask queue then holds, in order: the `then` callback, the `queueMicrotask` callback, the continuation after `await`. The timeout is a macrotask and runs last.
4. A second exercise, with function calls:

```ts
async function a(): Promise<void> {
  console.log('a1');
  await b();
  console.log('a2');
}
async function b(): Promise<void> {
  console.log('b1');
}

console.log('start');
setTimeout(() => console.log('timeout'), 0);
void a();
new Promise<void>((resolve) => {
  console.log('executor');
  resolve();
}).then(() => console.log('then'));
console.log('end');
```

Output: `start`, `a1`, `b1`, `executor`, `end`, `a2`, `then`, `timeout`. The promise executor runs synchronously. `a2` comes before `then` because `a`'s continuation was queued first.

**Follow-ups:**
- *Where does `process.nextTick` go?* In Node it has its own queue that runs before promise microtasks in a CommonJS file. In an ES module the main module itself runs inside a promise job, so promise callbacks run first. I checked both on Node 26.13 and got different orders, so I do not depend on it.
- *What if a microtask queues another microtask?* It also runs before any timer, so an endless chain starves the loop.

**Trap:** thinking `setTimeout(..., 0)` runs before `Promise.resolve().then`. It does not.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide

### What is a Promise, and what are its states?

Topic: js-async | Core | id: q0237

**Say:** A Promise is an object for a value that is not ready yet. It is `pending`, then either `fulfilled` with a value or `rejected` with a reason, and after that it never changes. `then` registers a callback for success, `catch` for failure, `finally` for both, and each returns a new promise, so they chain. A value returned from `then` becomes the next step's input, and a thrown error skips to the next `catch`.

**Full process:**

```ts
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function parseAge(text: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const n = Number(text);
    if (Number.isNaN(n)) reject(new Error(`not a number: ${text}`));
    else resolve(n);
  });
}

parseAge('42')
  .then((n) => n + 1)                   // returns a plain value: next then gets 43
  .then((n) => wait(10).then(() => n))  // returns a promise: the chain waits for it
  .then((n) => console.log('result', n)) // result 43
  .catch((e: unknown) => console.log('failed', e))
  .finally(() => console.log('done'));
```

**Follow-ups:**
- *Callbacks vs promises?* Callbacks nest and each handles its own error. Promises chain flat and one `catch` handles any failure above it.
- *What does `new Promise(executor)` run?* The executor runs immediately and synchronously.
- *What if you do not handle a rejection?* Node reports an unhandled rejection, and in modern Node versions that ends the process with an error by default.

**Trap:** forgetting `return` inside a `then` callback, so the next step gets `undefined` and does not wait.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises

### How does `async/await` work?

Topic: js-async | Core | id: q0238

**Say:** An `async` function always returns a Promise. `await` pauses that function until the promise settles, then gives me the value, or throws the rejection so `try/catch` works. While it waits, the rest of the program keeps running, so it does not block the thread. It is syntax over promises, which is why I can mix both. Playwright uses it everywhere because each browser action is asynchronous.

**Full process:**

```ts
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);          // pause until the response headers arrive
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // becomes a rejection of the returned promise
  return res.json();
}

async function main(): Promise<void> {
  try {
    const data = await getJson('https://example.test/api/items');
    console.log(data);
  } catch (e) {
    console.log('request failed', e instanceof Error ? e.message : e);
  } finally {
    console.log('always runs');
  }
}
void main();
```

1. A function with `await` must be `async`. Top-level `await` works only in ES modules.
2. `return res.json()` inside an `async` function is the same as `return await res.json()` for the caller, except inside a `try/catch`, where `return await` is needed to catch the rejection in that block.
3. `async` returns a promise even for `return 5`: the caller gets `Promise<number>`.

**Follow-ups:**
- *Can `await` be used on a non-promise?* Yes, it returns the value, after one microtask.
- *`await` in a loop?* It makes iterations sequential, which is right when each depends on the previous one and slow when they do not.

**Trap:** `async` makes a function run on another thread. It does not.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function

### What does `Promise.all` do, and what happens when one promise fails?

Topic: js-async | Core | id: q0239

**Say:** `Promise.all` takes several promises, starts nothing itself (they already run), and resolves with an array of results in the same order. If any promise rejects, `Promise.all` rejects at once with that reason, and the results of the others are lost, though they keep running. I use it for independent work: two API calls, or a click together with `waitForResponse`.

**Full process:**

```ts
const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function demo(): Promise<void> {
  const [a, b] = await Promise.all([delay(30, 'A'), delay(10, 42)]);
  console.log(a, b);                      // A 42: order follows the input, not the finish time

  try {
    await Promise.all([
      delay(10, 'ok'),
      Promise.reject(new Error('boom')),
    ]);
  } catch (e) {
    console.log('rejected with', e instanceof Error ? e.message : e); // boom
  }
}
void demo();
```

Typed result: for a tuple input, TypeScript gives a tuple output, so `a` is `string` and `b` is `number` above. This is `Awaited` at work.

**Follow-ups:**
- *Does `Promise.all` cancel the rest on failure?* No. JavaScript promises cannot be cancelled. The others keep running and their results are ignored.
- *Empty array?* It resolves immediately with `[]`.
- *When not to use it?* When the operations share state or must be ordered, such as creating a record, then updating it.

**Trap:** `Promise.all` on thousands of requests at once. It starts them all. Use a concurrency limit.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

### What is the difference between `Promise.all`, `allSettled`, `race` and `any`?

Topic: js-async | Standard | id: q0240

**Say:** `all` resolves with all values and rejects on the first failure. `allSettled` never rejects, it waits for everything and gives a list of `{ status, value | reason }`, so I use it when I want every outcome, such as cleanup of several resources. `race` settles with the first promise to settle, success or failure, which suits a timeout. `any` resolves with the first success and rejects with an `AggregateError` only if all fail, which suits "try several mirrors".

**Full process:**

```ts
const ok = <T>(ms: number, v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));
const fail = (ms: number, msg: string): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));

async function demo(): Promise<void> {
  const settled = await Promise.allSettled([ok(10, 'a'), fail(5, 'x')]);
  console.log(settled.map((s) => s.status));            // [ 'fulfilled', 'rejected' ]

  const first = await Promise.race([ok(20, 'slow'), ok(5, 'fast')]);
  console.log(first);                                    // fast

  const firstOk = await Promise.any([fail(5, 'x'), ok(15, 'good')]);
  console.log(firstOk);                                  // good: the early failure is ignored

  try {
    await Promise.any([fail(5, 'x'), fail(6, 'y')]);
  } catch (e) {
    console.log(e instanceof AggregateError);            // true
  }
}
void demo();
```

A timeout with `race`:

```ts
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms),
  );
  return Promise.race([p, timeout]);
}
void withTimeout;
```

The timer keeps running after the race ends, so in real code clear it, or use `AbortSignal.timeout(ms)` for `fetch`.

**Follow-ups:**
- *Which one for "wait for all cleanup steps, report each failure"?* `allSettled`.
- *`race` with an empty array?* It never settles.

**Trap:** Using `Promise.all` for cleanup and assuming the rest stop after the first failure. The other promises keep running, because a promise cannot be cancelled. The test may move on while cleanup is still in progress.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled

### How do you handle errors in async code? What is an unhandled rejection?

Topic: js-async | Standard | id: q0241

**Say:** In an `async` function I use `try/catch/finally`. With raw promises I end a chain with `.catch`. A rejected promise that nobody handles is an unhandled rejection, and Node by default stops the process with an error, so a forgotten `await` can show up as a crash far from the cause. In tests I let the error fail the test, and I use `finally` for cleanup. I do not swallow errors with an empty `catch`, and I do not retry inside `try/catch` to make a flaky test pass.

**Full process:**

```ts
async function cleanup(): Promise<void> { console.log('cleanup'); }
async function risky(): Promise<never> { throw new Error('boom'); }

async function run(): Promise<void> {
  try {
    await risky();
  } catch (e) {
    console.log('caught', e instanceof Error ? e.message : e);
    throw e;                  // rethrow: the caller must still know
  } finally {
    await cleanup();          // runs on success and on failure
  }
}

run().catch((e: unknown) => {
  console.log('top level', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
```

**Follow-ups:**
- *Does `try/catch` catch a rejection without `await`?* No. `try { risky(); } catch {}` misses it, because the promise is not awaited inside the block.
- *`process.on('unhandledRejection')`?* A last-resort logger. It is not a way to fix the missing handler.

**Trap:** `.catch(() => {})` added to silence a failing test. It hides the bug.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises#error_handling

### What happens when you forget `await` in a Playwright test?

Topic: js-async | Standard | id: q0242

**Say:** The call returns a promise that nobody waits for, so the test goes on to the next line while the browser is still doing the action. The result is a flaky test or a false pass. An assertion without `await` is the worst case: `expect(locator).toBeVisible()` returns a promise, and if it is not awaited, a failure becomes an unhandled rejection after the test has already passed, or the check never gets enforced. I catch it with the lint rule `@typescript-eslint/no-floating-promises` or `playwright/missing-playwright-await`, so it fails in review and not in CI.

**Full process:**
1. The bug:

```ts
import { test, expect } from '@playwright/test';

test('adds an item to the cart', async ({ page }) => {
  await page.goto('/shop');
  page.getByRole('button', { name: 'Add to cart', exact: true }).click(); // missing await
  expect(page.getByRole('status')).toHaveText('1 item');                 // missing await
});
```

2. What happens: the click is sent but not waited for, the assertion is created but nothing waits for its result, and the test ends. The result depends on timing.
3. The fix is `await` on both lines.
4. Prevent it. Turn on type-aware linting and the rule `@typescript-eslint/no-floating-promises` (reports a promise that is not awaited, returned or handled). The `eslint-plugin-playwright` rule `missing-playwright-await` knows Playwright calls and matchers.
5. A related slip is an async callback passed where a sync one is expected, such as `array.forEach(async ...)` (see the forEach entry).

**Follow-ups:**
- *Does TypeScript catch it?* No, ignoring a promise is legal. The compiler does not report it, only the lint rules do.
- *What about `void promise`?* It tells the lint rule "ignored on purpose". Use it with a reason.

**Trap:** adding `await page.waitForTimeout(...)` after a missing-`await` bug. It treats the symptom.

**Source:** https://typescript-eslint.io/rules/no-floating-promises/

### Why does `forEach` with an async callback not work as expected?

Topic: js-async | Standard | id: q0243

**Say:** `forEach` ignores what the callback returns. If the callback is `async`, each call returns a promise, and `forEach` does not wait for any of them. So the code after the loop runs before the work is done. I use `for...of` with `await` when I need order, and `await Promise.all(items.map(async ...))` when the work can run at the same time.

**Full process:**

```ts
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function demo(): Promise<void> {
  const ids = [1, 2, 3];

  ids.forEach(async (id) => {
    await sleep(10);
    console.log('forEach done', id);
  });
  console.log('after forEach');                 // prints first

  for (const id of ids) {
    await sleep(10);
    console.log('sequential', id);              // 1, 2, 3 in order
  }

  await Promise.all(ids.map(async (id) => {
    await sleep(10);
    console.log('parallel', id);                // all three together
  }));
  console.log('after all');
}
void demo();
```

**Follow-ups:**
- *Does `map(async ...)` alone wait?* No. It returns an array of promises. Wrap it with `Promise.all`.
- *`filter(async ...)`?* The promises are truthy, so everything passes. Resolve first with `Promise.all`, then filter.

**Trap:** assuming `forEach` is just a shorter `for` loop.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach

### Sequential vs parallel: how do you choose?

Topic: js-async | Standard | id: q0244

**Say:** Run steps one after another when each needs the result of the previous one, or when order matters, such as create, update, delete. Run them in parallel with `Promise.all` when they are independent, such as seeding three unrelated records. Parallel is faster, but it needs independent data, and too much parallelism overloads the server or hits rate limits. In tests I run independent setup in parallel, and everything inside a single user flow in order.

**Full process:**

```ts
const call = async (name: string): Promise<string> => {
  await new Promise((r) => setTimeout(r, 50));
  return name;
};

async function sequential(): Promise<string[]> {
  const a = await call('a');   // 50 ms
  const b = await call('b');   // another 50 ms
  return [a, b];               // about 100 ms in total
}

async function parallel(): Promise<string[]> {
  return Promise.all([call('a'), call('b')]); // about 50 ms in total
}

async function main(): Promise<void> {
  console.time('sequential'); await sequential(); console.timeEnd('sequential');
  console.time('parallel'); await parallel(); console.timeEnd('parallel');
}
void main();
```

Measure with `console.time`: sequential is the sum of the delays, parallel is the longest one.

**Follow-ups:**
- *A bug in parallel tests?* Two tasks changing the same record. Use separate data per task.
- *Limit concurrency?* See the next entry.

**Trap:** Using `await` inside `forEach(async ...)` and expecting it to wait. `forEach` ignores the returned promises, so the code after it runs first. Use `for...of` with `await` for sequential and `Promise.all(items.map(...))` for parallel.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

### How do you start a wait together with the action that triggers it in Playwright?

Topic: js-async | Standard | id: q0245

**Say:** I create the wait promise first and the action together in one `Promise.all`. If I `await` the click first and only then start `waitForResponse`, the response may already have come, and the wait hangs until timeout. So the pattern is `const [response] = await Promise.all([page.waitForResponse(...), button.click()])`. The same holds for `waitForEvent('popup')`, `'download'` and `'filechooser'`.

**Full process:**

```ts
import { test, expect } from '@playwright/test';

test('saves the order and gets a 201', async ({ page }) => {
  await page.goto('/orders/new');
  await page.getByLabel('Title', { exact: true }).fill('Order A');

  const [response] = await Promise.all([
    page.waitForResponse('**/api/orders'),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);

  expect(response.status()).toBe(201);
  await expect(page.getByRole('status')).toHaveText('Saved');
});
```

1. `Promise.all` starts both promises in the same tick, so the listener exists before the click.
2. The result array has the response first, matching the input order.
3. If the click fails, `Promise.all` rejects with that error, so the failure message names the click.
4. Narrow the match to one request: a URL pattern plus a method check with a predicate function when the same URL is also used by GET.

**Follow-ups:**
- *Alternative?* Store the promise first: `const responsePromise = page.waitForResponse(...); await click(); const response = await responsePromise;`. Same effect.

**Trap:** awaiting the click and then calling `waitForResponse`. It is a race that passes locally and fails on slow CI.

**Source:** https://playwright.dev/docs/api/class-page#page-wait-for-response

### You must call a backend until the wanted result comes, on the 1st call or the 40th. How do you make that fast?

Topic: js-async | Standard | id: q0246

**Say:** One call after another is the slow way: each call waits for the previous answer, so 40 calls cost 40 round trips. The calls do not depend on each other, so I send them in batches. I start 10 requests together, wait for all 10 with `Promise.all`, check the 10 answers, and stop at the first one that has what I need. If none has it, I send the next 10. The batch size comes from the backend's rate limit, not from what my machine can do. And the loop has a cap, for example 100 calls, after which the test fails with a clear message instead of running forever.

| | One by one | Batches of 10 |
|---|---|---|
| Calls in the air at once | 1 | 10 |
| Round trips to reach call 37 | 37 | 4 |
| Measured, 100 ms per call | 3.9 s | 0.5 s |
| Risk | slow test | rate limit, if the batch is too big |

```ts
import { test, expect, type APIRequestContext } from '@playwright/test';

type PriceCheck = { offerId: string; priceChanged: boolean };

const BATCH_SIZE = 10; // the backend allows 10 calls at once
const MAX_CALLS = 100; // stop here and fail with a clear message

// One call after another: up to 40 round trips, each waits for the previous one.
async function findChangedPriceOneByOne(request: APIRequestContext, run: string): Promise<PriceCheck> {
  for (let call = 0; call < MAX_CALLS; call++) {
    const response = await request.get('/price-check', { params: { run } });
    const check: PriceCheck = await response.json();
    if (check.priceChanged) return check;
  }
  throw new Error(`no changed price in ${MAX_CALLS} calls`);
}

// Batches: 10 calls go out together, then the 10 answers are checked.
async function findChangedPriceInBatches(request: APIRequestContext, run: string, batchSize = BATCH_SIZE): Promise<PriceCheck> {
  for (let sent = 0; sent < MAX_CALLS; sent += batchSize) {
    const responses = await Promise.all(
      Array.from({ length: batchSize }, () => request.get('/price-check', { params: { run } })),
    );
    for (const response of responses) {
      expect(response.status(), 'the batch stayed inside the rate limit').toBe(200);
      const check: PriceCheck = await response.json();
      if (check.priceChanged) return check;
    }
  }
  throw new Error(`no changed price in ${MAX_CALLS} calls`);
}

test('batches of 10 find the changed price in a few round trips', async ({ request }, testInfo) => {
  const check = await findChangedPriceInBatches(request, testInfo.testId + Date.now());
  expect(check.priceChanged).toBe(true);
});
```

Run on Playwright 1.65.1 against a local backend that answers in 100 ms, returns the changed price on call 37 and allows 10 calls at once: one by one took 3,871 ms, batches of 10 took 477 ms, and a batch of 20 was rejected with 429.

**Follow-ups:**
- *Why not send all 40 at once?* The backend has a limit. Above it the calls come back as 429, and on a shared test environment I slow down everyone else.
- *What did the parallel run teach you?* The limit belongs to the backend, not to my test. In a trial run, a batch of 10 got a 429 as soon as other tests called the same endpoint in parallel. So the real budget is the batch size times the number of workers.
- *`Promise.all` or `Promise.allSettled`?* `Promise.all` here. `request.get` does not reject on a 4xx or 5xx, it returns the response, so I check the status myself. `allSettled` is for calls that may reject when I still want the other results.
- *Does the batch waste calls?* Up to 9, when the hit is first in its batch. That is the price of the speed.

**Powiedz:** Synchronicznie, jeden request po drugim, to najwolniejsza droga: każde wywołanie czeka na poprzednie, więc 40 wywołań to 40 pełnych odpowiedzi. Te wywołania od siebie nie zależą, więc wysyłam je paczkami. Odpalam 10 requestów naraz, czekam na wszystkie przez `Promise.all`, sprawdzam 10 odpowiedzi i kończę na pierwszej, która ma to, czego szukam. Jeśli żadna nie ma, leci następna dziesiątka. Wielkość paczki wynika z rate limitu backendu, a nie z tego, ile udźwignie moja maszyna. Pętla ma limit, na przykład 100 wywołań, po którym test pada z jasnym komunikatem, a nie kręci się bez końca.

**Trap:** A `while (true)` loop with no cap, or all the calls fired at once with no thought for the rate limit.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

### How do you run async tasks with a concurrency limit, or retry an async function?

Topic: js-async | Standard | id: q0247

**Say:** A limit means a small pool of workers that each take the next item until none are left, so at most N run at once. A retry is a loop that calls the function again after a failure, up to a maximum, usually with a delay that grows. Both are common coding tasks. In a test suite I do not wrap flaky steps in retries to hide product bugs. A retry belongs on a named test with a reason, or on a transient network call such as a 429 or 5xx from a helper.

**Full process:**

```ts
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;                 // safe: no await between read and increment
      results[index] = await fn(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, delayMs * 2 ** i)); // exponential backoff
    }
  }
  throw lastError;
}

const result = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
console.log(result);               // [2, 4, 6, 8, 10]
console.log(await retry(async () => 'ok', 3, 10));
```

1. `worker` shares the counter `next`. Reading and incrementing happen in one synchronous step, so two workers never take the same index.
2. Results are written by index, so the output keeps the input order.
3. `retry` rethrows the last error after the last attempt, so a real failure still fails.

**Follow-ups:**
- *Why exponential backoff?* Waiting longer after each failure gives the server time to recover.
- *Library?* `p-limit` does the first one. I would write the small version for a one-off script.

**Trap:** Calling `Promise.all(items.map(fn))` a limited run. It starts every task at once. Also, retrying a non-idempotent call such as a POST that creates a record can create duplicates.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise

### Callbacks, `promisify` and `fetch` with a timeout: how do you bridge old and new styles?

Topic: js-async | Standard | id: q0248

**Say:** An old Node API takes a callback with `(error, result)`. `util.promisify` turns it into a function that returns a promise, and many Node modules already have a `node:fs/promises` version. For `fetch` I use `AbortSignal.timeout(ms)` so a hanging request is cut. A timeout is a safety net around a request. It does not replace waiting for the right state in the UI.

**Full process:**

```ts
import { readFile } from 'node:fs';
import { promisify } from 'node:util';

const readFileAsync = promisify(readFile);

async function main(): Promise<void> {
  const text = await readFileAsync('package.json', 'utf8');
  console.log(text.length > 0);

  const res = await fetch('https://example.test/api/health', {
    signal: AbortSignal.timeout(5000),     // rejects with a TimeoutError after 5 s
  });
  console.log(res.status);
}

main().catch((e: unknown) => {
  console.log(e instanceof Error ? e.name : e);
});
```

**Follow-ups:**
- *Why prefer the `promises` module?* No wrapper needed, and proper types.

**Trap:** Thinking a timeout stops the work on the server. `AbortSignal.timeout` only stops the client from waiting. A request that already arrived may still be processed, so a retried POST can create a record twice.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static

## OOP, SOLID and patterns in test code (oop-patterns)

### What are the four OOP pillars, and where do they show up in a test framework?

Topic: oop-patterns | Standard | id: q0249

**Say:** Encapsulation hides internals behind a small public surface: a page object exposes `login()` and keeps its locators private or readonly. Abstraction means callers use the simple idea, not the details, such as a `ApiClient` with `createUser()`. Inheritance lets a class reuse another, which I use sparingly. Polymorphism means different classes answer the same call, for example two `Reporter` classes with the same interface. I use TypeScript interfaces and composition more than deep class trees.

**Follow-ups:**
- *Which pillar do tests break most often?* Encapsulation: tests that reach into a page object's locators and repeat the steps. The page object should hold the steps.

**Source:** https://www.typescriptlang.org/docs/handbook/2/classes.html

### How do classes work in TypeScript? Explain access modifiers, `readonly`, `abstract` and `implements`.

Topic: oop-patterns | Standard | id: q0250

**Say:** A class has fields, a constructor and methods. `public` is the default, `private` and `protected` limit access in the type system, and `#field` is a real runtime private field in JavaScript. `readonly` allows assignment only in the constructor. A constructor parameter with a modifier declares and assigns a field in one go. `abstract` classes cannot be instantiated and force subclasses to implement some methods. `implements` makes a class promise to match an interface.

**Full process:**

```ts
interface Reporter { report(message: string): void }

abstract class BaseClient {
  constructor(protected readonly baseUrl: string) {}
  abstract get(path: string): Promise<unknown>;       // subclasses must implement
  protected url(path: string): string { return `${this.baseUrl}${path}`; }
}

class FetchClient extends BaseClient {
  #calls = 0;                                         // runtime private field

  async get(path: string): Promise<unknown> {
    this.#calls += 1;
    const res = await fetch(this.url(path));
    if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
    return res.json();
  }

  get calls(): number { return this.#calls; }
}

class ConsoleReporter implements Reporter {
  report(message: string): void { console.log(message); }
}

const client = new FetchClient('https://example.test');
// @ts-expect-error baseUrl is protected
client.baseUrl;
new ConsoleReporter().report(String(client.calls));
```

**Follow-ups:**
- *`private` vs `#private`?* `private` is checked only by the compiler and visible at runtime. `#private` is enforced by JavaScript itself.

**Source:** https://www.typescriptlang.org/docs/handbook/2/classes.html

### Composition vs inheritance: which do you prefer in test code?

Topic: oop-patterns | Standard | id: q0251

**Say:** Composition, "has a" over "is a". A page object that holds a `HeaderComponent` and a `ModalComponent` is easier to change than a `BasePage` three levels deep, where a change in the base class touches every page. Inheritance is fine for one shallow level, such as a `BaseApiClient` with auth handling. Playwright fixtures are composition: each test asks for the parts it needs.

**Full process:**

```ts
import type { Locator, Page } from '@playwright/test';

class HeaderComponent {
  constructor(private readonly root: Locator) {}
  async openUserMenu(): Promise<void> {
    await this.root.getByRole('button', { name: 'User menu', exact: true }).click();
  }
}

class DashboardPage {
  readonly header: HeaderComponent;                    // composition
  constructor(readonly page: Page) {
    this.header = new HeaderComponent(page.getByRole('banner'));
  }
}
void DashboardPage;
```

**Follow-ups:**
- *Why does deep inheritance hurt?* A change to the base class has unknown reach, and a subclass inherits methods it does not need.

**Source:** https://playwright.dev/docs/pom

### What is SOLID, and how do you apply it to test code?

Topic: oop-patterns | Standard | id: q0252

**Say:** Five design rules. Single responsibility: a class has one reason to change, so a page object models a page and does not also seed the database. Open/closed: add behaviour by adding code, not by editing working code, for example a new reporter class. Liskov: a subclass must work wherever its parent works. Interface segregation: small interfaces, not one big one. Dependency inversion: depend on an interface and pass the real thing in, which is what fixtures do. I use them as a checklist when a helper grows.

**Full process:**
1. S: split `TestHelper` into `ApiSeeder` (creates data), `LoginPage` (UI actions), `Assertions` live in tests.
2. O: a `Reporter` interface with `report()`, and new reporters added as new classes.
3. L: a `MockApiClient` replaces `ApiClient` without changing the tests that use the interface.
4. I: `Seeder` and `Cleaner` as separate interfaces, so a read-only test does not depend on cleanup.
5. D: the test asks for an `ApiClient` fixture, not `new ApiClient()` inside the test:

```ts
interface ApiClient { createUser(name: string): Promise<{ id: number }> }

class FakeApi implements ApiClient {
  async createUser(name: string): Promise<{ id: number }> { return { id: name.length }; }
}

async function seedUsers(api: ApiClient, names: string[]): Promise<number[]> {
  const users = await Promise.all(names.map((n) => api.createUser(n)));
  return users.map((u) => u.id);
}

console.log(await seedUsers(new FakeApi(), ['Ann', 'Bob'])); // [3, 3]
```

**Follow-ups:**
- *When is SOLID too much?* In a small test suite, an interface with one implementation and no reason to vary is noise. Apply a rule when it removes a real problem.

**Source:** https://www.typescriptlang.org/docs/handbook/2/classes.html#implements-clauses

### What is the Factory pattern, and where would you use it in tests?

Topic: oop-patterns | Standard | id: q0253

**Say:** A factory is a function or class that creates objects so the caller does not call constructors and set up details. In tests I use factories for test data: `buildUser({ role: 'admin' })` returns a valid user with sensible, varied defaults, and the test overrides only what matters. A factory also hides which concrete class is created, for example choosing an API client or a page object per environment.

**Full process:**

```ts
interface User { id: number; email: string; role: 'admin' | 'member' }

let counter = 0;
function buildUser(overrides: Partial<User> = {}): User {
  counter += 1;
  return { id: counter, email: `user${counter}@example.test`, role: 'member', ...overrides };
}

console.log(buildUser());                    // { id: 1, email: 'user1@example.test', role: 'member' }
console.log(buildUser({ role: 'admin' }));   // { id: 2, ... role: 'admin' }
```

The counter makes each call return different data, which avoids tests sharing one sample.

**Follow-ups:**
- *Factory vs fixture?* A fixture sets up and tears down an environment. A factory only builds objects.

**Source:** https://playwright.dev/docs/test-fixtures

### What is the Builder pattern, and how is it different from a factory?

Topic: oop-patterns | Standard | id: q0254

**Say:** A builder creates a complex object step by step with chained methods, then `build()` returns it. A factory returns a ready object in one call. I reach for a builder when there are many optional parts and order or combinations matter, like an order with items, a coupon and a shipping address. For simple data a factory with `Partial` overrides is enough, and simpler.

**Full process:**

```ts
interface Order { items: string[]; coupon?: string; express: boolean }

class OrderBuilder {
  private items: string[] = [];
  private coupon: string | undefined;
  private express = false;

  withItem(name: string): this { this.items.push(name); return this; }
  withCoupon(code: string): this { this.coupon = code; return this; }
  withExpressShipping(): this { this.express = true; return this; }

  build(): Order {
    if (this.items.length === 0) throw new Error('an order needs at least one item');
    return { items: [...this.items], coupon: this.coupon, express: this.express };
  }
}

const order = new OrderBuilder().withItem('Book').withCoupon('SAVE10').withExpressShipping().build();
console.log(order);
```

`build()` validates, so an invalid order fails at creation, not later in the test.

**Follow-ups:**
- *Why return `this`?* It enables chaining and keeps the subclass type.

**Source:** https://refactoring.guru/design-patterns/builder

### DRY vs readable tests: how far do you go?

Topic: oop-patterns | Standard | id: q0255

**Say:** In production code I avoid repetition. In tests, a reader must understand one test without opening five helpers, so a bit of repetition is fine. I extract repeated setup and low-level actions into helpers, page objects and fixtures, but I keep the steps and the assertions that show intent visible in the test. A test is a contract, so I do not hide its assertions in a shared function. Some call this DAMP: descriptive and meaningful phrases.

**Full process:**
1. Extract when the same lines appear in three places and mean the same thing: login, seeding, navigation.
2. Keep inline: the data that matters to this scenario, and every assertion.
3. A bad abstraction costs more than duplication: a helper with five boolean flags to cover three tests is harder to read than three copies.
4. Rule I follow: if a change to the helper could silently change what a test proves, the helper is hiding too much.

**Follow-ups:**
- *Two identical assertions in one test?* If they bracket a state change, they are a pair, not a duplicate. Keep both.

**Source:** https://playwright.dev/docs/best-practices

### Which design patterns appear in a test automation framework?

Topic: oop-patterns | Standard | id: q0256

**Say:** Page Object (and component objects) to model the UI, Factory and Builder for test data, Fixture or dependency injection for setup and teardown, Singleton for a shared config or logger (used with care, since shared state breaks parallel tests), Strategy to swap behaviour such as different login methods, and Facade to give a simple front to a complicated flow like "checkout". I describe the problem each one solves rather than reciting names.

**Follow-ups:**
- *Why be careful with Singleton in tests?* Shared mutable state between tests breaks isolation and parallel runs.

**Source:** https://refactoring.guru/design-patterns

### What makes test code clean? Describe your rules.

Topic: oop-patterns | Standard | id: q0257

**Say:** One test checks one behaviour, and its name says which. The shape is arrange, act, assert, with no logic in the test body such as `if` or loops over assertions. Names say what the user does, not how. No fixed sleeps. Data is created for the test and cleaned up. Selectors follow what the user sees. Code is small and obvious (KISS), and the minimal change wins over a rewrite. A review of the test code should read like a review of production code.

**Follow-ups:**
- *How do you enforce it?* Lint rules in CI, so a rule is not just a review comment.

**Source:** https://playwright.dev/docs/best-practices

## Unit test frameworks (unit-frameworks)

### Jest vs Vitest vs Mocha: what are the differences, and what have you used?

Topic: unit-frameworks | Niche | id: q0258

**Say:** All three run unit tests. Jest is an all-in-one runner with built-in mocking and assertions. Vitest has a Jest-like API but runs on Vite, so TypeScript and ESM work with little setup, and it is fast. Mocha is only a runner, so I add an assertion library (Chai) and a mocking library (Sinon). If you have used Jest a little, say so, and if you have not used Mocha with Chai, say so plainly. For a new TypeScript project I would pick Vitest, and for a Playwright suite the Playwright runner already covers E2E and API tests.

**Follow-ups:**
- *How does TypeScript work in Jest?* Through Babel (`@babel/preset-typescript`, which only strips types and does not type-check) or `ts-jest`. Run `tsc --noEmit` separately either way.

**Trap:** claiming Mocha or Chai experience. Say you have used Jest, and explain how you know how Mocha differs.

**Source:** https://vitest.dev/guide/ and https://jestjs.io/docs/getting-started

### Show me a unit test in Vitest or Jest, and how you run it.

Topic: unit-frameworks | Niche | id: q0259

**Say:** I write a pure function, a test file beside it named `*.test.ts`, and use `describe`, `it` or `test`, and `expect` matchers. Vitest needs `import { describe, it, expect } from 'vitest'`. Jest in TypeScript can import the same names from `@jest/globals`. I run `npx vitest run` once, or `npx vitest` in watch mode. Each test follows arrange, act, assert.

**Full process:**
1. Install: `npm install -D vitest`. Add `"test:unit": "vitest run"` to `package.json`.
2. `src/price.ts`:

```ts
export function withVat(net: number, ratePercent: number): number {
  if (net < 0) throw new RangeError('net must not be negative');
  return Math.round(net * (1 + ratePercent / 100) * 100) / 100;
}
```

3. `src/price.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withVat } from './price.ts';

describe('withVat', () => {
  it.each([
    { net: 100, rate: 23, gross: 123 },
    { net: 0, rate: 23, gross: 0 },
    { net: 9.99, rate: 8, gross: 10.79 },
  ])('adds $rate% to $net', ({ net, rate, gross }) => {
    expect(withVat(net, rate)).toBe(gross);
  });

  it('rejects a negative net price', () => {
    expect(() => withVat(-1, 23)).toThrow(RangeError);
  });
});
```

4. Run `npx vitest run`. Output lists each case. `it.each` gives data-driven cases with boundaries (zero, rounding), and a negative case.
5. Vitest by default looks for files with `.test.` or `.spec.` in the name.

**Follow-ups:**
- *`toBe` vs `toEqual`?* `toBe` uses `Object.is` (identity for objects). `toEqual` compares structure.
- *`toStrictEqual`?* Also checks `undefined` properties and class types.
- *Float comparison?* `toBeCloseTo`.

**Source:** https://vitest.dev/guide/

### What is the difference between a mock, a stub, a spy and a fake?

Topic: unit-frameworks | Niche | id: q0260

**Say:** A stub returns fixed answers. A spy records how it was called and, by default, still runs the real code. A mock is a test double with expectations about calls. A fake is a working but simplified implementation, such as an in-memory repository. In Jest and Vitest, `fn()` makes a mock function that can be a stub or spy, and `spyOn` wraps a real method. I check behaviour through outputs where I can, and verify calls only when the call is the behaviour, such as "an email was sent".

**Full process:**

```ts
import { expect, it, vi } from 'vitest';

interface Mailer { send(to: string, body: string): Promise<void> }

async function notify(mailer: Mailer, to: string): Promise<void> {
  await mailer.send(to, 'Your order shipped');
}

it('sends one email to the customer', async () => {
  const mailer: Mailer = { send: vi.fn(async () => {}) };   // stub with a spy

  await notify(mailer, 'ann@example.test');

  expect(mailer.send).toHaveBeenCalledTimes(1);
  expect(mailer.send).toHaveBeenCalledWith('ann@example.test', 'Your order shipped');
});

it('spies on a real method and restores it', () => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  expect(Math.random()).toBe(0.5);
  spy.mockRestore();
});
```

Jest has the same API under `jest.fn` and `jest.spyOn`.

**Follow-ups:**
- *`clear` vs `reset` vs `restore`?* In Vitest, `clearAllMocks` clears call history. `resetAllMocks` clears history and resets implementations. `restoreAllMocks` restores the original of spies made with `spyOn`.
- *Risk of over-mocking?* The test passes while the real integration is broken.

**Source:** https://vitest.dev/api/vi.html and https://jestjs.io/docs/mock-functions

### How do you mock a module or fake timers?

Topic: unit-frameworks | Niche | id: q0261

**Say:** `vi.mock('./module')` (or `jest.mock`) replaces a module for the whole file. The call is hoisted above the imports, so it runs first, and a factory function cannot use outer variables unless they come from `vi.hoisted`. For time I use fake timers, so a debounce or a 30-second timeout does not make the test wait. Fake timers also replace `Date`.

**Full process:**

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

function waitThenRun(fn: () => void, ms: number): void {
  setTimeout(fn, ms);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('runs the callback after the delay without waiting', () => {
  const fn = vi.fn();
  waitThenRun(fn, 30_000);

  vi.advanceTimersByTime(29_999);
  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
});
```

Module mock shape (needs a real module path to run):

```ts
// vi.mock('./api.ts', () => ({ getUser: vi.fn(async () => ({ id: 1 })) }));
```

**Follow-ups:**
- *Fake timers and `process.nextTick` or `queueMicrotask`?* Vitest does not fake them by default.
- *Fake time in an E2E test?* Playwright has its own clock API for the browser. It is a different tool.

**Source:** https://vitest.dev/api/vi.html

### How do you test async code and errors in unit tests?

Topic: unit-frameworks | Niche | id: q0262

**Say:** I make the test function `async` and `await` the call. For a promise I can use `await expect(promise).resolves.toBe(...)` and `.rejects.toThrow(...)`. The `await` before `expect` matters: without it the assertion is not awaited and a failure can be lost. For a synchronous throw I pass a function: `expect(() => fn()).toThrow()`.

**Full process:**

```ts
import { expect, it } from 'vitest';

async function loadUser(id: number): Promise<{ id: number }> {
  if (id <= 0) throw new Error('invalid id');
  return { id };
}

it('resolves with the user', async () => {
  await expect(loadUser(1)).resolves.toEqual({ id: 1 });
});

it('rejects for a bad id', async () => {
  await expect(loadUser(0)).rejects.toThrow('invalid id');
});
```

**Follow-ups:**
- *What if you forget the `await` in `.rejects`?* The test can pass while the assertion fails later, the same bug as a missing `await` in Playwright.

**Source:** https://jestjs.io/docs/asynchronous

### What is Supertest? You have not used it: how would you approach it?

Topic: unit-frameworks | Niche | id: q0263

**Say:** If you have not used Supertest in a project, say so. It is a library for testing HTTP servers in Node: you give it an Express or other `http` app, it starts the app on an ephemeral port if it is not listening, sends requests with a chainable API built on superagent, and lets you assert status, headers and body. Typically it runs inside Jest or Vitest and tests an API without deploying it. For API tests, consider using Playwright's request API or Postman. I would pick up Supertest quickly because the ideas are the same.

**Follow-ups:**
- *Supertest vs Playwright API testing?* Supertest talks to the app object in the same process, so it suits a team that owns the backend code and wants fast integration tests. Playwright's request context talks to a deployed environment over the network, so it also covers the real setup.

**Trap:** claiming production use. Say: not in production, here is how it works.

**Source:** https://github.com/ladjs/supertest

### Supertest crash course: show a minimal API test.

Topic: unit-frameworks | Niche | id: q0264

**Say:** I would build the app in one file and export it without calling `listen`, then write the test file with Vitest or Jest. The test does `request(app).get('/path')`, then asserts `.expect(200)` and the body. For login flows `request.agent(app)` keeps cookies between calls. If you know Supertest only from the docs, say so.

**Full process:**
1. Install: `npm install express && npm install -D supertest @types/supertest @types/express vitest`.
2. `app.ts`, exporting the app without listening:

```ts
import express from 'express';

export const app = express();
app.use(express.json());

const users: Array<{ id: number; name: string }> = [];

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post('/users', (req, res) => {
  const name: unknown = req.body?.name;
  if (typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const user = { id: users.length + 1, name };
  users.push(user);
  res.status(201).location(`/users/${user.id}`).json(user);
});
```

3. `app.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app.ts';

describe('users API', () => {
  it('creates a user and returns 201 with a Location header', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Ann' })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/users/${res.body.id}`);
    expect(res.body).toMatchObject({ name: 'Ann' });
  });

  it('rejects an empty name with 400', async () => {
    const res = await request(app).post('/users').send({ name: ' ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name is required');
  });
});
```

4. Run `npx vitest run`. Supertest binds the app to a free port for the call, so no port conflicts, and no `listen` in the test.
5. The chain also supports `.expect(200)` and `.expect('Content-Type', /json/)` directly on the request.
6. Isolation: the module-level `users` array is shared across tests in the file. Reset it in `beforeEach` or build the app with a factory per test.
7. If the server fails mid-way, use the failed status and body in the assertion message, not a retry.

**Follow-ups:**
- *Why export the app without `listen`?* So the test controls the server lifecycle, and the import has no side effects.
- *Authenticated requests?* `.set('Authorization', 'Bearer <token>')`, or `request.agent(app)` for session cookies.

**Source:** https://github.com/ladjs/supertest

### What do you test in a unit test and what in E2E? Where is the line?

Topic: unit-frameworks | Niche | id: q0265

**Say:** Unit tests cover logic with many cases: calculations, parsing, formatting, state transitions. They are fast, isolated, and run on every commit. E2E tests cover a user flow across the UI, API and database, a few high-value paths. Before adding an E2E test I check whether a unit or API test already covers the same behaviour, because a duplicate E2E only adds flake and CI time. The exception is something only a real browser shows, such as focus, layout or a time zone and DST behaviour.

**Follow-ups:**
- *Test pyramid?* Many unit tests, fewer API or integration tests, few E2E.
- *A unit runner pinned to UTC?* It never crosses a DST change, so DST bugs need a test in a DST-observing zone or an E2E run with the clock set to that date.

**Source:** https://playwright.dev/docs/best-practices

### How do you know unit tests are good? What is mutation testing?

Topic: unit-frameworks | Niche | id: q0266

**Say:** Coverage tells me which lines ran, not whether the tests would notice a bug. Mutation testing changes the code in small ways (flip `<` to `<=`, remove a call) and checks that at least one test fails. A mutant that survives points to a test that never fails for that logic. I also watch every new test fail once, against the old code or a one-line change, before I trust it.

**Full process:**
1. Install Stryker: `npm install -D @stryker-mutator/core`, then run `npx stryker init` and pick your runner (Vitest or Jest).
2. Run `npx stryker run`. The report lists killed, survived and no-coverage mutants.
3. For each survivor, add a test that fails on that mutation, for example a boundary value.
4. Mutation runs are slow, so run them on a schedule or on changed files, not on every push.

**Follow-ups:**
- *Is 100% coverage a goal?* No, it is a signal for gaps. Chasing it produces tests that assert the implementation.

**Source:** https://stryker-mutator.io/docs/

### pytest vs unittest: what is the difference?

Topic: unit-frameworks | Niche | id: q0267

**Say:** `unittest` is in Python's standard library and uses classes, `self.assertEqual` and `setUp`. `pytest` is a third-party runner that uses plain functions and plain `assert`, shows detailed failure output, and has fixtures and parametrisation. It also runs `unittest` tests. I use pytest when I write Python, at scripting level.

**Full process:**

```python
# test_price.py, run with: pytest -q
import pytest

def with_vat(net: float, rate: float) -> float:
    if net < 0:
        raise ValueError("net must not be negative")
    return round(net * (1 + rate / 100), 2)

@pytest.mark.parametrize("net, rate, gross", [(100, 23, 123.0), (0, 23, 0.0)])
def test_with_vat(net: float, rate: float, gross: float) -> None:
    assert with_vat(net, rate) == gross

def test_negative_net_is_rejected() -> None:
    with pytest.raises(ValueError):
        with_vat(-1, 23)
```

**Follow-ups:**
- *What is a pytest fixture?* A function decorated with `@pytest.fixture` that provides setup, and teardown after a `yield`. Tests ask for it by parameter name.

**Source:** https://docs.pytest.org/en/stable/getting-started.html

## React, HTML, CSS and the DOM (react-frontend)

### What do you know about React? (React basics)

Topic: react-frontend | Standard | id: q0268

**Say:** A tester does not need to be a frontend developer, but should be able to read and make small fixes in React components, for example adding ARIA roles and accessible names and checking the result in Playwright. The basics: a component is a function that returns UI. Props are inputs from the parent and are read-only. State is data the component owns, and when it changes React renders the component again and updates only what changed in the page. Hooks like `useState` and `useEffect` add state and side effects. For testing, rendering is asynchronous, so I use web-first assertions and locators, not sleeps.

**Full process:** a component with props and state, to talk through if asked to explain code:

```tsx
import { useState } from 'react';

interface CounterProps {
  label: string;
  start?: number;
}

export function Counter({ label, start = 0 }: CounterProps) {
  const [count, setCount] = useState(start);

  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      {label}: {count}
    </button>
  );
}
```

1. `CounterProps` types the props. `label` is required, `start` is optional with a default.
2. `useState(start)` returns the current value and a setter. Calling the setter schedules a re-render.
3. `setCount((c) => c + 1)` uses the updater form, which is correct when the next value depends on the previous one.
4. The returned markup is JSX. The button has a text, so `getByRole('button', { name: 'Clicks: 0', exact: true })` finds it.
5. A Playwright test clicks it and asserts `toHaveText('Clicks: 1')`. The assertion retries until React has re-rendered.

**Follow-ups:**
- *What is the virtual DOM?* React's in-memory description of the UI. On each render React compares the new description with the previous one and applies the smallest set of real DOM changes.
- *Props vs state?* Props come from outside and are read-only for the component. State belongs to the component and changes over time.
- *What have you changed in React yourself?* Accessibility fixes: roles, accessible names, keyboard support, with tests.

**Trap:** pretending to be a React developer. Say what you do: read, fix small things, test the behaviour users see.

**Source:** https://react.dev/learn

### What are components and props? How does TypeScript help?

Topic: react-frontend | Standard | id: q0269

**Say:** A component is a function that takes props and returns UI. Props flow from parent to child and are read-only. In TypeScript I define an interface for the props, so a missing or wrongly typed prop is a compile error, and the editor autocompletes them. For testing, the component name often shows up in the folder structure and the accessible name shows up in the page, which is what I locate by.

**Full process:**

```tsx
interface UserCardProps {
  name: string;
  role: 'admin' | 'member';
  onSelect?: (name: string) => void;
}

export function UserCard({ name, role, onSelect }: UserCardProps) {
  return (
    <li>
      <button type="button" onClick={() => onSelect?.(name)}>
        {name} ({role})
      </button>
    </li>
  );
}

// parent
export function UserList() {
  return (
    <ul>
      <UserCard name="Ann" role="admin" />
      <UserCard name="Bob" role="member" onSelect={(n) => console.log(n)} />
    </ul>
  );
}
```

**Follow-ups:**
- *What is `children`?* A special prop with the content between the tags. Its type is `React.ReactNode`.
- *Callback props?* A child tells the parent something happened by calling a function the parent passed.

**Trap:** Changing props inside the child. Props are read-only and flow down from the parent. To send something up, the parent passes a callback prop.

**Source:** https://react.dev/learn/passing-props-to-a-component

### What is state, and why does a component re-render?

Topic: react-frontend | Standard | id: q0270

**Say:** State is data that a component remembers between renders. Calling the setter tells React that something changed, so it calls the component again and updates the page. A re-render also happens when the parent re-renders. State updates are batched and applied after the handler finishes, so reading the state variable right after the setter still gives the old value. For a test, the point is that the screen changes a moment after the action, and the DOM node can be replaced, so I assert with a locator that finds it again.

**Full process:**

```tsx
import { useState } from 'react';

export function Todo() {
  const [items, setItems] = useState<string[]>([]);
  const [text, setText] = useState('');

  function add(): void {
    if (text.trim() === '') return;
    setItems((prev) => [...prev, text]);   // new array: never push into state
    setText('');
  }

  return (
    <section>
      <label>
        New item
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="button" onClick={add}>Add</button>
      <ul>
        {items.map((item, i) => (
          <li key={`${i}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
```

1. State is replaced, not mutated: `[...prev, text]` is a new array. Mutating with `push` would not trigger a re-render.
2. `useState<string[]>([])` needs the type argument because an empty array has no inferable item type.
3. Playwright: `fill` the labelled input, click `Add`, then `await expect(page.getByRole('listitem')).toHaveText(['first'])`.

**Follow-ups:**
- *Why does `console.log(count)` right after `setCount` show the old value?* The new value is available on the next render.
- *Where should state live?* In the lowest common parent of the components that need it.

**Trap:** Expecting three `setCount(count + 1)` calls in one handler to add 3. All three use the `count` of that render, so the result is +1. Use the updater form, `setCount((c) => c + 1)`.

**Source:** https://react.dev/learn/state-a-components-memory

### What does `useEffect` do, and what is the dependency array?

Topic: react-frontend | Standard | id: q0271

**Say:** `useEffect` runs code after React has rendered, for side effects such as fetching data, subscribing, or touching something outside React. The dependency array lists values the effect uses. React runs the effect again when one of them changes. An empty array means once after the first render. A missing array means after every render. A cleanup function returned from the effect runs before the next effect and on unmount. A wrong array causes stale data or endless requests, which tests see as a spinner that never ends or a request that fires repeatedly.

**Full process:**

```tsx
import { useEffect, useState } from 'react';

interface User { id: number; name: string }

export function UserName({ id }: { id: number }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/users/${id}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<User>)
      .then(setUser)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error(e);
      });
    return () => controller.abort();     // cleanup: cancel the old request when id changes
  }, [id]);                              // run again when id changes

  return <p>{user ? user.name : 'Loading'}</p>;
}
```

1. The cleanup cancels the previous request, so an old, slow response cannot overwrite a newer one.
2. In development `StrictMode` runs the effect, its cleanup and the effect again once, to show missing cleanup. A request that appears twice in dev is not a product bug by itself.
3. Test angle: a view that fetches once on mount can race the backend write that fills it. Wait for the record to exist, for example with `expect.poll` on the same endpoint, and then open the view.

**Follow-ups:**
- *Do you need `useEffect` for every fetch?* Many apps use a data library, such as TanStack Query, which handles caching and cancellation.
- *What breaks with a stale dependency array?* The effect uses an old value from a previous render.

**Trap:** Two mistakes. Leaving the array out and thinking it means "once" (it means after every render, and `[]` means once). And passing an `async` function straight to `useEffect`, because the callback must return a cleanup function or nothing, not a promise.

**Source:** https://react.dev/reference/react/useEffect

### What are `useMemo`, `useCallback` and `useContext`?

Topic: react-frontend | Standard | id: q0272

**Say:** I don't write much React, but I can read these. `useMemo` remembers a calculated value and recalculates it only when its dependencies change. `useCallback` does the same for a function, so a child component doesn't get a new function on each render. `useContext` lets a component read shared data, such as the current user or theme, without passing props through every level. The first two are about avoiding needless work, so they shouldn't change what the user sees. If a test only passes with or without one of them, I suspect a stale dependency.

**Follow-ups:**
- *What does a wrong dependency array do?* The memoised value or function keeps old data, so the UI shows a stale value until something else triggers a change. In a test that looks like an element showing old text after an update.
- *Does `useMemo` make the app faster?* Only where the calculation is expensive or a memoised child depends on it. Elsewhere it adds a small cost.

**Trap:** Saying `useMemo` keeps data like state. It is a cache of a calculation, and React may throw it away.

**Source:** https://react.dev/reference/react/useMemo

### Why are `key` props needed in lists, and what goes wrong with a bad key?

Topic: react-frontend | Standard | id: q0273

**Say:** The `key` lets React match each list item between renders. With a stable, unique key (an id), React moves, adds and removes the right items and keeps their state. With the array index as key, after sorting or deleting, React reuses the wrong component for the wrong data, so inputs keep old text, focus jumps, or an item shows another item's state. For tests that shows up as an assertion on a row that reads the wrong row after a reorder.

**Full process:**

```tsx
interface Row { id: string; title: string }

export function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>                  {/* stable id, not the index */}
          <input defaultValue={row.title} aria-label={`Title of ${row.id}`} />
        </li>
      ))}
    </ul>
  );
}
```

Experiment: with `key={index}` and uncontrolled inputs, type into row 1, delete row 0, and the text you typed now sits in the wrong row's input.

**Follow-ups:**
- *Is a random key fine?* No. A new key on every render makes React recreate the element each time.
- *Test tip?* Scope row assertions to the row (`filter({ hasText })`) rather than the shared list, because siblings can render the same text.

**Trap:** Using the index as the key "because it removes the warning". The warning goes away and the bug stays. A key only has to be unique among siblings, and it must follow the data, not the position.

**Source:** https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key

### Controlled vs uncontrolled inputs: how does Playwright interact with them?

Topic: react-frontend | Standard | id: q0274

**Say:** In a controlled input, React state holds the value and the input shows `value={state}`, updated by `onChange`. In an uncontrolled input, the DOM holds the value and React reads it when needed, with a `ref` or the form data. Playwright's `fill()` sets the value and fires the input events, so a controlled input updates its state. Typing key by key with `pressSequentially` is needed only when the app reacts to each key. A common bug is setting `input.value` from JavaScript directly, which React does not notice.

**Full process:**

```tsx
import { useState } from 'react';

export function Search() {
  const [query, setQuery] = useState('');
  return (
    <label>
      Search
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
  );
}
```

Test: `await page.getByLabel('Search', { exact: true }).fill('playwright');` then `await expect(...).toHaveValue('playwright')`. Use `toHaveValue` for inputs, since `getByText` does not match input values.

**Follow-ups:**
- *Why not `page.evaluate(el => el.value = ...)`?* It skips the events React listens for.

**Trap:** Using `pressSequentially` on every input to "be realistic". It is slower and gives more room for flakiness. `fill()` is the default, and key by key is for fields with per-key handlers.

**Source:** https://react.dev/reference/react-dom/components/input

### What does React mean for test automation? What problems does it cause?

Topic: react-frontend | Standard | id: q0275

**Say:** Rendering is asynchronous and elements get replaced. So I use locators, which look the element up again on every action, not saved element handles. I use web-first assertions that retry, not sleeps. I wait for the state the user waits for, such as a row, a text or a response. Other effects: a double render in development StrictMode, animations that cover a control during exit, a modal that gives focus back to its opener after its close animation, and views that fetch on mount. Accessible names make locating stable, so missing ones are worth fixing in the product.

**Follow-ups:**
- *Why does `click()` fail with "intercepts pointer events"?* Another element, often an overlay in its exit animation, covers the target. Wait for it to be hidden, not a fixed delay.
- *Detached element error?* Saved a handle, then React replaced the node. Use a locator.
- *Component tests?* Playwright component testing exists, and so does React Testing Library with Vitest or Jest. If you have not used either extensively, say so plainly.

**Trap:** adding `waitForTimeout` after each click because "React is slow".

**Source:** https://playwright.dev/docs/actionability

### What is React Testing Library, and how does it differ from Playwright?

Topic: react-frontend | Standard | id: q0276

**Say:** React Testing Library renders a component in a simulated DOM (jsdom) inside a unit-test runner, and queries it by role, label and text, the way a user would. It is fast, and good for component logic. Playwright drives a real browser against a running app, so it sees layout, real events, network and navigation. I know the idea and use Playwright for what I do. If you have not written large React Testing Library suites, say so.

**Full process:**

```tsx
// Counter.test.tsx, Vitest + React Testing Library with a jsdom environment
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Counter } from './Counter.tsx';

it('increments on click', async () => {
  const user = userEvent.setup();
  render(<Counter label="Clicks" />);

  await user.click(screen.getByRole('button', { name: 'Clicks: 0' }));

  expect(screen.getByRole('button', { name: 'Clicks: 1' })).toBeDefined();
});
```

The query style (`getByRole`) is the same idea as in Playwright, so locator habits transfer.

**Follow-ups:**
- *Why not test everything in jsdom?* jsdom has no layout, so visibility, viewport and CSS behaviour are not real.

**Trap:** Testing component internals such as state or instance methods. The library's idea is to query like a user, by role, label and text, so a test of internals breaks on a harmless refactor.

**Source:** https://testing-library.com/docs/react-testing-library/intro/

### What is semantic HTML, and why does it matter for tests?

Topic: react-frontend | Standard | id: q0277

**Say:** Semantic HTML uses elements that say what they are: `button`, `a`, `nav`, `main`, `label` with `input`, `ul` and `li`, headings in order. Browsers and screen readers turn them into roles and names in the accessibility tree. Playwright's `getByRole` and `getByLabel` use that tree, so semantic markup gives stable, user-facing locators. A `div` with a click handler has no role, no keyboard support and no name, which is both an accessibility bug and a locator problem.

**Full process:**
1. Compare:

```tsx
export function Bad({ onSave }: { onSave: () => void }) {
  return <div className="btn btn-primary" onClick={onSave}>Save</div>;      // no role, not focusable
}

export function Good({ onSave }: { onSave: () => void }) {
  return <button type="button" onClick={onSave}>Save</button>;               // role button, focusable, name "Save"
}
```

2. Test the good one: `page.getByRole('button', { name: 'Save', exact: true })`.
3. Check the tree: Playwright's `locator.ariaSnapshot()` or the browser DevTools Accessibility tab show roles and names.
4. A wrapper with `role="button"` around a real control makes two tab stops. Make the wrapper inert.

**Follow-ups:**
- *`aria-label` vs visible text?* Prefer a visible label. Use `aria-label` when there is no visible text, such as an icon button.
- *First rule of ARIA?* Use native HTML elements when they exist. ARIA adds meaning, not behaviour.

**Trap:** Adding `role` and `aria-label` to every element to make it testable. Wrong ARIA is worse than none, because it changes what a screen reader announces. Use the native element first.

**Source:** https://playwright.dev/docs/locators#locate-by-role

### CSS for testers: selectors, specificity, the box model and what "visible" means.

Topic: react-frontend | Standard | id: q0278

**Say:** A CSS selector picks elements: type (`button`), class (`.card`), id (`#main`), attribute (`[type=submit]`), combinators (descendant, child `>`), and pseudo-classes (`:hover`, `:nth-child`). Specificity decides which rule wins: inline styles beat ids, ids beat classes, classes beat elements. The box model is content, padding, border and margin. For tests, "visible" in Playwright means a non-empty bounding box and no `visibility: hidden`. `display: none` removes it from layout, `visibility: hidden` keeps the space, and `opacity: 0` is still considered visible. I prefer role locators and use CSS only to scope.

**Follow-ups:**
- *Why avoid class selectors in tests?* Class names are styling details that change in a redesign.
- *Element covered by another?* `toBeVisible` can pass while a click is blocked. The click's actionability check catches it.
- *Pseudo-state?* `:hover` styles appear only with a real hover. Playwright's `hover()` triggers it.

**Trap:** Calling a long chain such as `div > div:nth-child(3) > span` precise. It breaks on any layout change. Scope with a role or label locator, then add short CSS only if needed.

**Source:** https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity

### Explain the DOM and events: bubbling, capturing and delegation. What about shadow DOM and iframes?

Topic: react-frontend | Standard | id: q0279

**Say:** The DOM is the browser's tree of the page that JavaScript can read and change. An event first travels down from the window to the target (capturing), then back up (bubbling). A listener on a parent can handle events from children, which is event delegation, and React uses it. `stopPropagation` stops the travel. Shadow DOM encapsulates a component's internals, and Playwright locators pierce open shadow roots by default. An iframe is a separate document, so I enter it with `frameLocator()` narrowed from a stable parent.

**Full process:**

```ts
function wire(list: HTMLElement): void {
  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest('li');
    if (item) console.log('clicked', item.textContent);  // one listener for all items
  });
}
void wire;
```

Playwright with an iframe: `page.frameLocator('iframe[title="Payment"]').getByRole('button', { name: 'Pay', exact: true }).click()`. The iframe content loads separately, so the locator waits for it as for any element.

**Follow-ups:**
- *`target` vs `currentTarget`?* `target` is the element clicked. `currentTarget` is the element the listener is attached to.
- *Storage?* `localStorage` persists, `sessionStorage` lives for the tab, cookies are sent to the server with requests.

**Trap:** Assuming every event bubbles. `focus`, `blur` and `mouseenter` do not, so a delegated listener on a parent misses them (`focusin` and `focusout` do bubble). Also, `page.locator` does not enter an iframe, so use `frameLocator`.

**Source:** https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling

## Python (python)

### What do you use Python for, and how good are you at it?

Topic: python | Standard | id: q0280

**Say:** If you have used Python for scripting, mention how it was applied, such as reading and transforming files, calling APIs, small command line tools, and glue around other tools. Note that automation work may be focused on Playwright with TypeScript. I know the language basics, virtual environments, pytest, and I can read Python test code. I would be productive in a Python suite after a short ramp-up, because the concepts match.

**Follow-ups:**
- *Would you switch a suite to Python?* The language is rarely the hard part. Locators, waiting, test data and CI design carry over. I would pick up the Playwright Python API and pytest fixtures first.

**Trap:** overselling it. Bounded, honest, then the transferable skills.

**Source:** https://docs.python.org/3/tutorial/index.html

### Show a small Python script that reads JSON, calls an API and fails with an exit code.

Topic: python | Standard | id: q0281

**Say:** I use the standard library where I can: `json`, `pathlib`, `argparse`, `urllib.request`, or the `requests` package for nicer HTTP. The script parses arguments, does the work in a function, and exits with a non-zero code on failure, because CI looks at the exit code. I type-hint the signatures.

**Full process:**
1. Save as `check_health.py`:

```python
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

def fetch_json(url: str, timeout: float = 5.0) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned {response.status}")
        return json.loads(response.read().decode("utf-8"))

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check a health endpoint")
    parser.add_argument("url")
    parser.add_argument("--out", type=Path, default=Path("health.json"))
    args = parser.parse_args(argv)

    try:
        body = fetch_json(args.url)
    except (urllib.error.URLError, RuntimeError, TimeoutError) as error:
        print(f"health check failed: {error}", file=sys.stderr)
        return 1

    args.out.write_text(json.dumps(body, indent=2), encoding="utf-8")
    print(f"saved {len(body)} keys to {args.out}")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

2. Run: `python3 check_health.py https://example.test/api/health --out health.json`. `echo $?` shows the exit code: `0` on success, `1` on failure.
3. `urllib.request.urlopen` raises `HTTPError` (a `URLError` subclass) for 4xx and 5xx, so the failure path is covered.
4. `if __name__ == "__main__":` runs `main` only when the file is executed, not when imported by a test.

**Follow-ups:**
- *Why return an int from `main`?* It makes `main` testable with pytest, and `sys.exit` turns it into the exit code.
- *`requests` instead?* Shorter code (`requests.get(url, timeout=5).raise_for_status()`), one more dependency.

**Source:** https://docs.python.org/3/library/argparse.html

### What are the Python basics an interviewer asks? Types, comprehensions, mutable defaults.

Topic: python | Standard | id: q0282

**Say:** Core types: `int`, `float`, `str`, `bool`, `list`, `tuple` (immutable), `dict`, `set`, and `None`. Indentation defines blocks. Comprehensions build lists and dicts in one line. Everything is an object and passed by object reference, so mutable arguments can be changed by a function. A classic trap is a mutable default argument, because the default is created once when the function is defined.

**Full process:**

```python
prices = [10, 20, 30]
doubled = [p * 2 for p in prices if p > 10]          # [40, 60]
by_name = {name: len(name) for name in ["ann", "bob"]}  # {'ann': 3, 'bob': 3}
unique = {1, 2, 2, 3}                                # {1, 2, 3}

def add_item_bad(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

print(add_item_bad("a"))   # ['a']
print(add_item_bad("b"))   # ['a', 'b']  the same list is reused

def add_item(item: str, items: list[str] | None = None) -> list[str]:
    items = [] if items is None else items
    items.append(item)
    return items

print(add_item("a"))       # ['a']
print(add_item("b"))       # ['b']
print(doubled, by_name, unique)
```

**Follow-ups:**
- *`is` vs `==`?* `==` compares values, `is` compares identity. Use `is None` for `None`.
- *List vs tuple?* A list is mutable. A tuple is not, so it can be a dict key when all its items are hashable.
- *Type hints?* They are checked by tools such as mypy or pyright, not at runtime.

**Source:** https://docs.python.org/3/faq/programming.html

### What is a virtual environment and how do you manage dependencies in Python?

Topic: python | Standard | id: q0283

**Say:** A virtual environment is an isolated folder with its own Python and packages, so projects do not clash. I create it with `python3 -m venv .venv`, activate it, install with `pip install`, and freeze versions in a `requirements.txt` (or `pyproject.toml` with a lock file from a tool such as uv or Poetry). It is the same idea as `node_modules` plus `package-lock.json`. CI creates a fresh environment and installs from the pinned file.

**Full process:**
1. `python3 -m venv .venv`
2. `source .venv/bin/activate` (on Windows PowerShell: `.venv\Scripts\Activate.ps1`)
3. `pip install pytest pytest-playwright`
4. `pip freeze > requirements.txt` records exact versions. Install elsewhere with `pip install -r requirements.txt`.
5. Add `.venv/` to `.gitignore`.

**Follow-ups:**
- *Why not install globally?* Two projects needing different versions of the same package would break each other.

**Source:** https://docs.python.org/3/library/venv.html

### How does Playwright for Python differ from the TypeScript version?

Topic: python | Standard | id: q0284

**Say:** Same engine and same ideas: locators, auto-waiting, web-first assertions, fixtures through `pytest-playwright`. Differences: snake_case names (`get_by_role`, `to_be_visible`), a sync API by default (no `await`), pytest instead of the Playwright test runner, and some features of the TypeScript runner, such as `test.extend` fixtures and sharding flags, come from pytest and plugins instead. If you know Playwright from TypeScript, say so, and say you would check the Python docs for the exact names.

**Full process:** the equivalent of a TypeScript test:

```python
from playwright.sync_api import Page, expect

def test_save_shows_confirmation(page: Page) -> None:
    page.goto("https://example.test/orders/new")
    page.get_by_label("Title", exact=True).fill("Order A")
    page.get_by_role("button", name="Save", exact=True).click()
    expect(page.get_by_role("status")).to_have_text("Saved")
```

Install with `pip install pytest-playwright` and `playwright install`, then run `pytest`.

**Follow-ups:**
- *Is there an async version?* Yes, `playwright.async_api` with `asyncio`, mostly for bigger frameworks.

**Source:** https://playwright.dev/python/docs/intro

## Java and C# (java-dotnet)

### Do you know Java or C#?

Topic: java-dotnet | Core | id: q0285

**Say:** If you have not used Java or C# for test automation, say so plainly and name the languages you have used. Then show you know how they differ: both are statically typed and class-based, tests are written with JUnit or TestNG in Java and NUnit, xUnit or MSTest in C#, builds use Maven or Gradle in Java and NuGet with `dotnet` in C#. Playwright and Selenium both have Java and .NET versions with the same ideas. I would learn the syntax quickly, the testing concepts are what I already know.

**Follow-ups:**
- *How would you ramp up?* Port a small existing Playwright TypeScript suite into the target language, read the framework's docs, and ask for code reviews early.

**Trap:** claiming "a little Java". If asked about specifics, I cannot answer them, so I say what I know and what I do not.

**Source:** https://playwright.dev/java/docs/intro and https://playwright.dev/dotnet/docs/intro

### How do Java or C# test frameworks compare to what you know?

Topic: java-dotnet | Core | id: q0286

**Say:** The structure is the same: a test is a method marked with an annotation or attribute (`@Test` in JUnit 5, `[Test]` in NUnit, `[Fact]` in xUnit), setup and teardown have their own annotations, and assertions come from a library. Dependency injection and parameterised tests exist in all of them. The difference from TypeScript is the heavier build and types, and no `async` event loop, because Java and C# use threads (and `async/await` with `Task` in C#). I would map concepts one to one: fixtures to setup methods or constructor injection, `test.each` to parameterised tests.

**Follow-ups:**
- *What carries over directly?* Page objects, test data builders, flaky-test analysis, CI design, API contract thinking.

**Source:** https://junit.org/junit5/docs/current/user-guide/ and https://learn.microsoft.com/en-us/dotnet/core/testing/

### Which language would you choose for a new test suite, and why?

Topic: java-dotnet | Core | id: q0287

**Say:** I would choose the language the team already writes the product or other tests in, so developers can review and help. For a web product with a JavaScript frontend I prefer TypeScript, because the types catch mistakes and the Playwright test runner is first class. If the team is a Java or .NET shop, the Playwright and Selenium bindings exist, and shared language helps with code reviews and hiring. The language matters less than the design: stable locators, isolated data, fast feedback.

**Follow-ups:**
- *Does Playwright feature-parity hold across languages?* The test runner is richest in TypeScript. Other languages use their own runners, so some runner features differ.

**Source:** https://playwright.dev/docs/languages

## Practice tasks: write this, or say what it prints

Cover the answer, write or predict, then run the file with `node file.ts` (Node 22.18 or later) and compare. Each file is a standalone script that also compiles under `strict` with `npx tsc --noEmit`. Task 8 uses top-level `await`, so save it as `.mts` or put `"type": "module"` in `package.json`.

### Task 1: What does this print? (typeof)

Topic: js-core | Standard | id: q0288

**Say:** Five results from `typeof`. `typeof null` is `'object'` (an old quirk), arrays are `'object'`, `NaN` is a `number`. I check null and arrays by hand because `typeof` cannot tell them apart from plain objects.

**Full process:**

```ts
console.log(typeof null, typeof [], typeof (() => 1), typeof NaN, typeof undefined);
```

Output: `object object function number undefined`.

**Follow-ups:**
- *How do you check for an array and for null?* `Array.isArray(x)` and `x === null`.
- *What does `typeof` give for an undeclared variable?* `'undefined'`, and it does not throw.

**Trap:** Answering `'null'` for `typeof null`, `'array'` for an array, or `'NaN'` for `typeof NaN`. The first two are `'object'`, and `NaN` is a `number`.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof

### Task 2: What does this print? (`var` and `let` in a loop with `setTimeout`)

Topic: js-core | Standard | id: q0289

**Say:** The `var` callbacks all see the same `i`, which is `3` when the timers fire. Each `let` iteration has its own `j`. All six callbacks run after the loops, in the order they were queued.

**Full process:**

```ts
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log('var', i), 0);
}
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log('let', j), 0);
}
```

Output: `var 3` three times, then `let 0`, `let 1`, `let 2`.

**Follow-ups:**
- *How do you fix the `var` version without `let`?* Wrap the body in a function that takes `i` as a parameter, or pass it as the extra argument of `setTimeout`.
- *Why do the two groups keep their order?* A zero-delay timer is a macrotask, and macrotasks with the same delay run in the order they were queued.

**Trap:** Printing `0 1 2` for the `var` loop. The callbacks run after the loop ended, when the one shared `i` is `3`.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let

### Task 3: What does this print? (`map(parseInt)`)

Topic: js-core | Standard | id: q0290

**Say:** `map` passes `(value, index, array)`, and `parseInt` reads the index as the radix. So `parseInt('2', 1)` is `NaN` (radix 1 is invalid) and `parseInt('3', 2)` is `NaN` (3 is not a binary digit). The fix is to wrap it and pass 10.

**Full process:**

```ts
console.log(['1', '2', '3'].map(parseInt));
console.log(['1', '2', '3'].map((s) => parseInt(s, 10)));
```

Output: `[ 1, NaN, NaN ]`, then `[ 1, 2, 3 ]`.

**Follow-ups:**
- *Why does `parseInt('1', 0)` work?* A radix of `0` or `undefined` is treated as 10 (a `0x` prefix switches to 16).
- *What is a shorter fix?* `map(Number)`: `Number` ignores the extra arguments.

**Trap:** Expecting `[1, 2, 3]`, or `[1, NaN, 3]`. The first item works only because index `0` means radix `0`, which is treated as 10. The next two fail.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt

### Task 4: What does this print? (`sort` without a comparator)

Topic: js-core | Standard | id: q0291

**Say:** The default sort converts items to strings, so `10` comes before `9`. A comparator `(a, b) => a - b` sorts numbers. `sort` also changes the array in place.

**Full process:**

```ts
console.log([10, 9, 1, 100].sort());
console.log([10, 9, 1, 100].sort((a, b) => a - b));
```

Output: `[ 1, 10, 100, 9 ]`, then `[ 1, 9, 10, 100 ]`.

**Follow-ups:**
- *How do you sort without changing the original?* `toSorted` (ES2023) returns a new array, or copy first with `[...items].sort(...)`.
- *How do you sort text with accents correctly?* `a.localeCompare(b)` as the comparator.

**Trap:** Believing `sort()` sorts numbers by value, or that it returns a copy. It compares strings and it changes the array in place.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort

### Task 5: What does this print? (coercion)

Topic: js-core | Standard | id: q0292

**Say:** `+` with a string concatenates, so `'5' + 3` is `'53'`. `-` converts to numbers. An array turns into text with `join`, so `[1, 2] + ''` is `'1,2'`. Floating point makes `0.1 + 0.2 === 0.3` false. `Number('')` is `0`, spaces are trimmed, and a comma is not a decimal point.

**Full process:**

```ts
console.log('5' + 3);
console.log(Number('5') - 3);
console.log([1, 2] + '');
console.log(0.1 + 0.2 === 0.3);
console.log(Number(true) + 1, Number('') , Number(' 12 '), Number('1,5'));
```

Output: `53`, `2`, `1,2`, `false`, then `2 0 12 NaN`.

**Follow-ups:**
- *How do you compare floats in a test?* Playwright has `toBeCloseTo`, for example `expect(0.1 + 0.2).toBeCloseTo(0.3)`. In plain code compare with a tolerance.
- *What are `null + 1` and `undefined + 1`?* `1` and `NaN`.

**Trap:** Saying `Number('')` is `NaN`. It is `0`, while `Number('1,5')` is `NaN`, so a price typed with a comma needs parsing before `Number`.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness

### Task 6: What does this print? (closures)

Topic: js-core | Standard | id: q0293

**Say:** Each call to `makeCounter` creates its own `n`. The two counters do not share state. The calls run left to right: `a()` gives 1, `a()` 2, `b()` 10, `a()` 3, `b()` 20.

**Full process:**

```ts
function makeCounter(step: number): () => number {
  let n = 0;
  return () => (n += step);
}
const a = makeCounter(1);
const b = makeCounter(10);
console.log(a(), a(), b(), a(), b());
```

Output: `1 2 10 3 20`.

**Follow-ups:**
- *What is this pattern used for?* Private state: nothing outside can reach `n` except through the returned function.
- *What changes if `n` is declared outside `makeCounter`?* Both counters share it, so the output becomes `1 2 12 13 23`.

**Trap:** Saying the two counters share `n`, or that `n` resets on each call. Each `makeCounter` call creates a new scope, and the returned function keeps its own `n` alive.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures

### Task 7: What does this print? (async order)

Topic: js-async | Standard | id: q0294

**Say:** Synchronous lines first: `A`, then `first start`, then `second` (an async function runs synchronously until its first `await`), then `B`. Then the microtasks in queue order: the continuation of `first` was queued before the `then` callbacks, so `first end`, `then 1`, `then 2`. The timeout is a macrotask and is last.

**Full process:**

```ts
async function first(): Promise<void> {
  console.log('first start');
  await second();
  console.log('first end');
}
async function second(): Promise<void> {
  console.log('second');
}
console.log('A');
setTimeout(() => console.log('timeout'), 0);
void first();
Promise.resolve().then(() => console.log('then 1')).then(() => console.log('then 2'));
console.log('B');
```

Output, one per line: `A`, `first start`, `second`, `B`, `first end`, `then 1`, `then 2`, `timeout`.

**Follow-ups:**
- *Why does `first end` come before `then 1`?* The `await` queued its continuation before the `then` callback was queued, and microtasks run in queue order.
- *Why is the timer last?* Timer callbacks are macrotasks. The engine drains all microtasks first.

**Trap:** Putting `timeout` before `then 1` because the delay is zero. A zero-delay timer still waits for the next macrotask, after every microtask.

**Source:** https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide

### Task 8: What does this print? (`allSettled`, `all`, `race`)

Topic: js-async | Standard | id: q0295

**Say:** `allSettled` waits for all and keeps input order, so the result is `a`, the rejection message `x`, `c`. `Promise.all` rejects as soon as the failing promise rejects, at 10 ms. `race` settles with the first to finish, the 5 ms one.

**Full process:**

```ts
const ok = (v: string, ms: number): Promise<string> =>
  new Promise((resolve) => setTimeout(() => resolve(v), ms));
const bad = (ms: number): Promise<string> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error('x')), ms));

const settled = await Promise.allSettled([ok('a', 20), bad(10), ok('c', 5)]);
console.log(settled.map((r) => (r.status === 'fulfilled' ? r.value : r.reason.message)));

try {
  await Promise.all([ok('a', 20), bad(10), ok('c', 5)]);
} catch (e) {
  console.log('all failed with', (e as Error).message);
}
console.log(await Promise.race([ok('slow', 20), ok('fast', 5)]));
```

Output: `[ 'a', 'x', 'c' ]`, `all failed with x`, `fast`.

**Follow-ups:**
- *Does `Promise.all` cancel the other promises?* No. They keep running, and `all` just stops waiting.
- *What would `Promise.any` give with the same inputs?* `'c'`, the first fulfilled one, at 5 ms.

**Trap:** Saying `Promise.all` waits 20 ms and returns partial results. It rejects at 10 ms with `x`, and the other promises still run but their results are ignored.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled

### Task 9: What does this print? (lost `this`)

Topic: js-core | Standard | id: q0296

**Say:** A method call sets `this` to the object. Copying the method into a variable and calling it plainly loses `this`, which is `undefined` in strict code, so `this?.name` is `undefined`. Without the `?.` it would throw a `TypeError`.

**Full process:**

```ts
const user = {
  name: 'Ann',
  hello(): string {
    return `hi ${this?.name}`;
  },
};
const hello = user.hello;
console.log(user.hello());
console.log(hello());
```

Output: `hi Ann`, then `hi undefined`.

**Follow-ups:**
- *How do you fix it?* Call it on the object, `user.hello()`, or bind it, `user.hello.bind(user)`.
- *Where does this bite in test code?* Passing `this.method` as a callback from a page object, for example to `map` or `then`. An arrow function property keeps `this`.

**Trap:** Expecting `hi Ann` because the function is written inside the object. For a regular function `this` depends on how it is called, not where it is defined.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this

### Task 10: What does this print? (`||` vs `??`)

Topic: ts-core | Standard | id: q0297

**Say:** `||` replaces every falsy value, `??` only `null` and `undefined`. So `0 || 3` is `3` but `0 ?? 3` is `0`. For the empty string, `||` gives `'none'` and `??` keeps the empty string. The optional chain returns `undefined` when `timeout` is missing, then `??` picks 5000.

**Full process:**

```ts
const retries: number = 0;
const label: string = '';
console.log(retries || 3, retries ?? 3);
console.log(label || 'none', label ?? 'none');
const config: { timeout?: { ms: number } } = {};
console.log(config.timeout?.ms ?? 5000);
```

Output: `3 0`, then `none ` (the second value is an empty string), then `5000`.

**Follow-ups:**
- *Can you mix `??` with `||` without parentheses?* No, that is a syntax error.
- *What does `??=` do?* It assigns only when the left side is `null` or `undefined`: `config.timeout ??= 5000`.

**Trap:** Using `||` for defaults of numbers, booleans or strings. `retries || 3` turns a valid `0` into `3`, and `false` or `''` get replaced too.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing

### Task 11: Write a function that counts how often each word appears in a text.

Topic: js-core | Standard | id: q0298

**Say:** Lowercase, split on whitespace, drop empty items, and count in a record. The `?? 0` handles the first occurrence. I choose `Record<string, number>` for the return type.

**Full process:**

```ts
function countWords(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
}
console.log(countWords('The cat and the hat'));
```

Input `'The cat and the hat'` gives `{ the: 2, cat: 1, and: 1, hat: 1 }`. A `Map` is the alternative when keys can clash with object properties, such as the word `constructor`.

**Follow-ups:**
- *What breaks with the word `constructor`?* `counts['constructor']` finds the inherited function, so `?? 0` does not apply and the count is garbage. Use a `Map`.
- *How do you strip punctuation?* `text.replace(/[^\p{L}\p{N}\s]/gu, '')` before the split.

**Trap:** Splitting on `' '`. Two spaces create an empty item that is counted as a word. Split on `/\s+/` and filter out empty strings, and lowercase first.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map

### Task 12: Write a generic `unique` function that removes duplicates and keeps the type.

Topic: ts-core | Standard | id: q0299

**Say:** A `Set` keeps unique values by identity for primitives. The generic `T` keeps the item type, so the result of `unique([1, 2])` is `number[]`. For objects, `Set` compares references, so two equal-looking objects both stay.

**Full process:**

```ts
function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
console.log(unique([1, 2, 2, 3, 1]), unique(['a', 'b', 'a']));
```

Output: `[ 1, 2, 3 ] [ 'a', 'b' ]`.

**Follow-ups:**
- *How do you remove duplicates by a key?* `[...new Map(items.map((i) => [i.id, i])).values()]`, which keeps the last item for each key.
- *Does a `Set` treat `NaN` as equal to `NaN`?* Yes, it uses the SameValueZero comparison.

**Trap:** Writing `items.filter((x, i) => items.indexOf(x) === i)`. It works but is quadratic. Another wrong belief is that a `Set` removes objects with equal content. It compares references.

**Source:** https://www.typescriptlang.org/docs/handbook/2/generics.html

### Task 13: Write `pick(obj, keys)` that returns an object with only the chosen keys, fully typed.

Topic: ts-core | Standard | id: q0300

**Say:** Two type parameters: `T` for the object and `K extends keyof T` for the keys, so a typo in a key is a compile error. The return type is the built-in `Pick<T, K>`. The `{} as Pick<T, K>` cast is the one place I tell the compiler what the loop will fill.

**Full process:**

```ts
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
const user = { id: 1, name: 'Ann', email: 'ann@example.test' };
const small = pick(user, ['id', 'name']);
console.log(small);
```

Output: `{ id: 1, name: 'Ann' }`. `pick(user, ['nmae'])` does not compile.

**Follow-ups:**
- *Why `K extends keyof T`?* A wrong key is a compile error and `obj[key]` is typed `T[K]`.
- *How would you write `omit`?* Copy the object, skip the listed keys, and return `Omit<T, K>`.

**Trap:** Typing `obj` as `any` and `keys` as `string[]`. It compiles, loses the checking, and a typo in a key returns `undefined` silently.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys

### Task 14: Write `chunk(items, size)` that splits an array into groups.

Topic: js-core | Standard | id: q0301

**Say:** Loop in steps of `size` and `slice`. I guard against a non-positive or non-integer size, because `size = 0` would loop forever. An empty array gives an empty result.

**Full process:**

```ts
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('size must be a positive integer');
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
console.log(chunk([1, 2, 3, 4, 5], 2));
console.log(chunk([], 3));
```

Output: `[ [ 1, 2 ], [ 3, 4 ], [ 5 ] ]`, then `[]`.

**Follow-ups:**
- *Is there a version without a loop?* `Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))`.
- *What happens when `size` is larger than the array?* One group with all items.

**Trap:** Using `splice` inside the loop. It changes the caller's array, so the data is gone after the call. `slice` leaves the input alone.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice

### Task 15: Write `flatten` for arbitrarily nested arrays (and name the built-in).

Topic: js-core | Standard | id: q0302

**Say:** A recursive type `Nested<T>` describes the input, and the function recurses when an item is an array. The built-in is `array.flat(Infinity)`. Recursion depth is limited by the stack for extremely deep input.

**Full process:**

```ts
type Nested<T> = T | Nested<T>[];

function flatten<T>(input: Nested<T>[]): T[] {
  const result: T[] = [];
  for (const item of input) {
    if (Array.isArray(item)) result.push(...flatten(item));
    else result.push(item);
  }
  return result;
}
console.log(flatten<number>([1, [2, [3, [4]], 5]]));
console.log([1, [2, [3, [4]], 5]].flat(Infinity));
```

Output: `[ 1, 2, 3, 4, 5 ]` for both.

**Follow-ups:**
- *Can you avoid recursion?* Yes, with an explicit stack: pop an item, push its children if it is an array, otherwise add it to the result. Mind the order.
- *Does `flat` change the original?* No, it returns a new array.

**Trap:** Calling `.flat()` with no argument and expecting full flattening. The default depth is 1, so `[1, [2, [3]]]` becomes `[1, 2, [3]]`. You need `.flat(Infinity)`.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat

### Task 16: Write `reverse` without `Array.reverse`, and a palindrome check.

Topic: js-core | Standard | id: q0303

**Say:** Walk the string with `for...of`, which iterates code points, and prepend each character. For a palindrome, lowercase, remove non-alphanumerics, and compare with the reverse. Emoji and combining marks are an edge case I would mention.

**Full process:**

```ts
function reverse(text: string): string {
  let out = '';
  for (const ch of text) out = ch + out;
  return out;
}
function isPalindrome(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === reverse(clean);
}
console.log(reverse('abc'), isPalindrome('A man, a plan, a canal: Panama'), isPalindrome('abc'));
```

Output: `cba true false`.

**Follow-ups:**
- *Why `for...of` and not an index loop?* It walks code points, so a surrogate pair stays whole. Combining marks still split, and `Intl.Segmenter` handles graphemes.
- *What is the one-liner?* `[...text].reverse().join('')`, which is fine once the restriction on `reverse` is lifted.

**Trap:** Writing `text.split('').reverse().join('')`. `split('')` cuts by UTF-16 units, so an emoji breaks into two broken halves. Also forgetting to lowercase and strip punctuation in the palindrome check.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of

### Task 17: Write `findDuplicates` that returns the values appearing more than once.

Topic: js-core | Standard | id: q0304

**Say:** Two sets: `seen` and `dupes`. One pass, linear time. A nested loop would be quadratic. The result keeps the order in which the duplicates were first detected.

**Full process:**

```ts
function findDuplicates<T>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const dupes = new Set<T>();
  for (const item of items) {
    if (seen.has(item)) dupes.add(item);
    seen.add(item);
  }
  return [...dupes];
}
console.log(findDuplicates([1, 2, 3, 2, 1, 4, 2]));
```

Output: `[ 2, 1 ]` for `[1, 2, 3, 2, 1, 4, 2]`.

**Follow-ups:**
- *What if you also need the counts?* Count in a `Map`, then keep the entries with a count above 1.
- *What about objects?* A `Set` compares references, so key the check by a field such as `id`.

**Trap:** Using nested loops or `includes` on an array. It is quadratic. Without the second set, a value seen three times is returned twice.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set

### Task 18: Write `missingNumber`: numbers from 1 to n with one missing, find it.

Topic: js-core | Standard | id: q0305

**Say:** The sum of 1 to n is `n * (n + 1) / 2`. Subtract the actual sum and what is left is the missing number. Linear time, constant memory. This assumes exactly one missing and no duplicates.

**Full process:**

```ts
function missingNumber(numbers: readonly number[], n: number): number {
  const expected = (n * (n + 1)) / 2;
  const actual = numbers.reduce((sum, x) => sum + x, 0);
  return expected - actual;
}
console.log(missingNumber([1, 2, 4, 5], 5));
```

Output: `3` for `[1, 2, 4, 5]` with n = 5.

**Follow-ups:**
- *What if two numbers are missing?* The sum alone is not enough. Use a `Set` of the present values, or the sum and the sum of squares.
- *Can the sum overflow?* Numbers are exact up to `Number.MAX_SAFE_INTEGER`, about 9e15, so `n(n+1)/2` is safe up to n of roughly 134 million. Past that use `BigInt` or XOR.

**Trap:** Using `numbers.length` as `n`. The array has `n - 1` items, so `n` must be passed in, or use `length + 1`. This off-by-one is the usual wrong answer.

**Source:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce

### Task 19: What are the types `A` to `E`? (utility types)

Topic: ts-core | Standard | id: q0306

**Say:** `Pick` keeps listed keys and the optional flag, `Omit` removes keys, `Required<User>['email']` is `string` because `Required` removes the `?`, `keyof User` is the union of the three keys, and `Awaited<ReturnType<...>>` unwraps the promise to `User[]`. The file checks each claim with a small `Equal` helper. A wrong claim becomes a compile error, which I confirmed by changing one.

**Full process:**

```ts
interface User { id: number; name: string; email?: string }

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const check = <T extends true>(): T | undefined => undefined;

type A = Pick<User, 'id' | 'email'>;
type B = Omit<User, 'email'>;
type C = Required<User>['email'];
type D = keyof User;
type E = Awaited<ReturnType<() => Promise<User[]>>>;

check<Equal<A, { id: number; email?: string }>>();
check<Equal<B, { id: number; name: string }>>();
check<Equal<C, string>>();
check<Equal<D, 'id' | 'name' | 'email'>>();
check<Equal<E, User[]>>();
console.log('all five type checks compile');
```

Output: `all five type checks compile`. Types: `A` is `{ id: number; email?: string }`, `B` is `{ id: number; name: string }`, `C` is `string`, `D` is `'id' | 'name' | 'email'`, `E` is `User[]`.

**Follow-ups:**
- *What is the difference between `Omit` and `Exclude`?* `Omit` removes keys from an object type. `Exclude` removes members from a union.
- *Why use an `Equal` helper and not assignability?* `readonly` does not affect assignability, and `any` is assignable both ways, so two-way assignment misses real differences.

**Trap:** Expecting `Omit<User, 'emial'>` to error on a typo. `Omit` accepts any key name, so a misspelt key silently removes nothing. `Pick` rejects it.

**Source:** https://www.typescriptlang.org/docs/handbook/utility-types.html

### Task 20: Write an exhaustive `switch` over a union of three statuses.

Topic: ts-core | Standard | id: q0307

**Say:** Each case returns a string and the `default` passes the value to `assertNever`. If someone adds a fourth status and forgets a case, the argument is no longer `never` and the build fails. That is the discriminated-union check from earlier.

**Full process:**

```ts
type Result =
  | { status: 'ok'; data: string }
  | { status: 'error'; message: string }
  | { status: 'loading' };

function assertNever(x: never): never {
  throw new Error(`unhandled: ${JSON.stringify(x)}`);
}

function describeResult(r: Result): string {
  switch (r.status) {
    case 'ok': return `data: ${r.data}`;
    case 'error': return `error: ${r.message}`;
    case 'loading': return 'loading';
    default: return assertNever(r);
  }
}
console.log(describeResult({ status: 'ok', data: 'x' }), describeResult({ status: 'loading' }));
```

Output: `data: x loading`.

**Follow-ups:**
- *What other ways give the same check?* Assign to a `never` variable in the default branch, or turn on the typescript-eslint rule `switch-exhaustiveness-check`.
- *What does `assertNever` do at run time?* It throws, so a value that bypassed the types (for example from JSON) fails loudly.

**Trap:** Writing `default: return 'unknown'`. It still compiles when a fourth status is added, so the missing case shows up at run time instead of in the build.

**Source:** https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
