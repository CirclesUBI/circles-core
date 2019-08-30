import Web3 from 'web3';

import CirclesCore from '~';

describe('CirclesCore', () => {
  let core;

  beforeEach(() => {
    core = new CirclesCore({
      web3: new Web3(),
    });
  });

  it('should be instantiable', () => {
    expect(core).toBeInstanceOf(CirclesCore);
  });

  it('should throw an error when missing options', () => {
    expect(() => {
      new CirclesCore({});
    }).toThrow();
  });
});
