import type { TryMembers, TryOptions } from '../interfaces';
import { handledNames } from '../handler/rules/interfaces';
import type { TryManager } from '../manager';
import { isWrapper } from '../handler';
import { upChain } from '../helpers';
import { isCaught } from '../catcher';

/**
 * Internal. The entry point a refusal names.
 *
 * {@link tryWrap}, {@link tryClass} and {@link tryFn} refuse several of the
 * same things, and each says so in its own name — a message naming another
 * entry point would send its reader looking for a call they never made.
 */
export type Entry = 'tryWrap' | 'tryClass' | 'tryFn';

/**
 * Internal. Registers each mapped member against the object its descriptor is
 * read from, refusing any the map cannot take.
 *
 * Whatever is being wrapped, it was declared by somebody else, so nothing may be
 * written to it: every member catches only through `.try`.
 *
 * @param entry - the entry point registering, for the refusals' wording
 * @param manager - the manager the members join
 * @param source - the object members are resolved from, walking up its chain
 * @param members - the member map, each with its own options
 * @throws if a mapped member shares a name with the `.try` map's own, is
 * already caught by `@CatchError`, or is neither a method nor a getter
 */
export const registerMembers = (
  entry: Entry,
  manager: TryManager<any, any>,
  source: object,
  members: object,
): void =>
  manager.registerTryCatchDescriptors(
    Reflect.ownKeys(members).map((property) => {
      const prototype = descriptorSource(source, property);

      rejectShadowed(manager, property);
      rejectCaught(entry, prototype, property);

      return {
        property,
        prototype,
        // `alwaysCatch` is load-bearing rather than a default repeated for
        // clarity. It is what leaves the registration with nothing to install,
        // and the object it would otherwise install on is `prototype` above —
        // which for an inherited member is a shared one, `Map.prototype` for a
        // wrapped `Map`. It is hard-set after the spread so a member's own
        // options cannot reach it, and the public option types do not carry it.
        options: {
          ...(members as Record<PropertyKey, TryOptions | undefined>)[property],
          alwaysCatch: false,
        },
      };
    }),
  );

/**
 * Wrapping a wrapper is refused.
 *
 * The outer wrapper's catchers would run the member against the inner proxy,
 * which is the incompatible-receiver failure {@link tryWrap} resolves the
 * receiver to the raw target to avoid — arriving silently, and only for the
 * builtins hardest to debug. Two wraps of the same *raw* target stay allowed:
 * nothing is written to it, so neither can affect the other.
 *
 * A decorated instance is one of these too. `@TryCatch` hands out the same
 * wrapper, so the same reasoning applies to it.
 *
 * Inheriting from a wrapper counts. The member is found by walking up from the
 * target, so the walk passes straight through an inner wrapper standing in the
 * chain and reaches whatever declared the member — leaving the catcher running
 * against an object that is not the one the inner wrapper stands in front of,
 * which is the same corruption arriving by a longer road.
 *
 * This says nothing about a target that merely has a builtin's methods without
 * its internal slots, which fails the same way and cannot be told apart here:
 * `Object.create(new Map())`, which looks like an ordinary subclass, or a proxy
 * placed in front of a builtin. That includes a proxy placed in front of a
 * wrapper. It is neither the wrapper nor anything inheriting from it, and
 * nothing portable tells it from any other proxy. The catchers then run against
 * that proxy, and fail because of the proxy rather than the nesting: one in
 * front of a bare `Map` fails identically.
 *
 * {@link tryFn} refuses the same wrappers for a different reason. Its catcher
 * runs the function with whatever `this` the call provides, so no receiver goes
 * wrong; but the wrapper it would stand in front of answers `.try` already, and
 * the outer `.try` would hide the inner one with nothing said. That holds in
 * both directions, which is why `tryWrap` refuses a `tryFn` result too.
 * `tryClass` refuses a wrapped class in its own terms, and is not an entry here.
 *
 * @param entry - the entry point refusing, which says why
 * @param target - the object about to be wrapped
 * @throws if the target, or anything it inherits from, is a wrapper
 */
