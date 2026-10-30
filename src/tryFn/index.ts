import type { TryFn, TryOptions } from '../interfaces';
import { rejectReservedNames, rejectWrapper } from '../foreign';
import { Handle } from '../handler/rules/interfaces';
import { CatchRunner } from '../catcher';
import { isFunction } from '../helpers';
import { TryClassWrapper } from '../wrapper';
import { markWrapper } from '../handler';

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
 * @throws if `fn` is not a function, if it or anything it inherits from is a
 * `tryFn` or `tryWrap` result, or if it declares `try`. Writing or defining
 * `try` through the wrapper throws too, as does reading it once the function
 * has fixed its own; any other write reaches the function.
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
  rejectNonFunction(fn);
  rejectWrapper('tryFn', fn);
  rejectReservedNames('tryFn', fn, [Handle.Try]);

  // Read once, here. An empty name would log `${property} failed` as " failed",
  // and 'anonymous' is what `new Function().name` already reports.
  const catcher = CatchRunner.for<any, any>(
    fn.name || 'anonymous',
    { value: fn },
    { tryOptions: options },
  );

  // A method, so `this` is whatever the call provides and `new` is refused: a
  // plain function would construct, running the original as a plain call
  // against an object it never built. The wrapper is what `parse.try(x)`
  // provides, and nothing wants the function run against its own proxy. It
  // carries none of the original's `name` or `length`: the wrapper is what
  // stands in for the function, and it has both.
  const { attempt } = {
    attempt(this: unknown, ...args: any[]): unknown {
      return catcher.catchError(this === wrapper ? undefined : this, ...args);
    },
  };

  // There is no `apply` trap. A callable proxy without one calls the function
  // with the caller's `this` and arguments, which is all forwarding a direct
  // call means, so `obj.parse(x)` runs against `obj` as it did unwrapped.
  const wrapper = new Proxy(fn, {
    /**
     * `try` is answered here, and every other read passes through with its
     * receiver, as `set` passes writes: the wrapper itself reads as the
     * function, and an object inheriting from it reads as itself.
     *
     * @throws if the function has since fixed a `try` of its own, which a
     * proxy may not answer over
     */
    get: (target, property, receiver) => {
      if (property === Handle.Try) {
        rejectPinned(target);

        return attempt;
      }

      return Reflect.get(target, property, receiver === wrapper ? target : receiver);
    },

    /**
     * `new` on the wrapper hands the wrapper on as `new.target`, as `tryWrap`
     * does, and the instance's prototype is read through it, which `get`
     * forwards. A bound function is the exception: it has no prototype to
     * read, and builds what it was bound from only when it is `new.target`
     * itself, so with the wrapper there it built a plain object. It alone is
     * handed on as itself. A subclass arrives as itself and is left alone.
     */
    construct: (target, args, newTarget) =>
      Reflect.construct(
        target,
        args,
        newTarget === wrapper && Object(target.prototype) !== target.prototype
          ? target
          : newTarget,
      ),

    /**
     * A write of `try` on the wrapper is refused, and every other write passes
     * through.
     *
     * Without this, `parse.try = x` lands on the function, which `tryFn`
     * promises never to touch, while `get` goes on answering `try` itself, so
     * the write visibly does nothing. Only a write made on the wrapper itself
     * is refused. Any other is forwarded with its own receiver: an object
     * inheriting from the wrapper keeps its `try`, as it would anywhere, and a
     * write through a proxy standing in front still has to define the name on
     * that proxy, which reaches `defineProperty` below.
     *
     * @throws if `try` is written on the wrapper itself
     */
    set: (target, property, value, receiver) => {
      if (property === Handle.Try && receiver === wrapper) {
        throw refusal();
      }

      return Reflect.set(
        target,
        property,
        value,
        receiver === wrapper ? target : receiver,
      );
    },

    /**
     * A definition of `try` is refused, and every other definition passes
     * through.
     *
     * `Object.defineProperty(parse, 'try', …)` never reaches `set`, and a
     * definition made on the wrapper always lands on the function, so without
     * this the name `set` refuses could still be planted by the other route.
     *
     * @throws if the property is `try`
     */
    defineProperty: (target, property, descriptor) => {
      if (property === Handle.Try) {
        throw refusal();
      }

      return Reflect.defineProperty(target, property, descriptor);
    },

    /**
     * A delete of `try` is refused, and every other delete passes through.
     *
     * Without this, `delete parse.try` reaches the function and answers
     * `true`, while `get` goes on answering `try` itself — the same silent
     * no-op `set` refuses.
     *
     * @throws if the property is `try`
     */
    deleteProperty: (target, property) => {
      if (property === Handle.Try) {
        throw new Error(
          `[TryError]: tryFn answers 'try' itself and cannot pass a delete of it through. Property 'try' would go on being answered by the wrapper — delete it on the function directly if that is what you mean`,
        );
      }

      return Reflect.deleteProperty(target, property);
    },
  }) as TryFn<F>;

  markWrapper(wrapper);
  // A wrapper passes `Object.getPrototypeOf` to the function, so a walk up a
  // chain through it would step past a wrapped class standing behind it.
  TryClassWrapper.recordStandIn(wrapper, fn);

  return wrapper;
}

/**
 * Anything but a function is refused before anything is built.
 *
 * Typed callers cannot get here, but JavaScript and `any` can, and without
 * this the first to notice is the catcher factory, which refuses an object in
 * the decorators' terms — a member named `'anonymous'` that is not a method —
 * and `null` with a `TypeError` reading its name. It also comes first because
 * the wrapper check walks the chain of an object.
 *
 * @throws if `fn` is not callable
 */
const rejectNonFunction = (fn: unknown): void => {
  if (!isFunction(fn)) {
    throw new Error(
      `[TryError]: tryFn needs a function. Received ${typeof fn} — wrap an object's members with tryWrap instead`,
    );
  }
};

/**
 * A `try` the function fixed after it was wrapped leaves `.try` unanswerable.
 *
 * `tryFn` refuses a function declaring `try`, but `fn.try = x` on the function
 * itself is left alone, and the wrapper goes on answering over it. Once that
 * property is non-configurable and read-only — `Object.freeze(fn)`
 * afterwards, or a bare `Object.defineProperty` — a proxy must report it as it
 * is, and answering `.try` throws the engine's invariant `TypeError` on every
 * read. Anything short of both leaves the wrapper free to answer.
 *
 * @throws if the function's own `try` is non-configurable and read-only
 */
const rejectPinned = (target: object): void => {
  const own = Reflect.getOwnPropertyDescriptor(target, Handle.Try);
  const pinned =
    own?.configurable === false &&
    ('get' in own ? own.get === undefined : !own.writable);

  if (pinned) {
    throw new Error(
      `[TryError]: tryFn cannot answer 'try' once the function fixes its own. Property 'try' was made non-configurable and read-only on the function after it was wrapped, and the wrapper must then report it as it is — reach it on the function itself`,
    );
  }
};

/**
 * The refusal both write traps raise for `try`, which the wrapper answers
 * itself.
 */
const refusal = (): Error =>
  new Error(
    `[TryError]: tryFn answers 'try' itself and cannot pass a write of it through. Property 'try' would be set on the function where nothing could read it back — assign it on the function directly if that is what you mean`,
  );
