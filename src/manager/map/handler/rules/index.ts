import { ShouldHandle } from '../../../../interfaces';
import { rules } from './rules';

export abstract class TryHandlerRuleRunner {
  static fetchRule<T extends object, K extends keyof T>(
    target: T,
    property: K | string,
  ): ShouldHandle {
    return rules
      .map((Rule) => new Rule(target, property))
      .find((rule) => rule.shouldHandle())!;
  }
}
