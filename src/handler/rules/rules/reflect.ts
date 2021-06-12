import { ShouldHandleRule } from '../base';

export class ReflectRule<
  T extends object,
  K extends keyof T,
> extends ShouldHandleRule<T, K> {
  shouldHandle() {
    return true;
  }

  handle(): T[K] {
    return Reflect.get(this.target, this.property, this.receiver);
  }
}
