import Web3 from 'web3';

import CirclesCore from '~';

describe('CirclesCore', () => {
  let core;

  beforeEach(() => {
    core = new CirclesCore({
      web3: new Web3(),
    });
  });

  it('is instantiable', () => {
    expect(core).toBeInstanceOf(CirclesCore);
  });
});
