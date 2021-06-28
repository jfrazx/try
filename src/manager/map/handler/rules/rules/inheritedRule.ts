import { isSymbol } from '../../../../../helpers';
import { ShouldHandleTryMapRule } from '../base';
import { TryMap } from '../../../map';

export class InheritedRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return isSymbol(this.property);
  }

  handle(): T[K] {
    return Reflect.get(this.target, this.property);
  }
}
