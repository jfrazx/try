import type { TryOptions } from '../interfaces';
import { CatchRunner } from '../catcher';

/**
 * Always catches errors thrown by the decorated method or accessor.
 *
 * Standalone, unlike {@link Try} and {@link Catch} — the class needs no
 * {@link TryCatch} wrapper and there is no `.try` map. A caught error yields
 * `null` unless `returnOnError` says otherwise; an `async` member yields a
 * `Promise` of that value.
 *
 * @template T - the class owning the decorated member
 * @param tryOptions - catching behavior for this member
 * @returns a method decorator that replaces the member's descriptor
 *
 * @example
 * ```ts
 * import { CatchError } from '@status/try';
 *
 * class Example {
 *   @CatchError()
 *   method(): string {
 *     throw new Error('Error');
 *   }
 *
 *   @CatchError({ returnOnError: 'fallback' })
 *   withFallback(): string {
 *     throw new Error('Error');
 *   }
 * }
 *
 * const example = new Example();
 *
 * example.method(); // null
 * example.withFallback(); // 'fallback'
 * ```
 */
export function CatchError<T extends object>(tryOptions: TryOptions = {}) {
  return <K extends keyof T>(
    _target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const catcher = CatchRunner.for<T, K>(property, descriptor, {
      tryOptions: { ...tryOptions, alwaysCatch: true },
    });

    return catcher.modifyDescriptor();
  };
}
