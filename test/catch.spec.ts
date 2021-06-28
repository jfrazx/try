import { Catch, TryCatch } from '../src';
import { expect } from 'chai';

describe('Catch', () => {
  it('should throw an error when attempting to catch a property', () => {
    @TryCatch<Test>()
    class Test {
      // @ts-ignore
      @Catch<Test>()
      failure = 'this will throw an error';
    }

    expect(() => {
      new Test();
    }).to.throw(
      `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
    );
  });
});
