import { TryManager } from '../src/manager';
import { Gambler } from './lib/gambler';

describe('TryManager', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should retrieve the TryManager', () => {
    expect(gambler.getTryManager()).toBeInstanceOf(TryManager);
  });

  it('should always retrieve the same TryManager instance', () => {
    const gambler2 = new Gambler();

    expect(gambler.getTryManager()).toBe(gambler2.getTryManager());
  });
});
