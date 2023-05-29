import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { Default, wrapDefaults } from '@status/defaults';
import { TryHandler } from '../handler';
import { TryManager } from '../manager';

export interface TryConstruct<T extends object> {
  new (...args: any[]): T;
}

export class TryClassWrapper<T extends Function, K extends keyof T>
  implements ProxyHandler<T>
{
  private static managerMap = new Map<Function, TryManager<any, any>>();
  private static decoratorMap: Default<
    Map<Function, DecoratedEventMap<any, any>[]>
  > = wrapDefaults({
    execute: true,
    setUndefined: true,
    defaultValue: (): DecoratedEventMap<any, any>[] => [],
    wrap: new Map<Function, DecoratedEventMap<any, any>[]>(),
  });

  constructor(target: T, options: TryCatchOptions) {
    const manager = new TryManager<T, K>(options);

    TryClassWrapper.managerMap.set(target, manager);
  }

  construct(target: T, args: any[], newTarget: Function): T {
    const manager: TryManager<T, K> = TryClassWrapper.managerMap.get(target)!;
    const decoratorMap = TryClassWrapper.retrieveDecoratorMap(target);
    const wrappedInstance = TryHandler.wrap<T, K>(
      Reflect.construct(target, args, newTarget),
      manager,
    );

    return manager.registerTryCatchDescriptors(wrappedInstance, decoratorMap);
  }

  static wrap<T extends Function, K extends keyof T>(
    klass: T,
    options: TryCatchOptions,
  ): T {
    return new Proxy(klass, new TryClassWrapper<T, K>(klass, options));
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
    return this.decoratorMap.get(klass)!;
  }
}
