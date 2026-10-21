import type { TryCatchOptions, TryClass, TryMembers } from '../interfaces';
import { ForeignClassWrapper } from '../wrapper/foreignClass';
import { registerMembers, type StrictMembers } from '../foreign';
import { TryClassWrapper } from '../wrapper';
import { TryManager } from '../manager';
import { upChain } from '../helpers';

/**
 * Makes members of a class you did not write catchable on every instance it
 * builds, without a decorator.
 *
 * {@link tryWrap} covers an object you were handed. A class you import and
 * construct yourself would need wrapping at every construction site; this wraps
 * it once, and each instance of what comes back carries its own `.try`.
 *
 * `.try`-map semantics throughout, matching {@link Try} and `tryWrap`: a mapped
 * member keeps throwing on a direct call, and the call through `.try` is what
 * catches.
 *
 * The class is never written to — not it, not its prototype. Every member is
 * registered as catching only through `.try`, and `.try` and `getTryManager()`
 * are defined on each instance as it is built, hidden from inspection. An
 * ordinary call meets no proxy, so a method reading a `#private` field works as
 * it did on the original class.
 *
 * What comes back is a new class standing in front of the original:
 * `instanceof` holds against the original, but identity does not, and a
 * subclass must extend whichever one is meant.
 *
 * The map addresses the prototype. Statics are members of the class object
 * itself, and `tryWrap` on the class covers those.
 *
 * A key the map cannot take is a compile error, a typo beside a real member
 * included, exactly as for `tryWrap`.
 *
 * @template C - the class being wrapped
 * @template M - the member map, which is what types `.try`
 * @param klass - the class whose instances should carry `.try`
 * @param members - the members to make catchable, each with its own options
 * @param options - defaults applied to every member in the map
 * @returns a class building instances that carry a `.try` map over the mapped
 * members
 * @throws if the target has no prototype, if it or anything it extends is
 * already wrapped, if its prototype carries a `try` or `getTryManager` member,
 * if a mapped member shares a name with the `.try` map's own or is already
 * caught by `@CatchError`, or if a mapped member is neither a method nor a
 * getter. Constructing refuses an instance its constructor gave either name,
 * or handed back already wrapped, and a subclass the map cannot be resolved
 * against.
 *
 * @example
 * ```ts
 * import { tryClass } from '@status/try';
 *
 * const Client = tryClass(ThirdPartyClient, { connect: {} });
 *
 * const client = new Client(url);
 *
 * client.connect(); // throws
 * client.try.connect(); // null
 * ```
 */
export function tryClass<
  C extends abstract new (...args: any[]) => object,
  M extends TryMembers<InstanceType<C>>,
>(
  klass: C,
  members: M & StrictMembers<InstanceType<C>, M>,
  options: TryCatchOptions = {},
): TryClass<C, Extract<keyof M, keyof InstanceType<C>>> {
  type K = Extract<keyof M, keyof InstanceType<C>>;

  rejectWrappedClass(klass);

  return ForeignClassWrapper.wrap(klass, (prototype) => {
    const manager = new TryManager<any, any>(options);

    registerMembers('tryClass', manager, prototype, members);

    return manager;
  }) as TryClass<C, K>;
}

/**
 * A class already wrapped, or extending one that is, is refused.
 *
 * Its instances would be equipped twice — once by the wrap already in place,
 * once by this one — and the two would contend for the same names on the same
 * object: a decorated class hands each instance out behind a proxy answering
 * `try` for itself, and a second wrap defining `try` on the instance behind it
 * leaves one of the two maps unreachable. Wrap the original class once, with
 * every member it needs.
 *
 * The walk covers what the class extends, since a class's `extends` chain is
 * its own prototype chain and every class in it constructs the same instance.
 *
 * @throws if the class, or anything it extends, is wrapped
 */
const rejectWrappedClass = (klass: Function): void => {
  if (upChain(klass, (owner) => TryClassWrapper.isWrapped(owner as Function))) {
    throw new Error(
      `[TryError]: tryClass cannot wrap a class that is already wrapped, decorated with @TryCatch, or extends one that is — its instances would be wrapped twice`,
    );
  }
};
