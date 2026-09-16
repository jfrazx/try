# Toolchain Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and modernize the `@status/try` toolchain — test runner, linter, compiler, bundler, CI and release — without changing library behavior.

**Architecture:** Six sequential PRs into `develop`, decomposed into 10 tasks. PR 1 restores a working lint and test signal so everything after it is verifiable. PR 2 swaps the test runner against that green baseline. PR 3 moves the compiler and build. PR 4 wires publishing. PRs 5-6 are documentation. Each task ends with a verified, independently reviewable deliverable.

**Tech Stack:** TypeScript 6, Jest 30 + `@swc/jest`, ESLint 10 flat config, tsdown (Rolldown), semantic-release via npx, GitHub Actions, npm trusted publishing (OIDC).

**Spec:** `docs/superpowers/specs/2026-09-16-toolchain-modernization-design.md`

## Global Constraints

- **Library behavior must not change.** No edits to `src/**` logic in Tasks 1-9. Task 10 adds comments only.
- **Legacy decorators stay.** `experimentalDecorators: true` is retained everywhere. Never introduce Stage 3 decorators — tsdown does not support them.
- **`emitDecoratorMetadata` is removed.** Nothing consumes it; there is no `reflect-metadata` dependency.
- **TypeScript `^6.0.3`.** Never 7.x — tooling support is too sparse. If TS 6 misbehaves, fall back to `^5.9.3` and record why.
- **ESLint `^10.10`.** eslintrc format is unsupported in ESLint 10; flat config only.
- **Dev/CI Node floor is 22.18.** Driven by tsdown (`^22.18 || ^24.11 || >=26`) and semantic-release (`^22.14 || >=24.10`).
- **Published `engines.node` is `>=20.19.0`.** This is the consumer floor and is deliberately lower than the dev floor.
- **Test baseline is 27 passing.** 1 (catch) + 10 (catchError) + 12 (try) + 2 (tryCatch) + 2 (tryManager). This number must never drop.
- **No `NPM_TOKEN`.** Publishing uses OIDC trusted publishing. Never add an npm token to the repo, its secrets, or any workflow.
- **`semantic-release` is not a devDependency.** It runs via `npx semantic-release` and uses only its four bundled plugins.
- **Commits are GPG-signed.** `git commit` fails non-interactively with "gpg: signing failed: Timeout". Do not pass `--no-gpg-sign`. Stage the changes, hand over the prepared commit message, and let Jason commit.
- **No co-author or tool-attribution trailers** in commit messages. Not `Co-Authored-By:`, not `Generated with`.

---

### Task 1: ESLint 10 flat config

Replaces the crashing `.eslintrc`. `npx eslint` currently dies with "Cannot read config file: .../eslint-config-prettier/@typescript-eslint.js" because that export was removed in eslint-config-prettier 8.

**Files:**
- Create: `eslint.config.mjs`
- Delete: `.eslintrc`
- Modify: `package.json` (devDependencies, scripts)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`

- [ ] **Step 1: Confirm the current failure**

Run: `npx eslint src/index.ts`
Expected: FAIL — `Cannot read config file` referencing `prettier/@typescript-eslint`. Capture this output; it is the "before" evidence.

- [ ] **Step 2: Swap the lint dependencies**

```bash
npm uninstall @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-node eslint-plugin-prettier
npm install --save-dev eslint@^10.10.0 @eslint/js@^10.10.0 typescript-eslint@^8.70.0 eslint-config-prettier@^10.1.8 globals@^16.0.0
```

`eslint-plugin-node` is unmaintained. `eslint-plugin-prettier` is dropped because running Prettier as a lint rule is no longer recommended — Prettier gets its own scripts in Step 4.

- [ ] **Step 3: Create `eslint.config.mjs`**

```js
// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';

