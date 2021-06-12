import { ShouldHandleTryMapRule } from '../base';
import { TryMap } from '../../../map';

export class CatcherRule<
  T extends TryMap<T, K>,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return true;
  }
  handle() {
    return this.target.getCatcher(this.property).prepareRun(this.property);
  }
}
