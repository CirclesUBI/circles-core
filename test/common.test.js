import Web3 from 'web3';

import getContracts from '~/common/contracts';

describe('Common module', () => {
  describe('contracts', () => {
    let contracts;

    beforeEach(() => {
      const web3 = new Web3();
      contracts = getContracts(web3);
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
