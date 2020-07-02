import { RequestError } from '~/common/error';
import { getSafeContract } from '~/common/getContracts';

import { deploySafe } from './helpers/transactions';
import createCore from './helpers/core';
import getAccount from './helpers/account';
import web3 from './helpers/web3';

let account;
let core;
let otherAccount;
let safe;
let safeAddress;

beforeAll(async () => {
  account = getAccount();
  otherAccount = getAccount(2);
  core = createCore();
});

describe('Utils', () => {
  beforeEach(async () => {
    safeAddress = await deploySafe(core, account);
    safe = getSafeContract(web3, safeAddress);
  });

  describe('estimateTransactionCosts', () => {
    it('should return the total gas fees of an transaction', async () => {
      const txData = safe.methods
        .addOwnerWithThreshold(otherAccount.address, 1)
        .encodeABI();

      const gasCosts = await core.utils.estimateTransactionCosts(account, {
        safeAddress,
        to: safeAddress,
        txData,
      });

      expect(web3.utils.isBN(gasCosts)).toBe(true);
      expect(gasCosts.isZero()).toBe(false);
    });
  });

  describe('executeSafeTx', () => {
    it('should send a transaction to the relayer', async () => {
      const txData = safe.methods
        .addOwnerWithThreshold(otherAccount.address, 1)
        .encodeABI();

      const txHash = await core.utils.executeSafeTx(account, {
        safeAddress,
        to: safeAddress,
        txData,
      });

      expect(web3.utils.isHexStrict(txHash)).toBe(true);
    });

    it('should unqueue failed transactions from the TransactionQueue', async () => {
      expect.assertions(2);

      // Do an invalid transaction: We can't set the
      // threshold to 0 for owners ...
      let txData = safe.methods
        .addOwnerWithThreshold(otherAccount.address, 0)
        .encodeABI();

      try {
        await core.utils.executeSafeTx(account, {
          safeAddress,
          to: safeAddress,
          txData,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError);
      }

      // The following (correct) transaction should just
      // work and not be stuck because of an previous failed
      // transaction loop!
      txData = safe.methods
        .addOwnerWithThreshold(otherAccount.address, 1)
        .encodeABI();

      const txHash = await core.utils.executeSafeTx(account, {
        safeAddress,
        to: safeAddress,
        txData,
      });

      expect(web3.utils.isHexStrict(txHash)).toBe(true);
    });
  });
});
