import type { TryCatchExtension } from '../src';
import { Gambler } from './lib/gambler';
import { TryCatch, Try } from '../src';

describe('Try', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  describe('Standard', () => {
    it('should throw an error when attempting to catch a property', () => {
      // the class is defined inside the assertion: registration happens as the
      // class is defined, so an unsupported member is rejected there rather
      // than waiting for something to construct it
      expect(() => {
        @TryCatch<Testable>()
        class Testable {
          // @ts-ignore
          @Try<Testable>()
          failure = 'this will throw an error';
        }

        return Testable;
      }).toThrow(
        `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
      );
    });

    it('should throw an error when called normally', () => {
      expect(() => gambler.fail()).toThrow(`This should fail`);
    });

    it('should catch errors and return null when called through try', () => {
      expect(() => gambler.try.fail()).not.toThrow();
      expect(gambler.try.fail()).toBeNull();
    });

    it('should throw an error asynchronously when called normally', async () => {
      try {
        await gambler.asyncFail();
      } catch (error: any) {
        expect(error.message).toBe(`This should fail async`);
      }
    });

    it('should catch asynchronous errors and return null when called through try', async () => {
      try {
        const result = await gambler.try.asyncFail();

        expect(result).toBeNull();
      } catch (_error) {
        expect(() => {
          throw new Error(`Test Failed`);
        }).not.toThrow();
      }
    });

    it('should catch property errors', () => {
      expect(gambler.try.test).toBeNull();
    });

    it('should throw an error when accessing a non-existent try property', () => {
      expect(() => (gambler.try as any).doesNotExist()).toThrow(
        `[TryError]: Property 'doesNotExist' does not exist in TryMap`,
      );
    });

    it('should not throw an error when called normally | async', async () => {
      const success = await gambler.successAsync();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try | async', async () => {
      const success = await gambler.try.successAsync();

      expect(success).toBe('success');
    });

    it('should not throw an error when called normally | sync', () => {
      const success = gambler.success();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try | sync', () => {
      const success = gambler.try.success();

      expect(success).toBe('success');
    });

    it('should not throw an error when called through try returning undefined | sync', () => {
      const success = gambler.try.successUndefined();

      expect(success).toBeUndefined();
    });

    /**
     * A rejected promise is caught by attaching to the promise the member
     * returned, and what makes a return value a promise has to be a `catch`
     * that can be called. Optional call syntax guards `null` and `undefined`
     * alone, so an ordinary object carrying a `catch` key threw a `TypeError`
     * from inside the catcher, which the catcher's own try block then caught:
     * a successful call came back as the fallback, with `runOnError` fired on
     * an error nothing raised.
     */
    it('should hand back a value carrying a non-callable catch key', () => {
      const errors: string[] = [];

      interface Payload extends TryCatchExtension<Payload, 'load'> {}

      @TryCatch<Payload>()
      class Payload {
        @Try<Payload>({
          returnOnError: 'FALLBACK',
          runOnError: ({ error }) => void errors.push(error.message),
        })
        load(): unknown {
          return { catch: 'not a function', data: 7 };
        }
      }

      expect(new Payload().try.load()).toEqual({
        catch: 'not a function',
        data: 7,
      });
      expect(errors).toEqual([]);
    });
  });
});
