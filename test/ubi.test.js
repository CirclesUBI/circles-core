import createCore from './helpers/createCore';
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
    const safeCreationNonce = new Date().getTime();

    safeAddress = await core.safe.prepareDeploy(account, {
      nonce: safeCreationNonce,
    });

    // @TODO: Later we will pay our gas fees to the relayer in Circles Token.
    await web3.eth.sendTransaction({
      from: account.address,
      to: safeAddress,
      value: web3.utils.toWei('1', 'ether'),
    });

    await core.safe.deploy(account, {
      address: safeAddress,
    });

    // .. wait for Relayer to really deploy Safe
    await new Promise(resolve => setTimeout(resolve, 1000));
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
