import { rejectReservedNames, rejectWithoutPrototype } from '../foreign';
import type { TryManager } from '../manager';
import { TryClassWrapper } from './index';
import { equip } from './equip';

/**
 * Internal. Proxy handler behind {@link tryClass}: the class form of a wrapper,
 * for a class nothing decorated.
 *
 * It stands where {@link TryClassWrapper} stands for `@TryCatch` — a proxy over
 * the class whose `construct` trap equips each instance — but owes nothing to
 * a decorator queue. Its members come from a map resolved against the
 * prototype of the class being constructed, and each instance carries its
 * `.try` itself rather than being handed out behind a proxy.
 */
export class ForeignClassWrapper<T extends Function> implements ProxyHandler<T> {
  /**
   * The manager for each prototype an instance is built on through this proxy:
   * the class's own, filed as the proxy is built, and each subclass's, filed
   * the first time one is constructed.
   *
   * Keyed by the prototype rather than the class, since the prototype is all a
   * manager is resolved against. A class standing in front of another — a
   * `tryWrap` of the result, arriving as `newTarget` — reads the same
   * `prototype` and so finds the same manager, without anything rewriting the
   * `new.target` its constructor sees.
   *
   * Weak, so a subclass created per request, per tenant or per test leaves
   * nothing behind once it is unreachable.
   */
  private readonly managers = new WeakMap<object, TryManager<any, any>>();

  private constructor(
    private readonly buildManager: (prototype: object) => TryManager<any, any>,
  ) {}

  /**
   * Builds the instance and equips it with the manager for the class actually
   * being constructed.
   *
   * The manager is settled before the constructor runs, so a subclass the map
   * cannot be resolved against is refused without constructing anything.
   *
   * An instance a decorated class will equip is built and left bare.
   */
  construct(target: T, args: any[], newTarget: Function): object {
    const manager = this.managerFor(newTarget);
    const instance = Reflect.construct(target, args, newTarget);

    return manager ? equip(instance, manager) : instance;
  }

  /**
   * The manager for the class being constructed, resolved against its own
   * prototype the first time it is constructed — or nothing, when a class
   * decorated with `@TryCatch` is building the instance through this proxy.
   *
   * A subclass has to be resolved for itself. A catcher keeps the member it
   * was built around, so a subclass sharing the base's manager would have
   * `.try.connect()` run the base's `connect` while a direct call ran its own
   * override — the two paths disagreeing about which code a call runs. Resolved
   * against the subclass's prototype, each mapped member is found where that
   * class declares it, which is where a direct call finds it too.
   *
   * `new Wrapped()` passes the proxy as `newTarget`, not the class behind it;
   * both read the same `prototype`, which is why the class's own manager is
   * filed as the proxy is built.
   *
   * A decorated class constructing through this proxy equips the instance
   * itself: its trap resumes once this one returns and hands the instance out
   * behind the decorator's proxy, whose `.try` already answers for what was
   * mapped here, since the decorator adopts it as it would a decorated base's.
   * Equipping it here as well would resolve the map a second time for nothing
   * and leave a `.try` nobody can reach on the instance behind that proxy.
   *
   * Whether one is constructing is asked of what is running, not read off the
   * chain. The decorator may stand anywhere between `newTarget` and this proxy
   * — an undecorated class extending it constructs through its trap all the
   * same — and a class merely named as `newTarget` through `Reflect.construct`
   * runs no trap but this one, which then has to equip the instance itself.
   *
   * @throws if the subclass has no prototype, declares `try` or
   * `getTryManager`, or the map cannot be resolved against its prototype
   */
  private managerFor(newTarget: Function): TryManager<any, any> | undefined {
    if (TryClassWrapper.isConstructing(newTarget)) {
      return undefined;
    }

    return this.managers.get(newTarget.prototype) ?? this.file(newTarget);
  }

  /**
   * Resolves the member map against a class's prototype and files the result
   * under that prototype.
   *
   * The class is checked for the names `.try` needs as it is resolved. The
   * proxy's check is the wrap's own; a subclass was declared after the wrap,
   * so nothing else has seen it.
   *
   * @throws if the class has no prototype, declares `try` or `getTryManager`,
   * or the map cannot be resolved against its prototype
   */
  private file(klass: Function): TryManager<any, any> {
    rejectWithoutPrototype(klass);
    rejectReservedNames('tryClass', klass.prototype);

    const manager = this.buildManager(klass.prototype);

    this.managers.set(klass.prototype, manager);

    return manager;
  }

  /**
   * Builds the proxy, resolving the member map against the class's own
   * prototype before anything is constructed.
   *
   * Resolving here rather than at first construction is what makes a bad map —
   * a typo the types missed, a member that is a plain value — fail where
   * `tryClass` was called, not at some later `new` far from it.
   *
   * The proxy is recorded as a wrapped class, so `@TryCatch` on a subclass
   * finds the members mapped here, and a second wrap of anything extending it
   * is refused.
   *
   * @param klass - the class to stand in front of
   * @param buildManager - registers the member map against a prototype
   * @returns the proxy standing in for the class
   * @throws if the class has no prototype, declares `try` or `getTryManager`,
   * or the map cannot be resolved against its prototype
   */
  static wrap<T extends Function>(
    klass: T,
    buildManager: (prototype: object) => TryManager<any, any>,
  ): T {
    const handler = new ForeignClassWrapper<T>(buildManager);
    const wrapper = new Proxy(klass, handler);

    TryClassWrapper.record(wrapper, handler.file(wrapper));

    return wrapper;
  }
}
