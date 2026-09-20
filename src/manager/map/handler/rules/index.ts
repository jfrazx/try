import type { ShouldHandle } from '../../../../interfaces';
import type { TryMap } from '../../map';
import { rules } from './rules';

/** Picks the first `.try` rule that claims the property. */
export abstract class TryHandlerRuleRunner {
  static fetchRule<T extends object, K extends keyof T>(
    target: TryMap<T, K>,
    property: K | string,
    receiver: T,
  ): ShouldHandle {
    return rules
      .map((Rule) => new Rule(target, property as string, receiver))
      .find((rule: ShouldHandle) => rule.shouldHandle())!;
  }
}
