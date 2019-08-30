import Web3 from 'web3';

import CirclesCore from '~';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('CirclesCore', () => {
  let core;

  beforeEach(() => {
    core = new CirclesCore({
      gnosisSafeAddress: ZERO_ADDRESS,
      hubAddress: ZERO_ADDRESS,
      proxyFactoryAddress: ZERO_ADDRESS,
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
