import type { TryCatchOptions, RegistrationOptions } from '../interfaces';

/** Internal. The two option sources — class-wide and per-member — before they are merged. */
export interface TryAllOptions {
  tryOptions?: Partial<RegistrationOptions>;
  global?: TryCatchOptions;
}

const defaultTryOptions: Required<RegistrationOptions> = {
  alwaysCatch: false,
  returnOnError: null,
  runOnError: () => {},
};

export interface OptionsContainer extends Required<RegistrationOptions> {}

/** Merged options for one member: defaults, then class-wide, then per-member. Written as non-writable own properties. */
export class OptionsContainer {
  constructor(readonly combinedOptions: TryAllOptions) {
    const options = this.mergeOptions(combinedOptions);

    Object.entries(options).forEach(([key, value]) => {
      Object.defineProperty(this, key, {
        enumerable: true,
        value,
      });
    });
  }

  private mergeOptions({
    tryOptions,
    global = {},
  }: TryAllOptions): Required<RegistrationOptions> {
    return { ...defaultTryOptions, ...global, ...tryOptions };
  }
}
