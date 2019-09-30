import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

// This was set during Hub deployment:
const INITIAL_PAYOUT = 100;

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

describe('UBI', () => {
  beforeAll(async () => {
    safeAddress = await deploySafe(core, account);
    otherSafeAddress = await deploySafe(core, otherAccount);

    await core.ubi.signup(account, {
      safeAddress,
    });

    await core.ubi.signup(otherAccount, {
      safeAddress: otherSafeAddress,
    });
  });

  describe('when a user wants to interact with its Token', () => {
    let tokenAddress;

    beforeAll(async () => {
      tokenAddress = await core.ubi.getTokenAddress(account, {
        safeAddress,
      });
    });

    it('should be a valid contract address', async () => {
      expect(web3.eth.getCode(tokenAddress)).not.toBe('0x');
    });

    it('should get the initial payout balance', async () => {
      const balance = await core.ubi.getBalance(account, {
        address: safeAddress,
        tokenAddress,
      });

      expect(parseInt(balance, 10)).toBe(INITIAL_PAYOUT);
    });

    it('should send Circles to someone', async () => {
      const value = 20;

      await core.ubi.transfer(account, {
        from: safeAddress,
        to: otherSafeAddress,
        value,
      });

      const accountBalance = await core.ubi.getBalance(account, {
        address: safeAddress,
        tokenAddress,
      });

      const otherAccountBalance = await core.ubi.getBalance(account, {
        address: otherSafeAddress,
        tokenAddress,
      });

      expect(parseInt(otherAccountBalance, 10)).toBe(value);
      expect(parseInt(accountBalance, 10)).toBe(INITIAL_PAYOUT - value);
    });
  });
});
