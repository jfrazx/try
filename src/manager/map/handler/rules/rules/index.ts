import type { ShouldHandle } from '../../../../../interfaces';
import { TryMapMethodRule } from './tryMapMethodRule';
import { InheritedRule } from './inheritedRule';
import { CatcherRule } from './catcherRule';

interface TryHandleConstructor<T extends object, K extends keyof T> {
  new (target: T, property: K): ShouldHandle;
}

export const rules: TryHandleConstructor<any, any>[] = [
  TryMapMethodRule,
  InheritedRule,
  CatcherRule,
];
