import { TryManager } from '../src/manager';
import { Gambler } from './lib';
import { expect } from 'chai';

describe('TryManager', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should retrieve the TryManager', () => {
    expect(gambler.getTryManager()).to.be.instanceOf(TryManager);
  });

  it('should always retrieve the same TryManager instance', () => {
    const gambler2 = new Gambler();

    expect(gambler.getTryManager()).to.equal(gambler2.getTryManager());
  });
});
