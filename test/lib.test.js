import CirclesCore from '~';

import createCore from './helpers/core';
import setupWeb3 from './helpers/setupWeb3';

describe('CirclesCore', () => {
  const { web3 } = setupWeb3();
  let core = createCore(web3);

  it('should be instantiable', () => {
    expect(core).toBeInstanceOf(CirclesCore);
  });

  it('should throw an error when missing options', () => {
    expect(() => {
      new CirclesCore({});
    }).toThrow(core.CoreError);
  });
});
