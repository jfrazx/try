import { ShouldHandleTryMapRule } from '../base';
import { TryMap } from '../../../map';

export class TryMapMethodRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  private readonly tryMapProperties = [
    'add',
    'has',
    'getCatcher',
    'propertyMap',
    'getPropertyMap',
    'isNotYetRegistered',
  ] as K[];

  shouldHandle(): boolean {
    return this.tryMapProperties.includes(this.property);
  }
  handle(): T[K] {
    return Reflect.get(this.target, this.property);
  }
}
