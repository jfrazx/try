import { TryManager } from '../manager';

export type TryProperties<T, K extends keyof T> = Omit<Pick<T, K>, 'try'>;

export type Tryable<T extends object, K extends keyof T = keyof T> = T &
  TryMethods<T, K>;

export interface TryCatchExtension<T extends object, K extends keyof T>
  extends TryMethods<T, K> {
  try: TryProperties<T, K>;
}

export interface TryMethods<T extends object, K extends keyof T> {
  getTryManager(): TryManager<T, K>;
}

export interface TryCatchOptions extends SharedOptions {}

export interface TryError {
  error: Error;
  arguments: any[];
  property: string;
  returnOnError: any;
}

interface SharedOptions {
  runOnError?(tryError: TryError): any;
}

export interface TryOptions extends SharedOptions {
  returnOnError?: any;
}

export interface DecoratedEventMap<T extends object, K extends keyof T> {
  property: K;
  options: RegistrationOptions;
  descriptor: TypedPropertyDescriptor<T[K]>;
}

export interface RegistrationOptions extends TryOptions {
  alwaysCatch: boolean;
}

export interface ShouldHandle {
  shouldHandle(): boolean;
  handle(): any;
}
