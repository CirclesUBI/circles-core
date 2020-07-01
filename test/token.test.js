import { getTokenContract } from '~/common/getContracts';

import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop, { isReady } from './helpers/loop';
import web3 from './helpers/web3';
import { deploySafeAndToken, addTrustConnection } from './helpers/transactions';

let core;

const accounts = [];
const safeAddresses = [];
const tokenAddresses = [];

beforeAll(async () => {
  new Array(6).fill({}).forEach((item, index) => {
    accounts.push(getAccount(index));
  });

  core = createCore();
});

describe('Token', () => {
  beforeAll(async () => {
    // Deploy Safe and Token for each test account
    const tasks = accounts.map((account) => {
      return deploySafeAndToken(core, account);
    });

    const results = await Promise.all(tasks);

    results.forEach((result) => {
      const { safeAddress, tokenAddress } = result;

      safeAddresses.push(safeAddress);
      tokenAddresses.push(tokenAddress);
    });

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

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const connectionTasks = connections.map((connection) => {
      return addTrustConnection(core, accounts[connection[0]], {
        user: safeAddresses[connection[1]],
        canSendTo: safeAddresses[connection[0]],
        limitPercentage: connection[2],
      });
    });

    await Promise.all(connectionTasks);
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
      (balance) => balance.toString().slice(0, 2) === '94',
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
        const network = await core.token.getNetwork({
          from: safeAddresses[0],
          to: safeAddresses[4],
          networkHops: 3,
        });

        return network.find(({ from, to }) => {
          return from === safeAddresses[2] && to === safeAddresses[1];
        });
      }, isReady);

      expect(connection.tokenOwnerAddress).toBe(safeAddresses[2]);
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
        { from: nodes[0], to: nodes[1], capacity: 10 },
        { from: nodes[0], to: nodes[2], capacity: 5 },
        { from: nodes[0], to: nodes[3], capacity: 15 },
        { from: nodes[1], to: nodes[4], capacity: 9 },
        { from: nodes[1], to: nodes[5], capacity: 15 },
        { from: nodes[1], to: nodes[2], capacity: 4 },
        { from: nodes[2], to: nodes[5], capacity: 8 },
        { from: nodes[2], to: nodes[3], capacity: 4 },
        { from: nodes[3], to: nodes[6], capacity: 16 },
        { from: nodes[4], to: nodes[5], capacity: 15 },
        { from: nodes[4], to: nodes[7], capacity: 10 },
        { from: nodes[5], to: nodes[7], capacity: 10 },
        { from: nodes[5], to: nodes[6], capacity: 15 },
        { from: nodes[6], to: nodes[2], capacity: 6 },
        { from: nodes[6], to: nodes[7], capacity: 10 },
      ];

      network.map((connection) => {
        connection.capacity = web3.utils.toBN(
          core.utils.toFreckles(connection.capacity),
        );

        connection.tokenOwnerAddress = web3.utils.toChecksumAddress(
          web3.utils.randomHex(20),
        );

        return connection;
      });
    });

    it('should fail when max-flow is too small', () => {
      const value = new web3.utils.BN(core.utils.toFreckles(100));

      expect(() => {
        core.tolen.findTransitiveTransactions({
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

        const path = core.token.findTransitiveTransactions({
          from: nodes[INDEX_SENDER],
          to: nodes[INDEX_RECEIVER],
          value: new web3.utils.BN(core.utils.toFreckles(value)),
          network,
        });

        // Simulate transaction
        const balances = new Array(NUM_NODES).fill(0);
        balances[INDEX_SENDER] = value;

        path.forEach((transaction) => {
          const indexFrom = nodes.indexOf(transaction.from);
          const indexTo = nodes.indexOf(transaction.to);

          balances[indexFrom] -= core.utils.fromFreckles(transaction.value);
          balances[indexTo] += core.utils.fromFreckles(transaction.value);
        });

        expect(balances[INDEX_RECEIVER]).toBe(value);
      }
    });
  });

  describe('requestUBIPayout', () => {
    let token;
    let payout;

    beforeAll(async () => {
      token = await getTokenContract(web3, tokenAddresses[5]);

      payout = await core.token.checkUBIPayout(accounts[5], {
        safeAddress: safeAddresses[5],
      });
    });

    it('should add the next payout to our balance', async () => {
      const balanceBefore = await token.methods
        .balanceOf(safeAddresses[5])
        .call();

      await core.token.requestUBIPayout(accounts[5], {
        safeAddress: safeAddresses[5],
      });

      const balanceAfter = await token.methods
        .balanceOf(safeAddresses[5])
        .call();

      const expectedBalance = web3.utils
        .toBN(balanceBefore)
        .add(payout)
        .toString();

      // Do not check for the exact amount as payout is changing every second
      expect(web3.utils.toBN(balanceAfter).gt(expectedBalance)).toBe(true);
    });
  });
});
