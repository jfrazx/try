# Toolchain Modernization — Design

**Date:** 2026-09-16
**Repo:** `jfrazx/try` (`@status/try`)
**Status:** Approved for planning

## 1. Purpose

`@status/try` is a ~700 LOC TypeScript decorator library that catches errors on
object methods and accessors. Its toolchain has decayed past the point of being
merely dated: the test suite, the linter, the CI trigger, and the release
pipeline are each independently broken. This design modernizes the toolchain and
makes the package publishable, without changing library behavior.

Library semantics are explicitly out of scope. The existing tests are the safety
net for that, which is why repairing them comes first.

## 2. Current state

### 2.1 Broken, verified

| Thing | Evidence |
|---|---|
| `npm test` | Fails on Node 24. `ts-node/register/transpile-only` no longer intercepts; Node's native type-stripping loads the `.ts` files and rejects decorator syntax. Confirmed: `NODE_OPTIONS=--no-experimental-strip-types` makes all 27 tests pass. |
| `npx eslint` | Crashes. `.eslintrc` extends `prettier/@typescript-eslint`, removed in eslint-config-prettier 8.0.0. No `lint` script exists, so this was never exercised. |
| Test CI | `test.yml` triggers on `[main, develop]`. The default branch is `master`. CI has never run on the main branch. |
| Release CI | `release.yml` gates on a `Snyk Security Check` workflow that no longer exists. It can never fire. |
| `semantic-release` | Invoked via bare `npx`, absent from devDependencies, no config committed. |
| `typedoc` | Referenced by the `docs` script, not installed. |
| Package `exports` | A bare string pointing at the ESM build. CJS consumers cannot resolve the package at all. |
| JSDoc delivery | `removeComments: true` strips JSDoc from `.d.ts`, not just from emitted JS (verified empirically). The existing JSDoc on `Try` and `TryCatch` reaches no consumer. |

### 2.2 Dated

ESLint 8 (EOL), typescript-eslint 7, mocha 10 / chai 4 / sinon 18, nyc, the
deprecated `codecov` uploader package, microbundle (effectively unmaintained),
TypeScript 5.5.

### 2.3 The decorator constraint

The library is built entirely on **legacy** TypeScript decorators — the
`(target, property, descriptor)` signature, with a class decorator that returns
a replacement constructor. This constrains every tool choice:

- Node's built-in test runner cannot parse them at all.
- Vitest's esbuild transform supports `experimentalDecorators` but not
  `emitDecoratorMetadata`.
- tsdown supports legacy decorators and explicitly does **not** support Stage 3.
- SWC supports legacy decorators, with metadata emission gated behind the same
  legacy flag.

`emitDecoratorMetadata` is set in tsconfig but nothing consumes it — there is no
`reflect-metadata` dependency anywhere in `src` or `test`. It is dead config and
is removed.

## 3. Decisions

| Decision | Value | Rationale |
|---|---|---|
| Test runner | Jest 30 + `@swc/jest` | Full legacy-decorator support, built-in coverage, no ts-node. |
| Decorators | Stay legacy | Stage 3 migration is a breaking source rewrite deserving its own design. tsdown not supporting Stage 3 independently reinforces this. |
| TypeScript | `^6.0.3` | Explicitly **not** 7.x — tooling support is too sparse. 6.0.3 is published and stable despite npm's `latest` tag pointing at 7.0.2. v6 preferred; 5.9 is an acceptable fallback if it misbehaves. |
| ESLint | `^10.10` flat config | ESLint 10 removed eslintrc entirely; no escape hatch. |
| typescript-eslint | `^8.70` | Peer range `eslint ^8.57 \|\| ^9 \|\| ^10` and `typescript >=4.8.4 <6.1.0` — accepts both targets. |
| Build | tsdown, dual ESM+CJS | Replaces microbundle. UMD/unpkg dropped: a TS class-decorator library has no plain-browser-script audience, and nothing is published yet to break. |
| Publishing | npm trusted publishing (OIDC) | No long-lived tokens. Mirrors `surrogate`. |
| Dev/CI Node | >= 22.18 | Driven by tsdown (`^22.18 \|\| ^24.11 \|\| >=26`) and semantic-release (`^22.14 \|\| >=24.10`), both above ESLint's floor. |
| Delivery | 6 staged PRs into `develop` | Each independently reviewable and revertable. |

