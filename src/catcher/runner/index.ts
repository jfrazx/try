import type { ShouldHandle } from '../../interfaces';
import { CatcherConstructor, rules } from './rules';
import type { TryAllOptions } from '../../options';
import { OptionsContainer } from '../../options';
import type { CatchError } from '../interfaces';

export abstract class CatchRunner {
  static for<T extends object, K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: TypedPropertyDescriptor<T[K]>,
    combinedOptions: TryAllOptions,
  ): CatchError<T, K> {
    const options = new OptionsContainer(combinedOptions);

    return rules
      .map(
        (Rule: CatcherConstructor<any, any>) =>
          new Rule(target, property as K, descriptor, options),
      )
      .find((rule: ShouldHandle) => rule.shouldHandle())!
      .handle();
  }
}
