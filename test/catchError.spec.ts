import { CatchError, TryError } from '../src';

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

      expect(fail.sad()).toBeNull();
    });

    it('should always catch asynchronous method errors and return null', async () => {
      class FailMethodAsync {
        @CatchError()
        async sad() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailMethodAsync();

      expect(await fail.sad()).toBeNull();
    });

    it('should always catch synchronous property errors and return null', () => {
      class FailPropertySync {
        @CatchError()
        get sad() {
          throw new Error(`I am a failure`);
        }
      }

      const fail = new FailPropertySync();

      expect(fail.sad).toBeNull();
    });

    it('should always catch asynchronous property errors and return null', async () => {
      class FailPropertyAsync {
        @CatchError()
        get sad() {
          return Promise.reject(new Error(`I am a failure`));
        }
      }

      const fail = new FailPropertyAsync();

      expect(await fail.sad).toBeNull();
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

      expect(fail.sad()).toBe(value);
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

      expect(await fail.sad()).toBe(value);
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

      expect(fail.sad).toBe(value);
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

      expect(await fail.sad).toBe(value);
    });

    it('should run on method errors', () => {
      const error = new Error(`I am a failure`);
      const returnOnError = `terrible`;
      const param = 'this is a test';

      const runOnError = jest.fn((tryError: TryError) => {
        expect(typeof tryError).toBe('object');
        expect(Array.isArray(tryError.arguments)).toBe(true);
        expect(tryError.arguments).toHaveLength(1);
        expect(tryError.arguments[0]).toBe(param);
        expect(tryError.property).toBe('sad');
        expect(tryError.error).toBe(error);
      });

      class FailMethodSyncRunOnError {
        @CatchError({ runOnError, returnOnError })
        sad(_value: string): string {
          throw error;
        }
      }

      const fail = new FailMethodSyncRunOnError();
      const result = fail.sad(param);

      expect(result).toBe(returnOnError);

      expect(runOnError).toHaveBeenCalledTimes(1);
    });

    it('should run on property errors', () => {
      const error = new Error(`I am a failure`);
      const runOnErrorReturn = 'override';
      const returnOnError = `terrible`;

      const runOnError = jest.fn((tryError: TryError) => {
        expect(typeof tryError).toBe('object');
        expect(Array.isArray(tryError.arguments)).toBe(true);
        expect(tryError.arguments).toHaveLength(0);
        expect(tryError.property).toBe('sad');
        expect(tryError.error).toBe(error);

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

      expect(result).toBe(runOnErrorReturn);

      expect(runOnError).toHaveBeenCalledTimes(1);
    });
  });
});
