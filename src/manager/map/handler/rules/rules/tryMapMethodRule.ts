import { ShouldHandleTryMapRule } from '../base';
import { TryMap } from '../../../map';

export class TryMapMethodRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return this.property in this.target;
  }

  handle(): T[K] {
    return Reflect.get(this.target, this.property);
  }
}
