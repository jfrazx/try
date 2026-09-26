import type { Tryable, ShouldHandle } from '../../../interfaces';
import type { TryHandler } from '../../handler';

/** Internal. Construction shape every instance rule shares, so the runner can build them uniformly. */
export interface ShouldHandleConstructor<T extends object, K extends keyof T> {
  new (
    handler: TryHandler<T, K>,
    target: T,
    property: string,
    receiver: Tryable<T, K>,
  ): ShouldHandle;
}

/** The two property names `@TryCatch` adds, as the rules match them. The public types in `src/interfaces` spell the same names literally and do not import this, so the two can drift. */
export enum Handle {
  Try = 'try',
  TryManager = 'getTryManager',
}

/**
 * Every name in {@link Handle}: the ones the wrapper answers itself, and so
 * refuses to let anything define on the object behind it. Derived from the enum
 * so that a name added there is refused everywhere at once.
 */
export const handledNames: readonly PropertyKey[] = Object.values(Handle);
