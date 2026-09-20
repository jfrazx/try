import type { TryOptions } from '../interfaces';
import { registerMember } from './register';

/**
 * Marks a method or accessor as catchable on every call, for use with
 * {@link TryCatch}.
 *
 * This is what sets it apart from {@link Try}: a direct call is caught too,
 * not only a call through the `.try` map. The member is registered with the
 * class either way, so it appears on `.try` alongside the rest.
 *
 * Both paths resolve the same catcher and the same merged options, so a
 * `runOnError` passed to {@link TryCatch} applies to a direct call as well.
 *
 * The catching is in place from the moment the class is defined, so it covers a
 * call made before anything is constructed, a reference taken off the
 * prototype, and a call the constructor itself makes.
 *
 * {@link CatchError} is the standalone equivalent, for a class that wants no
 * `.try` map at all.
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
 * example.method(); // null
 * example.try.method(); // null
 * ```
 */
export function Catch<T extends object>(tryOptions: TryOptions = {}) {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): void => {
    return registerMember('Catch', target, property, descriptor, {
      ...tryOptions,
      alwaysCatch: true,
    });
  };
}
