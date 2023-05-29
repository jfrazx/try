import type { CatchPrepare } from '../interfaces';

export class ErrorThrower<T extends object, K extends keyof T>
  implements CatchPrepare<T, K>
{
  prepareRun(property: K): never {
    throw new Error(
      `[TryError]: Property '${property.toString()}' does not exist in TryMap`,
    );
  }
}
