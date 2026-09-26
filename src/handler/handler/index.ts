import type { Tryable, TryProperties, TryReceiver } from '../../interfaces';
import type { TryManager } from '../../manager';
import { HandlerRuleRunner } from '../rules';
import { handledNames } from '../rules/interfaces';
import { markWrapper } from '../wrapped';
import { upChain } from '../../helpers';

/**
 * Proxy around each instance: intercepts `.try` and `getTryManager`, and passes
 * everything else through.
 *
 * Which object the catchers behind `.try` run against is settled by the
 * {@link TryReceiver} the wrapper was built with. This handler is the `proxy`
 * one a decorated class gets, and hands the receiver on as it arrived; the
 * `raw` one {@link tryWrap} gets extends it.
 */
export class TryHandler<
  T extends object,
  K extends keyof T,
> implements ProxyHandler<T> {
  private readonly tryMaps = new WeakMap<object, TryProperties<T, K>>();

  /**
   * The proxy this handler stands behind, known once {@link TryHandler.wrap}
   * has built it.
   */
  protected wrapper?: Tryable<T, K>;

  constructor(private readonly manager: TryManager<T, K>) {}

  get(target: T, property: string, receiver: Tryable<T, K>): T[K] {
    return HandlerRuleRunner.fetchRule(this, target, property, receiver).handle();
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
   * this whole seam exists to avoid.
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
   * The receiver an ordinary read is forwarded with, for anything the wrapper
   * does not answer itself: here, the receiver as it arrived, which is what a
   * proxy with no traps would forward.
   */
  forwarded(_target: T, receiver: T): T {
    return receiver;
  }

  /**
   * Which of the two the catchers behind `.try` run against: here, the
   * receiver, so `this` inside a decorated member stays proxy-transparent and
   * a derived object reading `.try` runs against itself.
   */
  protected against(_target: T, receiver: T): T {
    return receiver;
  }

  static wrap<T extends object, K extends keyof T>(
    instance: T,
    manager: TryManager<T, K>,
    receiverMode: TryReceiver = 'proxy',
  ): Tryable<T, K> {
    const handler =
      receiverMode === 'raw' ? new RawTryHandler(manager) : new TryHandler(manager);
    const wrapper = new Proxy(instance, handler) as Tryable<T, K>;

    handler.wrapper = wrapper;
    markWrapper(wrapper);

    return wrapper;
  }
}

/**
 * The handler {@link tryWrap} builds, for an object somebody else declared.
 *
 * The target, not the receiver, is what the catchers run against and what an
 * ordinary access is forwarded with, and the two names the wrapper answers
 * cannot be written behind it.
 *
 * The write traps live here rather than on every handler. A trap on writes puts
 * a JavaScript call in front of every assignment through the wrapper. That is
 * worth paying for a foreign object other code shares, and not for a decorated
 * instance, where `this.count++` inside a member runs through the wrapper too —
 * measured at about five times the cost of an untrapped write.
 */
class RawTryHandler<T extends object, K extends keyof T> extends TryHandler<T, K> {
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
   * The refusal covers a write that would land behind the wrapper: one made on
   * the wrapper itself, or through a proxy standing in front of it. An object
   * inheriting from the wrapper is let through, since the write lands on that
   * object and is read back from there before the wrapper is reached.
   *
   * Everything else is forwarded as an ordinary write, with the receiver
   * `forwarded` settles.
   *
   * @throws if the property is one the wrapper answers, and the write would
   * land behind it
   */
  set(
    target: T,
    property: string,
    value: unknown,
    receiver: Tryable<T, K>,
  ): boolean {
    if (handledNames.includes(property) && !this.inheritsFromWrapper(receiver)) {
      throw refusal(property);
    }

    return Reflect.set(target, property, value, this.forwarded(target, receiver));
  }

  /**
   * Definitions are refused for the same two names, and pass through otherwise.
   *
   * `Object.defineProperty(wrapper, 'try', …)` never reaches the `set` trap,
   * and a definition made on the wrapper always lands on the object behind it —
   * so without this, a name `set` refuses could still be planted by the other
   * route. An object inheriting from the wrapper defines on itself and never
   * arrives here.
   *
   * @throws if the property is one the wrapper answers
   */
  defineProperty(
    target: T,
    property: string | symbol,
    descriptor: PropertyDescriptor,
  ): boolean {
    if (handledNames.includes(property)) {
      throw refusal(String(property));
    }

    return Reflect.defineProperty(target, property, descriptor);
  }

  /**
   * The target, so a builtin's getter or setter sees the object it insists on
   * and `map.size` reads the `Map` — whether the access was made on the wrapper
   * or through a proxy standing in front of it.
   *
   * An object inheriting from the wrapper is the exception, and is left as
   * JavaScript would leave it: a write lands on that object rather than on the
   * target everyone else holding the reference shares, and an inherited getter
   * reads that object. This is where `.try` and an ordinary access part ways.
   * Both use the target for the wrapper itself; only `.try` does for an object
   * inheriting from it.
   */
  override forwarded(target: T, receiver: T): T {
    return this.inheritsFromWrapper(receiver) ? receiver : target;
  }

  /**
   * The target, whatever the access came through. A catcher run against an
   * object that merely inherits from the wrapper would hand a builtin an object
   * it rejects, and every call would come back as the fallback.
   */
  protected override against(target: T): T {
    return target;
  }

  /**
   * Whether the receiver inherits from this wrapper, rather than being the
   * wrapper or something standing in front of it.
   *
   * Asked of the chain rather than by identity. A proxy placed around the
   * wrapper arrives as the receiver as well, and an identity check takes it for
   * an heir; its chain runs through the target's, never through the wrapper.
   */
  private inheritsFromWrapper(receiver: object): boolean {
    return (
      receiver !== this.wrapper &&
      upChain(Object.getPrototypeOf(receiver), (owner) => owner === this.wrapper) !==
        undefined
    );
  }
}

/**
 * The refusal both write traps raise for a name the wrapper answers itself.
 *
 * @param property - the name being written
 */
const refusal = (property: string): Error =>
  new Error(
    `[TryError]: The wrapper answers 'try' and 'getTryManager' itself and cannot pass a write of either through. Property '${property}' would be set on the target where nothing could read it back — assign it on the target directly if that is what you mean`,
  );
