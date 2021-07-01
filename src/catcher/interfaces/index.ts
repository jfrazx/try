export type TryCatchBinding<T extends object, K extends keyof T> = (
  ...args: any[]
) => T[K];

export type TryCatchPrepare<T extends object, K extends keyof T> =
  | TryCatchBinding<T, K>
  | T[K];

export interface CatchError<T extends object, K extends keyof T>
  extends CatchPrepare<T, K> {
  alwaysCatch: boolean;
  catchError(...args: any[]): T[K];
  modifyDescriptor(): TypedPropertyDescriptor<T[K]>;
}

export interface CatchPrepare<T extends object, K extends keyof T> {
  prepareRun(property?: K | string): TryCatchPrepare<T, K>;
}
