import { CatchError, ErrorThrower } from '../../../catcher';
import { wrapDefaults } from '@status/defaults';

export class TryMap<T extends object, K extends keyof T> {
  private readonly propertyMap = wrapDefaults({
    defaultValue: () => new ErrorThrower<T, never>(),
    wrap: new Map<K, CatchError<T, K>>(),
    execute: true,
  });

  addToTryMap(property: K, catcher: CatchError<T, K>): void {
    this.propertyMap.set(property, catcher);
    catcher.modifyDescriptor();
  }

  hasInTryMap(property: K): boolean {
    return this.getTryPropertyMap().has(property);
  }

  hasNotBeenRegisteredInTryMap(property: K): boolean {
    return !this.hasInTryMap(property);
  }

  getTryPropertyMap(): Map<K, CatchError<T, K>> {
    return this.propertyMap;
  }

  getTryCatcher(property: K): CatchError<T, K> {
    return this.getTryPropertyMap().get(property)!;
  }
}
