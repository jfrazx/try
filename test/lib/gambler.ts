import { TryCatch, Try, TryCatchExtension } from '../../src';

export interface Gambler
  extends TryCatchExtension<
    Gambler,
    | 'fail'
    | 'failOptions'
    | 'asyncFail'
    | 'asyncFailOptions'
    | 'test'
    | 'success'
    | 'successAsync'
    | 'successUndefined'
  > {}

@TryCatch<Gambler>()
export class Gambler {
  @Try()
  fail() {
    throw new Error(`This should fail`);
  }

  @Try({ returnOnError: 'fail with options' })
  failOptions(): string {
    throw new Error(`This should fail`);
  }

  @Try()
  async asyncFail(): Promise<string> {
    throw new Error(`This should fail async`);
  }

  @Try({ returnOnError: 'fail with options' })
  async asyncFailOptions(): Promise<string> {
    throw new Error(`This should fail async`);
  }

  @Try()
  get test(): string {
    throw new Error(`This should fail property accessor`);
  }

  @Try()
  async successAsync() {
    return 'success';
  }

  @Try()
  success() {
    return 'success';
  }

  @Try()
  successUndefined() {}
}
