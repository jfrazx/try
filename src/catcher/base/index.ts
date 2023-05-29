import type { CatchError, TryCatchBinding, TryCatchPrepare } from '../interfaces';
import type { OptionsContainer } from '../../options';

export abstract class ErrorCatcher<T extends object, K extends keyof T>
  implements CatchError<T, K>
{
  protected abstract original: Function;

  constructor(
    protected readonly target: T,
    protected readonly property: K,
    protected readonly descriptor: TypedPropertyDescriptor<T[K]>,
    readonly options: OptionsContainer,
  ) {}

  catchError(...args: any[]): T[K] {
    try {
      const result = this.original.apply(this.target, args);

      return this.catchReturn(result, args);
    } catch (error: any) {
      return this.onError(error as Error, args);
    }
  }

  private catchReturn(returnValue: any, args: any[]): any {
    return (
      returnValue?.catch?.((error: Error) => this.onError(error, args)) ??
      returnValue
    );
  }

  get alwaysCatch(): boolean {
    return this.options.alwaysCatch;
  }

  protected onError(error: Error, args: any[]): any {
    const runOnResult = this.options.runOnError({
      error,
      arguments: args,
      property: this.property as string,
      returnOnError: this.options.returnOnError,
    });

    return runOnResult ?? this.options.returnOnError ?? null;
  }

  protected binding(): TryCatchBinding<T, K> {
    return this.alwaysCatch
      ? this.catchError.bind(this)
      : (this.original as TryCatchBinding<T, K>);
  }

  abstract prepareRun(): TryCatchPrepare<T, K>;
  abstract modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}
