import Web3 from 'web3';

import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';
import { ZERO_ADDRESS } from '~/common/constants';

describe('Common', () => {
  describe('checkOptions', () => {
    it('should only return required options', () => {
      const result = checkOptions(
        {
          optionA: 200,
          optionB: 100,
          optionC: 'not needed',
        },
        ['optionA', 'optionB'],
      );

      expect(result).toStrictEqual({
        optionA: 200,
        optionB: 100,
      });
    });

    it('should throw an error when an option is missing', () => {
      expect(() => {
        checkOptions(
          {
            optionB: 100,
          },
          ['optionA'],
        );
      }).toThrow();
    });
  });

  describe('getContracts', () => {
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
