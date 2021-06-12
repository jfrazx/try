import { CatchError, TryError } from '../src';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('CatchError', () => {
  describe('Standard', () => {
    it('should always catch synchronous method errors and return null', () => {
      class FailMethodSync {
        @CatchError()
        suck() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodSync();

      expect(fail.suck()).to.be.null;
    });

    it('should always catch asynchronous method errors and return null', async () => {
      class FailMethodAsync {
        @CatchError()
        async suck() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodAsync();

      expect(await fail.suck()).to.be.null;
    });

    it('should always catch synchronous property errors and return null', () => {
      class FailPropertySync {
        @CatchError()
        get suck() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailPropertySync();

      expect(fail.suck).to.be.null;
    });

    it('should always catch asynchronous property errors and return null', async () => {
      class FailPropertyAsync {
        @CatchError()
        get suck() {
          return Promise.reject(new Error(`I am a failure`));
        }
      }

      const fail = new FailPropertyAsync();

      expect(await fail.suck).to.be.null;
    });
  });

  describe('Options', () => {
    it('should always catch synchronous method errors and return passed value', () => {
      const value = 'return on error';

      class FailMethodSync {
        @CatchError({ returnOnError: value })
        suck(): string {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodSync();

      expect(fail.suck()).to.equal(value);
    });

    it('should always catch asynchronous method errors and return null', async () => {
      const value = 'return on async error';

      class FailMethodAsync {
        @CatchError({ returnOnError: value })
        async suck(): Promise<string> {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodAsync();

      expect(await fail.suck()).to.equal(value);
    });

    it('should always catch synchronous property errors and return null', () => {
      const value = 'return on property error';

      class FailPropertySync {
        @CatchError({ returnOnError: value })
        get suck(): string {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailPropertySync();

      expect(fail.suck).to.equal(value);
    });

    it('should always catch asynchronous property errors and return null', async () => {
      const value = 'return on async property error';

      class FailPropertyAsync {
        @CatchError({ returnOnError: value })
        get suck(): Promise<string> {
          return Promise.reject(new Error(`I am a failure`));
        }
      }

      const fail = new FailPropertyAsync();

      expect(await fail.suck).to.equal(value);
    });

    it('should run on method errors', () => {
      const error = new Error(`I am a failure`);
      const returnOnError = `terrible`;
      const param = 'this is a test';

      const runOnError = sinon.spy((tryError: TryError) => {
        expect(tryError).to.be.an('object');
        expect(tryError.arguments).to.be.an('array');
        expect(tryError.arguments).to.have.lengthOf(1);
        expect(tryError.arguments[0]).to.equal(param);
        expect(tryError.property).to.equal('suck');
        expect(tryError.error).to.equal(error);
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        suck(_value: string): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.suck(param);

      expect(result).to.equal(returnOnError);

      sinon.assert.calledOnce(runOnError);
    });

    it('should run on property errors', () => {
      const error = new Error(`I am a failure`);
      const runOnErrorReturn = 'override';
      const returnOnError = `terrible`;

      const runOnError = sinon.spy((tryError: TryError) => {
        expect(tryError).to.be.an('object');
        expect(tryError.arguments).to.be.an('array');
        expect(tryError.arguments).to.have.lengthOf(0);
        expect(tryError.property).to.equal('suck');
        expect(tryError.error).to.equal(error);

        return runOnErrorReturn;
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        get suck(): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.suck;

      expect(result).to.equal(runOnErrorReturn);

      sinon.assert.calledOnce(runOnError);
    });
  });
});
