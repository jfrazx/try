import type { ShouldHandle } from '../../../../interfaces';
import { UnsupportedMemberRule } from './unsupported';
import { OptionsContainer } from '../../../../options';
import { AccessorCatcherRule } from './accessor';
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
    descriptor: PropertyDescriptor | undefined,
    options: OptionsContainer,
  ): ShouldHandle;
}

/** Ordered: first match wins, so the rejecting {@link UnsupportedMemberRule} must stay last. */
export const rules: CatcherConstructor[] = [
  AccessorCatcherRule,
  MethodCatcherRule,
  UnsupportedMemberRule,
];
