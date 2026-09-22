import type { TryManager } from '../manager';

/**
 * The shape of the `.try` map: the catchable members of `T`, minus `try`
 * itself so the map cannot be nested.
 *
 * @template T - the decorated class
 * @template K - the members registered as catchable
 */
export type TryProperties<T, K extends keyof T> = Omit<Pick<T, K>, 'try'>;

/**
 * A class `T` together with everything {@link TryCatch} adds to it.
 *
 * An alternative to declaration merging with {@link TryCatchExtension}, useful
 * where you need the combined type as an expression rather than on the class
 * declaration itself.
 *
 * @template T - the decorated class
 * @template K - the members registered as catchable, defaulting to all of them
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type Tryable } from '@status/try';
 *
 * @TryCatch()
 * class Loader {
 *   @Try()
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * const loader = new Loader() as Tryable<Loader, 'load'>;
 *
 * loader.try.load(); // null
 * ```
 */
export type Tryable<T extends object, K extends keyof T = keyof T> = T &
  TryCatchExtension<T, K>;

/**
 * The members {@link TryCatch} adds to a decorated class at runtime.
 *
 * A decorator cannot change the type of the class it decorates, so these are
 * declared by merging an interface of the same name — without that, `.try` and
 * `getTryManager()` exist at runtime but the compiler does not know it.
 *
 * @template T - the decorated class
 * @template K - the members registered as catchable
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension } from '@status/try';
 *
 * interface Loader extends TryCatchExtension<Loader, 'load'> {}
 *
 * @TryCatch<Loader>()
 * class Loader {
 *   @Try()
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * new Loader().try.load(); // null
 * ```
 */
export interface TryCatchExtension<
  T extends object,
  K extends keyof T,
> extends TryMethods<T, K> {
  try: TryProperties<T, K>;
}

/**
 * The manager accessor {@link TryCatch} adds to a decorated class.
 *
 * @template T - the decorated class
 * @template K - the members registered as catchable
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension, type TryManager } from '@status/try';
 *
 * interface Loader extends TryCatchExtension<Loader, 'load'> {}
 *
 * @TryCatch<Loader>()
 * class Loader {
 *   @Try()
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * const manager: TryManager<Loader, 'load'> = new Loader().getTryManager();
 * ```
 */
export interface TryMethods<T extends object, K extends keyof T> {
  /** The registry holding this instance's catchers. One per class, shared by every instance. */
  getTryManager(): TryManager<T, K>;
}

/**
 * Class-wide defaults passed to {@link TryCatch}, applied to every member it
 * registers.
 *
 * Only `runOnError` is settable here. `returnOnError` is per-member and lives
 * on {@link TryOptions}, because a single fallback value rarely suits every
 * member of a class.
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension } from '@status/try';
 *
 * interface Loader extends TryCatchExtension<Loader, 'load'> {}
 *
 * @TryCatch<Loader>({
 *   runOnError: ({ property }) => console.warn(`${property} failed`),
 * })
 * class Loader {
 *   @Try()
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * new Loader().try.load(); // null, after the warning
 * ```
 */
export interface TryCatchOptions extends SharedOptions {}

/**
 * The description of a caught error, handed to `runOnError`.
 *
 * @example
 * ```ts
 * import { CatchError, type TryError } from '@status/try';
 *
 * class Loader {
 *   @CatchError({
 *     runOnError: ({ property, error }: TryError) =>
 *       console.warn(`${property}: ${error.message}`),
 *   })
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * new Loader().load(); // null, after warning "load: nope"
 * ```
 */
export interface TryError {
  /** The error the member threw. */
  error: Error;
  /**
   * Name of the member that threw. A symbol-named member arrives in its
   * `String()` form — `Symbol(parse)` — so this is always safe to interpolate.
   */
  property: string;
  /** Arguments the member was called with, in the order they were passed. */
  arguments: any[];
  /** The configured fallback, before `runOnError` has had its chance to replace it. */
  returnOnError: any;
}

/**
 * Options common to the class-wide and per-member forms. Not exported; its
 * members surface on {@link TryCatchOptions} and {@link TryOptions}.
 */
