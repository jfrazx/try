import type { ShouldHandle } from '../../interfaces';
import { rules } from './rules';
import type { TryAllOptions } from '../../options';
import { OptionsContainer } from '../../options';
import type { CatchError } from '../interfaces';

/**
 * Entry point for building a catcher: merges the options, then picks the
 * catcher matching the member kind.
 *
 * A catcher is stateless with respect to the object it runs against — the
 * receiver arrives per call — so one catcher is shared by every instance.
 */
export abstract class CatchRunner {
  static for<T extends object, K extends keyof T>(
    property: string | K,
    descriptor: PropertyDescriptor | undefined,
    combinedOptions: TryAllOptions,
  ): CatchError<T, K> {
    const options = new OptionsContainer(combinedOptions);

    return rules
      .map((Rule) => new Rule(property as string, descriptor, options))
      .find((rule: ShouldHandle) => rule.shouldHandle())!
      .handle() as CatchError<T, K>;
  }
}
