import { TryAllOptions, OptionsContainer } from '../../options';
import { FunctionCatcher, PropertyCatcher } from '../catchers';
import { isFunction } from '../../helpers';
import { CatchError } from '../base';

export abstract class CatchRunner {
  static for<T extends object, K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: TypedPropertyDescriptor<T[K]>,
    combinedOptions: TryAllOptions,
  ): CatchError<T, K> {
    const options = new OptionsContainer(combinedOptions);
    const Catcher = this.determineCatcher(property as string, descriptor);

    return new Catcher(target, property as K, descriptor, options);
  }

  private static determineCatcher(property: string, descriptor: PropertyDescriptor) {
    const { value, get } = descriptor;

    switch (true) {
      case isFunction(get):
        return PropertyCatcher;
      case isFunction(value):
        return FunctionCatcher;
      default:
        throw new Error(
          `[TryError]:: Only methods and accessors can be captured. Property '${property}' not supported`,
        );
    }
  }
}
