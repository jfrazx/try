import { TryCatch } from '../src';
import { Gambler } from './lib';
import { expect } from 'chai';

describe('TryCatch', () => {
  let gambler: Gambler;

  beforeEach(() => {
    gambler = new Gambler();
  });

  it('should be a function', () => {
    expect(TryCatch).to.be.a('function');
  });

  it('should decorate a class', () => {
    expect(gambler.try).to.be.an('object');
    expect(gambler.try.fail).to.be.a('function');
    expect(gambler.try.asyncFail).to.be.a('function');
  });
});
