import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

/**
 * @description Decorator used in tandem with TryCatch decorator for methods and accessors that will catch errors only when called through a 'try' map
 *
 * @template T
 * @param {TryOptions} [tryOptions={}]
 * @returns
 *
 * @example
 * ```typescript
 * @TryCatch()
 * class Example {
 *   @Try()
 *   method() {
 *    throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 * example.method(); // throws error
 *
 * example.try.method(); // returns null
 */
export function Try<T extends object>(tryOptions: TryOptions = {}) {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): void => {
    return TryClassWrapper.registerDecorator(target.constructor, {
      property,
      descriptor,
      options: { ...tryOptions, alwaysCatch: false },
    });
  };
}
