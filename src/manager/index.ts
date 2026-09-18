import type { TryCatchOptions, DecoratedEventMap } from '../interfaces';
import { CatchRunner } from '../catcher';
import { TryMapHandler } from './map';

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
  private readonly tryMap = TryMapHandler.wrap<T, K>();

  constructor(private global: TryCatchOptions) {}

  /**
   * Registers each decorated member against `target`, skipping any already
   * registered.
   *
   * The skip is per class, not per instance, and the catcher it keeps captures
   * the instance it was built from — so `.try` on every later instance runs
   * against the first one's state. See
   * {@link https://github.com/jfrazx/try/issues/33 | issue #33}.
   *
   * Called by the class wrapper during construction; not part of normal use.
   *
   * @internal
   * @param target - the instance being constructed
   * @param descriptorMap - members collected at decoration time
   * @returns the same `target`, for chaining by the caller
   */
  registerTryCatchDescriptors(
    target: T,
    descriptorMap: DecoratedEventMap<T, K>[],
  ): T {
    descriptorMap
      .filter(({ property }) => this.tryMap.hasNotBeenRegisteredInTryMap(property))
      .forEach((descriptor) => this.registerTryCatchDescriptor(target, descriptor));

    return target;
  }

  private registerTryCatchDescriptor(
    target: T,
    { property, descriptor, options }: DecoratedEventMap<T, K>,
  ) {
    const catcher = CatchRunner.for(target, property, descriptor, {
      tryOptions: options,
      global: { ...this.global },
    });

    this.tryMap.addToTryMap(property, catcher);
  }

  /**
   * The map of registered catchers — the same object reached as `.try` on an
   * instance.
   *
   * @internal
   * @returns the try map for this class
   */
  getTryMap() {
    return this.tryMap;
  }
}
