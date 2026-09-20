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
   * Adopts the catchers of the class this one extends, once its own members are
   * registered.
   *
   * A manager is built per class from that class's own decorators, so a
   * subclass starts with a map covering only what it declares. Everything the
   * base declared is still there on the instance — inherited through the
   * prototype chain like any other member — and this is what keeps `.try`
   * saying the same.
   *
   * Nothing to adopt when the class extends nothing decorated, which is the
   * usual case.
   *
   * @internal
   * @param parent - the manager of the class this one extends, if it has one
   * @param prototype - this class's prototype, whose own members win
   */
  inherit(parent: TryManager<any, any> | undefined, prototype: object): void {
    if (!parent) {
      return;
    }

    this.tryMap.inheritFrom(parent.tryMap, prototype);
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
   * `@Catch` cannot be found in the map. It is recognized by the claim it
   * records against the prototype instead — without that check the member
   * arriving here is already a catcher, and building a second one around it
   * leaves the inner decorator answering every call while the outer one's
   * options are never reached.
   *
   * The descriptor is read from the prototype rather than taken from the
   * decorator that queued the member. A decorator applied above `@Try` or
   * `@Catch` runs afterwards and may replace the member, and by now every
   * member decorator has run — so the prototype holds what the class actually
   * declares, while the queued descriptor holds what it declared partway
   * through decoration.
   */
  private registerTryCatchDescriptor({
    property,
    prototype,
    options,
  }: DecoratedEventMap<T, K>) {
    if (this.tryMap.hasPropertyInTryMap(property)) {
      throw new Error(
        `[TryError]: Only one of @Try or @Catch can be applied to a member. Property '${String(property)}' is decorated more than once`,
      );
    }

    if (isCaught(prototype, property)) {
      throw new Error(
        `[TryError]: @CatchError cannot be combined with @Try or @Catch. Property '${String(property)}' is already caught by @CatchError, which needs no class decorator`,
      );
    }

    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);

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
   *
   * A member another decorator sealed cannot be replaced, so it is rejected
   * here in the library's own terms. Redefining it anyway throws a bare
   * `TypeError` that says nothing about the decorators involved, and skipping
   * it instead would quietly demote `@Catch` to `@Try` — the direct call would
   * stop catching with nothing said.
   *
   * @throws if the member cannot be redefined
   */
  private installAlwaysCatch(
    prototype: object,
    property: K,
    catcher: CatchError<T, K>,
  ): void {
    if (!catcher.alwaysCatch) {
      return;
    }

    const descriptor = catcher.modifyDescriptor();

    if (!descriptor.configurable) {
      throw new Error(
        `[TryError]: @Catch has to replace the member it catches, and property '${String(property)}' cannot be redefined. A decorator applied above it returned a non-configurable descriptor`,
      );
    }

    Object.defineProperty(prototype, property, descriptor);
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
