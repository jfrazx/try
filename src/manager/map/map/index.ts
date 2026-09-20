import type { CatchError, CatchPrepare } from '../../../catcher';
import { wrapDefaults, Default } from '@status/defaults';
import { ErrorThrower } from '../../../catcher';

/**
 * Internal. The `.try` map itself — registered member to catcher, defaulting to
 * a thrower for anything never registered, so a typo throws rather than
 * yielding `undefined`.
 *
 * Two quirks of that lookup are tracked in
 * {@link https://github.com/jfrazx/try/issues/34 | issue #34}: a decorated
 * member sharing a name with this class is shadowed by it, and string-named
 * protocol probes such as `toJSON` throw like a typo would.
 */
export class TryMap<T extends object, K extends keyof T> {
  private readonly propertyMap: Default<Map<K, CatchPrepare<T, K>>> = wrapDefaults<
    Map<K, CatchPrepare<T, K>>,
    CatchPrepare<T, K>
  >({
    defaultValue: () => new ErrorThrower<T, never>(),
    wrap: new Map<K, CatchPrepare<T, K>>(),
    execute: true,
  });

  addToTryMap(property: K, catcher: CatchError<T, K>): void {
    this.propertyMap.set(property, catcher);
  }

  /**
   * Adopts a base class's catchers, so a subclass's `.try` answers for what it
   * inherits rather than only for what it declares.
   *
   * Each class builds its own map from its own decorators, and a member the
   * base declared is still reachable on an instance of the subclass — so
   * without this, `sub.baseMember()` catches while `sub.try.baseMember()`
   * throws as though the member were a typo.
   *
   * The catcher is shared rather than rebuilt. The base already installed what
   * `@Catch` installs, and a second catcher built around that wrapper would
   * catch twice and resolve the base class's options through the subclass's.
   * Catchers hold no instance, so one serves both classes.
   *
   * A member the subclass declares itself is skipped, whether or not it carries
   * a decorator. Its own registration is already here, and an override that
   * carries no decorator is not catchable — inheriting the base's catcher for
   * it would leave `.try` running the implementation the subclass replaced.
   *
   * Runs after this class's own members are registered, so the duplicate
   * check never sees an inherited entry and rejects a legitimate override as a
   * member decorated twice.
   */
  inheritFrom(parent: TryMap<any, any>, prototype: object): void {
    parent.propertyMap.forEach((catcher, property) => {
      if (!Object.getOwnPropertyDescriptor(prototype, property)) {
        this.propertyMap.set(property, catcher);
      }
    });
  }

  hasPropertyInTryMap(property: K): boolean {
    return this.propertyMap.has(property);
  }

  getTryCatcher(property: K): CatchPrepare<T, K> {
    return this.propertyMap.get(property)!;
  }
}
