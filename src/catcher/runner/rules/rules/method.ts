import type { CatchError } from '../../../interfaces';
import { MethodCatcher } from '../../../catchers';
import { isFunction } from '../../../../helpers';
import { CatcherRule } from '../base';

/** Selects {@link MethodCatcher} when the descriptor carries a function value. */
export class MethodCatcherRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return isFunction(this.descriptor.value);
  }

  handle(): CatchError<T, K> {
    return new MethodCatcher(
      this.property as K,
      this.descriptor as TypedPropertyDescriptor<T[K]>,
      this.options,
    );
  }
}
