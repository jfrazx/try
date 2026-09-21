import { ShouldHandleTryMapRule } from '../base';

/** Terminal `.try` rule: hands back the registered catcher, or the thrower when nothing is registered. */
export class CatcherRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleTryMapRule<T, K> {
  shouldHandle(): boolean {
    return true;
  }

  handle() {
    return this.target
      .getTryCatcher(this.property as K)
      .prepareRun(this.receiver, this.property);
  }
}
