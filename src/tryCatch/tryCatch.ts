import { TryClassWrapper, TryConstruct } from '../wrapper';
import type { TryCatchOptions } from '../interfaces';

/**
 * @description Decorator that wraps a class with a proxy that catches errors for registered methods and accessors
 *
 * @template T
 * @param {TryCatchOptions} [options={}]
 * @returns
 */
export function TryCatch<T extends object>(options: TryCatchOptions = {}) {
  return (klass: TryConstruct<T>): TryConstruct<T> => {
    return TryClassWrapper.wrap(klass, options);
  };
}
