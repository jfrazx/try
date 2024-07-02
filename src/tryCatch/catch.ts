import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

/**
 * @description Decorator used in tandem with TryCatch decorator for methods and accessors that will always catch errors
 *
 * @template T
 * @param {TryOptions} [tryOptions={}]
 * @returns
 *
 * @example
 * @TryCatch()
 * class Example {
 *   @Catch()
 *    method() {
 *     throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 * example.method(); // returns null
 */
export function Catch<T extends object>(tryOptions: TryOptions = {}) {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): void => {
    return TryClassWrapper.registerDecorator(target.constructor, {
      property,
      descriptor,
      options: { ...tryOptions, alwaysCatch: true },
    });
  };
}
