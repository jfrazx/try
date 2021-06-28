import { TryManager } from '../src/manager';
import { Gambler } from './lib';
import { expect } from 'chai';

describe('TryManager', () => {
  it('should retrieve the TryManager', () => {
    const gambler = new Gambler();

    expect(gambler.getTryManager()).to.be.instanceOf(TryManager);
  });
});
