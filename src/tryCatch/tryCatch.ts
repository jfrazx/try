import { TryClassWrapper, TryConstruct } from '../wrapper';
import type { TryCatchOptions } from '../interfaces';

/**
 * @description Decorator that wraps a class with a proxy that catches errors for registered methods and accessors
 *
 * @template T
 * @param {TryCatchOptions} [options={}]
 * @returns {(klass: TryConstruct<T>) => TryConstruct<T>}
 */
export const TryCatch =
  <T extends object>(
    options: TryCatchOptions = {},
  ): ((klass: TryConstruct<T>) => TryConstruct<T>) =>
  (klass: TryConstruct<T>) =>
    TryClassWrapper.wrap(klass, options);
