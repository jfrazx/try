import type { CatchError, TryCatchBinding, TryCatchPrepare } from '../interfaces';
import type { OptionsContainer } from '../../options';
import { isFunction } from '../../helpers';

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

  /**
   * A rejected promise is caught by attaching to the promise the member
   * returned, so an async member resolves the same options a synchronous one
   * does.
   *
   * `catch` is confirmed callable rather than merely present. Optional call
   * syntax guards `null` and `undefined` alone, so an ordinary object carrying
   * a `catch` key threw a `TypeError` from inside this method — which the try
   * block above then caught and reported as though the member had failed. A
   * successful call came back as the fallback, with `runOnError` fired on a
   * fabricated error. `JSON.parse('{"catch": 1}')` is enough to do it, and
   * nothing about the returned data is under the caller's control.
   */
  private catchReturn(returnValue: any, args: any[]): any {
    return isFunction(returnValue?.catch)
      ? returnValue.catch((error: Error) => this.onError(error, args))
      : returnValue;
  }

  get alwaysCatch(): boolean {
    return this.options.alwaysCatch;
  }

  /**
   * The member name is converted rather than cast. A symbol-named member
   * arrives here as a symbol, and `TryError.property` promises a string —
   * handing the symbol over behind a cast leaves the handler holding one while
   * TypeScript reports a string.
   *
   * That mismatch surfaces in the first thing anyone does with the field:
   * `${property}` throws on a symbol, so the documented way to log a failure
   * would itself throw, inside the callback written to handle failures.
   */
  protected onError(error: Error, args: any[]): any {
    const runOnResult = this.options.runOnError({
      error,
      arguments: args,
      property: String(this.property),
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
   * original against.
   *
   * It carries no mark saying a catcher installed it. A second catching
   * decorator is rejected by the claim the first one recorded against the
   * prototype, which survives an unrelated decorator replacing this wrapper —
   * a mark carried here would not.
   */
  protected binding(): TryCatchBinding<T, K> {
    const run = this.catchError.bind(this);

    return this.impersonate(function (this: T, ...args: any[]): T[K] {
      return run(this, ...args);
    } as TryCatchBinding<T, K>);
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
