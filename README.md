# Try

Automatically catch errors on object methods and accessors.

`try`/`catch` blocks tend to pile up around the calls most likely to fail, until
the error handling outweighs the work. This library moves that handling onto the
declaration with a decorator, and lets the call site stay a call site. For an
object you did not declare, `tryWrap` does the same without one.

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

## Objects you did not declare

Every decorator above needs the declaration site. `tryWrap` is for the objects
that do not have one you control — `JSON`, `Math`, an SDK client, a driver, a
factory's object literal, `localStorage`.

It takes the target and a map of the members to make catchable:

```ts
import { tryWrap } from '@status/try';

const json = tryWrap(JSON, {
  parse: { returnOnError: {} },
});

json.parse('nope'); // throws SyntaxError
json.try.parse('nope'); // {}
json.try.parse('{"a":"b"}'); // { a: 'b' }
```

`.try`-map semantics only, matching `@Try`: the member keeps throwing on a
direct call, and the call through `.try` is what catches. That is deliberate
rather than a missing feature — other code holds the same reference and has its
own expectations about whether the member throws.

The target is never written to. Each member is registered as catching through
`.try` alone, so nothing is installed on the object and a frozen or sealed one
wraps as readily as any other. What comes back stands in front of the target and
is not the target, so `tryWrap(JSON, …) !== JSON` and `JSON.parse` keeps
throwing for everyone else.

A third argument supplies defaults for every member, mirroring `@TryCatch()`,
and a member's own options win — the same precedence `@Try()` has over
`@TryCatch()`:

```ts
const client = tryWrap(
  apiClient,
  {
    fetchUser: { returnOnError: null },
    listUsers: { returnOnError: [] },
  },
  {
    runOnError: ({ property, error }) => log.warn(`${property}: ${error.message}`),
  },
);
```

Inherited members are the normal case rather than the exception — `new Map().get`
is declared on `Map.prototype` — so the member is resolved off the prototype
chain.

### Types come for free

A decorator cannot change the type of what it decorates, which is why `.try`
needs declaration merging. A function can, so `tryWrap` needs none of it: the
member map is what types the result.

```ts
const client = tryWrap(apiClient, { fetchUser: {} });

client.try.fetchUser('7'); // typed from apiClient
client.try.listUsers(); // compile error: not in the map
tryWrap(apiClient, { fetchUsr: {} }); // compile error: not a member
```

A map built ahead of the call keeps its own type with `satisfies`. Annotated as
`TryMembers<…>` instead, it widens to every member, and `.try` types all of them
whether they were mapped or not:

```ts
const members = { fetchUser: {} } satisfies TryMembers<typeof apiClient>;

tryWrap(apiClient, members).try.listUsers(); // compile error: not in the map
```

A getter and a data property have the same type, so the map cannot exclude a
data property. That one is rejected at runtime, off the descriptor:

```ts
tryWrap({ config: 1 }, { config: {} });
// [TryError]: Only methods and getters can be captured.
// Property 'config' holds a value that is not a function
```

### What it refuses

Two cases are rejected as the wrapper is built rather than left to surface later:

- **a target that already has a `try` or `getTryManager` member.** Both names are
  resolved before anything reaches the target, so the member would be left
  unreachable with nothing said. The author of a decorated class can rename
  theirs; whoever was handed an SDK client cannot.
- **a target that is already wrapped**, including a `@TryCatch` instance. The
  outer catchers would run against the inner wrapper rather than the target.

Wrapping the same **raw** target twice is fine. Each call gets its own map and
neither can affect the other, precisely because nothing is written to the target.

### Known limitations

- `.try` covers the members of `T` the type knows about, so a member that exists
  at runtime but not in the type cannot be named
  ([#43](https://github.com/jfrazx/try/issues/43)).
- A member whose name is already `in` the `.try` map — `toString`, `valueOf`,
  `constructor` — is shadowed by the map rather than caught, and a string-named
  protocol probe such as `toJSON` throws like a typo would
  ([#34](https://github.com/jfrazx/try/issues/34)). `tryWrap` refuses such a
  member outright rather than returning a plausible wrong answer; on a decorated
  class it stays as described.
- A method that checks its receiver has to be called through `.try`. That is
  every method of a builtin with internal slots — `Map`, `Set`, `Date`,
  `Promise`, a typed array — and of any class using `#private` fields. Reading
  or writing a property through the wrapper works, but a direct call fails on
  the receiver, because `this` is the wrapper whatever the access handed back
  ([#57](https://github.com/jfrazx/try/issues/57)):

  ```ts
  const map = tryWrap(new Map([['a', 1]]), { get: {} });

  map.try.get('a'); // 1
  map.size; // 1
  map.get('a'); // TypeError: called on incompatible receiver
  ```

  Hold the target itself for the calls that are meant to throw.

- A member returning `this` returns the target, not the wrapper, so `.try` does
  not chain on a fluent API:

  ```ts
  const map = tryWrap(new Map(), { set: {} });

  map.try.set('a', 1).try; // undefined — set returned the raw Map
  ```

  Keep the wrapper in a variable and start each call from it.

- What the wrapper covers is fixed when it is built. A member reassigned
  afterwards — a re-initialized SDK client, a `jest.spyOn`, a monkey patch —
  leaves `.try` running the implementation that was there at wrap time while a
  direct call runs the new one. A `try` or `getTryManager` the target gains
  afterwards is shadowed with nothing said, since the wrapper can only refuse
  names the target already had. Wrap again after mutating the target.

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

`tryWrap` needs none of this, because a function can change its return type —
see [Objects you did not declare](#objects-you-did-not-declare).

## Exports

| Export              |                                                            |
| ------------------- | ---------------------------------------------------------- |
| `TryCatch`          | class decorator; installs the `.try` map                   |
| `Try`               | catches only through `.try`                                |
| `Catch`             | always catches; registered on the class, so also on `.try` |
| `CatchError`        | always catches; standalone                                 |
| `tryWrap`           | makes members of an object you did not declare catchable   |
| `TryOptions`        | `returnOnError`, `runOnError`                              |
| `TryMembers`        | the member map `tryWrap` takes                             |
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
