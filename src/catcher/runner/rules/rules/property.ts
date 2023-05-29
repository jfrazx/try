import type { CatchError } from '../../../interfaces';
import { isObject } from '../../../../helpers';
import { CatcherRule } from '../base';

export class PropertyCatcherRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return isObject(this.descriptor) === false;
  }

  handle(): CatchError<T, K> {
    throw new Error(
      `[TryError]: Only methods and accessors can be captured. Property '${this.property.toString()}' not supported`,
    );
  }
}
