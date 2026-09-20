import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { TryHandler } from '../handler';
import { TryManager, type TryInheritance } from '../manager';

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

  private readonly manager: TryManager<T, K>;

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
   * A decorated ancestor is picked up afterwards, so its members answer on this
   * class's `.try` too.
   *
   * The queue is dropped once read. It has served its only purpose, and holding
   * it would keep every registration alive for as long as the class is.
   */
  constructor(target: T, options: TryCatchOptions) {
    this.manager = new TryManager<T, K>(options);

    this.manager.registerTryCatchDescriptors(
      TryClassWrapper.retrieveDecoratorMap(target),
    );

    this.manager.inherit(TryClassWrapper.inheritedFrom(target), target.prototype);

    TryClassWrapper.decoratorMap.delete(target);
    TryClassWrapper.managerMap.set(target, this.manager);
  }

  construct(target: T, args: any[], newTarget: Function): T {
    return TryHandler.wrap<T, K>(
      Reflect.construct(target, args, newTarget),
      this.manager,
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
   * Both the class and the proxy are recorded, because the two ways of applying
   * it twice arrive by different doors. Stacked decorators hand the second
   * application the proxy; calling the factory's result on the class again —
   * `TryCatch()(Example)` twice — hands it the class. Recording only the proxy
   * lets the second call through to build a manager from a queue the first one
   * already emptied, and that empty manager replaces the first under the same
   * key: every instance already handed out loses its `.try` registrations.
   *
   * The manager is filed under the proxy as well as the class, because the
   * proxy is what a subclass extends and so what it finds when it looks for a
   * decorated base.
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

    const handler = new TryClassWrapper<T, K>(klass, options);
    const wrapper = new Proxy(klass, handler);

    this.wrapped.add(klass).add(wrapper);
    this.managerMap.set(wrapper, handler.manager);

    return wrapper;
  }

  static registerDecorator<T extends Function>(
    klass: T,
    options: DecoratedEventMap<T, any>,
  ): void {
    this.retrieveDecoratorMap(klass).push(options);
  }

  /**
   * The nearest decorated class above this one, and the prototype its members
   * are declared on.
   *
   * The class a class extends is its own prototype, and a decorated one has
   * left its manager under that key — under the proxy key, since the proxy is
   * what `extends` was given.
   *
   * The whole chain is walked rather than only the class immediately above.
   * An undecorated class standing between two decorated ones is ordinary
   * JavaScript, and its members are inherited like any other — stopping there
   * would leave the subclass's `.try` answering for nothing it inherited, while
   * the members themselves still worked when called directly.
   *
   * Only the nearest is needed. That class did this same walk as it was
   * defined, so its map already carries whatever it inherited from further up.
   */
  private static inheritedFrom<T extends Function>(
    klass: T,
  ): TryInheritance | undefined {
    for (
      let ancestor = Object.getPrototypeOf(klass);
      ancestor;
      ancestor = Object.getPrototypeOf(ancestor)
    ) {
      const manager = this.managerMap.get(ancestor);

      if (manager) {
        return { manager, prototype: ancestor.prototype };
      }
    }

    return undefined;
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
