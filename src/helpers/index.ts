/** Internal. Narrows to a callable, so the rule chains read as intent rather than a `typeof` comparison. */
export const isFunction = (value: unknown): value is Function =>
  is(value, 'function');

/** Internal. Narrows to a symbol, so well-known symbols are passed through rather than treated as try members. */
export const isSymbol = (value: unknown): value is symbol => is(value, 'symbol');

/** Internal. The shared `typeof` comparison the guards above narrow from. */
const is = (value: unknown, type: string) => typeof value === type;

/**
 * Internal. An object and everything it inherits from, in order, up to the
 * first that answers.
 *
 * Several questions asked of a foreign object are about the whole chain rather
 * than the object itself — what declares a member, whether a wrapper stands
 * anywhere in it — so the walk is written once and the predicate says which
 * question is being asked.
 *
 * @param start - the object to start from, or `null` for an empty chain
 * @param found - what makes an object the answer
 * @returns the first object that answers, or nothing
 */
export const upChain = (
  start: object | null,
  found: (owner: object) => boolean,
): object | undefined => {
  for (let owner = start; owner; owner = Object.getPrototypeOf(owner)) {
    if (found(owner)) {
      return owner;
    }
  }

  return undefined;
};
