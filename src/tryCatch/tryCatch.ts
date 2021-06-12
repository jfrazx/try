import { TryClassWrapper, TryConstruct } from '../wrapper';
import { TryCatchOptions } from '../interfaces';

export const TryCatch =
  <T extends object>(options: TryCatchOptions = {}) =>
  (klass: TryConstruct<T>) =>
    TryClassWrapper.wrap(klass, options);