export default tseslint.config(
  { ignores: ['dist/**', 'build/**', 'coverage/**', 'docs/api/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { sourceType: 'module' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { '@typescript-eslint/ban-ts-comment': 'off' },
  },
  prettier,
);
```

Two rules need explaining so they are not "cleaned up" later by mistake:
- `no-empty-object-type` is off because the library's extension pattern relies on it — `export interface Gambler extends TryCatchExtension<Gambler, keyof GamblerProps> {}` in `test/lib/gambler.ts` is an intentional empty interface.
- `ban-ts-comment` is off for tests only, because `test/try.spec.ts` uses `@ts-ignore` and `test/catch.spec.ts` uses `@ts-expect-error` to assert compile-time rejection of decorated properties.

Everything else from the old `.eslintrc` is deliberately dropped. `no-underscore-dangle`, `arrow-body-style`, `no-plusplus`, `func-names`, `prefer-destructuring`, `no-else-return`, `no-console` and `comma-dangle` all set rules to `0` that were never switched on, because the old config never extended airbnb. Carrying them forward would be copying dead config.

- [ ] **Step 4: Delete the old config and add scripts**

```bash
rm .eslintrc
```

Add to `package.json` `scripts`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write \"{src,test}/**/*.ts\" \"*.{json,md}\"",
"format:check": "prettier --check \"{src,test}/**/*.ts\" \"*.{json,md}\""
```

- [ ] **Step 5: Verify lint runs and passes**

Run: `npm run lint`
Expected: PASS, exit 0, no config error. If rule violations appear in `src/**`, fix them with `npm run lint:fix` — but if a fix would change runtime behavior, stop and report instead. Global constraint: library behavior must not change.

- [ ] **Step 6: Verify formatting is clean**

Run: `npm run format:check`
Expected: PASS. If it fails, run `npm run format` and re-check.

- [ ] **Step 7: Stage and hand over**

```bash
git add eslint.config.mjs package.json package-lock.json
git rm --cached .eslintrc
```

Prepared message:

```
fix(lint): replace broken eslintrc with ESLint 10 flat config

The .eslintrc extended prettier/@typescript-eslint, removed in
eslint-config-prettier 8, so eslint crashed on every invocation. No lint
script existed, so this was never surfaced.

Moves to ESLint 10 flat config with typescript-eslint 8, drops the
unmaintained eslint-plugin-node and the eslint-plugin-prettier rule
integration, and adds lint/format scripts.
```

---

### Task 2: Repair CI workflows and unbreak the test run

`test.yml` triggers on `[main, develop]`, but the default branch is `master` — CI has never run on the main branch. Separately, `npm test` fails on Node >=22.18 because native type-stripping intercepts the `.ts` files before ts-node can and rejects decorator syntax.

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/c-spell.yml`
- Modify: `.github/workflows/codeql.yml`
- Create: `.github/workflows/lint.yml`
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: `npm run lint` and `npm run format:check` from Task 1
- Produces: a green `Test` workflow on `master` and `develop`; 27 passing tests on Node 24

- [ ] **Step 1: Confirm the test failure and the fix**

```bash
npm test 2>&1 | head -5
NODE_OPTIONS="--no-experimental-strip-types" npx cross-env TS_NODE_PROJECT='./test/tsconfig.json' mocha 2>&1 | tail -3
```

Expected: the first FAILS with `SyntaxError ... Invalid or unexpected token`; the second reports `27 passing`. This confirms type-stripping is the cause.

- [ ] **Step 2: Apply the stopgap to the test script**

In `package.json`:

```json
"test": "cross-env TS_NODE_PROJECT='./test/tsconfig.json' NODE_OPTIONS=--no-experimental-strip-types mocha"
```

This is deliberately temporary. Task 5 deletes it along with ts-node, cross-env and mocha. Its only job is to give Task 3's conversion a green baseline to diff against.

- [ ] **Step 3: Verify the stopgap**

Run: `npm test`
Expected: `27 passing`.

- [ ] **Step 4: Fix `test.yml`**

```yaml
name: Test

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [22.18.0, 24.15.0]

    steps:
      - uses: actions/checkout@v6
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm test
```

The branch list is the substantive fix. Node 20 is dropped now rather than in Task 7, so the matrix never has to change again.

- [ ] **Step 5: Create `lint.yml`**

```yaml
name: Lint

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  lint:
    timeout-minutes: 5
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24.15.0
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm run lint
      - run: npm run format:check
```

- [ ] **Step 6: Refresh the other two workflows**

In `.github/workflows/c-spell.yml`: change `actions/checkout@v4` to `@v6`, `actions/setup-node@v4` to `@v6`, `node-version: latest` to `node-version: 24.15.0`, and the trigger branches to `[master, develop]`.

In `.github/workflows/codeql.yml`: change `actions/checkout@v4` to `@v6` and both `github/codeql-action/*@v3` to `@v4`.

- [ ] **Step 7: Verify workflow syntax**

Run: `npx --yes @action-validator/cli@latest .github/workflows/test.yml .github/workflows/lint.yml .github/workflows/c-spell.yml .github/workflows/codeql.yml`
Expected: no errors. If the validator is unavailable offline, fall back to `python3 -c "import yaml,sys,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('yaml ok')"`.

- [ ] **Step 8: Stage and hand over**

```bash
git add .github/workflows/ package.json
```

Prepared message:

```
fix(ci): run on master, refresh actions, unbreak the test run

test.yml triggered on 'main', which does not exist in this repo, so CI
never ran on the default branch.

Node >=22.18 strips types natively before ts-node can register, which
rejects decorator syntax and breaks the suite. Sets
--no-experimental-strip-types as a stopgap until the Jest migration
removes ts-node entirely.

Adds a lint workflow and pins exact Node versions.
```

---

### Task 3: Jest infrastructure + first spec conversion

Stands up Jest with SWC and proves the decorator transform works, converting the smallest spec file (2 tests) as the pilot. Mocha still runs the other four.

**Files:**
- Create: `.swcrc`
- Create: `jest.config.mjs`
- Modify: `test/tryManager.spec.ts`
- Modify: `package.json` (devDependencies, scripts)

**Interfaces:**
- Consumes: the 27-passing baseline from Task 2
- Produces: `npm run test:jest` (temporary, removed in Task 5), a working `@swc/jest` decorator transform

- [ ] **Step 1: Install Jest and SWC**

```bash
npm install --save-dev jest@^30.5.1 @types/jest@^30.0.0 @swc/core@^1.16.2 @swc/jest@^0.2.39
```

`@types/jest` rather than `@jest/globals`: the converted specs call `describe`,
`it` and `expect` as bare globals without importing them, and `@jest/globals`
only supplies types at an explicit import site. Using it here would leave
`npm run typecheck` failing with "Cannot find name 'describe'" in Task 6.

- [ ] **Step 2: Create `.swcrc`**

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": false
    },
    "target": "es2022",
    "keepClassNames": true
  },
  "module": {
    "type": "commonjs"
  },
  "sourceMaps": true
}
```

Three settings are load-bearing and must not be changed:
- `parser.decorators: true` — without it SWC will not parse decorator syntax at all.
- `transform.legacyDecorator: true` — this library uses `(target, property, descriptor)` decorators. Stage 3 semantics would break every decorator in `src`.
- `keepClassNames: true` — the wrapper and manager layers key off constructors; minified class names risk changing identity behavior. Retaining names keeps the transform behavior-neutral.

`decoratorMetadata` stays `false` because nothing reads `design:type` — there is no `reflect-metadata` dependency anywhere.

- [ ] **Step 3: Create `jest.config.mjs`**

```js
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary', 'html'],
};
```

`coverageProvider: 'v8'` is required, not a preference. Jest's default `babel` provider instruments via `babel-jest`; with an SWC transform it would report zero coverage.

`src/index.ts` is excluded to match the old `.nycrc.json`, which excluded it too — it is a pure re-export barrel.

- [ ] **Step 4: Add a temporary Jest script**

In `package.json` `scripts`, alongside the existing `test`:

```json
"test:jest": "jest"
```

Both runners coexist through Tasks 3-4 so the suite total stays accountable while files move across one at a time. Task 5 deletes `test:jest` and repoints `test`.

- [ ] **Step 5: Convert `test/tryManager.spec.ts`**

```ts
import { TryManager } from '../src/manager';
import { Gambler } from './lib/gambler';

describe('TryManager', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should retrieve the TryManager', () => {
    expect(gambler.getTryManager()).toBeInstanceOf(TryManager);
  });

  it('should always retrieve the same TryManager instance', () => {
    const gambler2 = new Gambler();

    expect(gambler.getTryManager()).toBe(gambler2.getTryManager());
  });
});
```

The `import { expect } from 'chai'` line is removed — Jest provides `expect` as a global. `.to.be.instanceOf` becomes `toBeInstanceOf`; `.to.equal` becomes `toBe` because this asserts identity, not deep equality.

- [ ] **Step 6: Run Jest against the converted file**

Run: `npx jest test/tryManager.spec.ts`
Expected: PASS, `Tests: 2 passed, 2 total`.

If this fails with a decorator parse error, `.swcrc` is not being picked up — confirm it sits at the repo root and that `@swc/jest` is resolving it.

- [ ] **Step 7: Confirm the combined count still reaches 27**

The converted file can no longer run under mocha. It dropped `import { expect } from 'chai'` and now relies on Jest's global `expect`, which mocha does not provide. The two runners therefore get **added together**, not cross-checked — running `npm test` unfiltered at this point will error on the converted file, and that is expected rather than a regression.

Run:

```bash
npx cross-env TS_NODE_PROJECT='./test/tsconfig.json' NODE_OPTIONS=--no-experimental-strip-types mocha --ignore 'test/tryManager.spec.ts'
```

Expected: `25 passing` — the baseline 27 minus the 2 that Jest now owns. Together with Step 6's `2 passed`, every one of the 27 is still accounted for.

This addition is the invariant to hold through Task 4: as each file moves, mocha's count drops by exactly what Jest's gains.

- [ ] **Step 8: Stage and hand over**

```bash
git add .swcrc jest.config.mjs test/tryManager.spec.ts package.json package-lock.json
```

Prepared message:

```
test: add jest with @swc/jest, convert tryManager spec

Stands up Jest 30 with the SWC transform configured for legacy
decorators, and converts the smallest spec file as a pilot. Mocha still
runs the remaining four files; both runners report green.
```

---

### Task 4: Convert the four remaining spec files

The highest-risk task in the plan. A mistranslated assertion passes while testing nothing, so every file is checked against its mocha count before moving on.

**Files:**
- Modify: `test/tryCatch.spec.ts`
- Modify: `test/catch.spec.ts`
- Modify: `test/try.spec.ts`
- Modify: `test/catchError.spec.ts`

**Interfaces:**
- Consumes: Jest infrastructure from Task 3
- Produces: all 27 tests running under Jest

**Conversion reference** — apply exactly, do not improvise:

| chai / sinon | Jest |
|---|---|
| `expect(x).to.be.null` | `expect(x).toBeNull()` |
| `expect(x).to.be.undefined` | `expect(x).toBeUndefined()` |
| `expect(x).to.equal(y)` | `expect(x).toBe(y)` |
| `expect(x).to.be.instanceOf(C)` | `expect(x).toBeInstanceOf(C)` |
| `expect(x).to.be.a('function')` | `expect(typeof x).toBe('function')` |
| `expect(x).to.be.an('object')` | `expect(typeof x).toBe('object')` |
| `expect(x).to.be.an('array')` | `expect(Array.isArray(x)).toBe(true)` |
| `expect(x).to.have.lengthOf(n)` | `expect(x).toHaveLength(n)` |
| `expect(fn).to.throw(msg)` | `expect(fn).toThrow(msg)` |
| `expect(fn).not.to.throw()` | `expect(fn).not.toThrow()` |
| `sinon.spy(impl)` | `jest.fn(impl)` |
| `sinon.assert.calledOnce(spy)` | `expect(spy).toHaveBeenCalledTimes(1)` |

Both chai's `.to.throw(string)` and Jest's `toThrow(string)` match on substring, so the error-message assertions carry over unchanged.

- [ ] **Step 1: Convert `test/tryCatch.spec.ts` (2 tests)**

```ts
import { Gambler } from './lib/gambler';
import { TryCatch } from '../src';

describe('TryCatch', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should be a function', () => {
    expect(typeof TryCatch).toBe('function');
  });

  it('should decorate a class', () => {
    expect(typeof gambler.try).toBe('object');
    expect(typeof gambler.try.fail).toBe('function');
    expect(typeof gambler.try.asyncFail).toBe('function');
  });
});
```

- [ ] **Step 2: Verify**

Run: `npx jest test/tryCatch.spec.ts`
Expected: `Tests: 2 passed, 2 total`.

- [ ] **Step 3: Convert `test/catch.spec.ts` (1 test)**

```ts
import { Catch, TryCatch } from '../src';

describe('Catch', () => {
  it('should throw an error when attempting to catch a property', () => {
    @TryCatch<Test>()
    class Test {
      // @ts-expect-error
      @Catch<Test>()
      failure = 'this will throw an error';
    }

    expect(() => {
      new Test();
    }).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
    );
  });
});
```

Keep the `// @ts-expect-error` exactly where it is. It asserts that decorating a property is a compile-time error, which is part of what this test covers. Removing it would silently weaken the test and break `npm run typecheck` in Task 6 with an unused-directive error.

- [ ] **Step 4: Verify**

Run: `npx jest test/catch.spec.ts`
Expected: `Tests: 1 passed, 1 total`.

- [ ] **Step 5: Convert `test/try.spec.ts` (12 tests)**

```ts
import { Gambler } from './lib/gambler';
import { TryCatch, Try } from '../src';

describe('Try', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  describe('Standard', () => {
    it('should throw an error when attempting to catch a property', () => {
      @TryCatch<Testable>()
      class Testable {
        // @ts-ignore
        @Try<Testable>()
        failure = 'this will throw an error';
      }

      expect(() => {
        const test = new Testable();
        console.log(test.failure);
      }).toThrow(
        `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
      );
    });

    it('should throw an error when called normally', () => {
      expect(() => gambler.fail()).toThrow(`This should fail`);
    });

    it('should catch errors and return null when called through try', () => {
      expect(() => gambler.try.fail()).not.toThrow();
      expect(gambler.try.fail()).toBeNull();
    });

    it('should throw an error asynchronously when called normally', async () => {
      try {
        await gambler.asyncFail();
      } catch (error: any) {
        expect(error.message).toBe(`This should fail async`);
      }
    });

    it('should catch asynchronous errors and return null when called through try', async () => {
      try {
        const result = await gambler.try.asyncFail();

        expect(result).toBeNull();
      } catch (error) {
        expect(() => {
          throw new Error(`Test Failed`);
        }).not.toThrow();
      }
    });

    it('should catch property errors', () => {
      expect(gambler.try.test).toBeNull();
    });

    it('should throw an error when accessing a non-existent try property', () => {
      expect(() => (gambler.try as any).doesNotExist()).toThrow(
        `[TryError]: Property 'doesNotExist' does not exist in TryMap`,
      );
    });

    it('should not throw an error when called normally | async', async () => {
      const success = await gambler.successAsync();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try | async', async () => {
      const success = await gambler.try.successAsync();

      expect(success).toBe('success');
    });

    it('should not throw an error when called normally | sync', () => {
      const success = gambler.success();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try | sync', () => {
      const success = gambler.try.success();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try returning undefined | sync', () => {
      const success = gambler.try.successUndefined();

      expect(success).toBeUndefined();
    });
  });
});
```

Two things to leave alone even though they look wrong:
- The fifth test's `catch` branch asserts that a throwing function does not throw, which fails deliberately if the promise rejects. It is an awkward way to write "this should not reject", but converting it faithfully preserves behavior. Improving it is out of scope — behavior must not change.
- `// @ts-ignore` here, versus `// @ts-expect-error` in `catch.spec.ts`. Do not normalize them. `@ts-expect-error` errors if there is nothing to suppress, so swapping it in could break the typecheck.

- [ ] **Step 6: Verify**

Run: `npx jest test/try.spec.ts`
Expected: `Tests: 12 passed, 12 total`.

- [ ] **Step 7: Convert `test/catchError.spec.ts` (10 tests)**

Replace the import block:

```ts
import { CatchError, TryError } from '../src';
```

The `sinon` and `chai` imports are both removed. Then convert the two spy-based tests at the end of the `Options` block:

```ts
    it('should run on method errors', () => {
      const error = new Error(`I am a failure`);
      const returnOnError = `terrible`;
      const param = 'this is a test';

      const runOnError = jest.fn((tryError: TryError) => {
        expect(typeof tryError).toBe('object');
        expect(Array.isArray(tryError.arguments)).toBe(true);
        expect(tryError.arguments).toHaveLength(1);
        expect(tryError.arguments[0]).toBe(param);
        expect(tryError.property).toBe('sad');
        expect(tryError.error).toBe(error);
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        sad(_value: string): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.sad(param);

      expect(result).toBe(returnOnError);

      expect(runOnError).toHaveBeenCalledTimes(1);
    });

    it('should run on property errors', () => {
      const error = new Error(`I am a failure`);
      const runOnErrorReturn = 'override';
      const returnOnError = `terrible`;

      const runOnError = jest.fn((tryError: TryError) => {
        expect(typeof tryError).toBe('object');
        expect(Array.isArray(tryError.arguments)).toBe(true);
        expect(tryError.arguments).toHaveLength(0);
        expect(tryError.property).toBe('sad');
        expect(tryError.error).toBe(error);

        return runOnErrorReturn;
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        get sad(): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.sad;

      expect(result).toBe(runOnErrorReturn);

      expect(runOnError).toHaveBeenCalledTimes(1);
    });
```

The remaining eight tests in this file need only the mechanical swaps from the reference table: `.to.be.null` to `toBeNull()` (four occurrences) and `.to.equal(value)` to `toBe(value)` (four occurrences).

The `toHaveBeenCalledTimes(1)` assertions are essential. Every assertion inside `jest.fn` is dead code if the callback never fires, so without the call-count check these two tests could pass while asserting nothing.

- [ ] **Step 8: Verify the full suite reaches the baseline**

Run: `npx jest`
Expected: `Tests: 27 passed, 27 total` across 5 suites. Anything under 27 means a test was lost in conversion — find it before continuing.

- [ ] **Step 9: Stage and hand over**

```bash
git add test/
```

Prepared message:

```
test: convert remaining specs from chai/sinon to jest

Converts tryCatch, catch, try and catchError. Assertion counts checked
per file against the mocha baseline; suite total holds at 27.

sinon spies become jest.fn() with explicit toHaveBeenCalledTimes(1)
assertions, since assertions inside a spy body never run if the spy is
not invoked.
```

---

### Task 5: Remove the mocha stack

Deletes the old runner now that Jest carries all 27 tests, and adds the two CI workflows that depend on the new scripts.

**Files:**
- Delete: `.nycrc.json`, `test/tsconfig.json`
- Create: `.github/workflows/typecheck.yml`, `.github/workflows/code-cov.yml`
- Modify: `package.json`, `tsconfig.json`, `cspell.json`

**Interfaces:**
- Consumes: all 27 tests under Jest from Task 4
- Produces: `npm test` (Jest), `npm run coverage`, `npm run typecheck`

- [ ] **Step 1: Capture the coverage baseline before changing thresholds**

Run: `npx jest --coverage`
Expected: a `text-summary` table. **Write the four percentages down** — statements, branches, functions, lines. The old `.nycrc.json` demanded 90% across all four, but nyc and v8 disagree about what counts, so these numbers are the real starting point.

- [ ] **Step 2: Remove the old test dependencies**

```bash
npm uninstall mocha chai sinon nyc ts-node cross-env source-map-support codecov \
  @types/mocha @types/chai @types/sinon @istanbuljs/nyc-config-typescript \
  commitizen cz-conventional-changelog
```

`codecov` is a deprecated package superseded by `codecov-action`. commitizen and `cz-conventional-changelog` go because the `npm run commit` flow is being dropped — semantic-release parses commit messages regardless of how they were authored.

- [ ] **Step 3: Clean up `package.json`**

Delete the `mocha` block, the `config.commitizen` block, and the `commit`, `test:jest`, `coverage:check`, `coverage:report`, `coverage:post`, `precoverage:test` and `coverage:test` scripts. Then set:

```json
"test": "jest",
"test:watch": "jest --watch",
"coverage": "jest --coverage",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Add the coverage threshold using the measured numbers**

Append to `jest.config.mjs`, substituting the Step 1 values rounded **down** to the nearest whole percent:

```js
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
```

If any measured value is below 90, set that key to the measured floor instead of 90 and note the gap in the commit message. Do not lower a threshold that is already met, and do not raise one above what was measured.

- [ ] **Step 5: Delete the dead config**

```bash
rm .nycrc.json test/tsconfig.json
```

`test/tsconfig.json` existed only to point ts-node at the test directory, and its `baseUrl` is deprecated in TypeScript 6.

- [ ] **Step 6: Point the root tsconfig at both directories**

In `tsconfig.json`, change the include line:

```json
"include": ["src", "test"]
```

This has been verified to type-check cleanly against the current strict settings, so no source changes should be needed.

- [ ] **Step 7: Verify everything**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: `27 passed`; typecheck silent with exit 0; lint clean.

- [ ] **Step 8: Add `typecheck.yml`**

```yaml
name: Typecheck

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  typecheck:
    timeout-minutes: 5
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24.15.0
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm run typecheck
```

- [ ] **Step 9: Add `code-cov.yml`**

```yaml
name: Codecov

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  coverage:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24.15.0
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm run coverage
      - name: Codecov
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          fail_ci_if_error: true
```

Note `./coverage/lcov.info` — Jest's `lcov` reporter writes there, unlike the old nyc setup which produced `coverage.lcov` at the repo root.

- [ ] **Step 10: Update the spell-check word list**

In `cspell.json`, remove `precoverage` and `codecov` if the coverage scripts that used them are gone, and add `swcrc`, `tsdown`, `rolldown` and `oxc` for the words arriving in Task 7. Then run `npx cspell lint --no-progress "**"` and expect no errors.

- [ ] **Step 11: Stage and hand over**

```bash
git add -A
```

Prepared message:

```
test: remove mocha stack in favor of jest

Drops mocha, chai, sinon, nyc, ts-node, cross-env, source-map-support
and the deprecated codecov package, along with the
--no-experimental-strip-types stopgap that ts-node required.

Coverage moves to Jest's v8 provider; thresholds re-baselined against
measured output rather than carried over from nyc.

Also drops commitizen, adds typecheck and codecov workflows, and folds
test/ into the root tsconfig.
```

---

### Task 6: TypeScript 6 and tsconfig rewrite

TS 6 deprecates `baseUrl` and changes the default `moduleResolution`, so settings that were previously inherited get stated explicitly.

**Files:**
- Modify: `tsconfig.json`
- Create: `tsconfig.build.json`
- Modify: `package.json` (typescript, typescript-eslint)

**Interfaces:**
- Consumes: `npm run typecheck` from Task 5
- Produces: `tsconfig.build.json` for Task 7's declaration build

- [ ] **Step 1: Upgrade TypeScript**

```bash
npm install --save-dev typescript@^6.0.3
```

npm's `latest` tag points at 7.0.2, so `typescript@latest` would install the wrong major. Pin `^6.0.3` explicitly. typescript-eslint 8.70's peer range is `>=4.8.4 <6.1.0`, so it accepts this.

- [ ] **Step 2: Check what TS 6 now complains about**

Run: `npm run typecheck`
Expected: either clean, or `TS5107` deprecation errors. Record whatever appears — Step 3 addresses it.

- [ ] **Step 3: Rewrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["node", "jest"],
    "noEmit": true,
    "sourceMap": true,
    "removeComments": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "experimentalDecorators": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "test"]
}
```

Every change here has a reason:
- `target: es2022` (was `es6`). Verified safe: `src` has no class-field initializers — only enum members, object literals and TS parameter properties — so the `useDefineForClassFields` semantics change at ES2022 does not affect this codebase.
- `module: "preserve"` with `moduleResolution: "bundler"` keeps the existing extensionless relative imports valid. `nodenext` would demand `.js` extensions on every relative import across all 44 source files.
- `removeComments: false` — **this is what makes Task 10 worth doing.** Verified empirically: with `removeComments: true`, `tsc --declaration` emits `export declare function hello(): string;` and drops the JSDoc entirely. Without it, the JSDoc block survives into the `.d.ts`. Leaving this `true` would mean shipping documentation no consumer can see.
- `noEmit: true` — tsdown owns emit now; this config is for type-checking only.
- `types: ["node", "jest"]` — explicit, so the removal of `@types/mocha` cannot silently resurface.
- Removed: `emitDecoratorMetadata` (nothing reads it), `outDir` / `declaration` / `incremental` (moved to the build config), and `noImplicitAny`, `noImplicitThis`, `strictNullChecks`, `alwaysStrict`, `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization` — all redundant under `strict: true`.
- `experimentalDecorators` stays. Non-negotiable.

- [ ] **Step 4: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

Test files and Jest types are excluded so they cannot leak into the published declarations.

- [ ] **Step 5: Verify both configs**

```bash
npm run typecheck
npx tsc -p tsconfig.build.json --noEmit
```

Expected: both silent, exit 0. No `TS5107` deprecation errors. If `baseUrl` or `moduleResolution` warnings persist, something still references the deleted `test/tsconfig.json`.

- [ ] **Step 6: Confirm tests and lint still pass**

```bash
npm test
npm run lint
```

Expected: `27 passed`; lint clean. Jest reads `.swcrc`, not `tsconfig.json`, so the compiler change should not affect the suite — if it does, investigate before continuing.

- [ ] **Step 7: Stage and hand over**

```bash
git add tsconfig.json tsconfig.build.json package.json package-lock.json
```

Prepared message:

```
build: upgrade to TypeScript 6

Sets module/moduleResolution explicitly, since TS 6 deprecates baseUrl
and changes the moduleResolution default. Targets es2022, verified safe
against useDefineForClassFields because src has no class field
initializers.

Sets removeComments: false so JSDoc survives into .d.ts, and drops the
strict sub-flags that are redundant under strict: true. Splits out
tsconfig.build.json for declaration emit.
```

---

### Task 7: tsdown build and packaging

Replaces microbundle and fixes an `exports` field that currently makes the package unresolvable for CJS consumers.

**Files:**
- Create: `tsdown.config.ts`
- Delete: `.npmignore`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: `tsconfig.build.json` from Task 6
- Produces: `npm run build` emitting `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts`

- [ ] **Step 1: Swap the bundler**

```bash
npm uninstall microbundle
npm install --save-dev tsdown@^0.23.0 publint@^0.3.24 @arethetypeswrong/cli@^0.18.5
```

- [ ] **Step 2: Create `tsdown.config.ts`**

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  outDir: 'dist',
  dts: { tsconfig: './tsconfig.build.json' },
  sourcemap: true,
  clean: true,
});
```

tsdown reads `experimentalDecorators` from the tsconfig and supports legacy decorators. It does **not** support Stage 3 decorators — another reason the global constraint against migrating them holds.

- [ ] **Step 3: Rewrite the packaging fields in `package.json`**

Remove `source`, `module`, `unpkg` and the old string-valued `exports`. Replace with:

```json
"main": "./dist/index.cjs",
"module": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "import": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "require": {
      "types": "./dist/index.d.cts",
      "default": "./dist/index.cjs"
    }
  },
  "./package.json": "./package.json"
},
"files": ["dist"],
"engines": {
  "node": ">=20.19.0"
},
"sideEffects": false
```

The old `"exports": "./build/index.modern.js"` was a bare string, which exposes exactly one entry point with no `require` condition — CJS consumers could not resolve the package at all. Within each condition `types` must come first; condition order is significant and a `types` key placed last is ignored.

`engines.node` is the **consumer** floor and is intentionally lower than the 22.18 dev floor, which CI enforces instead.

`sideEffects: false` is safe here: importing this module only defines decorators. Side effects happen when a consumer applies one, at their call site, not on import.

- [ ] **Step 4: Replace the ignore list with an allowlist**

```bash
rm .npmignore
```

`files: ["dist"]` from Step 3 supersedes it. A denylist silently ships every new file added later; an allowlist cannot.

- [ ] **Step 5: Update the build scripts**

Replace the `prebuild`, `build` and `dev` scripts:

```json
"build": "tsdown",
"dev": "tsdown --watch",
"prepack": "npm run build"
```

`prebuild` goes away because tsdown's `clean: true` handles it. `prepack` guarantees `npm publish` always ships a fresh build — required by Task 8.

- [ ] **Step 6: Fix `.gitignore`**

The blanket `*.js` and `*.d.ts` rules with `!jest.config.js` and `!.eslintrc.js` escape hatches are a trap: any new root-level `.js` config file is silently untracked. Replace those five lines with:

```gitignore
dist/
build/
coverage/
*.log
*.tsbuildinfo
```

Then confirm nothing needed is being ignored:

Run: `git status --porcelain --ignored | grep -E 'eslint.config.mjs|jest.config.mjs|tsdown.config.ts'`
Expected: no output. Any match means a config file is still ignored.

- [ ] **Step 7: Build and inspect the output**

```bash
npm run build
ls -la dist/
```

Expected: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts` plus sourcemaps. If `index.d.cts` is missing, the CJS `types` condition points at nothing — check that `format` includes `cjs` and `dts` is enabled.

- [ ] **Step 8: Validate the package contract**

```bash
npx publint
npx attw --pack .
```

Expected: both clean. `attw` specifically catches the masquerading-types problems that a hand-written `exports` map invites. Fix anything reported before continuing — this is the check that proves the CJS resolution bug is actually gone.

- [ ] **Step 9: Verify the published file list**

Run: `npm pack --dry-run`
Expected: only `dist/**`, `package.json`, `README.md` and `LICENSE`. No `src/`, no `test/`, no configs. If `src/` appears, `files` is wrong.

- [ ] **Step 10: Stage and hand over**

```bash
git add -A
```

Prepared message:

```
build: replace microbundle with tsdown, fix package exports

The exports field was a bare string pointing at the ESM build, so CJS
consumers could not resolve the package at all. Replaces it with a
conditional map carrying types-first import and require conditions.

Swaps microbundle for tsdown (dual ESM/CJS with declarations), drops the
UMD build, and replaces .npmignore with a files allowlist. Validated with
publint and attw.
```

---

### Task 8: Trusted publishing and release

Wires releases to npm trusted publishing via OIDC. No tokens.

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run build` and `prepack` from Task 7; the `Test` workflow from Task 2
- Produces: an automated release on merge to `master`

- [ ] **Step 1: Rewrite `release.yml`**

```yaml
name: Release

on:
  workflow_run:
    workflows: ['Test']
    branches: [master]
    types:
      - completed

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 24.15.0

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Build
        run: npm run build

      - name: Release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
```

Four deliberate choices:
- The old `workflows: ['Snyk Security Check', 'Test']` referenced a workflow that no longer exists, which is why releases could never fire. Only `Test` remains.
- `if: github.event.workflow_run.conclusion == 'success'` — without this the release runs even when tests **fail**. `surrogate` omits this guard; do not copy that.
- `id-token: write` enables OIDC. There is deliberately no `NPM_TOKEN`. `packages: write` is dropped, as npm publishing does not use it.
- `npx semantic-release` with no `-p` flags, because semantic-release bundles the four plugins this config uses.

- [ ] **Step 2: Add the release configuration to `package.json`**

```json
"version": "0.0.0-development",
"publishConfig": {
  "access": "public",
  "provenance": true
},
"release": {
  "branches": ["master"],
  "plugins": [
    ["@semantic-release/commit-analyzer", { "preset": "angular" }],
    "@semantic-release/release-notes-generator",
    "@semantic-release/github",
    "@semantic-release/npm"
  ]
}
```

`version: "0.0.0-development"` is the semantic-release convention — the real version is computed from commit history at release time, so a hardcoded `1.0.0` would be misleading.

`access: "public"` is mandatory: `@status/try` is scoped, and scoped packages default to restricted.

The plugin list uses only what semantic-release bundles — commit-analyzer, release-notes-generator, github and npm. `@semantic-release/changelog` and `@semantic-release/git` are **not** bundled, which is why there is no committed `CHANGELOG.md`; release notes live on GitHub Releases. Adding one later means installing both plugins and passing them on the npx line.

- [ ] **Step 3: Verify the release config parses**

Run: `npx semantic-release --dry-run --no-ci`
Expected: it loads the config and reports the next version, or exits complaining about authentication. An auth complaint is fine — it proves config parsing succeeded. A *config* error is not.

- [ ] **Step 4: Verify no token crept in**

Run: `grep -rn "NPM_TOKEN" .github/ package.json`
Expected: no matches. Any hit violates a global constraint.

- [ ] **Step 5: Stage and hand over**

```bash
git add .github/workflows/release.yml package.json
```

Prepared message:

```
ci: release via npm trusted publishing

The release workflow gated on a Snyk workflow that no longer exists, so
it could never fire. Gates on Test instead, and only when Test actually
succeeded.

Publishes via OIDC trusted publishing with provenance, so no NPM_TOKEN is
needed. semantic-release runs through npx using its bundled plugins
rather than being carried as a devDependency.
```

- [ ] **Step 6: Hand the bootstrap to Jason**

This task cannot complete without a manual step. `@status/try` has never been published — npm returns 404 — and trusted publishers are configured in package settings, which requires the package to exist.

Report to Jason, do not attempt:

1. Check whether npm now supports trusted-publisher pre-registration for a package that does not yet exist.
2. If not, publish a shell version to create it: `npm publish --access public --provenance`
3. Then bind CI: `npm trust github @status/try --file release.yml --repo jfrazx/try --allow-publish`

---

### Task 9: README, typedoc and renovate

**Files:**
- Modify: `README.md`, `package.json`, `cspell.json`
- Create: `renovate.json`

**Interfaces:**
- Consumes: the final public API surface
- Produces: `npm run docs` emitting to `docs/api`

- [ ] **Step 1: Install typedoc**

```bash
npm install --save-dev typedoc@^0.28.20
```

It was referenced by the `docs` script but never installed, so `npm run docs` has always failed. typedoc 0.28's peer range includes `6.0.x`, so it works with the Task 6 upgrade.

- [ ] **Step 2: Confirm the docs scripts are correctly targeted**

`package.json` should already read:

```json
"predocs": "rimraf docs/api",
"docs": "typedoc src/index.ts --out docs/api"
```

These were redirected from `docs/` to `docs/api` when the spec was written, because `rimraf docs` would have deleted the spec and this plan. Verify they still say `docs/api` before running anything.

- [ ] **Step 3: Generate the API docs**

Run: `npm run docs`
Expected: exit 0, `docs/api/index.html` created, and `docs/superpowers/` untouched. Confirm with `ls docs/` showing both `api` and `superpowers`.

- [ ] **Step 4: Rewrite `README.md`**

Replace the placeholder ("Usage / Soon, but not really") with sections covering:

- **Install** — `npm install @status/try`, dropping the "Currently unpublished" line once Task 8's bootstrap is done.
- **`TryCatch` + `Try`** — the paired decorators. `@TryCatch()` on the class, `@Try()` on methods and accessors; calling normally throws, calling through `.try` catches.
- **`CatchError`** — the standalone decorator that always catches, needing no class decorator.
- **Options** — `returnOnError` (value returned when catching), `runOnError` (callback receiving a `TryError` with `property`, `error` and `arguments`; its return value overrides `returnOnError`), and `alwaysCatch`.
- **TypeScript usage** — the `TryCatchExtension<T, K>` interface-merging pattern that gives `.try` its types. Adapt the working example from `test/lib/gambler.ts`.

Every code sample must be one that actually runs. Derive them from the specs in `test/`, which are now the verified source of truth for behavior.

- [ ] **Step 5: Verify the README examples compile**

Extract each code sample into a scratch `.ts` file under the scratchpad directory and run `npx tsc --noEmit --experimentalDecorators --target es2022 --strict <file>` against it. Expected: clean. A README example that does not compile is worse than no example.

- [ ] **Step 6: Create `renovate.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true
    }
  ],
  "platformAutomerge": true
}
```

This matches `surrogate`'s config. It lands here rather than in Task 1 on purpose: renovate is already running against this repo unconfigured, and automerging dependency bumps while Tasks 1-7 are deleting those same dependencies would produce conflicts.

Note that `matchCurrentVersion: "!/^0/"` excludes tsdown, which is at `0.23.0` — its majors will need manual review. That is the intent.

- [ ] **Step 7: Spell-check**

Run: `npx cspell lint --no-progress --fail-fast "**"`
Expected: clean. Add any new legitimate words to `cspell.json` rather than rewording documentation around the linter.

- [ ] **Step 8: Stage and hand over**

```bash
git add README.md package.json renovate.json cspell.json
```

Prepared message:

```
docs: rewrite README, add typedoc and renovate config

Replaces the placeholder README with usage documentation for TryCatch,
Try and CatchError, including the TryCatchExtension typing pattern. All
examples verified to compile.

Adds typedoc, which the docs script referenced but was never installed,
and a renovate config matching the one used in surrogate.
```

---

### Task 10: JSDoc pass over `src`

Public API thorough, internals light. Comments only — no logic changes.

**Files:**
- Modify: `src/tryCatch/*.ts`, `src/interfaces/index.ts`, and one-line headers across the remaining `src/**` files

**Interfaces:**
- Consumes: `removeComments: false` from Task 6 — without it none of this reaches consumers
- Produces: JSDoc in `dist/*.d.ts` and richer typedoc output

- [ ] **Step 1: Confirm JSDoc survives the build before writing any**

```bash
npm run build
grep -A2 "export declare function Try" dist/index.d.ts
```

Expected: the existing JSDoc block on `Try` appears above the declaration. **If it does not, stop.** tsdown generates declarations through oxc rather than tsc, so tsc's behavior does not guarantee this. The fallback is generating declarations with `tsc -p tsconfig.build.json --emitDeclarationOnly` and pointing tsdown at them. Resolve this before writing 44 files of documentation that would not ship.

- [ ] **Step 2: Document the exported decorators**

For `Try` in `src/tryCatch/try.ts`, `TryCatch` in `src/tryCatch/tryCatch.ts`, `Catch` in `src/tryCatch/catch.ts` and `CatchError` in `src/tryCatch/catchError.ts`, each gets `@param` for every parameter, `@returns`, and a runnable `@example`.

`Try` and `TryCatch` already carry JSDoc — extend rather than replace, and keep the existing `@example` blocks, which are accurate.

Pattern to follow:

```ts
/**
 * Catches errors on a decorated method or accessor, unconditionally.
 *
 * Unlike {@link Try}, this does not require the class to be decorated with
 * {@link TryCatch}, and it catches on every call rather than only when
 * invoked through the `try` map.
 *
 * @param options - Behavior overrides for this member.
 * @param options.returnOnError - Value returned when an error is caught.
 *   Defaults to `null`.
 * @param options.runOnError - Callback invoked with the caught `TryError`.
 *   A non-undefined return value overrides `returnOnError`.
 * @returns A method or accessor decorator.
 *
 * @example
 * ```typescript
 * class Example {
 *   @CatchError({ returnOnError: 'fallback' })
 *   risky(): string {
 *     throw new Error('boom');
 *   }
 * }
 *
 * new Example().risky(); // 'fallback'
 * ```
 */
```

Verify each `@example` against the corresponding test in `test/catchError.spec.ts` — the tests are the source of truth for what these actually return.

- [ ] **Step 3: Document the exported types**

In `src/interfaces/index.ts`, add a description to each member of `TryOptions`, `TryCatchOptions`, `TryError`, `Tryable`, `TryMethods`, `TryProperties` and `TryCatchExtension`. These surface on hover in consumers' editors, so describe what a field *does*, not what its type already says.

- [ ] **Step 4: Add one-line headers to internals**

Every other file under `src/**` gets a single block comment above its primary export saying why the unit exists. Example for `src/catcher/runner/rules/rules/accessor.ts`:

```ts
/**
 * Rule that matches accessor descriptors, so getters and setters are wrapped
 * through property access rather than invocation.
 */
```

Do not document internals method-by-method. The goal is orientation for someone reading the rules engine cold, not exhaustive coverage.

- [ ] **Step 5: Verify nothing changed but comments**

Run: `git diff --stat` then `git diff -U0 src/ | grep -E '^\+' | grep -vE '^\+\s*(\*|/\*|\*/|//)' | grep -v '^+++'`
Expected: no output. Any line means non-comment code was modified, which violates the global constraint.

- [ ] **Step 6: Verify the full pipeline**

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run docs
```

Expected: lint clean, typecheck silent, `27 passed`, build succeeds, docs generate.

- [ ] **Step 7: Confirm the docs actually shipped**

Run: `grep -c "@example\|\*" dist/index.d.ts`
Expected: a non-zero count well above the pre-task baseline. Spot-check `dist/index.d.ts` by eye to confirm the decorator docs are present and readable.

- [ ] **Step 8: Stage and hand over**

```bash
git add src/
```

Prepared message:

```
docs(src): document the public API and annotate internals

Adds full JSDoc with examples to Try, TryCatch, Catch and CatchError and
to the exported option and error interfaces, plus one-line purpose
comments on internal units.

Examples are verified against the test suite. Relies on
removeComments: false so the documentation reaches .d.ts consumers.
```

---

## Verification Summary

Run after every task. No task is complete on inspection alone.

| Command | Expected |
|---|---|
| `npm run lint` | clean, exit 0 |
| `npm run typecheck` | silent, exit 0 |
| `npm test` | `27 passed` |
| `npm run build` | `dist/` with 4 entry artifacts (Task 7 onward) |
| `npx publint && npx attw --pack .` | clean (Task 7 onward) |

## Task-to-PR Mapping

| PR | Tasks | Theme |
|---|---|---|
| 1 | 1, 2 | Green the gate |
| 2 | 3, 4, 5 | Jest migration |
| 3 | 6, 7 | TypeScript 6 + packaging |
| 4 | 8 | Trusted publishing |
| 5 | 9 | README, typedoc, renovate |
| 6 | 10 | JSDoc pass |
