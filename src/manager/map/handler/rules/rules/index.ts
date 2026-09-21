import type { ShouldHandle } from '../../../../../interfaces';
import { TryMapMethodRule } from './tryMapMethodRule';
import { InheritedRule } from './inheritedRule';
import type { TryMap } from '../../../map';
import { CatcherRule } from './catcherRule';

/**
 * Internal. Construction shape every `.try` rule shares, so the runner can
 * build them uniformly.
 *
 * Deliberately not generic: this array is a reflective list, so the element
 * type only has to describe the call the runner makes.
 */
export interface TryHandleConstructor {
  new (target: TryMap<any, any>, property: string, receiver: object): ShouldHandle;
}

/** Ordered: first match wins, so the catch-all {@link CatcherRule} must stay last. */
export const rules: TryHandleConstructor[] = [
  TryMapMethodRule,
  InheritedRule,
  CatcherRule,
];
