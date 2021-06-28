import { CatchError, TryCatchBinding, TryCatchPrepare } from '../interfaces';
import { OptionsContainer } from '../../options';

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

      return result?.catch?.((error: Error) => this.onError(error, args)) ?? result;
    } catch (error) {
      return this.onError(error, args);
    }
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
    return (this.alwaysCatch ? this.catchError.bind(this) : this.original) as any;
  }

  abstract prepareRun(): TryCatchPrepare<T, K>;
  abstract modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}
