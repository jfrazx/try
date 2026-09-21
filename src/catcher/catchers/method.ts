import type { TryCatchPrepare } from '../interfaces';
import { ErrorCatcher } from '../base';

/** Catcher for methods, wrapping `descriptor.value`. */
export class MethodCatcher<T extends object, K extends keyof T> extends ErrorCatcher<
  T,
  K
> {
  protected readonly original = this.descriptor.value as unknown as Function;

  modifyDescriptor(): TypedPropertyDescriptor<T[K]> {
    const { descriptor } = this;

    descriptor.value = this.binding() as any;

    return descriptor;
  }

  prepareRun(receiver: T): TryCatchPrepare<T, K> {
    return (...args: any[]) => this.catchError(receiver, ...args);
  }
}
