import { TryCatchOptions, RegistrationOptions } from '../interfaces';

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

export class OptionsContainer {
  constructor(readonly combinedOptions: TryAllOptions = {}) {
    const options = this.mergeOptions(combinedOptions);

    Object.entries(options).forEach(([key, value]) => {
      Object.defineProperty(this, key, {
        enumerable: true,
        value,
      });
    });
  }

  private mergeOptions({
    tryOptions = {},
    global = {},
  }: TryAllOptions): Required<RegistrationOptions> {
    return { ...defaultTryOptions, ...global, ...tryOptions };
  }
}