### 3.1 Non-goals

- No change to library behavior or public API.
- No Stage 3 decorator migration.
- No TypeScript 7.
- No husky hooks (considered, declined).
- commitizen and `cz-conventional-changelog` are removed. semantic-release
  parses commit messages regardless of how they were authored, and the existing
  log already follows conventional commits.

## 4. Reference implementation

`jfrazx/surrogate` is the same author's decorator library with a working
trusted-publishing setup. Its conventions are adopted where they apply:
`actions/checkout@v6`, `setup-node@v6`, `codeql-action@v4`, exact-pinned Node
versions in the CI matrix, `npm ci --ignore-scripts`, split per-concern
workflows, `codecov-action@v5` with `CODECOV_TOKEN`, semantic-release config
inline in `package.json`, and `version: "0.0.0-development"`.

Two deviations from surrogate, both deliberate:

1. **Release gating.** surrogate's `release.yml` uses `workflow_run` without
   checking `conclusion`, so it releases even when tests fail. `try` adds
   `if: github.event.workflow_run.conclusion == 'success'`.
2. **Permissions.** surrogate requests `packages: write`, which npm publishing
   does not need. `try` requests only `contents: write` and `id-token: write`.

Note for separate follow-up: surrogate pins `eslint: ^10.0.0` while still using
`.eslintrc`. That combination cannot work. Out of scope here.

## 5. The PRs

### PR 1 — Green the gate

Nothing downstream is verifiable until CI and lint run, so this lands alone.

- `test.yml`: trigger on `[master, develop]`.
- Delete `.eslintrc`; add `eslint.config.mjs`. Seed with the `@eslint/v8-to-v9-config`
  codemod, then hand-finish.
- Add `lint` / `lint:fix` scripts, and `format` / `format:check` running Prettier
  directly.
- Remove `eslint-plugin-node` (unmaintained) and `eslint-plugin-prettier`
  (running Prettier as a lint rule is no longer recommended). `eslint-config-prettier/flat`
  remains, purely to switch off conflicting rules.
- Drop the obsolete `useJSXTextNode` parser option.
- Add `lint.yml` as its own workflow (first of the per-concern splits).
- Update `test.yml` and `c-spell.yml` to `actions/checkout` / `setup-node`
  with exact-pinned Node versions; `codeql.yml` to `codeql-action`.

Most of the old rule block is dead config: `no-underscore-dangle`,
`arrow-body-style`, `no-plusplus`, `func-names`, `prefer-destructuring`,
`no-else-return`, `no-console` and `comma-dangle` all disable rules that were
never enabled, because the config never extended airbnb. Only genuinely active
overrides carry forward.

Tests are also made green here, via a one-line stopgap rather than a rewrite:
setting `NODE_OPTIONS=--no-experimental-strip-types` on the test script. This
was verified to restore all 27 passing tests on Node 24. It is deliberately
temporary — PR 2 deletes it along with ts-node — but it means PR 2 converts
assertions against a green CI baseline instead of a red one.

### PR 2 — Jest migration

`.swcrc` needs `jsc.parser.decorators: true` and `jsc.transform.legacyDecorator: true`;
`decoratorMetadata` stays off.

`jest.config.ts`: `testEnvironment: 'node'`, `transform` via `@swc/jest`,
`coverageProvider: 'v8'`, `collectCoverageFrom: ['src/**/*.ts', '!src/index.ts']`.

The v8 provider is required, not preferred: Jest's default `babel` provider
instruments through babel-jest and will not instrument an SWC transform.

Convert 5 spec files — `catch.spec.ts`, `catchError.spec.ts`, `try.spec.ts`,
`tryCatch.spec.ts`, `tryManager.spec.ts`:

