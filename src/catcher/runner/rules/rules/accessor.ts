import type { CatchError } from '../../../interfaces';
import { AccessorCatcher } from '../../../catchers';
import { isFunction } from '../../../../helpers';
import { CatcherRule } from '../base';

/** Selects {@link AccessorCatcher} when the descriptor carries a getter. */
export class AccessorCatcherRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return isFunction(this.descriptor.get);
  }

  handle(): CatchError<T, K> {
    return new AccessorCatcher(
      this.target,
      this.property,
      this.descriptor,
      this.options,
    );
  }
}
