import { TryProperties } from '../../../interfaces';
import { ShouldHandleRule } from '../base';
import { Handle } from '../interfaces';

export class TryRule<T extends object, K extends keyof T> extends ShouldHandleRule<
  T,
  K
> {
  shouldHandle(): boolean {
    return this.property === Handle.Try;
  }

  handle(): TryProperties<T, K> {
    return this.handler.getTryManager().getTryMap();
  }
}
