import type { TryCatchOptions, TryMembers, Tryable } from '../interfaces';
import { Handle } from '../handler/rules/interfaces';
import { TryHandler, isWrapper } from '../handler';
import { TryManager } from '../manager';
import { isCaught } from '../catcher';

/**
 * Makes members of an object you did not declare catchable, without a
 * decorator.
 *
 * `.try`-map semantics throughout, matching {@link Try}: the member keeps
 * throwing on a direct call, and the call through `.try` is what catches. That
 * is the deliberate choice for a foreign object — other code holds the same
 * reference and has its own expectations about whether the member throws.
 *
 * The target is never written to. Every member is registered as catching only
 * through `.try`, so nothing is installed on it and a frozen or sealed object
 * wraps as readily as any other. What comes back is a new object standing in
 * front of the target, not the target.
 *
 * Unlike the decorators, this needs no declaration merging: a function can
 * change its return type, so `.try` and `getTryManager()` are typed from the
 * member map.
 *
 * @template T - the object being wrapped
 * @template M - the member map, which is what types `.try`
 * @param target - the object whose members should become catchable
 * @param members - the members to make catchable, each with its own options
 * @param options - defaults applied to every member in the map
 * @returns the target behind a `.try` map covering the mapped members
 * @throws if the target already carries a `try` or `getTryManager` member, if
 * it or anything it inherits from is already wrapped, if a mapped member shares
 * a name with the `.try` map's own or is already caught by `@CatchError`, or if
 * a mapped member is neither a method nor a getter
 *
 * @example
 * ```ts
 * import { tryWrap } from '@status/try';
 *
 * const json = tryWrap(JSON, {
 *   parse: { returnOnError: {} },
 * });
 *
 * json.parse('nope'); // throws SyntaxError
 * json.try.parse('nope'); // {}
 * json.try.parse('{"a":"b"}'); // { a: 'b' }
 * ```
 */
export function tryWrap<T extends object, M extends TryMembers<T>>(
  target: T,
  members: M,
  options: TryCatchOptions = {},
): Tryable<T, Extract<keyof M, keyof T>> {
  type K = Extract<keyof M, keyof T>;

  rejectWrapper(target);
  rejectReservedNames(target);

  const manager = new TryManager<T, K>(options);

  manager.registerTryCatchDescriptors(
    Reflect.ownKeys(members).map((property) => {
      const prototype = descriptorSource(target, property);

      rejectShadowed(manager, property);
      rejectCaught(prototype, property);

      return {
        property: property as K,
        prototype,
        // `alwaysCatch` is load-bearing rather than a default repeated for
        // clarity. It is what leaves the registration with nothing to install,
        // and the object it would otherwise install on is `prototype` above —
        // which for an inherited member is a shared one, `Map.prototype` for a
        // wrapped `Map`. It is hard-set after the spread so a member's own
        // options cannot reach it, and the public option types do not carry it.
        options: { ...members[property as keyof M], alwaysCatch: false },
      };
    }),
  );

  return TryHandler.wrap<T, K>(target, manager, 'raw');
}

/**
 * Wrapping a wrapper is refused.
 *
 * The outer wrapper's catchers would run the member against the inner proxy,
 * which is the incompatible-receiver failure this entry point resolves the
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
 * This says nothing about a target that merely inherits a builtin's methods
 * without its internal slots — `Object.create(new Map())` — which fails the
 * same way and cannot be told apart from an ordinary subclass here.
 *
 * @throws if the target, or anything it inherits from, is a wrapper
 */
const rejectWrapper = (target: object): void => {
  if (upChain(target, isWrapper)) {
    throw new Error(
      `[TryError]: tryWrap cannot wrap an object that is already wrapped, or one that inherits from a wrapper. The outer catchers would run against the inner wrapper rather than the target, which a builtin rejects as an incompatible receiver — wrap the original target once, with every member it needs`,
    );
  }
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
const rejectShadowed = (
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
const rejectCaught = (prototype: object, property: PropertyKey): void => {
  if (isCaught(prototype, property)) {
    throw new Error(
      `[TryError]: tryWrap cannot wrap a member @CatchError already catches. Property '${String(property)}' catches on its own, so it never throws and the options given here would never be reached`,
    );
  }
};

/**
 * A target declaring `try` or `getTryManager` is refused.
 *
 * Both names are claimed by rules that run before anything is forwarded to the
 * target, so a member of either name is left unreachable with nothing said. The
 * author of a decorated class chose its member names and can change one;
 * whoever was handed an SDK client did not and cannot.
 *
 * Inherited counts, which is why this is an `in` check rather than an own-property
 * one: a member inherited from a base class is shadowed just as completely as
 * one declared on the object.
 *
 * @throws if the target has either name
 */
const rejectReservedNames = (target: object): void => {
  const claimed = [Handle.Try, Handle.TryManager].find((name) => name in target);

  if (claimed) {
    throw new Error(
      `[TryError]: tryWrap resolves 'try' and 'getTryManager' before the target sees them. Property '${claimed}' is declared on the target and would be unreachable through the wrapper — reach it on the target itself, or wrap an object that does not declare it`,
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
 * The target and everything it inherits from, in order, up to the first that
 * answers.
 *
 * Both questions this file asks of a foreign object are about the whole chain
 * rather than the object itself — what declares a member, and whether a wrapper
 * stands anywhere in it — so the walk is written once and the predicate says
 * which question is being asked.
 *
 * @param target - the object to start from
 * @param found - what makes an object the answer
 * @returns the first object that answers, or nothing
 */
const upChain = (
  target: object,
  found: (owner: object) => boolean,
): object | undefined => {
  for (
    let owner: object | null = target;
    owner;
    owner = Object.getPrototypeOf(owner)
  ) {
    if (found(owner)) {
      return owner;
    }
  }

  return undefined;
};
