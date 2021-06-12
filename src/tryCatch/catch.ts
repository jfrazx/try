import { TryClassWrapper } from '../wrapper';
import { TryOptions } from '../interfaces';

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