export const rejectWrapper = (
  entry: Exclude<Entry, 'tryClass'>,
  target: object,
): void => {
  if (upChain(target, isWrapper)) {
    throw new Error(alreadyWrapped[entry]);
  }
};

/**
 * Why each entry point refuses a wrapper, which differs: one would run its
 * catchers against the wrong receiver, the other would hide a `.try`.
 */
const alreadyWrapped: Record<Exclude<Entry, 'tryClass'>, string> = {
  tryWrap: `[TryError]: tryWrap cannot wrap an object that is already wrapped, or one that inherits from a wrapper. The outer catchers would run against the inner wrapper rather than the target, which a builtin rejects as an incompatible receiver — wrap the original target once, with every member it needs`,
  tryFn: `[TryError]: tryFn cannot wrap a function that is already wrapped, or one that inherits from a wrapper. Its .try would hide the one the wrapper already answers — wrap the original function once`,
};

/**
 * A member sharing a name with the `.try` map's own is refused.
 *
 * `.try` resolves its own members first, so a member named `toString` or
 * `valueOf` is answered by the map and its catcher is never reached —
 * `.try.toString()` hands back `'[object Object]'` rather than the fallback,
 * with nothing said. See
 * {@link https://github.com/jfrazx/try/issues/34 | issue #34}, which is where
 * the decorators leave it: a class can rename its member, and refusing there
 * would reject classes that work today. Nothing can be renamed on an object
 * somebody else declared, and the whole member list is here before anything
 * has run.
 *
 * @throws if the map answers that name itself
 */
export const rejectShadowed = (
  manager: TryManager<any, any>,
  property: PropertyKey,
): void => {
  if (manager.shadowsTryMap(property)) {
    throw new Error(
      `[TryError]: The try map answers its own members before any catcher. Property '${String(property)}' shares a name with one and would never catch — reach it on the target itself`,
    );
  }
};

/**
 * A member `@CatchError` already catches is refused.
 *
 * Registration refuses it too, but in the decorators' terms — naming `@Try` and
 * `@Catch`, neither of which whoever called this applied. The reason is the
 * same either way: the member a catcher would be built around is already a
 * catcher, so it answers every call and yields its own fallback. Nothing ever
 * throws, and the options given here are never reached.
 *
 * @throws if a catching decorator already answers for the member
 */
export const rejectCaught = (
  entry: Entry,
  prototype: object,
  property: PropertyKey,
): void => {
  if (isCaught(prototype, property)) {
    throw new Error(
      `[TryError]: ${entry} cannot wrap a member @CatchError already catches. Property '${String(property)}' catches on its own, so it never throws and the options given here would never be reached`,
    );
  }
};

/**
 * A target declaring a name its entry point claims is refused.
 *
 * `tryWrap` answers `try` and `getTryManager` with rules that run before
 * anything is forwarded to the target, `tryClass` defines both on every
 * instance it builds, and `tryFn` answers `try` alone — it builds a single
 * catcher, with no manager to hand out. Whichever it is, a member of a claimed
 * name is left unreachable with nothing said. The author of a decorated class
 * chose its member names and can change one; whoever was handed an SDK client
 * did not and cannot.
 *
 * Inherited counts, which is why this is an `in` check rather than an own-property
 * one: a member inherited from a base class is shadowed just as completely as
 * one declared on the object.
 *
 * @param entry - the entry point refusing, which says why
 * @param target - the object about to be wrapped
 * @param names - the names that entry point claims
 * @throws if the target has any of those names
 */
export const rejectReservedNames = (
  entry: Entry,
  target: object,
  names: readonly PropertyKey[] = handledNames,
): void => {
  const claimed = names.find((name) => name in target);

  if (claimed) {
    throw new Error(reservedName[entry](String(claimed)));
  }
};

/**
 * Why each entry point refuses a reserved name, which differs: two answer the
 * name in front of the target, the other defines it on the instance.
 */
