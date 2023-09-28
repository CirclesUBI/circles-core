import setupWeb3 from './helpers/setupWeb3';
import TransactionQueue from '~/common/queue';
import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';
import parameterize from '~/common/parameterize';
import { ZERO_ADDRESS } from '~/common/constants';
import { signTypedData } from '~/common/typedData';

describe('Common', () => {
  const { web3 } = setupWeb3();
  describe('signTypedData', () => {
    it('should hash typed data according to EIP 712', () => {
      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
          ],
          Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
          ],
        },
        primaryType: 'Mail',
        domain: {
          name: 'Ether Mail',
          version: '1',
          chainId: 1,
          verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
          from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
          },
          to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
          },
          contents: 'Hello, Bob!',
        },
      };

      const privateKey = web3.utils.keccak256('cow');
      const { v, r, s } = signTypedData(web3, privateKey, typedData);

      expect(v).toBe(28);

      expect(r).toBe(
        '30456498978348419035113697096786286190221642508076327013477434142925027351709',
      );

      expect(s).toBe(
        '3239688114989807171223523113163838721254638492728567579547907301252041086306',
      );
    });
  });

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
      const data = hub.methods.signup().encodeABI();
      expect(data).toContain('0x');
    });
  });

  describe('TransactionQueue', () => {
    let transactionQueue;
    let ticketId1;
    let ticketId2;
    let ticketId3;

    beforeEach(() => {
      transactionQueue = new TransactionQueue();

      ticketId1 = transactionQueue.queue('panda');
      ticketId2 = transactionQueue.queue('panda');
      ticketId3 = transactionQueue.queue('panda');
    });

    it('should give every queued task an unique ticket number', () => {
      expect([ticketId2, ticketId3]).not.toContain(ticketId1);
    });

    it('should be a queue following a LIFO logic', () => {
      expect(() => transactionQueue.unqueue('panda', ticketId1)).not.toThrow();
      expect(() => transactionQueue.unqueue('panda', ticketId3)).toThrow();
      expect(() => transactionQueue.unqueue('panda', ticketId2)).not.toThrow();
    });

    it('should tell us if the task is ready to get executed', () => {
      expect(transactionQueue.isNextInQueue('panda', ticketId1)).toBe(true);
      expect(transactionQueue.isNextInQueue('panda', ticketId2)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId3)).toBe(false);

      transactionQueue.unqueue('panda', ticketId1);
      expect(transactionQueue.isNextInQueue('panda', ticketId1)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId2)).toBe(true);
      expect(transactionQueue.isNextInQueue('panda', ticketId3)).toBe(false);

      transactionQueue.unqueue('panda', ticketId2);
      expect(transactionQueue.isNextInQueue('panda', ticketId1)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId2)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId3)).toBe(true);

      transactionQueue.unqueue('panda', ticketId3);
      expect(transactionQueue.isNextInQueue('panda', ticketId1)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId2)).toBe(false);
      expect(transactionQueue.isNextInQueue('panda', ticketId3)).toBe(false);
    });

    it('should lock keys with data attached', () => {
      transactionQueue.lockTransaction('lala', { someData: 12345 });

      expect(transactionQueue.getCurrentTransaction('lala').someData).toBe(
        12345,
      );
    });

    it('should lock and unlock keys', () => {
      expect(transactionQueue.isLocked('baba')).toBe(false);

      transactionQueue.lockTransaction('lala', { data: 123 });
      expect(transactionQueue.isLocked('lala')).toBe(true);

      transactionQueue.unlockTransaction('lala');
      expect(transactionQueue.isLocked('lala')).toBe(false);
    });

    it('should fail when trying to lock an already locked key', () => {
      expect(() =>
        transactionQueue.lockTransaction('panda', { haha: 'huhu' }),
      ).not.toThrow();

      expect(() =>
        transactionQueue.lockTransaction('panda', { haha: 'huhu' }),
      ).toThrow();
    });
  });
});
