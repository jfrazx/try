import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

/**
 * Marks a method or accessor as catchable, for use with {@link TryCatch}.
 *
 * `@Catch()` is meant to catch on a direct call as well as through the `.try`
 * map, which is what would set it apart from {@link Try}. It does not currently
 * do that — as shipped it behaves identically to {@link Try}, so a direct call
 * still throws and only `.try` catches. See
 * {@link https://github.com/jfrazx/try/issues/30 | issue #30}.
 *
 * Until that is resolved, reach for {@link CatchError} when you want a member
 * that always catches.
 *
 * @template T - the class owning the decorated member
 * @param tryOptions - per-member catching behavior, overriding the class defaults
 * @returns a method decorator that registers the member with its class
 *
 * @example
 * ```ts
 * import { TryCatch, Catch, type TryCatchExtension } from '@status/try';
 *
 * interface Example extends TryCatchExtension<Example, 'method'> {}
 *
 * @TryCatch<Example>()
 * class Example {
 *   @Catch()
 *   method(): string {
 *     throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 *
 * example.method(); // throws Error('Error') -- see issue #30
 * example.try.method(); // null
 * ```
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
