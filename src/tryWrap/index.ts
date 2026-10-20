import type { TryCatchOptions, TryMembers, Tryable } from '../interfaces';
import { TryClassWrapper } from '../wrapper';
import { TryHandler } from '../handler';
import { TryManager } from '../manager';
import { isFunction } from '../helpers';
import {
  registerMembers,
  rejectReservedNames,
  rejectWrapper,
  type StrictMembers,
} from '../foreign';

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
 * A key the map cannot take — one outside `keyof T`, or one of the names
 * {@link TryMembers} leaves out — is a compile error, a typo beside a real
 * member included.
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
  members: M & StrictMembers<T, M>,
  options: TryCatchOptions = {},
): Tryable<T, Extract<keyof M, keyof T>> {
  type K = Extract<keyof M, keyof T>;

  rejectWrapper(target);
  rejectReservedNames('tryWrap', target);

  const manager = new TryManager<T, K>(options);

  registerMembers('tryWrap', manager, target, members);

  const wrapper = TryHandler.wrap<T, K>(target, manager, 'raw');

  if (isFunction(target)) {
    TryClassWrapper.recordStandIn(wrapper as unknown as Function, target);
  }

  return wrapper;
}
