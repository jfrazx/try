/** Internal. A member rebound so calling it routes through the catcher. */
export type TryCatchBinding<T extends object, K extends keyof T> = (
  ...args: any[]
) => T[K];

/** Internal. What `.try` yields: a callable for methods, the already-resolved value for accessors. */
export type TryCatchPrepare<T extends object, K extends keyof T> =
  TryCatchBinding<T, K> | T[K];

/**
 * Internal. A catcher that can both run the member and install itself on the
 * descriptor. Shares its name with the public `@CatchError` decorator, which is
 * why it could not simply be exported — see
 * {@link https://github.com/jfrazx/try/issues/35 | issue #35}.
 */
export interface CatchError<
  T extends object,
  K extends keyof T,
> extends CatchPrepare<T, K> {
  alwaysCatch: boolean;
  catchError(receiver: T, ...args: any[]): T[K];
  modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}

/**
 * Internal. The minimum `.try` needs: hand back something callable or already
 * resolved, bound to the instance the call arrived on.
 */
export interface CatchPrepare<T extends object, K extends keyof T> {
  prepareRun(receiver: T, property?: K | string): TryCatchPrepare<T, K>;
}
