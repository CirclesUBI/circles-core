import { ethers } from 'ethers';

import ethProvider from './helpers/ethProvider';
import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';
import parameterize from '~/common/parameterize';
import { ZERO_ADDRESS } from '~/common/constants';

describe('Common', () => {
  describe('parameterize', () => {
    it('should parse arrays correctly', () => {
      expect(
        parameterize({
          address: [],
          username: ['test', 'test2'],
        }),
      ).toEqual('?username[]=test&username[]=test2');
    });
  });

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
      const result = checkOptions(
        {
          optionA: ZERO_ADDRESS,
        },
        {
          optionA: {
            type: ethers.utils.isHexString,
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
      contracts = getContracts(ethProvider, {
        hubAddress: ZERO_ADDRESS,
        proxyFactoryAddress: ZERO_ADDRESS,
        safeMasterAddress: ZERO_ADDRESS,
      });
    });

    it('should give us access to contracts', () => {
      expect(contracts.safeMaster).toBeDefined();
      expect(contracts.hub).toBeDefined();
      expect(contracts.proxyFactory).toBeDefined();
    });

    it('should be able to interact with contract methods', () =>
      contracts.hub.populateTransaction
        .signup()
        .then(({ data }) => expect(data).toContain('0x')));
  });
});
