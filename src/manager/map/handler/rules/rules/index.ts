import type { ShouldHandle } from '../../../../../interfaces';
import { TryMapMethodRule } from './tryMapMethodRule';
import { InheritedRule } from './inheritedRule';
import { CatcherRule } from './catcherRule';

/** Internal. Construction shape every `.try` rule shares, so the runner can build them uniformly. */
export interface TryHandleConstructor<T extends object, K extends keyof T> {
  new (target: T, property: K): ShouldHandle;
}

/** Ordered: first match wins, so the catch-all `CatcherRule` in this directory must stay last. */
export const rules: TryHandleConstructor<any, any>[] = [
  TryMapMethodRule,
  InheritedRule,
  CatcherRule,
];
