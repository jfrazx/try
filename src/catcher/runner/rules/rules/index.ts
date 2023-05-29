import type { ShouldHandle } from '../../../../interfaces';
import { OptionsContainer } from '../../../../options';
import { AccessorCatcherRule } from './accessor';
import { PropertyCatcherRule } from './property';
import { MethodCatcherRule } from './method';

export interface CatcherConstructor<T extends object, K extends keyof T> {
  new (
    target: T,
    property: K,
    descriptor: TypedPropertyDescriptor<T[K]>,
    options: OptionsContainer,
  ): ShouldHandle;
}

export const rules: CatcherConstructor<any, any>[] = [
  PropertyCatcherRule,
  AccessorCatcherRule,
  MethodCatcherRule,
];
