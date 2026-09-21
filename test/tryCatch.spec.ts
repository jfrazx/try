import { Gambler } from './lib/gambler';
import { TryCatch } from '../src';

describe('TryCatch', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should be a function', () => {
    expect(typeof TryCatch).toBe('function');
  });

  it('should decorate a class', () => {
    expect(typeof gambler.try).toBe('object');
    expect(typeof gambler.try.fail).toBe('function');
    expect(typeof gambler.try.asyncFail).toBe('function');
  });
});
