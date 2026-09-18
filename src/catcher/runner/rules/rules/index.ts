import type { ShouldHandle } from '../../../../interfaces';
import { OptionsContainer } from '../../../../options';
import { AccessorCatcherRule } from './accessor';
import { PropertyCatcherRule } from './property';
import { MethodCatcherRule } from './method';

/**
 * Internal. Construction shape every catcher rule shares, so the runner can
 * build them uniformly.
 *
 * Deliberately not generic. A catcher rule is generic in the class it serves,
 * but this array is a reflective list — the runner builds every entry and asks
 * each whether it matches, so the element type only has to describe the call.
 */
export interface CatcherConstructor {
  new (
    property: string,
    descriptor: PropertyDescriptor,
    options: OptionsContainer,
  ): ShouldHandle;
}

/** Ordered: first match wins, so the rejecting {@link PropertyCatcherRule} must stay first. */
export const rules: CatcherConstructor[] = [
  PropertyCatcherRule,
  AccessorCatcherRule,
  MethodCatcherRule,
];
