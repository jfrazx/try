import { HandlerRuleRunner } from '../rules';
import { TryManager } from '../../manager';
import { Tryable } from '../../interfaces';

export class TryHandler<T extends object, K extends keyof T>
  implements ProxyHandler<T>
{
  constructor(private readonly manager: TryManager<T, K>) {}

  get(target: T, property: string, receiver: Tryable<T, K>): T[K] {
    return HandlerRuleRunner.fetchRule(this, target, property, receiver).handle();
  }

  getTryManager(): TryManager<T, K> {
    return this.manager;
  }

  static wrap<T extends object, K extends keyof T>(
    instance: T,
    manager: TryManager<T, K>,
  ): Tryable<T, K> {
    return new Proxy(instance, new TryHandler(manager)) as Tryable<T, K>;
  }
}
