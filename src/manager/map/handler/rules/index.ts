import type { ShouldHandle } from '../../../../interfaces';
import { TryHandleConstructor, rules } from './rules';

export abstract class TryHandlerRuleRunner {
  static fetchRule<T extends object, K extends keyof T>(
    target: T,
    property: K | string,
  ): ShouldHandle {
    return rules
      .map((Rule: TryHandleConstructor<T, K>) => new Rule(target, property as K))
      .find((rule: ShouldHandle) => rule.shouldHandle())!;
  }
}
