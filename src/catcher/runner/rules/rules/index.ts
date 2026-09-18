import type { ShouldHandle } from '../../../../interfaces';
import { OptionsContainer } from '../../../../options';
import { AccessorCatcherRule } from './accessor';
import { PropertyCatcherRule } from './property';
import { MethodCatcherRule } from './method';

/** Internal. Construction shape every catcher rule shares, so the runner can build them uniformly. */
export interface CatcherConstructor<T extends object, K extends keyof T> {
  new (
    target: T,
    property: K,
    descriptor: TypedPropertyDescriptor<T[K]>,
    options: OptionsContainer,
  ): ShouldHandle;
}

/** Ordered: first match wins, so the rejecting {@link PropertyCatcherRule} must stay first. */
export const rules: CatcherConstructor<any, any>[] = [
  PropertyCatcherRule,
  AccessorCatcherRule,
  MethodCatcherRule,
];
