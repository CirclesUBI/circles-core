import Web3 from 'web3';

import getContracts from '~/common/contracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('Common module', () => {
  describe('contracts', () => {
    let contracts;

    beforeEach(() => {
      const web3 = new Web3();

      contracts = getContracts(web3, {
        gnosisSafeAddress: ZERO_ADDRESS,
        hubAddress: ZERO_ADDRESS,
        proxyFactoryAddress: ZERO_ADDRESS,
      });
    });

    it('should give us access to contracts', () => {
      expect(contracts.GnosisSafe.methods).toBeDefined();
      expect(contracts.Hub.methods).toBeDefined();
      expect(contracts.ProxyFactory.methods).toBeDefined();
      expect(contracts.Token.methods).toBeDefined();
    });

    it('should be able to interact with contract methods', () => {
      const { Hub } = contracts;
      const data = Hub.methods.signup('testToken').encodeABI();

      expect(data).toContain('0x');
    });
  });
});
