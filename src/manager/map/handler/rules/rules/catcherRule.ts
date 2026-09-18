import { ShouldHandleTryMapRule } from '../base';
import type { TryMap } from '../../../map';

/** Terminal `.try` rule: hands back the registered catcher, or the thrower when nothing is registered. */
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
