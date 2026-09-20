import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { TryHandler } from '../handler';
import { TryManager } from '../manager';

/** Internal. The constructor shape `@TryCatch` accepts and returns, so the wrapped class stays newable. */
export interface TryConstruct<T extends object> {
  new (...args: any[]): T;
}

/**
 * Proxy handler behind `@TryCatch`. Holds each class's manager and the
 * decorators that registered before it, wiring them together as the class is
 * defined and handing each new instance its `.try` map.
 *
 * Every map here is weak and keyed by the class, so decorating a class created
 * per request, per tenant, or per test leaves nothing behind once that class is
 * unreachable.
 */
export class TryClassWrapper<
  T extends Function,
  K extends keyof T,
> implements ProxyHandler<T> {
  private static managerMap = new WeakMap<Function, TryManager<any, any>>();
  private static decoratorMap = new WeakMap<
    Function,
    DecoratedEventMap<any, any>[]
  >();

  private static wrapped = new WeakSet<Function>();

  /**
   * Registers the decorated members as the class is defined, not as it is
   * constructed.
   *
   * Member decorators run before the class decorator, so by the time this runs
   * every member has already registered and nothing is left to wait for. Doing
   * it here is what makes a member that always catches catch from the moment
   * the class exists: before the first instance, through a reference captured
   * before it, and when the constructor itself calls the member.
   *
   * The queue is dropped once read. It has served its only purpose, and holding
   * it would keep every decorated descriptor alive for as long as the class is.
   */
  constructor(target: T, options: TryCatchOptions) {
    const manager = new TryManager<T, K>(options);

    manager.registerTryCatchDescriptors(
      TryClassWrapper.retrieveDecoratorMap(target),
    );

    TryClassWrapper.decoratorMap.delete(target);
    TryClassWrapper.managerMap.set(target, manager);
  }

  construct(target: T, args: any[], newTarget: Function): T {
    const manager: TryManager<T, K> = TryClassWrapper.managerMap.get(target)!;

    return TryHandler.wrap<T, K>(
      Reflect.construct(target, args, newTarget),
      manager,
    );
  }

  /**
   * Applying `@TryCatch` twice is rejected rather than silently obeyed.
   *
   * The second application receives the first one's proxy, which is a different
   * key from the class the member decorators registered under — so the outer
   * manager reads an empty queue, and its `.try` map, the one every instance
   * actually gets, would answer for no member at all.
   *
   * @throws if the class is already wrapped
   */
  static wrap<T extends Function, K extends keyof T>(
    klass: T,
    options: TryCatchOptions,
  ): T {
    if (this.wrapped.has(klass)) {
      throw new Error(
        `[TryError]: @TryCatch can only be applied once to a class. '${klass.name}' is decorated more than once`,
      );
    }

    const wrapper = new Proxy(klass, new TryClassWrapper<T, K>(klass, options));

    this.wrapped.add(wrapper);

    return wrapper;
  }

  static registerDecorator<T extends Function>(
    klass: T,
    options: DecoratedEventMap<T, any>,
  ): void {
    this.retrieveDecoratorMap(klass).push(options);
  }

  private static retrieveDecoratorMap<T extends Function>(
    klass: T,
  ): DecoratedEventMap<T, any>[] {
    const registered = this.decoratorMap.get(klass);

    if (registered) {
      return registered;
    }

    const queue: DecoratedEventMap<T, any>[] = [];

    this.decoratorMap.set(klass, queue);

    return queue;
  }
}
