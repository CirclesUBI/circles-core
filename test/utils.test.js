import { deploySafe } from './helpers/transactions';
import createCore from './helpers/core';
import getAccounts from './helpers/getAccounts';
import setupWeb3 from './helpers/setupWeb3';
import generateSaltNonce from './helpers/generateSaltNonce';
import onboardAccountManually from './helpers/onboardAccountManually';
import { getSafeContract } from '~/common/getContracts';

describe('Utils', () => {
  const { web3, provider } = setupWeb3();
  const core = createCore(web3);
  const [account, otherAccount] = getAccounts(web3);
  let safeAddress;
  let onboardedAccount;
  let safe;

  afterAll(() => provider.engine.stop());
  beforeEach(async () => {
    // Predeploy manually an account (safe and token)
    onboardedAccount = await onboardAccountManually(
      { account: account, nonce: generateSaltNonce() },
      core,
    );
    safeAddress = onboardedAccount.safeAddress;
  });

  beforeEach(async () => {
    safeAddress = await deploySafe(core, account);
    safe = getSafeContract(web3, safeAddress);
  });

  describe('matchAddress', () => {
    it('should find a valid ethereum address in a string', () => {
      expect(
        core.utils.matchAddress(
          'Hello, this is an address somewhere 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1here.',
        ),
      ).toBe('0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1');

      expect(
        core.utils.matchAddress(
          'Hello, this is not a valid address 0x90F8bf6A479d074411a4B0e7944Ea8c9C1here.',
        ),
      ).toBe(null);
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
  });
});
