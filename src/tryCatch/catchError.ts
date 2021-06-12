import { TryOptions } from '../interfaces';
import { CatchRunner } from '../catcher';

export const CatchError = <T extends object>(tryOptions: TryOptions = {}) => {
  return <K extends keyof T>(
    target: T,
    property: string | K,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const catcher = CatchRunner.for(target, property, descriptor, {
      tryOptions: { ...tryOptions, alwaysCatch: true },
    });

    return catcher.modifyDescriptor();
  };
};
