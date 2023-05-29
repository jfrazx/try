import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

/**
 * @description Decorator for methods and accessors that will always catch errors
 *
 * @template T
 * @param {TryOptions} [tryOptions={}]
 * @returns
 */
export const Catch = <T extends object>(tryOptions: TryOptions = {}) => {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): void => {
    return TryClassWrapper.registerDecorator(target.constructor, {
      property,
      descriptor,
      options: { ...tryOptions, alwaysCatch: true },
    });
  };
};
