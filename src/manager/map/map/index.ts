import type { CatchError, CatchPrepare } from '../../../catcher';
import { wrapDefaults, Default } from '@status/defaults';
import { ErrorThrower } from '../../../catcher';

export class TryMap<T extends object, K extends keyof T> {
  private readonly propertyMap: Default<Map<K, CatchPrepare<T, K>>> = wrapDefaults<
    Map<K, CatchPrepare<T, K>>,
    CatchPrepare<T, K>
  >({
    defaultValue: () => new ErrorThrower<T, never>(),
    wrap: new Map<K, CatchPrepare<T, K>>(),
    execute: true,
  });

  addToTryMap(property: K, catcher: CatchError<T, K>): void {
    this.propertyMap.set(property, catcher);

    catcher.modifyDescriptor();
  }

  hasPropertyInTryMap(property: K): boolean {
    return this.propertyMap.has(property);
  }

  hasNotBeenRegisteredInTryMap(property: K): boolean {
    return !this.hasPropertyInTryMap(property);
  }

  getTryCatcher(property: K): CatchPrepare<T, K> {
    return this.propertyMap.get(property)!;
  }
}
