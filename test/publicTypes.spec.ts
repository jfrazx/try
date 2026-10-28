import type { TryFn, TryManager as TryManagerType } from '../src';
import { tryFn } from '../src';
import { Gambler, type GamblerProps } from './lib/gambler';
import { TryManager } from '../src/manager';

describe('public type surface', () => {
  it('should expose TryManager as a nameable type from the package entry point', () => {
    const gambler = new Gambler();

    // the annotation is the whole assertion: it only compiles while '../src'
    // exports the TryManager *type*, which is the gap #27 closed. The
    // instanceof below is a sanity check on the fixture, not on the public
    // surface -- the class is imported from a deep path that `exports` does
    // not publish, and #27 deliberately exported the type alone.
    const manager: TryManagerType<Gambler, keyof GamblerProps> =
      gambler.getTryManager();

    expect(manager).toBeInstanceOf(TryManager);
  });

  it('should type tryFn with TryFn and keep overloads', () => {
    function pick(x: string): string;
    function pick(x: number): number;
    function pick(x: any) {
      return x;
    }

    const safe: TryFn<typeof pick> = tryFn(pick);
    const s: string = safe.try('a');
    const n: number = safe.try(1);

    expect([s, n]).toEqual(['a', 1]);
  });

  it('should not accept a class', () => {
    // the directive is the assertion: it fails to compile if a class is ever
    // accepted
    // @ts-expect-error a class has no call signature
    const wrapped = tryFn(class {});

    expect(wrapped).toBeDefined();
  });
});
