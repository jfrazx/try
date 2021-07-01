import { TryCatch, Try } from '../src';
import { Gambler } from './lib';
import { expect } from 'chai';

describe('Try', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  describe('Standard', () => {
    it('should throw an error when attempting to catch a property', () => {
      @TryCatch<Testable>()
      class Testable {
        // @ts-ignore
        @Try<Testable>()
        failure = 'this will throw an error';
      }

      expect(() => {
        new Testable();
      }).to.throw(
        `[TryError]: Only methods and accessors can be captured. Property 'failure' not supported`,
      );
    });

    it('should throw an error when called normally', () => {
      expect(() => gambler.fail()).to.throw(`This should fail`);
    });

    it('should catch errors and return null when called through try', () => {
      expect(() => gambler.try.fail()).not.to.throw();
      expect(gambler.try.fail()).to.be.null;
    });

    it('should throw an error asynchronously when called normally', async () => {
      try {
        await gambler.asyncFail();
      } catch (error) {
        expect(error.message).to.equal(`This should fail async`);
      }
    });

    it('should catch asynchronous errors and return null when called through try', async () => {
      try {
        const result = await gambler.try.asyncFail();

        expect(result).to.be.null;
      } catch (error) {
        expect(() => {
          throw new Error(`Test Failed`);
        }).not.to.throw();
      }
    });

    it('should catch property errors', () => {
      expect(gambler.try.test).to.be.null;
    });

    it('should throw an error when accessing a non-existent try property', () => {
      expect(() => (gambler.try as any).doesNotExist()).to.throw(
        `[TryError]: Property 'doesNotExist' does not exist in TryMap`,
      );
    });

    it('should not throw an error when called normally | async', async () => {
      const success = await gambler.successAsync();

      expect(success).to.equal('success');
    });

    it('should not throw an error when called through try | async', async () => {
      const success = await gambler.try.successAsync();

      expect(success).to.equal('success');
    });

    it('should not throw an error when called normally | sync', () => {
      const success = gambler.success();

      expect(success).to.equal('success');
    });

    it('should not throw an error when called through try | sync', () => {
      const success = gambler.try.success();

      expect(success).to.equal('success');
    });

    it('should not throw an error when called through try returning undefined | sync', () => {
      const success = gambler.try.successUndefined();

      expect(success).to.be.undefined;
    });
  });
});
