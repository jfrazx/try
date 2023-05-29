import type { TryCatchPrepare } from '../interfaces';
import { ErrorCatcher } from '../base';

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

  prepareRun(): TryCatchPrepare<T, K> {
    return (...args: any[]) => this.catchError(args);
  }
}
