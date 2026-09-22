import type { Tryable, TryProperties, TryReceiver } from '../../interfaces';
import type { TryManager } from '../../manager';
import { HandlerRuleRunner } from '../rules';
import { Handle } from '../rules/interfaces';
import { markWrapper } from '../wrapped';

/**
 * Proxy around each instance: intercepts `.try` and `getTryManager`, and passes
 * everything else through.
 *
 * Which object the catchers behind `.try` run against is settled here, by the
 * {@link TryReceiver} the wrapper was built with — the proxy for a decorated
 * class, the raw target for an object handed to `tryWrap`.
 */
export class TryHandler<
  T extends object,
  K extends keyof T,
> implements ProxyHandler<T> {
  private readonly tryMaps = new WeakMap<object, TryProperties<T, K>>();

  constructor(
    private readonly manager: TryManager<T, K>,
    private readonly receiverMode: TryReceiver,
  ) {}

  get(target: T, property: string, receiver: Tryable<T, K>): T[K] {
    return HandlerRuleRunner.fetchRule(this, target, property, receiver).handle();
  }

  /**
   * Writes pass through to the object behind the wrapper, save for the two
   * names the wrapper answers itself.
   *
   * A proxy carrying only a `get` trap still forwards writes, so
   * `wrapper.try = x` defined a real `try` property on the object being stood
   * in front of — unreadable through the wrapper, which resolves that name
   * before the target is reached, visible to everything else holding the same
   * reference, and enough to make a later {@link tryWrap} of it refuse a name
   * this library planted. Reads of those names are intercepted, so writes of
   * them have to be too, or the two directions disagree.
   *
   * Which object an ordinary write lands on is the same question `.try` asks,
   * and is answered the same way. Under `proxy` that is the receiver, which is
   * what a proxy with no `set` trap does anyway; under `raw` it is the target,
   * so a setter on a builtin sees the object it insists on.
   *
   * @throws if the property is one the wrapper answers
   */
  set(
    target: T,
    property: string,
    value: unknown,
    receiver: Tryable<T, K>,
  ): boolean {
    if (property === Handle.Try || property === Handle.TryManager) {
      throw new Error(
        `[TryError]: The wrapper answers 'try' and 'getTryManager' itself and cannot pass a write of either through. Property '${property}' would be set on the target where nothing could read it back — assign it on the target directly if that is what you mean`,
      );
    }

    return Reflect.set(target, property, value, this.against(target, receiver));
  }

  getTryManager(): TryManager<T, K> {
    return this.manager;
  }

  /**
   * The `.try` map for one object, built once and memoized against it.
   *
   * Both candidates are handed over rather than one resolved by the rule,
   * because which of them the catchers should run against is a property of the
   * wrapper and not of the access: a decorated class wants the receiver, and a
   * wrapped object wants the target it stands in front of.
   *
   * Memoizing keeps `.try` from allocating a proxy per access, but it has to be
   * keyed on whichever of the two won. A handler usually serves one instance,
   * yet the receiver is whatever the property was read through, so an object
   * inheriting from the instance arrives here too. A single slot would hand
   * that object's map back to the instance itself, which is the stale receiver
   * this whole seam exists to avoid. The handler cannot capture the receiver at
   * construction because the proxy it belongs to does not exist yet.
   */
  getTryMap(target: T, receiver: T): TryProperties<T, K> {
    const against = this.against(target, receiver);
    const cached = this.tryMaps.get(against);

    if (cached) {
      return cached;
    }

    const tryMap = this.manager.getTryMap(against);

    this.tryMaps.set(against, tryMap);

    return tryMap;
  }

  /**
   * Which of the two the wrapper acts against, by the {@link TryReceiver} it
   * was built with. Every trap that has to choose asks here, so `.try` and a
   * write cannot answer differently.
   */
  private against(target: T, receiver: T): T {
    return this.receiverMode === 'raw' ? target : receiver;
  }

  static wrap<T extends object, K extends keyof T>(
    instance: T,
    manager: TryManager<T, K>,
    receiverMode: TryReceiver = 'proxy',
  ): Tryable<T, K> {
    const wrapper = new Proxy(
      instance,
      new TryHandler(manager, receiverMode),
    ) as Tryable<T, K>;

    markWrapper(wrapper);

    return wrapper;
  }
}
