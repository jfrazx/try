import { isSymbol } from '../../../../../helpers';
import { ShouldHandleTryMapRule } from '../base';

/** Lets symbol access through untouched, so things like `Symbol.iterator` are not mistaken for try members. */
export class InheritedRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return isSymbol(this.property);
  }

  handle() {
    return Reflect.get(this.target, this.property);
  }
}