interface SharedOptions {
  /**
   * Runs when a member throws — logging, metrics — called with the
   * {@link TryError} before the fallback value is handed back.
   *
   * Its return value is **not** discarded. Anything other than `null` or
   * `undefined` is handed to the caller in place of `returnOnError`. Mind
   * implicit arrow returns: `({ error }) => logger.warn(error)` returns
   * whatever `logger.warn` returns, quietly replacing the configured fallback.
   * Give the handler a block body to run it purely as a side effect.
   *
   * @param tryError - what threw, where, and what would otherwise be returned
   * @returns a replacement for `returnOnError`, or `null`/`undefined` to leave it alone
   */
  runOnError?(tryError: TryError): any;
}

/**
 * Per-member catching behavior, passed to {@link Try}, {@link Catch} or
 * {@link CatchError}.
 *
 * `returnOnError` is the value a caught member yields, defaulting to `null`.
 * `runOnError` runs first, with the {@link TryError}; if it returns anything
 * other than `null` or `undefined`, that value is yielded instead.
 *
 * An `async` member yields a `Promise` of that value, not the value itself —
 * `await` it before comparing.
 *
 * @example
 * ```ts
 * import { CatchError } from '@status/try';
 *
 * class Loader {
 *   @CatchError({ returnOnError: [] })
 *   list(): string[] {
 *     throw new Error('nope');
 *   }
 * }
 *
 * new Loader().list(); // []
 * ```
 */
export interface TryOptions extends SharedOptions {
  /**
   * Value a caught member yields in place of throwing. Defaults to `null`, and
   * a non-nullish return from `runOnError` takes precedence over it.
   */
  returnOnError?: any;
}

/**
 * The members {@link tryWrap} should make catchable, each with its own
 * {@link TryOptions}.
 *
 * Every key is optional and every key has to be a member of `T`, so a typo is a
 * compile error rather than a member that silently never catches. The map is
 * also what types the resulting `.try`, which is why `tryWrap` needs none of
 * the declaration merging the decorators do.
 *
 * Keys cannot be narrowed to callable members only. A getter and a data
 * property are indistinguishable to the type system — `get config(): string`
 * has the same type as `config: string` — so a data property is rejected at
 * runtime off its descriptor instead.
 *
 * @template T - the object being wrapped
 *
 * @example
 * ```ts
 * import { tryWrap, type TryMembers } from '@status/try';
 *
 * const members: TryMembers<JSON> = { parse: { returnOnError: {} } };
 *
 * tryWrap(JSON, members).try.parse('nope'); // {}
 * ```
 */
export type TryMembers<T extends object> = { [K in keyof T]?: TryOptions };

/**
 * Internal. One decorated member, queued at decoration time for registration
 * when the class decorator runs.
 *
 * The descriptor is deliberately not carried here. What a member decorator is
 * handed is the member as it stood at that moment, and a decorator applied
 * above it may replace the member afterwards — so the descriptor is read from
 * the prototype at registration time instead, once every member decorator has
 * had its turn.
 */
export interface DecoratedEventMap<T extends object, K extends keyof T> {
  options: RegistrationOptions;
  /**
   * The prototype the decorator was applied to. A member that always catches
   * is installed here rather than on the prototype of whatever subclass
   * happened to be constructed first.
   */
  prototype: object;
  property: K;
}

/** Internal. {@link TryOptions} plus the resolved `alwaysCatch` flag each decorator hard-sets; never user-supplied. */
export interface RegistrationOptions extends TryOptions {
  alwaysCatch: boolean;
}

/**
 * Internal. Which object a catcher runs the original against, decided per
 * wrapped object rather than library-wide.
 *
 * `proxy` is the decorator path. `this` inside a decorated member stays
 * proxy-transparent, so another decorated member reached through it still
 * catches, and a derived object reading `.try` runs against itself.
 *
 * `raw` is {@link tryWrap}. A foreign object's method should see that object as
 * `this`, and a builtin with internal slots — `Map`, `Set`, `Date`, `WeakMap`,
 * `Promise`, a typed array — insists on it: handed a Proxy it throws
 * `incompatible receiver`, which the catcher then catches. Every successful
 * call would come back as the fallback, so a wrapped `Map` would report every
 * key as missing.
 */
export type TryReceiver = 'proxy' | 'raw';

/** Internal. The rule contract used by the handler and catcher chains: test, then act. */
export interface ShouldHandle {
  shouldHandle(): boolean;
  handle(): any;
}
