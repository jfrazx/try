/**
 * Internal. The members a catching decorator has already claimed, keyed by the
 * object the decorator was applied to.
 *
 * A second catching decorator on the same member would otherwise build its
 * catcher from the wrapper the first one left behind: the inner catcher answers
 * every call, so the outer decorator's options are never reached and its
 * `runOnError` never runs. The claim is what lets that be rejected as the class
 * is defined rather than wrapped twice in silence.
 *
 * The claim is recorded here rather than marked on the wrapper the catcher
 * installs. An unrelated decorator standing between two of ours replaces that
 * wrapper with one of its own, and a mark carried on it goes too — while the
 * prototype and the property name are the same however many decorators stand
 * in between.
 *
 * The map is weak and keyed by that prototype, so a class decorated per
 * request, per tenant, or per test leaves nothing behind once it is
 * unreachable.
 */
const claims = new WeakMap<object, Set<PropertyKey>>();

/**
 * Internal. Records that a catcher now answers for this member.
 *
 * @param target - the prototype, or the constructor for a static member
 * @param property - the member the catcher was built for
 */
export const claimMember = (target: object, property: PropertyKey): void => {
  const claimed = claims.get(target) ?? new Set<PropertyKey>();

  claims.set(target, claimed.add(property));
};

/**
 * Internal. Whether a catcher already answers for this member.
 *
 * @param target - the prototype, or the constructor for a static member
 * @param property - the member to check
 */
export const isCaught = (target: object, property: PropertyKey): boolean =>
  claims.get(target)?.has(property) ?? false;
