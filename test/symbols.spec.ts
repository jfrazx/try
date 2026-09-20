import { Catch, TryCatch, type TryCatchExtension } from '../src';

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
