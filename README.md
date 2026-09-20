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

| Decorator       | Needs `@TryCatch` on the class | Catches                                    |
| --------------- | ------------------------------ | ------------------------------------------ |
| `@Try()`        | yes                            | only when called through `.try`            |
| `@Catch()`      | yes                            | always — direct calls too, not only `.try` |
| `@CatchError()` | no                             | always                                     |

A member takes one of these, not several. Two on the same member is a
contradiction rather than a combination, so it is rejected as the class is
defined.

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

`@Catch()` always catches. Every call to the member is covered — a direct call
just as much as one through `.try`.

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

config.parse('not json'); // null
config.try.parse('not json'); // null
config.try.parse('{"a":"b"}'); // { a: 'b' }
```

It does need `@TryCatch()` on the class: the class decorator is what builds the
registry that installs the catching. `.try` is an additional way to reach the
member, never the gate. Without the class decorator the member is left exactly
as declared, and `@CatchError()` is the decorator for that case — it catches
every call and needs nothing on the class.

Reach for `@Catch()` when every caller wants the fallback and you also want the
member listed on `.try` alongside the rest of the class.

Options resolve identically on both paths: a `runOnError` passed to
`@TryCatch()` applies to a direct call just as it does through `.try`.

Catching is in place from the moment the class is defined, so it applies before
anything has been constructed, to a reference taken off the prototype, and to a
call the constructor itself makes.

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

Only methods and getters can be decorated, and anything else is rejected as the
class is defined rather than on the first construction:

```ts
import { TryCatch, Try } from '@status/try';

@TryCatch<Broken>()
class Broken {
  // @ts-expect-error -- properties are not supported
  @Try<Broken>()
  value = 'nope';
}
// [TryError]: Only methods and accessors can be captured.
// Property 'value' not supported
```

A setter with no getter is rejected the same way. Catching replaces what a
member hands back, and a setter hands back nothing.

Members must also be instance members. A static is handed the constructor rather
than the prototype, so it never reaches the registry `@TryCatch()` builds —
`@CatchError()` is the one to reach for there, since it needs no registry.

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

## Subclassing

A subclass inherits the catchable members of the class it extends. Decorate the
subclass too and its `.try` answers for both — what it declares, and what it
inherited.

```ts
import { TryCatch, Catch, type TryCatchExtension, type Tryable } from '@status/try';

interface Base extends TryCatchExtension<Base, 'load'> {}

@TryCatch<Base>()
class Base {
  @Catch()
  load(): string {
    throw new Error('nope');
  }
}

@TryCatch<Sub>()
class Sub extends Base {
  @Catch({ returnOnError: 'saved' })
  save(): string {
    throw new Error('nope');
  }
}

const sub = new Sub() as Tryable<Sub, 'load' | 'save'>;

sub.try.load(); // null, inherited from Base
sub.try.save(); // 'saved'
```

An inherited member keeps the options it was declared under, the base class's
`@TryCatch` defaults included. It is the same catcher rather than a rebuilt
one, so extending a class never changes how its members behave.

The class in between need not be decorated. A decorated class inherits from the
nearest decorated class above it, however many undecorated ones stand between.

### Overrides

A member the subclass declares is the subclass's own. Decorate it and it gets
its own catcher, which takes precedence over the inherited one.

Override it **without** a decorator and it is not catchable. `.try` says so
rather than quietly running the implementation you replaced. An override
anywhere along the way counts, including one on an undecorated class in
between:

```ts
@TryCatch<Sub>()
class Sub extends Base {
  load(): string {
    throw new Error('nope');
  }
}

new Sub().load(); // Error: nope

(new Sub() as any).try.load();
// [TryError]: Property 'load' does not exist in TryMap
```

`super` reaches the base's member as the base left it, which differs by
decorator. `@Try` leaves the member alone, so `super` gets the original and it
throws. `@Catch` replaced the member, so `super` gets the catcher:

```ts
@TryCatch<Base>()
class Base {
  @Try({ returnOnError: 'tried' })
  tried(): string {
    throw new Error('nope');
  }

  @Catch({ returnOnError: 'caught' })
  caught(): string {
    throw new Error('nope');
  }
}

@TryCatch<Sub>()
class Sub extends Base {
  tried(): string {
    return super.tried(); // throws Error('nope')
  }

  caught(): string {
    return super.caught(); // 'caught'
  }
}
```

There is no way to reach the undecorated original of a `@Catch` member. Always
catching is what `@Catch` means, and it holds for a subclass calling `super` as
much as for anything else.

### Typing a subclass

A subclass cannot merge an interface of its own. It already inherits the base's
`try`, and a second declaration of a different type is rejected:

```ts
interface Sub extends TryCatchExtension<Sub, 'save'> {}
// TS2320: Interface 'Sub' cannot simultaneously extend types 'Base' and
// 'TryCatchExtension<Sub, "save">'.
```

Use `Tryable<T, K>` instead, listing what the subclass exposes:

```ts
const sub = new Sub() as Tryable<Sub, 'load' | 'save'>;
```

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

| Export              |                                                            |
| ------------------- | ---------------------------------------------------------- |
| `TryCatch`          | class decorator; installs the `.try` map                   |
| `Try`               | catches only through `.try`                                |
| `Catch`             | always catches; registered on the class, so also on `.try` |
| `CatchError`        | always catches; standalone                                 |
| `TryOptions`        | `returnOnError`, `runOnError`                              |
| `TryCatchOptions`   | `runOnError`                                               |
| `TryError`          | what `runOnError` receives                                 |
| `TryCatchExtension` | the `.try` + `getTryManager()` shape                       |
| `Tryable`           | `T & TryCatchExtension<T, K>`                              |
| `TryMethods`        | `getTryManager()`                                          |
| `TryProperties`     | the shape of the `.try` map                                |
| `TryManager`        | what `getTryManager()` returns                             |

Generated API documentation lives in `docs/api` after `npm run docs`.

## License

MIT
