import { TryClassWrapper, TryConstruct } from '../wrapper';
import type { TryCatchOptions } from '../interfaces';

/**
 * Wraps a class so members marked with {@link Try} or {@link Catch} become
 * reachable through a `.try` map that catches their errors.
 *
 * The decorator cannot add `.try` to the class type on its own, so declaration
 * merge the class with {@link TryCatchExtension} to type `.try` and
 * `getTryManager()`.
 *
 * @template T - the decorated class
 * @param options - defaults applied to every member registered on the class
 * @returns a class decorator returning the wrapped class
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension } from '@status/try';
 *
 * interface Config extends TryCatchExtension<Config, 'parse'> {}
 *
 * @TryCatch<Config>({
 *   runOnError: ({ property }) => console.warn(`${property} failed`),
 * })
 * class Config {
 *   @Try()
 *   parse(): Record<string, string> {
 *     throw new Error('bad json');
 *   }
 * }
 *
 * const config = new Config();
 *
 * config.parse(); // throws Error('bad json')
 * config.try.parse(); // null, after the warning
 * ```
 */
export function TryCatch<T extends object>(options: TryCatchOptions = {}) {
  return (klass: TryConstruct<T>): TryConstruct<T> => {
    return TryClassWrapper.wrap(klass, options);
  };
}
