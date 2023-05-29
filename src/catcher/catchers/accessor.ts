import type { TryCatchPrepare } from '../interfaces';
import { ErrorCatcher } from '../base';

export class AccessorCatcher<
  T extends object,
  K extends keyof T,
> extends ErrorCatcher<T, K> {
  protected readonly original = this.descriptor.get!;

  modifyDescriptor(): TypedPropertyDescriptor<T[K]> {
    const { descriptor } = this;

    descriptor.get = this.binding();

    return descriptor;
  }

  prepareRun(): TryCatchPrepare<T, K> {
    return this.catchError();
  }
}
