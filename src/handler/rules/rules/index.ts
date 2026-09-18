import type { ShouldHandleConstructor } from '../interfaces';
import { TryManagerRule } from './tryManager';
import { ReflectRule } from './reflect';
import { TryRule } from './try';

/** Ordered: first match wins, so the catch-all {@link ReflectRule} must stay last. */
export const rules: ShouldHandleConstructor<any, any>[] = [
  TryRule,
  TryManagerRule,
  ReflectRule,
];
