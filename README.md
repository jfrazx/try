# Try

Automatically catch errors on object methods and accessors.

`try`/`catch` blocks tend to pile up around the calls most likely to fail, until
the error handling outweighs the work. This library moves that handling onto the
declaration with a decorator, and lets the call site stay a call site.

## Install

```sh
npm install @status/try
```

```sh
yarn add @status/try
```

Decorators are the legacy (stage 2) kind, so `experimentalDecorators` must be
enabled:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
  },
}
```

## Two ways to catch

The library offers a choice about **when** a method is allowed to fail.

| Decorator       | Needs `@TryCatch` on the class | Catches                                               |
| --------------- | ------------------------------ | ----------------------------------------------------- |
| `@Try()`        | yes                            | only when called through `.try`                       |
| `@Catch()`      | yes                            | only when called through `.try` — [see below](#catch) |
| `@CatchError()` | no                             | always                                                |

A caught error produces `null` unless you say otherwise.

### `@TryCatch` + `@Try` — opt in at the call site

`@Try()` marks a method as catchable but does not change it. The method keeps
throwing when called normally. Calling it through the `.try` map is what applies
the catching.

```ts
import { TryCatch, Try, type TryCatchExtension } from '@status/try';

interface Config extends TryCatchExtension<Config, 'parse'> {}

@TryCatch<Config>()
class Config {
  @Try()
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}

const config = new Config();

config.parse('not json'); // throws SyntaxError
config.try.parse('not json'); // null
config.try.parse('{"a":"b"}'); // { a: 'b' }
```

This is the pairing to reach for when the same method has callers that want the
error and callers that do not. One declaration serves both.

The `interface` line is not decoration. `.try` is installed at runtime, so
TypeScript needs to be told it exists — see [TypeScript](#typescript) for what
that line is doing and how it scales past one method.

### `@Catch`

`@Catch()` is intended as the middle ground — registered on the class like
`@Try()`, but catching on every call rather than only through `.try`.

**It does not currently do that.** As shipped it is indistinguishable from
`@Try()`: calling the method normally still throws, and only `.try` catches.
See [#30](https://github.com/jfrazx/try/issues/30) for the cause.

```ts
import { TryCatch, Catch, type TryCatchExtension } from '@status/try';

interface Config extends TryCatchExtension<Config, 'parse'> {}

@TryCatch<Config>()
class Config {
  @Catch()
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}

const config = new Config();

config.parse('not json'); // throws -- despite the name
config.try.parse('not json'); // null
```

Until that is resolved, reach for `@CatchError()` when you want a method that
always catches, and treat `@Catch()` as a synonym for `@Try()`.

### `@CatchError` — standalone

`@CatchError()` needs no class decorator. Use it when one method wants error
handling and the rest of the class does not care.

```ts
import { CatchError } from '@status/try';

class Config {
  @CatchError()
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}

new Config().parse('not json'); // null
```

The tradeoff: no `.try` map, and no `getTryManager()`. It is the lighter tool.

## Accessors and async

Everything above works on getters and on anything returning a promise. A
rejected promise is caught the same way a thrown error is.

```ts
import { CatchError } from '@status/try';

class Remote {
  @CatchError()
  get config(): Promise<string> {
    return Promise.reject(new Error('unreachable'));
  }

  @CatchError()
  async load(): Promise<string> {
    throw new Error('unreachable');
  }
}

const remote = new Remote();

await remote.config; // null
await remote.load(); // null
```

Only methods and accessors can be decorated. A plain property is rejected:

```ts
import { TryCatch, Try } from '@status/try';

@TryCatch<Broken>()
class Broken {
  // @ts-expect-error -- properties are not supported
  @Try<Broken>()
  value = 'nope';
}

new Broken();
// [TryError]: Only methods and accessors can be captured.
// Property 'value' not supported
```

## Options

`@Try()`, `@Catch()` and `@CatchError()` all take the same two options.

### `returnOnError`

The value handed back instead of `null`.

```ts
import { CatchError } from '@status/try';

class Config {
  @CatchError({ returnOnError: {} })
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}

new Config().parse('not json'); // {}
```

### `runOnError`

A callback invoked with the error and its context. Useful for logging, and for
deciding the return value at the point of failure.

```ts
import { CatchError, type TryError } from '@status/try';

