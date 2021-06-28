import { TryAllOptions, OptionsContainer } from '../../options';
import { CatchError } from '../interfaces';
import { rules } from './rules';

export abstract class CatchRunner {
  static for<T extends object, K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: TypedPropertyDescriptor<T[K]>,
    combinedOptions: TryAllOptions,
  ): CatchError<T, K> {
    const options = new OptionsContainer(combinedOptions);

    return rules
      .map((Rule) => new Rule(target, property as K, descriptor, options))
      .find((rule) => rule.shouldHandle())!
      .handle();
  }
}
