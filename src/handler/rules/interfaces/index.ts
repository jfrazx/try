import { Tryable, ShouldHandle } from '../../../interfaces';
import { TryHandler } from '../../handler';

export interface ShouldHandleConstructor<T extends object, K extends keyof T> {
  new (
    handler: TryHandler<T, K>,
    target: T,
    property: string,
    receiver: Tryable<T, K>,
  ): ShouldHandle;
}

export enum Handle {
  Try = 'try',
  TryManager = 'getTryManager',
}
