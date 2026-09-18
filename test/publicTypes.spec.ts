import type { TryManager as TryManagerType } from '../src';
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
});
