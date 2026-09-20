import type { CatchError, TryCatchBinding, TryCatchPrepare } from '../interfaces';
import type { OptionsContainer } from '../../options';
import { CATCHER } from '../brand';

/** Runs a decorated member inside try/catch and applies the resolved options to whatever it throws or returns. */
export abstract class ErrorCatcher<
  T extends object,
  K extends keyof T,
> implements CatchError<T, K> {
  protected abstract original: Function;

  constructor(
    protected readonly property: K,
    protected readonly descriptor: TypedPropertyDescriptor<T[K]>,
    readonly options: OptionsContainer,
  ) {}

  catchError(receiver: T, ...args: any[]): T[K] {
    try {
      const result = this.original.apply(receiver, args);

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

  /**
   * The wrapper to install on the descriptor, routing the call through the
   * catcher.
   *
   * Only ever reached for a member that always catches: the descriptor is
   * rewritten for those alone, so there is no opt-in case to fall through to.
   *
   * The wrapper is a plain function rather than a bound one so that `this` is
   * the object the member was called on, which is what the catcher runs the
   * original against. It carries {@link CATCHER} so a second catching decorator
   * on the same member is rejected rather than wrapping it again.
   */
  protected binding(): TryCatchBinding<T, K> {
    const run = this.catchError.bind(this);

    const binding = this.impersonate(function (this: T, ...args: any[]): T[K] {
      return run(this, ...args);
    } as TryCatchBinding<T, K>);

    return Object.defineProperty(binding, CATCHER, { value: true });
  }

  /**
   * Gives the wrapper the original's `name` and `length`.
   *
   * A rest-parameter function reports an arity of zero and no name, and the
   * wrapper stands in for the original everywhere the prototype is read — so
   * without this, decorating a member silently rewrites what anything
   * introspecting it sees.
   */
  private impersonate(binding: TryCatchBinding<T, K>): TryCatchBinding<T, K> {
    return Object.defineProperties(binding, {
      name: { value: this.original.name, configurable: true },
      length: { value: this.original.length, configurable: true },
    });
  }

  abstract prepareRun(receiver: T): TryCatchPrepare<T, K>;
  abstract modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}
