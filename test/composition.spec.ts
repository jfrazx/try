import { Catch, Try, TryCatch, type TryCatchExtension } from '../src';

/**
 * A member may carry decorators this library knows nothing about, and they run
 * either side of `@Try` and `@Catch` on the way to the prototype.
 *
 * What the catcher wraps has to be the member as the class finally declares it,
 * not the member as it stood when `@Try` or `@Catch` was reached — otherwise
 * `@Catch` installs over the top of whatever ran after it, and that decorator
 * is discarded with nothing said.
 */
describe('composed with another decorator', () => {
  const trace =
    (calls: string[]) =>
    (
      _target: object,
      _property: string | symbol,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor => {
      const original = descriptor.value;

      return {
        ...descriptor,
        value(this: any, ...args: any[]) {
          calls.push('traced');

          return original.apply(this, args);
        },
      };
    };

  describe('@Catch', () => {
    it('should keep a decorator applied above it on a direct call', () => {
      const calls: string[] = [];

      @TryCatch<Test>()
      class Test {
        @trace(calls)
        @Catch<Test>()
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Test().boom()).toBeNull();
      expect(calls).toEqual(['traced']);
    });

    it('should keep a decorator applied below it on a direct call', () => {
      const calls: string[] = [];

      @TryCatch<Test>()
      class Test {
        @Catch<Test>()
        @trace(calls)
        boom(): string {
          throw new Error('boom');
        }
      }

      expect(new Test().boom()).toBeNull();
      expect(calls).toEqual(['traced']);
    });

    it('should reach it through .try as well, so both paths agree', () => {
      interface Test extends TryCatchExtension<Test, 'boom'> {}

      const calls: string[] = [];

      @TryCatch<Test>()
      class Test {
        @trace(calls)
        @Catch<Test>()
        boom(): string {
          throw new Error('boom');
        }
      }

      const test = new Test();

      expect(test.try.boom()).toBeNull();
      expect(test.boom()).toBeNull();
      expect(calls).toEqual(['traced', 'traced']);
    });

    it('should hand back what the member returns when nothing throws', () => {
      const calls: string[] = [];

      @TryCatch<Test>()
      class Test {
        @trace(calls)
        @Catch<Test>()
        fine(): string {
          return 'fine';
        }
      }

      expect(new Test().fine()).toBe('fine');
      expect(calls).toEqual(['traced']);
    });
  });

  describe('@Try', () => {
    it('should reach a decorator applied above it through .try', () => {
      interface Test extends TryCatchExtension<Test, 'boom'> {}

      const calls: string[] = [];

      @TryCatch<Test>()
      class Test {
        @trace(calls)
        @Try<Test>()
        boom(): string {
          throw new Error('boom');
        }
      }

      const test = new Test();

      expect(test.try.boom()).toBeNull();
      expect(() => test.boom()).toThrow('boom');
      expect(calls).toEqual(['traced', 'traced']);
    });
  });
});
