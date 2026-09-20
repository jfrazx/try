import { isFunction } from '../helpers';

/**
 * Internal. Marks a function as the wrapper a catcher installed.
 *
 * A second catching decorator on the same member would otherwise build its
 * catcher from the wrapper the first one left behind: the inner catcher answers
 * every call, so the outer decorator's options are never reached and its
 * `runOnError` never runs. The brand is what lets that be rejected as the class
 * is defined rather than wrapped twice in silence.
 */
export const CATCHER = Symbol('@status/try:catcher');

/** Internal. Whether the member a descriptor carries is already a catcher's wrapper. */
export const isCaught = (descriptor?: PropertyDescriptor): boolean => {
  const member = descriptor?.value ?? descriptor?.get;

  return isFunction(member) && CATCHER in member;
};
