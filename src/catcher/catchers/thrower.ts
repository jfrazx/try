import { CatchError } from '../base';

export class ErrorThrower<T extends object, K extends keyof T>
  implements CatchError<T, K>
{
  alwaysCatch = true;

  protected original = (property: K | string = `Unknown`): never => {
    throw new Error(`Property '${property}' does not exist in TryMap`);
  };

  catchError(): never {
    return this.original();
  }

  modifyDescriptor(): never {
    return this.original();
  }

  prepareRun(property: K) {
    return this.original(property);
  }
}
