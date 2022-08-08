import { execSync } from 'child_process';

//import json2csv from 'json2csv';
import { getTokenContract } from '~/common/getContracts';
import getContracts from '~/common/getContracts';
import { ZERO_ADDRESS } from '~/common/constants';

import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';
import {
  deploySafe,
  deploySafeAndToken,
  addTrustConnection,
} from './helpers/transactions';

const TEST_TRUST_NETWORK = [
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

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function deployTestNetwork(
  core,
  accounts,
  connections = TEST_TRUST_NETWORK,
) {
  // Deploy Safe and Token for each test account
  let results = [];
  for (const account of accounts) {
    results.push(await deploySafeAndToken(core, account));
  }

  const safeAddresses = [];
  const tokenAddresses = [];

  results.forEach((result) => {
    const { safeAddress, tokenAddress } = result;

    safeAddresses.push(safeAddress);
    tokenAddresses.push(tokenAddress);
  });

  const connectionTasks = connections.map((connection) => {
    return addTrustConnection(core, accounts[connection[0]], {
      user: safeAddresses[connection[1]],
      canSendTo: safeAddresses[connection[0]],
      limitPercentage: connection[2],
    });
  });

  await Promise.all(connectionTasks);

  return {
    safeAddresses,
    tokenAddresses,
  };
}

describe('Token', () => {
  let core;
  let accounts;
  let signupBonus;
  let contracts;
  let hubAddress;

  beforeAll(async () => {
    accounts = new Array(6).fill({}).map((item, index) => {
      return getAccount(index);
    });

    core = createCore();

    // Retrieve the value of the initial UBI payout (called signupBonus) from the deployed Hub contract
    hubAddress = core.options.hubAddress;
    contracts = await getContracts(web3, {
      hubAddress: hubAddress,
      proxyFactoryAddress: ZERO_ADDRESS,
      safeMasterAddress: ZERO_ADDRESS,
    });
    const { hub } = contracts;
    signupBonus = await hub.methods.signupBonus().call();
  });

  it('should check if safe has enough funds for token to be deployed', async () => {
    const safeAddress = await deploySafe(core, accounts[0]);

    expect(
      await core.token.isFunded(accounts[0], {
        safeAddress,
      }),
    ).toBe(true);
  });

  describe('Payment notes', () => {
    let paymentNote;
    let txHash;

    beforeAll(async () => {
      // Create sender and receiver Safe
      const sender = await deploySafeAndToken(core, accounts[0]);
      const receiver = await deploySafeAndToken(core, accounts[1]);

      // Create a trust connection between receiver and sender
      await addTrustConnection(core, accounts[1], {
        user: sender.safeAddress,
        canSendTo: receiver.safeAddress,
        limitPercentage: 50,
      });

      // Send some Circles on that path and store payment note
      const value = new web3.utils.BN(core.utils.toFreckles(3));
      paymentNote = 'Thank you for the fish';
      txHash = await core.token.transfer(accounts[0], {
        from: sender.safeAddress,
        to: receiver.safeAddress,
        value,
        paymentNote,
      });

      expect(web3.utils.isHexStrict(txHash)).toBe(true);
    });

    it('should receive the payment note', async () => {
      const result = await core.token.getPaymentNote(accounts[0], {
        transactionHash: txHash,
      });

      expect(result).toBe(paymentNote);
    });

    it('should disallow access for other users and return null', async () => {
      const result = await core.token.getPaymentNote(accounts[3], {
        transactionHash: txHash,
      });

      expect(result).toBe(null);
    });
  });

  describe('Find transitive transfer steps', () => {
    let safeAddresses;

    beforeAll(async () => {
      const result = await deployTestNetwork(core, accounts);
      safeAddresses = result.safeAddresses;
    });

    it('should return max flow and possible path', async () => {
      const value = new web3.utils.BN(core.utils.toFreckles(1));

      const result = await core.token.findTransitiveTransfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value,
      });
      expect(result.transferSteps.length).toBe(2);
      expect(result.transferSteps[0].from).toBe(safeAddresses[0]);
      expect(result.transferSteps[0].to).toBe(safeAddresses[3]);
      expect(result.transferSteps[0].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[0].tokenOwnerAddress).toBe(safeAddresses[0]);
      expect(result.transferSteps[1].from).toBe(safeAddresses[3]);
      expect(result.transferSteps[1].to).toBe(safeAddresses[4]);
      expect(result.transferSteps[1].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[1].tokenOwnerAddress).toBe(safeAddresses[3]);

      // The `pathfinder` stops searching for max flow as soon as it found a
      // successful solution, therefore it returns a lower max flow than it
      // actually is (25).
      expect(result.maxFlowValue).toBe(core.utils.toFreckles(1));
    });
  });

  describe('Transitive Transactions', () => {
    let safeAddresses;
    let tokenAddresses;

    beforeAll(async () => {
      const result = await deployTestNetwork(core, accounts);
      safeAddresses = result.safeAddresses;
      tokenAddresses = result.tokenAddresses;
    });

    it('should get the current balance', async () => {
      const balance = await core.token.getBalance(accounts[5], {
        safeAddress: safeAddresses[5],
      });

      // It should be equals the initial UBI payout (called signupBonus) which was set during Hub
      // contract deployment:
      expect(balance).toMatchObject(new web3.utils.BN(signupBonus));
    });

    it('should send Circles to someone directly', async () => {
      const value = web3.utils.toBN(core.utils.toFreckles(5));

      // Unidirectional trust relationship from 1 to 2
      const indexFrom = 1;
      const indexTo = 2;

      // Transfer from 1 to 2
      const response = await core.token.transfer(accounts[indexFrom], {
        from: safeAddresses[indexFrom],
        to: safeAddresses[indexTo],
        value,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);
    });

    it('should send Circles to someone transitively', async () => {
      const sentCircles = 5;
      const value = web3.utils.toBN(core.utils.toFreckles(sentCircles));
      const indexFrom = 0;
      const indexTo = 4;

      const response = await core.token.transfer(accounts[indexFrom], {
        from: safeAddresses[indexFrom],
        to: safeAddresses[indexTo],
        value,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const accountBalance = await loop(
        'Wait for balance to be lower after user transferred Circles',
        () => {
          return core.token.getBalance(accounts[indexFrom], {
            safeAddress: safeAddresses[indexFrom],
          });
        },
        (balance) => {
          return (
            (core.utils.fromFreckles(balance) + 1).toString() ===
            (core.utils.fromFreckles(signupBonus) - sentCircles).toString()
          );
        },
      );

      const otherAccountBalance = await core.token.getBalance(
        accounts[indexTo],
        {
          safeAddress: safeAddresses[indexTo],
        },
      );

      expect(
        (core.utils.fromFreckles(otherAccountBalance) + 1).toString(),
      ).toBe((core.utils.fromFreckles(signupBonus) + sentCircles).toString());
      expect((core.utils.fromFreckles(accountBalance) + 1).toString()).toBe(
        (core.utils.fromFreckles(signupBonus) - sentCircles).toString(),
      );
    });

    it('should fail sending Circles when there is no path', async () => {
      // Max flow is smaller than the given transfer value
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: web3.utils.toBN(core.utils.toFreckles('100')),
        }),
      ).rejects.toThrow();

      // Trust connection does not exist between node 0 and 5
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[5],
          value: web3.utils.toBN('1'),
        }),
      ).rejects.toThrow();
    });

    it('should fail sending Circles when data error', async () => {
      // Update the edges.csv file simulating data error:
      // Direct path does not exist between safeAddress 0 and 4,
      // thus we create a false edge between safeAddress 0 and 4
      await Promise.resolve().then(() => {
        let edgesCSVdata = `${safeAddresses[0]},${safeAddresses[4]},${safeAddresses[0]},100`;
        execSync(
          `docker exec circles-api bash -c "echo '${edgesCSVdata}' >> edges-data/edges.csv" `,
        );
      });

      // Then we perform the transfer expecting it to fail:
      // Attempt to send an ammount which we know is higher
      // than the allowed by the blockchain data
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: web3.utils.toBN(core.utils.toFreckles('100000000')),
        }),
      ).rejects.toThrow();

      const updateResult = await core.token.updateTransferSteps(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value: web3.utils.toBN(core.utils.toFreckles('5')),
      });
      await wait(3000);
      expect(updateResult.updated).toBe(true);

      // Only after updating the path, the transfer can succeed
      const response = await core.token.transfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value: web3.utils.toBN(core.utils.toFreckles('5')),
      });
      expect(web3.utils.isHexStrict(response)).toBe(true);
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
});
