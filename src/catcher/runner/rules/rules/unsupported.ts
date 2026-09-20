import type { CatchError } from '../../../interfaces';
import { isObject } from '../../../../helpers';
import { CatcherRule } from '../base';

/**
 * Terminal rule: nothing left to wrap, so say which member and why.
 *
 * It runs last and claims whatever the accessor and method rules declined,
 * which is the only way a member that is neither reaches a message rather than
 * falling off the end of the chain. Two cases arrive here — a plain property,
 * for which the decorator receives no descriptor at all, and a setter with no
 * getter, which has a descriptor with nothing wrappable on it.
 */
export class UnsupportedMemberRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return true;
  }

  handle(): CatchError<T, K> {
    throw new Error(
      isObject(this.descriptor)
        ? `[TryError]: Only methods and getters can be captured. Property '${this.property.toString()}' has no value or getter to wrap`
        : `[TryError]: Only methods and accessors can be captured. Property '${this.property.toString()}' not supported`,
    );
  }
}
