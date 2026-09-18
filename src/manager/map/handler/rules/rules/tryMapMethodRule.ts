import { ShouldHandleTryMapRule } from '../base';
import type { TryMap } from '../../../map';

/**
 * Lets TryMap's own methods through, so `.try` still answers its API rather
 * than treating them as members.
 *
 * It runs first and matches anything already `in` the map, so a decorated
 * member sharing a name with TryMap or `Object.prototype` is shadowed rather
 * than caught. See {@link https://github.com/jfrazx/try/issues/34 | issue #34}.
 */
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