| chai / sinon | Jest |
|---|---|
| `expect(x).to.be.null` | `expect(x).toBeNull()` |
| `expect(x).to.equal(y)` | `expect(x).toBe(y)` |
| `expect(x).to.deep.equal(y)` | `expect(x).toEqual(y)` |
| `expect(x).to.be.instanceof(C)` | `expect(x).toBeInstanceOf(C)` |
| `expect(fn).to.throw()` | `expect(fn).toThrow()` |
| `sinon.spy()` / `sinon.stub()` | `jest.fn()` / `jest.spyOn()` |

Removed: mocha, chai, sinon, nyc, ts-node, cross-env, source-map-support,
codecov, `@types/{mocha,chai,sinon}`, `@istanbuljs/nyc-config-typescript`,
`.nycrc.json`, and the `mocha` block in `package.json`.

Two more per-concern workflows land here, because both depend on scripts that
only exist after this PR: `typecheck.yml` (runs `tsc --noEmit`) and
`code-cov.yml` (runs Jest coverage, uploads via `codecov-action` with
`CODECOV_TOKEN`). The CI matrix pins exact Node versions `22.18.x` and `24.x`.

`test/tsconfig.json` is deleted — its `baseUrl` is deprecated in TS 6 and it
exists only to serve ts-node. Root `tsconfig.json` grows to cover `src` + `test`
behind a new `typecheck` script.

### PR 3 — TypeScript 6 + packaging

TS 6 deprecates `baseUrl` and changes default `moduleResolution`, so both are
set explicitly rather than inherited.

`tsconfig.json` (typecheck, `noEmit`, includes `src` + `test`):

- `target`: `es6` -> `es2022`
- `module`: `"preserve"`, `moduleResolution`: `"bundler"` — keeps the existing
  extensionless relative imports valid under bundling
- `removeComments`: `false` — required for PR 6 to ship anything
- Remove `emitDecoratorMetadata`
- Remove `noImplicitAny`, `noImplicitThis`, `strictNullChecks`, `alwaysStrict`,
  `strictBindCallApply`, `strictFunctionTypes`, `strictPropertyInitialization` —
  all redundant under `strict: true`

`tsconfig.build.json` extends it with `include: ["src"]` for tsdown's dts pass.

`tsdown.config.ts`: `format: ['esm','cjs']`, `dts: true`, `platform: 'node'`,
`sourcemap: true`. microbundle is removed.

`package.json` packaging:

```jsonc
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
},
"main": "./dist/index.cjs",
"module": "./dist/index.js",
"types": "./dist/index.d.ts",
"files": ["dist"],
"engines": { "node": ">=20.19.0" }
```

`.npmignore` is deleted in favor of the `files` allowlist — a denylist silently
leaks every new file added later. `engines` describes the *consumer* floor; the
higher dev floor is enforced by the CI matrix, not by this field.

Packaging is verified with `publint` and `@arethetypeswrong/cli`, both already
tsdown peer dependencies.

### PR 4 — Trusted publishing

`release.yml`, modeled on surrogate with the two deviations from section 4:

```yaml
permissions:
  contents: write
  id-token: write
```

`GITHUB_TOKEN` only. No `NPM_TOKEN` anywhere in the repo or its secrets.

`semantic-release` is **not** a devDependency. The release step invokes it via
`npx semantic-release` inline, matching surrogate. This constrains the plugin
set: semantic-release bundles commit-analyzer, release-notes-generator, github
and npm as its own dependencies, but **not** `@semantic-release/changelog` or
`@semantic-release/git`. Using only the four bundled plugins keeps the npx call
dependency-free, at the cost of no committed `CHANGELOG.md` — release notes live
on GitHub Releases instead. Adding one later means passing
`-p @semantic-release/changelog -p @semantic-release/git` on the npx line.

`package.json` gains `version: "0.0.0-development"`, an inline `release` block
(commit-analyzer, release-notes-generator, github, npm), and:

```jsonc
"publishConfig": { "access": "public", "provenance": true }
```

`access: "public"` is mandatory — `@status/try` is scoped, and scoped packages
default to restricted.

