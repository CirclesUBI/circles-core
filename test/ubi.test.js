import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

// This was set during Hub deployment:
const INITIAL_PAYOUT = 100;

let account;
let core;
let safeAddress;

beforeAll(async () => {
  account = getAccount();
  core = createCore();
});

describe('UBI', () => {
  beforeAll(async () => {
    safeAddress = await deploySafe(core, account);
  });

  describe('when a new user joins Circles', () => {
    it('should deploy an own Token', async () => {
      await core.ubi.signup(account, {
        safeAddress,
      });
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
        safeAddress,
        tokenAddress,
      });

      expect(parseInt(balance, 10)).toBe(INITIAL_PAYOUT);
    });
  });
});
