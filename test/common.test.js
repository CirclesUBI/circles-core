import Web3 from 'web3';

import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';
import { ZERO_ADDRESS } from '~/common/constants';

describe('Common', () => {
  describe('checkOptions', () => {
    it('should only return given fields', () => {
      const result = checkOptions(
        {
          optionA: 200,
          optionB: 100,
          optionC: 'not needed',
        },
        {
          optionA: {
            type: 'number',
          },
          optionB: {
            type: 'number',
          },
        },
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
          {
            optionA: null,
          },
        );
      }).toThrow();
    });

    it('should throw an error when an option was passed with a wrong type', () => {
      expect(() => {
        checkOptions(
          {
            optionB: 100,
          },
          {
            optionB: {
              type: 'string',
            },
          },
        );
      }).toThrow();
    });

    it('should fall back to default values when none were given', () => {
      const result = checkOptions(
        {
          optionA: 200,
        },
        {
          optionA: {
            type: 'number',
            default: 400,
          },
          optionB: {
            type: 'number',
            default: 300,
          },
        },
      );

      expect(result).toStrictEqual({
        optionA: 200,
        optionB: 300,
      });
    });

    it('should accept custom functions as validators', () => {
      const web3 = new Web3();

      const result = checkOptions(
        {
          optionA: ZERO_ADDRESS,
        },
        {
          optionA: {
            type: web3.utils.isHexStrict,
          },
        },
      );

      expect(result).toStrictEqual({
        optionA: ZERO_ADDRESS,
      });
    });
  });

  describe('getContracts', () => {
    let contracts;

    beforeEach(() => {
      const web3 = new Web3();

      contracts = getContracts(web3, {
        hubAddress: ZERO_ADDRESS,
        proxyFactoryAddress: ZERO_ADDRESS,
        safeMasterAddress: ZERO_ADDRESS,
      });
    });

    it('should give us access to contracts', () => {
      expect(contracts.safeMaster.methods).toBeDefined();
      expect(contracts.hub.methods).toBeDefined();
      expect(contracts.proxyFactory.methods).toBeDefined();
    });

    it('should be able to interact with contract methods', () => {
      const { hub } = contracts;
      const data = hub.methods.signup('testToken').encodeABI();

      expect(data).toContain('0x');
    });
  });
});