`prepack: "npm run build"` ensures `npm publish` emits a built `dist`.

**Bootstrap — requires Jason, not automatable.** `@status/try` has never been
published (npm returns 404), unlike surrogate, which already existed when its
trusted publisher was configured. Trusted publishers are configured in *package
settings* on npmjs.com, which requires the package to exist. Expected sequence:

1. One manual publish with 2FA: `npm publish --access public --provenance`
2. `npm trust github @status/try --file release.yml --repo jfrazx/try --allow-publish`

Step 1 should be re-checked against npm's current docs first. `npm trust` is new
enough that pre-registration for nonexistent packages may have landed since this
was written.

### PR 5 — README refresh

Full rewrite. Current README is a placeholder ("Soon, but not really"). Covers:
install, the `TryCatch` + `Try` pairing, `CatchError` standalone, the `try` map,
options (`returnOnError`, `runOnError`, `alwaysCatch`), and the
`TryCatchExtension` typing pattern that `test/lib/gambler.ts` demonstrates.

`typedoc` added as a real devDependency. `predocs` becomes `rimraf docs/api` and
`docs` outputs to `docs/api`, so generated API docs no longer collide with
hand-written documents under `docs/`.

`renovate.json` is added here, matching surrogate's config: `config:recommended`
with automerge for minor/patch/pin/digest and for non-zero-major devDependencies,
plus `platformAutomerge`. It lands late deliberately — renovate is already
running unconfigured against this repo (11 stale branches on origin prove it),
and automerging dependency bumps while the toolchain is mid-replacement would
create conflicts against deps PRs 1-3 are in the process of deleting.

### PR 6 — Code documentation

Public API thorough, internals light.

- Everything exported from `src/index.ts` — `Try`, `TryCatch`, `CatchError`, and
  the option/extension interfaces — gets full JSDoc with `@param`, `@returns`,
  and `@example`.
- Internal classes (the catcher/handler/rules layers) get a one-line purpose
  comment explaining why the unit exists, not what each line does.

Depends on `removeComments: false` from PR 3. Verification step: confirm JSDoc
survives tsdown's dts generation into `dist/*.d.ts` — that path runs through oxc
rather than tsc, so tsc's behavior does not guarantee it.

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Assertion mistranslation in PR 2 — a wrong conversion passes while testing nothing | High | Baseline is **27 passing**, captured with `NODE_OPTIONS=--no-experimental-strip-types npx mocha`. Convert one spec file at a time and confirm the running total still reaches 27. A drop in count is the failure signal; Jest reporting fewer tests than it should is the specific thing to watch for. |
| Coverage re-baselining — nyc and v8 disagree on what counts | Medium | Report measured numbers and set thresholds from them. Do not assume 90% carries over. |
| TS 6 is young | Medium | Same sparse-tooling concern as TS 7, one major down. Peer ranges verified to accept it; runtime surprises unknown until PR 3 runs. Fallback is holding at 5.9. |
| tsdown dts loses JSDoc | Medium | Explicitly verified in PR 6 rather than assumed. Fallback is generating declarations with tsc. |
| Trusted-publishing bootstrap blocks PR 4 | Medium | Isolated to PR 4. PRs 1-3, 5, 6 do not depend on it. |
| `target` bump changes class-field semantics via `useDefineForClassFields` | Low | Checked: `src` has no class-field initializers, only enum members, object literals, and TS parameter properties. Tests confirm. |

## 7. Verification

After every PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
PR 3 adds `publint` and `attw` on the built artifact. No PR is complete on
"looks right" — each claim is backed by command output.

## 8. Open items for Jason

1. Perform the PR 4 bootstrap: check whether npm now supports trusted-publisher
   pre-registration, otherwise publish a shell `0.0.1` to create the package,
   then `npm trust github`.
2. Prune the 11 stale `renovate/*` and `snyk-*` branches on origin. Listed, not
   deleted — remote refs are the maintainer's call. Best done before PR 5 lands
   `renovate.json`, so the new config governs a clean slate.
3. `CODECOV_TOKEN` must exist in repo secrets for the coverage workflow.
