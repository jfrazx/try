import type { Tryable, TryProperties } from '../../interfaces';
import type { TryManager } from '../../manager';
import { HandlerRuleRunner } from '../rules';

/** Proxy around each instance: intercepts `.try` and `getTryManager`, and passes everything else through. */
export class TryHandler<
  T extends object,
  K extends keyof T,
> implements ProxyHandler<T> {
  private readonly tryMaps = new WeakMap<object, TryProperties<T, K>>();

  constructor(private readonly manager: TryManager<T, K>) {}

  get(target: T, property: string, receiver: Tryable<T, K>): T[K] {
    return HandlerRuleRunner.fetchRule(this, target, property, receiver).handle();
  }

  getTryManager(): TryManager<T, K> {
    return this.manager;
  }

  /**
   * The `.try` map for one receiver, built once and memoized against it.
   *
   * Memoizing keeps `.try` from allocating a proxy per access, but it has to be
   * keyed: a handler usually serves one instance, yet the receiver is whatever
   * the property was read through, so an object inheriting from the instance
   * arrives here too. A single slot would hand that object's map back to the
   * instance itself, which is the stale receiver this whole seam exists to
   * avoid. The handler cannot capture the receiver at construction because the
   * proxy it belongs to does not exist yet.
   */
  getTryMap(receiver: T): TryProperties<T, K> {
    const cached = this.tryMaps.get(receiver);

    if (cached) {
      return cached;
    }

    const tryMap = this.manager.getTryMap(receiver);

    this.tryMaps.set(receiver, tryMap);

    return tryMap;
  }

  static wrap<T extends object, K extends keyof T>(
    instance: T,
    manager: TryManager<T, K>,
  ): Tryable<T, K> {
    return new Proxy(instance, new TryHandler(manager)) as Tryable<T, K>;
  }
}
