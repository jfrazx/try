import { isSymbol } from '../../../../../helpers';
import { ShouldHandleTryMapRule } from '../base';

/**
 * Lets symbol access through untouched, so things like `Symbol.iterator` are not
 * mistaken for try members.
 *
 * A symbol the class actually decorated is left to the catcher rule. Claiming it
 * here would hand back whatever `Reflect.get` found on the map — nothing — so a
 * registered symbol member would read as `undefined` rather than as the catcher
 * every other member resolves to.
 */
export class InheritedRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return (
      isSymbol(this.property) &&
      this.target.hasPropertyInTryMap(this.property as K) === false
    );
  }

  handle() {
    return Reflect.get(this.target, this.property);
  }
}
