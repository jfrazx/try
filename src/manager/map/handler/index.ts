import { TryProperties } from '../../../interfaces';
import { TryHandlerRuleRunner } from './rules';
import { TryMap } from '../map';

export class TryMapHandler<T extends object, K extends keyof T>
  implements ProxyHandler<TryMap<T, K>>
{
  get(target: TryMap<T, K>, property: string) {
    return TryHandlerRuleRunner.fetchRule(target, property).handle();
  }

  static wrap<T extends object, K extends keyof T>() {
    return new Proxy(new TryMap<T, K>(), new TryMapHandler<T, K>()) as TryMap<T, K> &
      TryProperties<T, K>;
  }
}
