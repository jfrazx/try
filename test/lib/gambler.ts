import { TryCatch, Try, TryProperties } from '../../src';

export interface Gambler {
  try: TryProperties<Gambler, keyof Gambler>;
}

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
}
