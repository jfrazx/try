import type { CatchError } from '../../../interfaces';
import { CatcherRule } from '../base';

/**
 * Terminal rule: nothing left to wrap, so say which member and why.
 *
 * It runs last and claims whatever the accessor and method rules declined,
 * which is the only way a member that is neither reaches a message rather than
 * falling off the end of the chain.
 */
export class UnsupportedMemberRule<
  T extends object,
  K extends keyof T,
> extends CatcherRule<T, K> {
  shouldHandle(): boolean {
    return true;
  }

  handle(): CatchError<T, K> {
    throw new Error(`[TryError]: ${this.message()}`);
  }

  /**
   * Three descriptor shapes arrive here, and each needs a different sentence to
   * be true of it.
   *
   * No descriptor at all is what a member decorator is handed for a plain
   * property, and what a wrapped object yields for a member its type promised
   * and the object does not have.
   *
   * A descriptor carrying `value` is a data property. `tryWrap` reaches it
   * head-on, with a mapped member that turns out to hold one; the decorators
   * reach it through a decorator applied above them that replaced the member,
   * since the descriptor is re-read from the prototype once every member
   * decorator has run. Telling either the property has no value to wrap would
   * be false of the one thing it does have.
   *
   * A descriptor carrying neither is a setter with no getter: there is genuinely
   * nothing on it to run.
   */
  private message(): string {
    const property = this.property.toString();
    const { descriptor } = this;

    if (!descriptor) {
      return `Only methods and accessors can be captured. Property '${property}' not supported`;
    }

    if ('value' in descriptor) {
      return `Only methods and getters can be captured. Property '${property}' holds a value that is not a function`;
    }

    return `Only methods and getters can be captured. Property '${property}' has no value or getter to wrap`;
  }
}
