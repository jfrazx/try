/** Internal. Narrows to a callable, so the rule chains read as intent rather than a `typeof` comparison. */
export const isFunction = (value: unknown): value is Function =>
  is(value, 'function');

/** Internal. Narrows to an object; used to reject plain properties, which cannot be wrapped. Note `typeof null` is `'object'`, so `null` passes. */
export const isObject = (value: unknown): value is object => is(value, 'object');
/** Internal. Narrows to a symbol, so well-known symbols are passed through rather than treated as try members. */
export const isSymbol = (value: unknown): value is symbol => is(value, 'symbol');

/** Internal. The shared `typeof` comparison the guards above narrow from. */
const is = (value: unknown, type: string) => typeof value === type;
