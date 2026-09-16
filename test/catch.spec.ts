import { Catch, TryCatch } from '../src';

describe('Catch', () => {
  it('should throw an error when attempting to catch a property', () => {
    @TryCatch<Test>()
    class Test {
      // @ts-expect-error
      @Catch<Test>()
      failure = 'this will throw an error';
    }

    expect(() => {
      new Test();
    }).toThrow(
      `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
    );
  });
});
