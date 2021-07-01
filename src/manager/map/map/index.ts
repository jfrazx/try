import { CatchError, ErrorThrower, CatchPrepare } from '../../../catcher';
import { wrapDefaults } from '@status/defaults';

export class TryMap<T extends object, K extends keyof T> {
  private readonly propertyMap = wrapDefaults<
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
    return this.getTryPropertyMap().has(property);
  }

  hasNotBeenRegisteredInTryMap(property: K): boolean {
    return !this.hasPropertyInTryMap(property);
  }

  getTryPropertyMap(): Map<K, CatchPrepare<T, K>> {
    return this.propertyMap;
  }

  getTryCatcher(property: K): CatchPrepare<T, K> {
    return this.getTryPropertyMap().get(property)!;
  }
}
