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
   * Adopts a decorated ancestor's catchers, so a subclass's `.try` answers for
   * what it inherits rather than only for what it declares.
   *
   * Each class builds its own map from its own decorators, and a member the
   * ancestor declared is still reachable on an instance of the subclass — so
   * without this, `sub.baseMember()` catches while `sub.try.baseMember()`
   * throws as though the member were a typo.
   *
   * The catcher is shared rather than rebuilt. The ancestor already installed
   * what `@Catch` installs, and a second catcher built around that wrapper
   * would catch twice and resolve the ancestor's options through this class's.
   * Catchers hold no instance, so one serves both classes.
   *
   * Runs after this class's own members are registered, so the duplicate
   * check never sees an inherited entry and rejects a legitimate override as a
   * member decorated twice.
   */
  inheritFrom(
    parent: TryMap<any, any>,
    prototype: object,
    ancestorPrototype: object,
  ): void {
    parent.propertyMap.forEach((catcher, property) => {
      if (!TryMap.isRedeclared(prototype, ancestorPrototype, property)) {
        this.propertyMap.set(property, catcher);
      }
    });
  }

  /**
   * Whether anything between this class and the ancestor that declared the
   * member has declared it again.
   *
   * A member redeclared along the way is not the ancestor's any more, whether
   * or not the class redeclaring it carries a decorator. A decorated override
   * has registered its own catcher already, and an undecorated one is not
   * catchable at all — adopting the ancestor's catcher for either would leave
   * `.try` running an implementation that was replaced.
   *
   * The walk stops at the ancestor rather than reading only this class's own
   * members: an undecorated class standing in between can override too, and its
   * override is just as much not the ancestor's.
   *
   * The ancestor's own prototype is where the member is declared, so it is the
   * boundary and never itself an override.
   */
  private static isRedeclared(
    prototype: object,
    ancestorPrototype: object,
    property: PropertyKey,
  ): boolean {
    for (
      let current = prototype;
      current !== ancestorPrototype;
      current = Object.getPrototypeOf(current)
    ) {
      if (Object.getOwnPropertyDescriptor(current, property)) {
        return true;
      }
    }

    return false;
  }

  hasPropertyInTryMap(property: K): boolean {
    return this.propertyMap.has(property);
  }

  getTryCatcher(property: K): CatchPrepare<T, K> {
    return this.propertyMap.get(property)!;
  }
}
