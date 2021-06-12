import { CatchError, ErrorThrower } from '../../../../catcher';

export class TryMap<T extends object, K extends keyof T> {
  private readonly propertyMap = new Map<K, CatchError<T, K>>();

  add(property: K, catcher: CatchError<T, K>): void {
    this.propertyMap.set(property, catcher);
    catcher.modifyDescriptor();
  }

  has(property: K): boolean {
    return this.getPropertyMap().has(property);
  }

  isNotYetRegistered(property: K): boolean {
    return !this.has(property);
  }

  getPropertyMap(): Map<K, CatchError<T, K>> {
    return this.propertyMap;
  }

  getCatcher(property: K): CatchError<T, K> {
    return this.getPropertyMap().get(property) ?? new ErrorThrower();
  }
}
