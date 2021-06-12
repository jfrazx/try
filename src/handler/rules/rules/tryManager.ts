import { TryManager } from '../../../manager';
import { ShouldHandleRule } from '../base';
import { Handle } from '../interfaces';

export class TryManagerRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleRule<T, K> {
  shouldHandle() {
    return this.property === Handle.TryManager;
  }

  handle(): () => TryManager<T, K> {
    return () => this.handler.getTryManager();
  }
}
