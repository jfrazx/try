import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

/**
 * Marks a method or accessor as catchable, for use with {@link TryCatch}.
 *
 * The decorated member is unchanged when called directly — it still throws.
 * Calling it through the `.try` map is what applies the catching. A caught
 * error yields `null` unless `returnOnError` says otherwise; an `async` member
 * yields a `Promise` of that value, so `await` it before comparing.
 *
 * @template T - the class owning the decorated member
 * @param tryOptions - per-member catching behavior, overriding the class defaults
 * @returns a method decorator that registers the member with its class
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension } from '@status/try';
 *
 * interface Example extends TryCatchExtension<Example, 'method'> {}
 *
 * @TryCatch<Example>()
 * class Example {
 *   @Try()
 *   method(): string {
 *     throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 *
 * example.method(); // throws Error('Error')
 * example.try.method(); // null
 * ```
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
