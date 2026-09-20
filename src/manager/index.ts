import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { CatchRunner, isCaught, type CatchError } from '../catcher';
import { TryMapHandler, TryMap } from './map';

/**
 * The per-class registry behind {@link TryCatch}: turns each decorated member
 * into a catcher and keeps the `.try` map that exposes them.
 *
 * One manager exists per decorated class and is shared by every instance of it.
 * Reach it with `getTryManager()` rather than constructing one — the instance
 * you are handed is already wired to that class's decorators.
 *
 * Exported so that what `getTryManager()` returns can be named. Its own members
 * are construction machinery and are marked internal; catching is reached
 * through `.try`, not through the manager.
 *
 * @template T - the decorated class
 * @template K - the members registered as catchable
 *
 * @example
 * ```ts
 * import { TryCatch, Try, type TryCatchExtension, type TryManager } from '@status/try';
 *
 * interface Loader extends TryCatchExtension<Loader, 'load'> {}
 *
 * @TryCatch<Loader>()
 * class Loader {
 *   @Try()
 *   load(): string {
 *     throw new Error('nope');
 *   }
 * }
 *
 * const loader = new Loader();
 *
 * // naming what getTryManager() hands back is the whole point of the export
 * const manager: TryManager<Loader, 'load'> = loader.getTryManager();
 *
 * loader.try.load(); // null
 * ```
 */
export class TryManager<T extends object, K extends keyof T> {
  private readonly tryMap = new TryMap<T, K>();

  constructor(private global: TryCatchOptions) {}

  /**
   * Registers each decorated member, rejecting any member decorated twice.
   *
   * One registration serves every instance: a catcher holds no reference to the
   * object it runs against, and a member that always catches is installed on
   * the prototype, so there is nothing per-instance left to do.
   *
   * Called by the class wrapper as the class is defined; not part of normal use.
   *
   * @internal
   * @param descriptorMap - members collected at decoration time
   * @throws if a member carries more than one catching decorator
   */
  registerTryCatchDescriptors(descriptorMap: DecoratedEventMap<T, K>[]): void {
    descriptorMap.forEach((descriptor) =>
      this.registerTryCatchDescriptor(descriptor),
    );
  }

  /**
   * The duplicate check belongs here rather than in a filter over the batch. A
   * filter is fully evaluated before the first registration, so two decorators
   * on one member both pass it, and the second builds its catcher from the
   * descriptor the first already rewrote — wrapping a wrapper.
   *
   * Two decorators on one member is a contradiction rather than something to
   * resolve by ordering: whichever the library picked, the other would be
   * discarded in silence. Rejecting it here means that shows up as the class is
   * defined, in the same place an unsupported member does.
   *
   * {@link CatchError} never registers, so a member stacking it with `@Try` or
   * `@Catch` cannot be found in the map. It is recognized by the brand on the
   * wrapper it installs instead — without that check the descriptor arriving
   * here is already a catcher, and building a second one around it leaves the
   * inner decorator answering every call while the outer one's options are
   * never reached.
   */
  private registerTryCatchDescriptor({
    property,
    prototype,
    descriptor,
    options,
  }: DecoratedEventMap<T, K>) {
    if (this.tryMap.hasPropertyInTryMap(property)) {
      throw new Error(
        `[TryError]: Only one of @Try or @Catch can be applied to a member. Property '${String(property)}' is decorated more than once`,
      );
    }

    if (isCaught(descriptor)) {
      throw new Error(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property '${String(property)}' is already caught by @CatchError, which needs no class decorator`,
      );
    }

    const catcher = CatchRunner.for<T, K>(property, descriptor, {
      tryOptions: options,
      global: { ...this.global },
    });

    this.tryMap.addToTryMap(property, catcher);
    this.installAlwaysCatch(prototype, property, catcher);
  }

  /**
   * Installs a member that always catches onto the prototype that declared it,
   * so a direct call is caught rather than only a call through `.try`.
   *
   * The decorator cannot do this itself: it runs before `@TryCatch`, so the
   * class-wide options do not exist yet, and TypeScript's `__decorate` has
   * already copied the descriptor onto the prototype by the time the catcher
   * could mutate it. Defining it here is what makes the two call paths resolve
   * the same options and the same catcher.
   *
   * It must be the *declaring* prototype, not the constructed instance's. A
   * subclass may be the first thing built, and it may override the member —
   * installing against the instance would leave the base class throwing and
   * would overwrite the override.
   */
  private installAlwaysCatch(
    prototype: object,
    property: K,
    catcher: CatchError<T, K>,
  ): void {
    if (!catcher.alwaysCatch) {
      return;
    }

    Object.defineProperty(prototype, property, catcher.modifyDescriptor());
  }

  /**
   * The `.try` map as seen by one instance: the class's shared catchers behind
   * a proxy that carries `receiver`, so each call runs against the object it
   * was made on.
   *
   * @internal
   * @param receiver - the instance `.try` was reached through
   * @returns the try map for that instance
   * @throws if called without a receiver, which would otherwise run every
   * catcher against `undefined` and swallow the result into `null`
   */
  getTryMap(receiver: T) {
    if (!receiver) {
      throw new Error(
        '[TryError]: A try map needs the instance it was reached through. Read `.try` on an instance rather than building a map from the manager.',
      );
    }

    return TryMapHandler.wrap<T, K>(this.tryMap, receiver);
  }
}
