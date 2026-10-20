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

  /** The wrappers {@link TryClassWrapper.record} filed, which `tryClass` built. */
  private static recorded = new WeakSet<Function>();

  /**
   * The class each decorated construction in progress is building an instance
   * for, innermost last.
   *
   * Constructions nest — a constructor may build other objects before `super()`
   * — so it is a stack, and only the innermost is the one a `tryClass` trap
   * below it is running for.
   */
  private static constructing: Function[] = [];

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
    TryClassWrapper.constructing.push(newTarget);

    try {
      return TryHandler.wrap<T, K>(
        Reflect.construct(target, args, newTarget),
        this.manager,
      );
    } finally {
      TryClassWrapper.constructing.pop();
    }
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
   * What `tryClass` handed back is refused too, in its own terms: it was never
   * decorated, so a message saying it was decorated twice would send its
   * reader looking for a decorator that is not there.
   *
   * @throws if the class is already wrapped
   */
  static wrap<T extends Function, K extends keyof T>(
    klass: T,
    options: TryCatchOptions,
  ): T {
    if (this.recorded.has(klass)) {
      throw new Error(
        `[TryError]: @TryCatch cannot decorate a class tryClass handed back. '${klass.name}' already equips its instances — decorate a subclass of it instead`,
      );
    }

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

  /**
   * Files a wrapper built some other way than by `@TryCatch`, so the two can
   * find each other.
   *
   * {@link tryClass} builds its own proxy over a class nothing decorated. Filed
   * here, a decorated subclass of it adopts the members it mapped, as it would
   * from a decorated base, and wrapping it again is refused like a second
   * `@TryCatch`.
   *
   * Only the proxy is filed, never the class behind it. Nothing was written to
   * that class, so two wraps of it stay independent and neither refuses the
   * other.
   *
   * @param wrapper - the proxy just built
   * @param manager - the manager its instances carry
   */
  static record(wrapper: Function, manager: TryManager<any, any>): void {
    this.wrapped.add(wrapper);
    this.recorded.add(wrapper);
    this.managerMap.set(wrapper, manager);
  }

  /**
   * Whether a class is wrapped — decorated with `@TryCatch`, or built by
   * {@link tryClass} — or is the proxy one of those handed out.
   *
   * `tryClass` asks it of everything in a class's chain, since wrapping a class
   * that is already wrapped would equip each instance twice, with one `.try`
   * hidden behind the other.
   *
   * @param klass - the class to check
   */
  static isWrapped(klass: Function): boolean {
    return this.wrapped.has(klass);
  }

  /**
   * Files a {@link tryWrap} of a wrapped class as wrapped too, under the same
   * manager.
   *
   * A wrapper passes `Object.getPrototypeOf` straight to the class behind it,
   * so a walk up a chain that runs through one steps from the wrapper to what
   * that class extends and never meets the class itself. A decorated subclass
   * would find no manager to adopt, and `tryClass` would take a subclass of it
   * for one nothing wraps. Filed here, the wrapper answers both as the class it
   * stands in front of — and `@TryCatch` on the wrapper itself is refused as it
   * would be on that class.
   *
   * A class nothing wraps is left alone; its wrapper hides nothing, since the
   * walk carries on to what that class extends.
   *
   * @param standIn - the wrapper `tryWrap` built
   * @param klass - the class it stands in front of
   */
  static recordStandIn(standIn: Function, klass: Function): void {
    const manager = this.managerMap.get(klass);

    if (!manager) {
      return;
    }

    if (this.recorded.has(klass)) {
      this.recorded.add(standIn);
    }

    this.wrapped.add(standIn);
    this.managerMap.set(standIn, manager);
  }

  /**
   * Whether a decorated class is building an instance for this class right
   * now, and so will equip what it builds itself.
   *
   * Asked by the `tryClass` trap a decorated subclass constructs through. It is
   * the trap's own question — will anything above me equip this instance? —
   * answered by what is actually running rather than by reading the chain, which
   * cannot tell a decorated class the construction runs through from one it
   * merely names as `newTarget`.
   *
   * @param newTarget - the class the trap is constructing for
   */
  static isConstructing(newTarget: Function): boolean {
    return this.constructing[this.constructing.length - 1] === newTarget;
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
