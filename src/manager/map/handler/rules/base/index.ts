import type { TryMap } from '../../../map';

export abstract class ShouldHandleTryMapRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> {
  constructor(protected readonly target: T, protected readonly property: K) {}

  abstract shouldHandle(): boolean;
  abstract handle(): any;
}
