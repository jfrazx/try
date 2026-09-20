import type { RegistrationOptions } from '../interfaces';
import { TryClassWrapper } from '../wrapper';
import { isFunction } from '../helpers';

/**
 * Internal. Queues a member for the class registry {@link TryCatch} builds.
 *
 * Shared by {@link Try} and {@link Catch}, which differ only in the
 * `alwaysCatch` they hard-set.
 *
 * A static member is rejected rather than queued. For a static, `target` is the
 * constructor rather than the prototype, so `target.constructor` is the global
 * `Function` — a key no class decorator ever reads. The member would be filed
 * where nothing looks, never catch, and say nothing about why.
 *
 * @param decorator - the decorator's name, for the message a static produces
 * @param target - the prototype the decorator was applied to
 * @param property - the decorated member
 * @param descriptor - what the decorator was handed; absent for a plain property
 * @param options - the member's options plus its resolved `alwaysCatch`
 * @throws if the decorated member is static
 */
export const registerMember = <T extends object, K extends keyof T>(
  decorator: string,
  target: T,
  property: string | K,
  descriptor: PropertyDescriptor | undefined,
  options: RegistrationOptions,
): void => {
  if (isFunction(target)) {
    throw new Error(
      `[TryError]: @${decorator} cannot decorate a static member. Property '${String(property)}' is static, and the registry @TryCatch builds covers instances — use @CatchError, which needs no class decorator`,
    );
  }

  return TryClassWrapper.registerDecorator(target.constructor, {
    property,
    prototype: target,
    descriptor,
    options,
  });
};
