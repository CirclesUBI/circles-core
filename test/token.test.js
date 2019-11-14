import createUtilsModule from '~/utils';
import { findTransitiveTransactions, getNetwork } from '~/token';

import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop, { isReady } from './helpers/loop';
import web3 from './helpers/web3';
import { deploySafeAndToken, addTrustConnection } from './helpers/transactions';

let core;
let utils;

const accounts = [];
const safeAddresses = [];
const tokenAddresses = [];

beforeAll(async () => {
  new Array(6).fill({}).forEach((item, index) => {
    accounts.push(getAccount(index));
  });

  core = createCore();
  utils = createUtilsModule(web3, core.contracts, core.options);
});

describe('Token', () => {
  beforeAll(async () => {
    // Deploy Safe and Token for each test account
    for (const account of accounts) {
      const { safeAddress, tokenAddress } = await deploySafeAndToken(
        core,
        account,
      );

      safeAddresses.push(safeAddress);
      tokenAddresses.push(tokenAddress);
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
      [2, 5, 50], // Unidirectional
    ];

    for (const connection of connections) {
      await addTrustConnection(core, accounts[connection[0]], {
        from: safeAddresses[connection[0]],
        to: safeAddresses[connection[1]],
        limitPercentage: connection[2],
      });
    }
  });

  it('should get the current balance', async () => {
    const balance = await core.token.getBalance(accounts[5], {
      safeAddress: safeAddresses[5],
    });

    // It should be equals the initial UBI payout
    // which was set during Hub contract deployment:
    expect(balance).toMatchObject(
      new web3.utils.BN(core.utils.toFreckles(100)),
    );
  });

  it('should send Circles to someone directly', async () => {
    const value = web3.utils.toBN(core.utils.toFreckles(5));

    // Unidirectional trust relationship from 2 to 5
    const indexFrom = 5;
    const indexTo = 2;

    // Transfer from 5 to 2
    const response = await core.token.transfer(accounts[indexFrom], {
      from: safeAddresses[indexFrom],
      to: safeAddresses[indexTo],
      value,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);
  });

  it('should send Circles to someone transitively', async () => {
    const value = web3.utils.toBN(core.utils.toFreckles(5));
    const indexFrom = 0;
    const indexTo = 4;

    const response = await core.token.transfer(accounts[indexFrom], {
      from: safeAddresses[indexFrom],
      to: safeAddresses[indexTo],
      value,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const accountBalance = await loop(
      () => {
        return core.token.getBalance(accounts[indexFrom], {
          safeAddress: safeAddresses[indexFrom],
        });
      },
      balance => balance.toString().slice(0, 2) === '94',
    );

    const otherAccountBalance = await core.token.getBalance(accounts[indexTo], {
      safeAddress: safeAddresses[indexTo],
    });

    expect(otherAccountBalance.toString().slice(0, 3)).toBe('104');
    expect(accountBalance.toString().slice(0, 2)).toBe('94');
  });

  it('should fail sending Circles when there is no path', async () => {
    // Max flow is smaller than the given transfer value.
    await expect(
      core.token.transfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value: web3.utils.toBN(core.utils.toFreckles('100')),
      }),
    ).rejects.toThrow();

    // Trust connection does not exist between
    // node 0 and 5
    await expect(
      core.token.transfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[5],
        value: web3.utils.toBN('1'),
      }),
    ).rejects.toThrow();
  });

  describe('getNetwork', () => {
    it('should return the correct trust network', async () => {
      const connection = await loop(async () => {
        const network = await getNetwork(web3, utils, {
          from: safeAddresses[0],
          to: safeAddresses[4],
          networkHops: 3,
        });

        return network.find(({ from, to }) => {
          return from === safeAddresses[2] && to === safeAddresses[1];
        });
      }, isReady);

      expect(connection.limit).toBe(core.utils.toFreckles(10));
    });
  });

  describe('findTransitiveTransactions', () => {
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

      network.map(connection => {
        connection.limit = web3.utils.toBN(
          core.utils.toFreckles(connection.limit),
        );

        connection.tokenAddress = web3.utils.toChecksumAddress(
          web3.utils.randomHex(20),
        );

        return connection;
      });
    });

    it('should fail when max-flow is too small', () => {
      const value = new web3.utils.BN(core.utils.toFreckles(100));

      expect(() => {
        findTransitiveTransactions(web3, core.utils, {
          from: nodes[INDEX_SENDER],
          to: nodes[INDEX_RECEIVER],
          value,
          network,
        });
      }).toThrow();
    });

    it('should successfully find a path', () => {
      for (let i = 0; i < 10; i += 1) {
        const value = 1 + Math.round(Math.random() * 27);

        const path = findTransitiveTransactions(web3, core.utils, {
          from: nodes[INDEX_SENDER],
          to: nodes[INDEX_RECEIVER],
          value: new web3.utils.BN(core.utils.toFreckles(value)),
          network,
        });

        // Simulate transaction
        const balances = new Array(NUM_NODES).fill(0);
        balances[INDEX_SENDER] = value;

        path.forEach(transaction => {
          const indexFrom = nodes.indexOf(transaction.from);
          const indexTo = nodes.indexOf(transaction.to);

          balances[indexFrom] -= core.utils.fromFreckles(transaction.value);
          balances[indexTo] += core.utils.fromFreckles(transaction.value);
        });

        expect(balances[INDEX_RECEIVER]).toBe(value);
      }
    });
  });
});
