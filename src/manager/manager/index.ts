import { TryCatchOptions, DecoratedEventMap } from '../../interfaces';
import { CatchRunner } from '../../catcher';
import { TryMapHandler } from './map';

export class TryManager<T extends object, K extends keyof T> {
  private readonly tryMap = TryMapHandler.wrap<T, K>();

  constructor(private global: TryCatchOptions) {}

  registerTryCatchDescriptors(
    target: T,
    descriptorMap: DecoratedEventMap<T, K>[],
  ): void {
    descriptorMap
      .filter(({ property }) => this.tryMap.isNotYetRegistered(property))
      .forEach((descriptor) => this.registerTryCatchDescriptor(target, descriptor));
  }

  private registerTryCatchDescriptor(
    target: T,
    { property, descriptor, options }: DecoratedEventMap<T, K>,
  ) {
    const catcher = CatchRunner.for(target, property, descriptor, {
      tryOptions: options,
      global: this.global,
    });

    this.getTryMap().add(property, catcher);
  }

  getTryMap() {
    return this.tryMap;
  }
}
