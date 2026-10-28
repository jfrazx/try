import type { TryFn, TryOptions } from '../interfaces';
import { Handle } from '../handler/rules/interfaces';
import { CatchRunner } from '../catcher';

/**
 * Makes a bare function catchable through `.try`, without a decorator.
 *
 * {@link tryWrap} needs a member to name, and a function standing alone has
 * none. What comes back is the function, callable as before, carrying a `.try`
 * that is the same function with catching: a direct call keeps throwing, and
 * the call through `.try` is what catches. That is the deliberate choice for a
 * function other code holds too — whether it throws stays its own business.
 *
 * The function is never written to. What comes back is a proxy standing in
 * front of it, answering `.try` itself and reading everything else through:
 * `name`, `length`, `prototype`, `new`, and whatever properties the function
 * carries — `debounce(fn).cancel` — survive with no copying. A frozen function
 * wraps as readily as any other.
 *
 * `.try` runs the function with `this` as the call provides it, except that
 * the wrapper itself becomes `undefined`. `parse.try(x)` then behaves exactly
 * like `parse(x)`, and `parse.try.call(obj, x)` reaches `obj`. A direct call is
 * untouched, so a wrapper installed as a method still runs against the object
 * it is called on. `obj.parse.try(x)` cannot reach `obj` — reading `.parse`
 * loses it before `.try` is looked up — so call `.try.call(obj, x)`, wrap
 * `fn.bind(obj)`, or wrap the object with `tryWrap(obj, { parse: {} })`.
 *
 * `TryError.property` is the function's `name`, `'anonymous'` when it has
 * none, and `'bound f'` for a bound one.
 *
 * A class is not a function to call. `.try()` on one catches its "cannot be
 * invoked without 'new'" error, which the direct call throws first; wrap it
 * with {@link tryClass} instead.
 *
 * @template F - the function being wrapped
 * @param fn - the function to make catchable
 * @param options - what `.try` hands back, and runs, when the function throws
 * @returns the function behind a proxy carrying `.try`
 *
 * @example
 * ```ts
 * import { tryFn } from '@status/try';
 *
 * const parse = tryFn(JSON.parse, { returnOnError: {} });
 *
 * parse('nope'); // throws SyntaxError
 * parse.try('nope'); // {}
 * parse.try('{"a":"b"}'); // { a: 'b' }
 * ```
 */
export function tryFn<F extends (...args: any[]) => any>(
  fn: F,
  options?: TryOptions,
): TryFn<F> {
  // Read once, here. An empty name would log `${property} failed` as " failed",
  // and 'anonymous' is what `new Function().name` already reports.
  const catcher = CatchRunner.for<any, any>(
    fn.name || 'anonymous',
    { value: fn },
    { tryOptions: options },
  );

  // A plain function, so `this` is whatever the call provides. The wrapper is
  // what `parse.try(x)` provides, and nothing wants the function run against
  // its own proxy. It carries none of the original's `name` or `length`: the
  // wrapper is what stands in for the function, and it has both.
  const attempt = function (this: unknown, ...args: any[]): unknown {
    return catcher.catchError(this === wrapper ? undefined : this, ...args);
  };

  // There is no `apply` trap. A callable proxy without one calls the function
  // with the caller's `this` and arguments, which is all forwarding a direct
  // call means, so `obj.parse(x)` runs against `obj` as it did unwrapped.
  const wrapper = new Proxy(fn, {
    get: (target, property) =>
      property === Handle.Try ? attempt : Reflect.get(target, property),

    // `new` on the wrapper hands the wrapper on as `new.target`, as `tryWrap`
    // does, and the instance's prototype is read through it, which `get`
    // forwards. A bound function is the exception: it has no prototype to
    // read, and builds what it was bound from only when it is `new.target`
    // itself, so with the wrapper there it built a plain object. It alone is
    // handed on as itself. A subclass arrives as itself and is left alone.
    construct: (target, args, newTarget) =>
      Reflect.construct(
        target,
        args,
        newTarget === wrapper && Object(target.prototype) !== target.prototype
          ? target
          : newTarget,
      ),
  }) as TryFn<F>;

  return wrapper;
}
