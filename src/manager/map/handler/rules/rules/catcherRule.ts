import { ShouldHandleTryMapRule } from '../base';
import type { TryMap } from '../../../map';

export class CatcherRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return true;
  }

  handle() {
    return this.target.getTryCatcher(this.property).prepareRun(this.property);
  }
}
