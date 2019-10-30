import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

import { findTransitiveTransactionPath } from '~/token';

// This was set during Hub deployment:
const INITIAL_PAYOUT = web3.utils.toBN(web3.utils.toWei('100', 'ether'));

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

    const response = await core.token.signup(account, {
      safeAddress,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

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

      const response = await core.token.transfer(account, {
        from: safeAddress,
        to: otherSafeAddress,
        value,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const accountBalance = await core.token.getBalance(account, {
        safeAddress,
        tokenAddress,
      });

      const otherAccountBalance = await core.token.getBalance(account, {
        safeAddress: otherSafeAddress,
        tokenAddress,
      });

      expect(web3.utils.toBN(otherAccountBalance)).toMatchObject(value);

      const balance = web3.utils.toBN(accountBalance).toString();

      // Sometimes we receive different numbers from the relayer ..
      const isCorrectBalance =
        balance === '99999999999999905259' ||
        balance === '99999999999999905387';

      expect(isCorrectBalance).toBe(true);
    });
  });
});

describe('findTransitiveTransactionPath', () => {
  const NUM_NODES = 8;
  const INDEX_SENDER = 0;
  const INDEX_RECEIVER = 7;

  let nodes;
  let network;

  beforeEach(() => {
    nodes = new Array(NUM_NODES).fill('').map(() => {
      return web3.utils.toChecksumAddress(web3.utils.randomHex(20));
    });

    network = [
      { from: nodes[0], to: nodes[1], limit: 10 },
      { from: nodes[0], to: nodes[2], limit: 5 },
      { from: nodes[0], to: nodes[3], limit: 15 },
      { from: nodes[1], to: nodes[4], limit: 9 },
      { from: nodes[1], to: nodes[5], limit: 15 },
      { from: nodes[1], to: nodes[2], limit: 4 },
      { from: nodes[2], to: nodes[5], limit: 8 },
      { from: nodes[2], to: nodes[3], limit: 4 },
      { from: nodes[3], to: nodes[6], limit: 16 },
      { from: nodes[4], to: nodes[5], limit: 15 },
      { from: nodes[4], to: nodes[7], limit: 10 },
      { from: nodes[5], to: nodes[7], limit: 10 },
      { from: nodes[5], to: nodes[6], limit: 15 },
      { from: nodes[6], to: nodes[2], limit: 6 },
      { from: nodes[6], to: nodes[7], limit: 10 },
    ];
  });

  it('should fail when max-flow is too small', () => {
    const value = new web3.utils.BN(100);

    expect(() => {
      findTransitiveTransactionPath(web3, {
        from: nodes[INDEX_SENDER],
        to: nodes[INDEX_RECEIVER],
        value,
        network,
      });
    }).toThrow();
  });

  it('should successfully transfer an value transitively', () => {
    for (let i = 0; i < 10; i += 1) {
      const value = 1 + Math.round(Math.random() * 27);

      const path = findTransitiveTransactionPath(web3, {
        from: nodes[INDEX_SENDER],
        to: nodes[INDEX_RECEIVER],
        value: new web3.utils.BN(value),
        network,
      });

      // Simulate transaction
      const balances = new Array(NUM_NODES).fill(0);
      balances[INDEX_SENDER] = value;

      path.forEach(transaction => {
        const indexFrom = nodes.indexOf(transaction.from);
        const indexTo = nodes.indexOf(transaction.to);

        balances[indexFrom] -= transaction.value.toNumber();
        balances[indexTo] += transaction.value.toNumber();
      });

      expect(balances[INDEX_RECEIVER]).toBe(value);
    }
  });
});
