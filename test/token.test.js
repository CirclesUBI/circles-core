import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

// This was set during Hub deployment:
const INITIAL_PAYOUT = web3.utils.toBN('100000000000000000000');

let account;
let otherAccount;
let core;
let safeAddress;
let otherSafeAddress;

beforeAll(async () => {
  account = getAccount();
  otherAccount = getAccount(5);
  core = createCore();
});

describe('Token', () => {
  beforeAll(async () => {
    safeAddress = await deploySafe(core, account);
    otherSafeAddress = await deploySafe(core, otherAccount);

    await core.token.signup(account, {
      safeAddress,
    });

    await core.token.signup(otherAccount, {
      safeAddress: otherSafeAddress,
    });
  });

  describe('when a user wants to interact with its Token', () => {
    let tokenAddress;

    beforeAll(async () => {
      tokenAddress = await core.token.getAddress(account, {
        safeAddress,
      });
    });

    it('should be a valid contract address', async () => {
      expect(web3.eth.getCode(tokenAddress)).not.toBe('0x');
    });

    it('should get the initial payout balance', async () => {
      const balance = await core.token.getBalance(account, {
        safeAddress,
        tokenAddress,
      });

      expect(web3.utils.toBN(balance)).toMatchObject(INITIAL_PAYOUT);
    });

    it('should send Circles to someone', async () => {
      const value = web3.utils.toBN('20');

      await core.token.transfer(account, {
        from: safeAddress,
        to: otherSafeAddress,
        value,
      });

      const accountBalance = await core.token.getBalance(account, {
        safeAddress,
        tokenAddress,
      });

      const otherAccountBalance = await core.token.getBalance(account, {
        safeAddress: otherSafeAddress,
        tokenAddress,
      });

      expect(web3.utils.toBN(otherAccountBalance)).toMatchObject(value);
      expect(web3.utils.toBN(accountBalance).toString()).toBe(
        '99999999999999905259',
      );
    });
  });
});
