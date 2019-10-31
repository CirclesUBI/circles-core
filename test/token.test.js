import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

import createUtilsModule from '~/utils';
import { findTransitiveTransactionPath, getTrustNetwork } from '~/token';

let core;
let utils;

const accounts = [];
const safeAddresses = [];
const tokenAddresses = [];

beforeAll(async () => {
  new Array(5).fill({}).forEach((item, index) => {
    accounts.push(getAccount(index));
  });

  core = createCore();
  utils = createUtilsModule(web3, core.contracts, core.options);
});

async function deploy(account) {
  const safeAddress = await deploySafe(core, account);

  await core.token.signup(account, {
    safeAddress,
  });

  const tokenAddress = await core.token.getAddress(account, {
    safeAddress,
  });

  safeAddresses.push(safeAddress);
  tokenAddresses.push(tokenAddress);
}

async function trust([indexFrom, indexTo, limit]) {
  await core.trust.addConnection(accounts[indexFrom], {
    from: safeAddresses[indexFrom],
    to: safeAddresses[indexTo],
    limit,
  });
}

describe('Token', () => {
  beforeAll(async () => {
    // Deploy Safe and Token for each test account
    for (const account of accounts) {
      await deploy(account);
    }

    // Create trust connections
    const connections = [
      [0, 1, 25],
      [1, 0, 50],
      [1, 2, 10],
      [2, 1, 20],
      [2, 3, 5],
      [3, 2, 15],
      [3, 0, 25],
      [3, 4, 25],
      [4, 3, 15],
      [4, 1, 10],
    ];

    for (const connection of connections) {
      await trust(connection);
    }
  });

  it('should get the current balance', async () => {
    const balance = await core.token.getBalance(accounts[2], {
      safeAddress: safeAddresses[2],
      tokenAddress: tokenAddresses[2],
    });

    expect(web3.utils.isBN(balance)).toBe(true);
  });

  // @TODO Add negative tests
  it('should send Circles to someone transitively', async () => {
    const value = web3.utils.toBN('5');
    const indexFrom = 0;
    const indexTo = 4;

    const response = await core.token.transfer(accounts[indexFrom], {
      from: safeAddresses[indexFrom],
      to: safeAddresses[indexTo],
      value,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const accountBalance = await core.token.getBalance(accounts[indexFrom], {
      safeAddress: safeAddresses[indexFrom],
      tokenAddress: tokenAddresses[indexFrom],
    });

    const otherAccountBalance = await core.token.getBalance(accounts[indexTo], {
      safeAddress: safeAddresses[indexTo],
      tokenAddress: tokenAddresses[indexTo],
    });

    expect(otherAccountBalance).toMatchObject(value);

    const balance = accountBalance.toString();

    // Sometimes we receive different numbers from the relayer ..
    // @TODO Correct these numbers:
    const isCorrectBalance =
      balance === '99999999999999905259' || balance === '99999999999999905387';

    expect(isCorrectBalance).toBe(true);
  });

  describe('getNetwork', () => {
    it('should return the correct trust network', async () => {
      const network = await getTrustNetwork(web3, utils, {
        from: safeAddresses[0],
        to: safeAddresses[4],
        networkHops: 3,
      });

      const connection = network.find(({ from, to }) => {
        return from === safeAddresses[4] && to === safeAddresses[1];
      });

      expect(connection.limit).toBe(10);
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
});
