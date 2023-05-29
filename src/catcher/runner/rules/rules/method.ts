import type { CatchError } from '../../../interfaces';
import { MethodCatcher } from '../../../catchers';
import { isFunction } from '../../../../helpers';
import { CatcherRule } from '../base';

export class MethodCatcherRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return isFunction(this.descriptor.value);
  }

  handle(): CatchError<T, K> {
    return new MethodCatcher(
      this.target,
      this.property,
      this.descriptor,
      this.options,
    );
  }
}
