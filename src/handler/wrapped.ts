/**
 * Internal. Every wrapper handed out, so one can be recognized if it comes
 * back.
 *
 * Wrapping a wrapper has to be refused — the outer catchers would run the
 * member against the inner proxy rather than the target — and recognizing one
 * is harder than it looks. `in` cannot do it: the proxy has no `has` trap, so
 * `'getTryManager' in wrapper` forwards to the target and reads false. A
 * get-based probe would see it, but reading a property off a foreign object
 * runs whatever getter is there, on the very targets most likely to be hostile.
 *
 * Recorded here rather than on the handler, which has enough to do resolving
 * access, and rather than beside the classes {@link TryClassWrapper} refuses a
 * second `@TryCatch` on: that registry answers whether a *class* is decorated,
 * keyed by the class, which is a different question from whether an *object* is
 * a wrapper.
 *
 * The set is weak, so a wrapper leaves nothing behind once it is unreachable.
 */
const wrappers = new WeakSet<object>();

/**
 * Internal. Records that this object is a wrapper.
 *
 * @param wrapper - the proxy just handed out
 */
export const markWrapper = (wrapper: object): void => void wrappers.add(wrapper);

/**
 * Internal. Whether this object is a wrapper we handed out.
 *
 * @param value - the object to check
 */
export const isWrapper = (value: object): boolean => wrappers.has(value);
