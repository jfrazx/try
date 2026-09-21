import type { TryOptions } from '../interfaces';
import { CatchRunner, claimMember, isCaught } from '../catcher';

/**
 * Always catches errors thrown by the decorated method or accessor.
 *
 * Standalone, unlike {@link Try} and {@link Catch} — the class needs no
 * {@link TryCatch} wrapper and there is no `.try` map. A caught error yields
 * `null` unless `returnOnError` says otherwise; an `async` member yields a
 * `Promise` of that value.
 *
 * Only one may be applied to a member. A second would build its catcher from
 * the wrapper the first installed: the inner one answers every call, so the
 * outer one's `returnOnError` and `runOnError` are never reached. The claim the
 * first one records is what lets that be rejected as the class is defined, and
 * it holds however many unrelated decorators stand between the two.
 *
 * @template T - the class owning the decorated member
 * @param tryOptions - catching behavior for this member
 * @returns a method decorator that replaces the member's descriptor
 * @throws if the member is already caught
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
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    if (isCaught(target, property)) {
      throw new Error(
        `[TryError]: Only one @CatchError can be applied to a member. Property '${String(property)}' is decorated more than once`,
      );
    }

    const catcher = CatchRunner.for<T, K>(property, descriptor, {
      tryOptions: { ...tryOptions, alwaysCatch: true },
    });

    claimMember(target, property);

    return catcher.modifyDescriptor();
  };
}
