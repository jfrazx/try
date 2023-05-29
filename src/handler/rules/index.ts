import type { Tryable, ShouldHandle } from '../../interfaces';
import type { TryHandler } from '../handler';
import { rules } from './rules';

export abstract class HandlerRuleRunner {
  static fetchRule<T extends object, K extends keyof T>(
    handler: TryHandler<T, K>,
    target: T,
    property: string,
    receiver: Tryable<T, K>,
  ): ShouldHandle {
    return rules
      .map((Rule) => new Rule(handler, target, property, receiver))
      .find((rule) => rule.shouldHandle())!;
  }
}
