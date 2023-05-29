import type { TryOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';

export const Try = <T extends object>(tryOptions: TryOptions = {}) => {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): void => {
    return TryClassWrapper.registerDecorator(target.constructor, {
      property,
      descriptor,
      options: { ...tryOptions, alwaysCatch: false },
    });
  };
};
