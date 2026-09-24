import { ShouldHandleRule } from '../base';

/**
 * Fallback: ordinary property access, forwarded to the real instance with the
 * receiver the handler settles — the one a write through the same wrapper gets.
 */
export class ReflectRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleRule<T, K> {
  shouldHandle() {
    return true;
  }

  handle(): T[K] {
    return Reflect.get(
      this.target,
      this.property,
      this.handler.forwarded(this.target, this.receiver),
    ) as T[K];
  }
}
