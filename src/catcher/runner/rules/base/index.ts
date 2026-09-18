import type { OptionsContainer } from '../../../../options';
import type { ShouldHandle } from '../../../../interfaces';
import type { CatchError } from '../../../interfaces';

/**
 * Base for the catcher-selection rules: each decides whether it handles a
 * descriptor, then builds its catcher.
 *
 * `property` and `descriptor` arrive in the shape the decorators actually
 * receive them — a bare name and an untyped {@link PropertyDescriptor}. The
 * narrowing to `K` and `TypedPropertyDescriptor<T[K]>` happens where the
 * catcher is built, which is the first point at which it is known to hold.
 */
export abstract class CatcherRule<
  T extends object,
  K extends keyof T,
> implements ShouldHandle {
  constructor(
    protected readonly property: K | string,
    protected readonly descriptor: PropertyDescriptor,
    protected readonly options: OptionsContainer,
  ) {}

  abstract shouldHandle(): boolean;
  abstract handle(): CatchError<T, K>;
}
