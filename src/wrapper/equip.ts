import type { TryProperties, Tryable } from '../interfaces';
import { TryHandler, isWrapper } from '../handler';
import { rejectReservedNames } from '../foreign';
import type { TryManager } from '../manager';

/**
 * Internal. The manager each instance was equipped with, so an instance a
 * constructor hands out again is recognized rather than equipped twice.
 *
 * A constructor may return an object it built earlier — a cached client, a
 * singleton — and its names are already defined and cannot be redefined.
 * Weak, so an instance leaves nothing behind once it is unreachable.
 */
const equippedWith = new WeakMap<object, TryManager<any, any>>();

/**
 * Internal. The proxy each instance was handed out behind, per manager, for
 * an instance that could not be equipped directly.
 *
 * Kept so that a constructor handing back the same object hands back the same
 * thing through the wrap: building a fresh proxy each time would make
 * `new Client() === new Client()` false for a singleton that is frozen, or
 * that another wrap equipped first.
 */
const fronts = new WeakMap<object, WeakMap<TryManager<any, any>, object>>();

/**
 * Internal. Gives a freshly constructed instance its `.try` map and
 * `getTryManager()`, defined on the instance itself rather than answered by a
 * proxy in front of it.
 *
 * A proxy is what the decorator and {@link tryWrap} hand out, and for a class
 * somebody else wrote it is the wrong default. Its methods are called with the
 * proxy as `this` on every ordinary call, and a `#private` field or a builtin's
 * internal slot rejects that — so a direct call that worked on the original
 * class would start throwing once the class was wrapped. Defined here, the two
 * names sit on the real instance and every other access never meets the
 * library at all.
 *
 * Both are hidden from inspection and fixed in place: not enumerable, so
 * `Object.keys`, spread and `JSON.stringify` see the instance the original
 * class built, and not configurable, so nothing replaces them out from under
 * the map. Neither has a setter, so a write to either throws in strict code.
 *
 * Both are getters, `getTryManager` included, though it never changes. A proxy
 * in front of a non-configurable value has to report that exact value, so a
 * wrapper standing in front of this instance — another wrap's raw proxy, a
 * decorator's — could not answer the name for itself and would throw on
 * every read.
 *
 * The map runs its catchers against this instance, closed over here, rather
 * than against whatever the property was read through. That is the receiver a
 * foreign method wants, and it is the one a raw-mode wrapper would pick too.
 * It is built on first read and kept, so `.try` costs nothing until used.
 *
 * A constructor that froze or sealed what it built leaves nothing to define
 * on — as does one handing back a proxy that declines the definition — and
 * the instance goes behind the raw-mode proxy `tryWrap` uses instead.
 * So does an instance another wrap already equipped, since its names are
 * taken; the one this wrap equipped comes back as it is. An instance once
 * handed out behind the proxy is handed out behind it from then on, and is
 * not checked again: a definition that took only the first name leaves that
 * name declared, and a second look would refuse it as the class's own.
 *
 * Ordinary access through that proxy still reaches the real instance, but a
 * direct call is made with the proxy as `this` — so a `#private` method on
 * such an instance throws, as it does through `tryWrap`. See
 * {@link https://github.com/jfrazx/try/issues/57 | issue #57}.
 *
 * @param instance - the object the constructor handed back
 * @param manager - the manager whose catchers the map exposes
 * @returns the same instance, now carrying both names, or a proxy in front of
 * one that cannot take them
 * @throws if the instance is a wrapper, or declares either name itself, which
 * defining them would overwrite
 */
export const equip = <T extends object, K extends keyof T>(
  instance: T,
  manager: TryManager<T, K>,
): Tryable<T, K> => {
  const installed = equippedWith.get(instance);

  if (installed === manager) {
    return instance as Tryable<T, K>;
  }

  if (installed || fronts.has(instance)) {
    return front(instance, manager);
  }

  rejectWrapped(instance);
  rejectReservedNames('tryClass', instance);

  if (!define(instance, manager)) {
    return front(instance, manager);
  }

  equippedWith.set(instance, manager);

  return instance as Tryable<T, K>;
};

/**
 * Defines both names on the instance, reporting whether it took them.
 *
 * `Reflect.defineProperty` reports a refusal rather than throwing one, so an
 * instance that cannot take them goes behind the proxy instead of failing to
 * construct: one its constructor froze, sealed or made non-extensible, and a
 * proxy the constructor handed back whose `defineProperty` trap declines.
 */
const define = <T extends object, K extends keyof T>(
  instance: T,
  manager: TryManager<T, K>,
): boolean => {
  let tryMap: TryProperties<T, K> | undefined;

  const getTryManager = () => manager;

  return (
    Reflect.defineProperty(instance, 'try', {
      get: () => (tryMap ??= manager.getTryMap(instance)),
    }) &&
    Reflect.defineProperty(instance, 'getTryManager', { get: () => getTryManager })
  );
};

/**
 * The raw-mode proxy an instance is handed out behind for this manager, built
 * the first time and the same one every time after.
 */
const front = <T extends object, K extends keyof T>(
  instance: T,
  manager: TryManager<T, K>,
): Tryable<T, K> => {
  const byManager = fronts.get(instance) ?? new WeakMap();
  const proxy = byManager.get(manager) ?? TryHandler.wrap(instance, manager, 'raw');

  fronts.set(instance, byManager.set(manager, proxy));

  return proxy as Tryable<T, K>;
};

/**
 * An instance that is already a wrapper is refused.
 *
 * A constructor can return anything, a `tryWrap` result or a decorated
 * instance included, and that wrapper answers `try` for itself. Defining the
 * names behind it would leave them unreachable and the options given to
 * `tryClass` never reached — with nothing said, for a decorated instance — or
 * fail on the wrapper's own write refusal, which names neither entry point.
 *
 * @throws if the instance is a wrapper
 */
const rejectWrapped = (instance: object): void => {
  if (isWrapper(instance)) {
    throw new Error(
      `[TryError]: tryClass cannot equip an object that is already wrapped. The constructor handed one back, and its wrapper answers 'try' in place of this one — return the original object rather than a wrapper of it`,
    );
  }
};
