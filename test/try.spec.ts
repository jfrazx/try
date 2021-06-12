import { Gambler } from './lib';
import { expect } from 'chai';

describe('Try', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  describe('Standard', () => {
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
  });
});