class Config {
  @CatchError({
    returnOnError: {},
    runOnError: (tryError: TryError) => {
      console.error(`${tryError.property} failed:`, tryError.error.message);
      console.error('called with:', tryError.arguments);
    },
  })
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}

new Config().parse('not json'); // {} -- runOnError returned nothing
```

It receives a `TryError`:

| Field           | Type     |                                        |
| --------------- | -------- | -------------------------------------- |
| `error`         | `Error`  | what was thrown                        |
| `property`      | `string` | the method or accessor that threw      |
| `arguments`     | `any[]`  | the arguments it was called with       |
| `returnOnError` | `any`    | the configured fallback, for reference |

**A value returned from `runOnError` wins.** The resolution order is the
callback's return, then `returnOnError`, then `null` — so returning nothing (or
`null`) falls through to `returnOnError`.

```ts
import { CatchError, type TryError } from '@status/try';

class Config {
  @CatchError({
    returnOnError: 'fallback',
    runOnError: (tryError: TryError) =>
      tryError.error instanceof SyntaxError ? 'malformed' : undefined,
  })
  parse(raw: string): string {
    JSON.parse(raw);
    return 'ok';
  }
}

new Config().parse('not json'); // 'malformed' -- the callback's return wins
```

### Class-wide defaults

`@TryCatch()` accepts a `runOnError` that applies to every decorated member of
the class. Per-method options take precedence.

```ts
import { TryCatch, Try, type TryError } from '@status/try';

@TryCatch<Config>({
  runOnError: (tryError: TryError) => {
    console.error(`${tryError.property}:`, tryError.error.message);
  },
})
class Config {
  @Try()
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }

  @Try({ returnOnError: {} })
  parseOrEmpty(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }
}
```

Note that `@TryCatch()` takes **only** `runOnError`. `returnOnError` is a
per-member decision and has no class-wide form.

## TypeScript

`.try` and `getTryManager()` are installed at runtime, so the class declaration
alone does not describe them. Declaration merging is how the types are picked
up — declare an interface of the same name extending `TryCatchExtension<T, K>`:

```ts
import { TryCatch, Try, type TryCatchExtension } from '@status/try';

type ConfigMethods = Pick<Config, 'parse' | 'load'>;

interface Config extends TryCatchExtension<Config, keyof ConfigMethods> {}

@TryCatch<Config>()
class Config {
  @Try()
  parse(raw: string): Record<string, string> {
    return JSON.parse(raw);
  }

  @Try()
  async load(path: string): Promise<string> {
    throw new Error(`cannot read ${path}`);
  }
}

const config = new Config();

config.try.parse('not json'); // typed Record<string, string>
await config.try.load('/etc/app'); // typed string

(config.try as any).missing();
// [TryError]: Property 'missing' does not exist in TryMap
```

The `Pick` is what keeps `.try` honest: list the members you decorated, and
`.try` exposes those and nothing else. As the last line shows, reaching for
anything absent from the map throws rather than returning `undefined`.

`Tryable<T, K>` is available as shorthand for `T & TryCatchExtension<T, K>`
where an intersection reads better than a merged interface.

## Exports

| Export              |                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `TryCatch`          | class decorator; installs the `.try` map                                                              |
| `Try`               | catches only through `.try`                                                                           |
| `Catch`             | intended as always-catch; currently behaves as `Try` ([#30](https://github.com/jfrazx/try/issues/30)) |
| `CatchError`        | always catches; standalone                                                                            |
| `TryOptions`        | `returnOnError`, `runOnError`                                                                         |
| `TryCatchOptions`   | `runOnError`                                                                                          |
| `TryError`          | what `runOnError` receives                                                                            |
| `TryCatchExtension` | the `.try` + `getTryManager()` shape                                                                  |
| `Tryable`           | `T & TryCatchExtension<T, K>`                                                                         |
| `TryMethods`        | `getTryManager()`                                                                                     |
| `TryProperties`     | the shape of the `.try` map                                                                           |
| `TryManager`        | what `getTryManager()` returns                                                                        |

Generated API documentation lives in `docs/api` after `npm run docs`.

## License

MIT
