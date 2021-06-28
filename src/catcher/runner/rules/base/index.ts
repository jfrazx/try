import { OptionsContainer } from '../../../../options';
import { ShouldHandle } from '../../../../interfaces';
import { CatchError } from '../../../interfaces';

export abstract class CatcherRule<T extends object, K extends keyof T>
  implements ShouldHandle
{
  constructor(
    protected readonly target: T,
    protected readonly property: K,
    protected readonly descriptor: TypedPropertyDescriptor<T[K]>,
    protected readonly options: OptionsContainer,
  ) {}

  abstract shouldHandle(): boolean;
  abstract handle(): CatchError<T, K>;
}
