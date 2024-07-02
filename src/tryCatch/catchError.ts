import type { TryOptions } from '../interfaces';
import { CatchRunner } from '../catcher';

/**
 * @description Decorator used independently from TryCatch decorator for methods and accessors that will always catch errors
 *
 * @export
 * @template T
 * @param {TryOptions} [tryOptions={}]
 * @returns
 *
 * @example
 * ```ts
 * class Example {
 *   @CatchError()
 *   method() {
 *     throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 * example.method(); // returns null
 */
export function CatchError<T extends object>(tryOptions: TryOptions = {}) {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const catcher = CatchRunner.for(target, property, descriptor, {
      tryOptions: { ...tryOptions, alwaysCatch: true },
    });

    return catcher.modifyDescriptor();
  };
}
