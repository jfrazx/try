import { CatchError, TryError } from '../src';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('CatchError', () => {
  describe('Standard', () => {
    it('should always catch synchronous method errors and return null', () => {
      class FailMethodSync {
        @CatchError()
        sad() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodSync();

      expect(fail.sad()).to.be.null;
    });

    it('should always catch asynchronous method errors and return null', async () => {
      class FailMethodAsync {
        @CatchError()
        async sad() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodAsync();

      expect(await fail.sad()).to.be.null;
    });

    it('should always catch synchronous property errors and return null', () => {
      class FailPropertySync {
        @CatchError()
        get sad() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailPropertySync();

      expect(fail.sad).to.be.null;
    });

    it('should always catch asynchronous property errors and return null', async () => {
      class FailPropertyAsync {
        @CatchError()
        get sad() {
          return Promise.reject(new Error(`I am a failure`));
        }
      }

      const fail = new FailPropertyAsync();

      expect(await fail.sad).to.be.null;
    });
  });

  describe('Options', () => {
    it('should always catch synchronous method errors and return passed value', () => {
      const value = 'return on error';

      class FailMethodSync {
        @CatchError({ returnOnError: value })
        sad(): string {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodSync();

      expect(fail.sad()).to.equal(value);
    });

    it('should always catch asynchronous method errors and return null', async () => {
      const value = 'return on async error';

      class FailMethodAsync {
        @CatchError({ returnOnError: value })
        async sad(): Promise<string> {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodAsync();

      expect(await fail.sad()).to.equal(value);
    });

    it('should always catch synchronous property errors and return null', () => {
      const value = 'return on property error';

      class FailPropertySync {
        @CatchError({ returnOnError: value })
        get sad(): string {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailPropertySync();

      expect(fail.sad).to.equal(value);
    });

    it('should always catch asynchronous property errors and return null', async () => {
      const value = 'return on async property error';

      class FailPropertyAsync {
        @CatchError({ returnOnError: value })
        get sad(): Promise<string> {
          return Promise.reject(new Error(`I am a failure`));
        }
      }

      const fail = new FailPropertyAsync();

      expect(await fail.sad).to.equal(value);
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
        expect(tryError.property).to.equal('sad');
        expect(tryError.error).to.equal(error);
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        sad(_value: string): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.sad(param);

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
        expect(tryError.property).to.equal('sad');
        expect(tryError.error).to.equal(error);

        return runOnErrorReturn;
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        get sad(): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.sad;

      expect(result).to.equal(runOnErrorReturn);

      sinon.assert.calledOnce(runOnError);
    });
  });
});
