import type { TryMap } from '../../../map';

/** Base for the `.try` access rules: each decides whether it owns a property, then resolves it. */
export abstract class ShouldHandleTryMapRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> {
  constructor(
    protected readonly target: T,
    protected readonly property: K,
  ) {}

  abstract shouldHandle(): boolean;
  abstract handle(): any;
}
