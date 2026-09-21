import type { TryProperties } from '../../../interfaces';
import { TryHandlerRuleRunner } from './rules';
import { TryMap } from '../map';

/**
 * Proxy in front of {@link TryMap} so `.try.foo` resolves through the rule
 * chain rather than plain property access.
 *
 * One handler exists per instance and carries that instance as the receiver,
 * while the map it fronts is shared by the whole class — so every `.try` call
 * reaches the shared catchers but runs against the object it was called on.
 */
export class TryMapHandler<
  T extends object,
  K extends keyof T,
> implements ProxyHandler<TryMap<T, K>> {
  constructor(private readonly receiver: T) {}

  get(target: TryMap<T, K>, property: string) {
    return TryHandlerRuleRunner.fetchRule(target, property, this.receiver).handle();
  }

  static wrap<T extends object, K extends keyof T>(map: TryMap<T, K>, receiver: T) {
    return new Proxy(map, new TryMapHandler<T, K>(receiver)) as TryMap<T, K> &
      TryProperties<T, K>;
  }
}
