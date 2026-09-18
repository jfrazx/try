import type { CatchPrepare } from '../interfaces';

/**
 * Stand-in for an unregistered property, so a misspelled `.try.whatever` fails
 * loudly instead of returning undefined.
 *
 * It cannot tell a typo from a runtime's protocol probe, so `JSON.stringify`
 * and `await` on a `.try` map throw here too — see
 * {@link https://github.com/jfrazx/try/issues/34 | issue #34}.
 */
export class ErrorThrower<
  T extends object,
  K extends keyof T,
> implements CatchPrepare<T, K> {
  prepareRun(_receiver: T, property: K): never {
    throw new Error(
      `[TryError]: Property '${property.toString()}' does not exist in TryMap`,
    );
  }
}
