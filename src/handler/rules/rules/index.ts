import type { ShouldHandleConstructor } from '../interfaces';
import { TryManagerRule } from './tryManager';
import { ReflectRule } from './reflect';
import { TryRule } from './try';

export const rules: ShouldHandleConstructor<any, any>[] = [
  TryRule,
  TryManagerRule,
  ReflectRule,
];
