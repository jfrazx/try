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
  it('should refuse to build a try map without the instance it belongs to', () => {
    const manager = gambler.getTryManager() as unknown as {
      getTryMap(receiver?: Gambler): unknown;
    };

    // reachable from getTryManager(), and silently answered null before
    expect(() => manager.getTryMap()).toThrow(
      '[TryError]: A try map needs the instance it was reached through',
    );
  });
});
