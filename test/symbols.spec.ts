import { Catch, TryCatch, type TryCatchExtension, type TryError } from '../src';

const boom = Symbol('boom');

/**
 * `.try` passes symbols through untouched so a runtime's protocol lookups —
 * `Symbol.iterator`, `Symbol.toPrimitive` — are not mistaken for decorated
 * members. A symbol the class actually decorated has to be the exception, or
 * the member reads as `undefined` on the one map that exists to expose it.
 */
describe('a symbol-named member', () => {
  interface Test extends TryCatchExtension<Test, typeof boom> {}

  @TryCatch<Test>()
  class Test {
    @Catch<Test>()
    [boom](): string {
      throw new Error('boom');
    }
  }

  it('should catch on a direct call', () => {
    expect(new Test()[boom]()).toBeNull();
  });

  it('should be reachable through .try', () => {
    expect(new Test().try[boom]()).toBeNull();
  });

  it('should leave an undecorated symbol passing through', () => {
    expect((new Test().try as any)[Symbol.iterator]).toBeUndefined();
  });
});

/**
 * `property` is documented as a string and every example in the README
 * interpolates it, so a symbol-named member has to arrive already converted.
 * Handing the symbol itself over would throw on interpolation — inside the
 * callback written to handle the failure, which is the worst place to find out.
 *
 * Both decorator paths build their metadata in the same catcher, so pinning one
 * pins the other.
 */
describe('error metadata for a symbol-named member', () => {
  const seen: TryError[] = [];

  interface Logged extends TryCatchExtension<Logged, typeof boom> {}

  @TryCatch<Logged>({ runOnError: (tryError: TryError) => void seen.push(tryError) })
  class Logged {
    @Catch<Logged>()
    [boom](): string {
      throw new Error('boom');
    }
  }

  beforeEach(() => {
    seen.length = 0;

    new Logged()[boom]();
  });

  it('should hand runOnError the name as a string', () => {
    expect(typeof seen[0].property).toBe('string');
    expect(seen[0].property).toBe('Symbol(boom)');
  });

  it('should survive the interpolation the README documents', () => {
    expect(`${seen[0].property} failed`).toBe('Symbol(boom) failed');
  });
});
