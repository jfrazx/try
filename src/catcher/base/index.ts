import { OptionsContainer } from '../../options';

export type TryCatchBinding<T extends object, K extends keyof T> = (
  ...args: any[]
) => T[K];

export type TryCatchPrepare<T extends object, K extends keyof T> =
  | TryCatchBinding<T, K>
  | T[K];

export interface CatchError<T extends object, K extends keyof T> {
  alwaysCatch: boolean;
  catchError(...args: any[]): T[K];
  modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
  prepareRun(property?: K | string): TryCatchPrepare<T, K>;
}

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
    return (
      this.options.alwaysCatch ? this.catchError.bind(this) : this.original
    ) as any;
  }

  abstract prepareRun(): TryCatchPrepare<T, K>;
  abstract modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}
