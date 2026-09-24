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

  /**
   * Each source spreads over the one before it, as given, with one exception.
   *
   * `runOnError` is called by the catcher, so an `undefined` one — which
   * `runOnError?:` accepts, and `verbose ? log : undefined` produces — falls
   * back to the source before it rather than replacing it with something that
   * cannot be called. The other options keep spreading as given: an
   * `undefined` `returnOnError` still overrides a class-wide one, and the
   * catcher hands back `null` for it, as before.
   */
  private mergeOptions({
    tryOptions,
    global = {},
  }: TryAllOptions): Required<RegistrationOptions> {
    return {
      ...defaultTryOptions,
      ...global,
      ...tryOptions,
      runOnError:
        tryOptions?.runOnError ?? global.runOnError ?? defaultTryOptions.runOnError,
    };
  }
}
