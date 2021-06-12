import { Tryable, ShouldHandle } from '../../../interfaces';
import { TryHandler } from '../../handler';

export abstract class ShouldHandleRule<T extends object, K extends keyof T>
  implements ShouldHandle
{
  constructor(
    protected readonly handler: TryHandler<T, K>,
    protected readonly target: T,
    protected readonly property: string,
    protected readonly receiver: Tryable<T, K>,
  ) {}

  abstract shouldHandle(): boolean;
  abstract handle(): any;
}
