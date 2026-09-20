import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { CatchRunner, isCaught, type CatchError } from '../catcher';
import { TryMapHandler, TryMap } from './map';

/**
 * Internal. A decorated ancestor as a subclass finds it: the manager holding
 * its catchers, and the prototype its members are declared on.
 */
export interface TryInheritance {
  manager: TryManager<any, any>;
  prototype: object;
}

/**
 * Internal. A member that passed validation, waiting to be committed. The
 * descriptor is present only for a member that always catches.
 */
interface TryRegistration<T extends object, K extends keyof T> {
  property: K;
  prototype: object;
  catcher: CatchError<T, K>;
  install?: PropertyDescriptor;
}

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
   * Every member is validated before any of them is committed. Registering a
   * member changes the class — a member that always catches replaces what the
   * prototype holds — and a member further down the list can still be rejected.
   * Committing as it went would leave a class whose decoration failed with some
   * of its members already wrapped, and applying `@TryCatch` to it again would
   * then build a catcher around that wrapper.
   *
   * Called by the class wrapper as the class is defined; not part of normal use.
   *
   * @internal
   * @param descriptorMap - members collected at decoration time
   * @throws if a member carries more than one catching decorator
   */
  registerTryCatchDescriptors(descriptorMap: DecoratedEventMap<T, K>[]): void {
    const planned = new Map<K, TryRegistration<T, K>>();

    descriptorMap.forEach((descriptor) =>
      this.planRegistration(descriptor, planned),
    );

    planned.forEach((registration) => this.commitRegistration(registration));
  }

  /**
   * Adopts the catchers of the nearest decorated class above this one, once
   * this class's own members are registered.
   *
   * A manager is built per class from that class's own decorators, so a
   * subclass starts with a map covering only what it declares. Everything the
   * ancestor declared is still there on the instance — inherited through the
   * prototype chain like any other member — and this is what keeps `.try`
   * saying the same.
   *
   * Nothing to adopt when nothing above this class is decorated, which is the
   * usual case.
   *
   * @internal
   * @param ancestor - the nearest decorated class above this one, if there is one
   * @param prototype - this class's prototype, from which overrides are found
   */
  inherit(ancestor: TryInheritance | undefined, prototype: object): void {
    if (!ancestor) {
      return;
    }

    this.tryMap.inheritFrom(ancestor.manager.tryMap, prototype, ancestor.prototype);
  }

  /**
   * Validates one member and works out what registering it will do, without
   * doing any of it.
   *
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
   * `@Catch` cannot be found among the planned members. It is recognized by the
   * claim it records against the prototype instead — without that check the
   * member arriving here is already a catcher, and building a second one around
   * it leaves the inner decorator answering every call while the outer one's
   * options are never reached.
   *
   * The descriptor is read from the prototype rather than taken from the
   * decorator that queued the member. A decorator applied above `@Try` or
   * `@Catch` runs afterwards and may replace the member, and by now every
   * member decorator has run — so the prototype holds what the class actually
   * declares, while the queued descriptor holds what it declared partway
   * through decoration.
   *
   * @throws if the member is decorated more than once, already caught, or
   * cannot be replaced
   */
  private planRegistration(
    { property, prototype, options }: DecoratedEventMap<T, K>,
    planned: Map<K, TryRegistration<T, K>>,
  ): void {
    if (planned.has(property)) {
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

    planned.set(property, {
      property,
      prototype,
      catcher,
      install: this.planAlwaysCatch(property, catcher),
    });
  }

  /**
   * The descriptor a member that always catches will be installed under, or
   * nothing when it catches only through `.try`.
   *
   * The decorator cannot install it itself: it runs before `@TryCatch`, so the
   * class-wide options do not exist yet, and TypeScript's `__decorate` has
   * already copied the descriptor onto the prototype by the time the catcher
   * could mutate it. Building it here is what makes the two call paths resolve
   * the same options and the same catcher.
   *
   * A member another decorator sealed cannot be replaced, so it is rejected
   * here in the library's own terms, while nothing has been committed.
   * Redefining it anyway throws a bare `TypeError` that says nothing about the
   * decorators involved, and skipping it instead would quietly demote `@Catch`
   * to `@Try` — the direct call would stop catching with nothing said.
   *
   * @throws if the member cannot be redefined
   */
  private planAlwaysCatch(
    property: K,
    catcher: CatchError<T, K>,
  ): PropertyDescriptor | undefined {
    if (!catcher.alwaysCatch) {
      return undefined;
    }

    const descriptor = catcher.modifyDescriptor();

    if (!descriptor.configurable) {
      throw new Error(
        `[TryError]: @Catch has to replace the member it catches, and property '${String(property)}' cannot be redefined. A decorator applied above it returned a non-configurable descriptor`,
      );
    }

    return descriptor;
  }

  /**
   * Commits one validated member: it joins the `.try` map, and one that always
   * catches replaces what the prototype holds.
   *
   * It must be the *declaring* prototype, not the constructed instance's. A
   * subclass may be the first thing built, and it may override the member —
   * installing against the instance would leave the base class throwing and
   * would overwrite the override.
   *
   * Nothing here can fail. Every member was validated before the first one was
   * committed, so reaching this point means the whole class is registrable.
   */
  private commitRegistration({
    property,
    prototype,
    catcher,
    install,
  }: TryRegistration<T, K>): void {
    this.tryMap.addToTryMap(property, catcher);

    if (install) {
      Object.defineProperty(prototype, property, install);
    }
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
