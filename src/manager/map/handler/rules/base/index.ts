import type { ShouldHandle } from '../../../../../interfaces';
import type { TryMap } from '../../../map';

/**
 * Base for the `.try` access rules: each decides whether it owns a property,
 * then resolves it.
 *
 * `receiver` is the instance the `.try` call arrived on. The map itself is
 * shared by every instance of the class, so the receiver is what a catcher
 * runs the decorated member against.
 */
export abstract class ShouldHandleTryMapRule<
  T extends object,
  K extends keyof T,
> implements ShouldHandle {
  constructor(
    protected readonly target: TryMap<T, K>,
    protected readonly property: K | string,
    protected readonly receiver: T,
  ) {}

  abstract shouldHandle(): boolean;
  abstract handle(): any;
}