const reservedName: Record<Entry, (claimed: string) => string> = {
  tryWrap: (claimed) =>
    `[TryError]: tryWrap resolves 'try' and 'getTryManager' before the target sees them. Property '${claimed}' is declared on the target and would be unreachable through the wrapper — reach it on the target itself, or wrap an object that does not declare it`,
  tryClass: (claimed) =>
    `[TryError]: tryClass defines 'try' and 'getTryManager' on every instance it builds. Property '${claimed}' is already declared by the class or its constructor and would be replaced — reach it through the original class, or wrap a class that does not declare it`,
  tryFn: (claimed) =>
    `[TryError]: tryFn answers 'try' before the function sees it. Property '${claimed}' is declared on the function and would be unreachable through the wrapper — reach it on the function itself, or wrap a function that does not declare it`,
};

/**
 * A class with no prototype is refused.
 *
 * The member map is resolved against the prototype, and an arrow function or a
 * bound one has none — so without this, the first thing to read it fails on
 * `undefined` with a message that says nothing about why. Neither builds an
 * instance worth wrapping either: an arrow cannot be constructed, and a bound
 * function constructs whatever it was bound from, which is the one to wrap.
 *
 * Asked of the class being wrapped and of each class constructed through it,
 * since `Reflect.construct` can name a bound function as the class to build.
 *
 * @throws if the class's prototype is not an object
 */
export const rejectWithoutPrototype = (klass: Function): void => {
  if (Object(klass.prototype) !== klass.prototype) {
    throw new Error(
      `[TryError]: tryClass needs a class. '${klass.name}' has no prototype to resolve members against — wrap an object with tryWrap instead`,
    );
  }
};

/**
 * The object registration should read the member's descriptor from.
 *
 * Registration reads the descriptor from the object it is handed and does not
 * walk, which is right for a decorator — the prototype it was applied to is the
 * one that declares the member. Here the target is usually an instance, and an
 * inherited member is the normal case rather than the exception: `new Map().get`
 * is declared on `Map.prototype`.
 *
 * The target stands in when nothing declares the member. Registration then
 * finds no descriptor and rejects it in the same terms an unsupported member
 * gets, which is the honest outcome for a member the type promised and the
 * object does not have.
 */
const descriptorSource = (target: object, property: PropertyKey): object =>
  upChain(target, (owner) =>
    Boolean(Object.getOwnPropertyDescriptor(owner, property)),
  ) ?? target;

/**
 * Internal. What a member map's keys must satisfy beyond the constraint on `M`.
 *
 * A key the map cannot take — one outside `keyof T`, or one of the names
 * {@link TryMembers} leaves out — is a compile error, which the constraint on
 * `M` does not manage alone. `M` is inferred from the literal, and a literal
 * sharing a single key with `TryMembers<T>` satisfies it with every other key
 * riding along — so a typo beside a real member compiled. Intersected with the
 * map, this requires each such key to be `never` as well, which no options
 * object is.
 *
 * Both halves of that requirement are load-bearing. Intersecting a bare
 * `Record` of the stray keys costs an inline `runOnError` its parameter types,
 * and breaks a caller forwarding a `TryMembers<T>` of its own, whose stray keys
 * are an `Exclude` of a generic that never simplifies. The conditional hands
 * back `unknown` whenever every key belongs to `TryMembers<T>`, which a
 * forwarded map's keys provably do. `Uninferred` keeps `M` inferred from the
 * map rather than the requirement — left out, a forwarded map infers `M` as `T`
 * itself.
 *
 * @template T - the object whose members are mapped
 * @template M - the member map as inferred from the call
 */
export type StrictMembers<T extends object, M> = Uninferred<
  keyof M extends keyof TryMembers<T>
    ? unknown
    : Record<Exclude<keyof M, keyof TryMembers<T>>, never>
>;

/**
 * Holds a type out of inference, as TypeScript 5.4's `NoInfer` does, in a form
 * older compilers read.
 *
 * The built-in would set the published typings' floor at 5.4 for every
 * consumer, decorators included, for the sake of one parameter: they compiled
 * back to 4.9 before it. Indexing a one-element tuple by a conditional the
 * compiler cannot resolve early is the long-standing way to get the same
 * deferral, and the suite's forwarded-map test fails without it.
 */
type Uninferred<T> = [T][T extends any ? 0 : never];
