import { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { TryHandler } from '../handler';
import { TryManager } from '../manager';

export interface TryConstruct<T extends object> {
  new (...args: any[]): T;
}

export class TryClassWrapper<T extends Function, K extends keyof T>
  implements ProxyHandler<T>
{
  private static managerMap = new Map<Function, TryManager<any, any>>();
  private static decoratorMap = new Map<Function, DecoratedEventMap<any, any>[]>();

  constructor(target: T, options: TryCatchOptions) {
    const manager = new TryManager<T, K>(options);

    TryClassWrapper.managerMap.set(target, manager);
  }

  construct(target: T, args: any[], newTarget: Function) {
    const manager: TryManager<T, K> = TryClassWrapper.managerMap.get(target)!;
    const decoratorMap = TryClassWrapper.retrieveDecoratorMap(target);
    const wrappedInstance = TryHandler.wrap<T, K>(
      Reflect.construct(target, args, newTarget),
      manager,
    );

    manager.registerTryCatchDescriptors(wrappedInstance, decoratorMap);

    return wrappedInstance;
  }

  static wrap<T extends Function, K extends keyof T>(
    klass: T,
    options: TryCatchOptions,
  ) {
    return new Proxy(klass, new TryClassWrapper<T, K>(klass, options));
  }

  static registerDecorator<T extends Function>(
    klass: T,
    options: DecoratedEventMap<T, any>,
  ) {
    const decoratorMap = this.retrieveDecoratorMap(klass);

    decoratorMap.push(options);

    this.decoratorMap.set(klass, decoratorMap);
  }

  private static retrieveDecoratorMap<T extends Function>(
    klass: T,
  ): DecoratedEventMap<T, any>[] {
    return this.decoratorMap.get(klass) ?? [];
  }
}
