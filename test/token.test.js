import { ethers } from 'ethers';
import { execSync } from 'child_process';

import core from './helpers/core';
import deployTestNetwork from './helpers/deployTestNetwork';
import accounts from './helpers/accounts';

const TRUST_NETWORK = {
  0: [[1, 25]],
  1: [
    [0, 50],
    [2, 10],
  ],
  2: [
    [1, 20],
    [3, 5],
    [5, 50],
  ],
  3: [
    [0, 25],
    [2, 15],
    [4, 25],
  ],
  4: [
    [3, 15],
    [1, 10],
  ],
};

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Token', () => {
  const isPathfinderServer = core.options.pathfinderType === 'server';
  const testPathfinderName = isPathfinderServer ? 'server' : 'binary';
  const tokenOwnerAddressProperty = isPathfinderServer
    ? 'token_owner'
    : 'tokenOwnerAddress';
  const transferStepsProperty = isPathfinderServer ? 'maxTransfers' : 'hops';
  let signupBonus;
  let safeAddresses;
  let tokenAddresses;

  beforeAll(async () => {
    // Retrieve the value of the initial UBI payout (called signupBonus) from the deployed Hub contract
    signupBonus = await core.contracts.hub.signupBonus();

    // Prepare all Safes and generate the network of trust
    const result = await deployTestNetwork({
      accounts: accounts.slice(0, 6),
      connections: TRUST_NETWORK,
    });

    safeAddresses = result.safeAddresses;
    tokenAddresses = result.tokenAddresses;
  });

  describe('Payment notes', () => {
    const paymentNote = 'Thank you for the fish';
    let txHash;

    beforeAll(async () => {
      // Send some Circles on that path and store payment note
      txHash = await core.token.transfer(accounts[1], {
        from: safeAddresses[1],
        to: safeAddresses[0],
        value: ethers.BigNumber.from(core.utils.toFreckles(3)),
        paymentNote,
      });
    });

    it('should receive the payment note', async () => {
      const result = await core.token.getPaymentNote(accounts[1], {
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
    it(`should return max flow and possible path when using ${testPathfinderName} pathfinder.`, async () => {
      const value = ethers.BigNumber.from(core.utils.toFreckles(1));
      const result = await core.token.findTransitiveTransfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value,
      });

      expect(result.transferSteps.length).toBe(2);
      expect(result.transferSteps[0].from).toBe(safeAddresses[0]);
      expect(result.transferSteps[0].to).toBe(safeAddresses[3]);
      expect(result.transferSteps[0].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[0][tokenOwnerAddressProperty]).toBe(
        safeAddresses[0],
      );
      expect(result.transferSteps[1].from).toBe(safeAddresses[3]);
      expect(result.transferSteps[1].to).toBe(safeAddresses[4]);
      expect(result.transferSteps[1].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[1][tokenOwnerAddressProperty]).toBe(
        safeAddresses[3],
      );
      // The `pathfinder` stops searching for max flow as soon as it found a
      // successful solution, therefore it returns a lower max flow than it
      // actually is (25).
      expect(result.maxFlowValue).toBe(core.utils.toFreckles(1));
    });

    it(`should return max flow and possible path when using ${transferStepsProperty} parameter in ${testPathfinderName} pathfinder`, async () => {
      const value = ethers.BigNumber.from(core.utils.toFreckles(1));
      const result = await core.token.findTransitiveTransfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value,
        [transferStepsProperty]: 2,
      });

      expect(result.transferSteps.length).toBe(2);
      expect(result.transferSteps[0].from).toBe(safeAddresses[0]);
      expect(result.transferSteps[0].to).toBe(safeAddresses[3]);
      expect(result.transferSteps[0].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[0][tokenOwnerAddressProperty]).toBe(
        safeAddresses[0],
      );
      expect(result.transferSteps[1].from).toBe(safeAddresses[3]);
      expect(result.transferSteps[1].to).toBe(safeAddresses[4]);
      expect(result.transferSteps[1].value).toBe(core.utils.toFreckles(1));
      expect(result.transferSteps[1][tokenOwnerAddressProperty]).toBe(
        safeAddresses[3],
      );
      // The `pathfinder` stops searching for max flow as soon as it found a
      // successful solution, therefore it returns a lower max flow than it
      // actually is (25).
      expect(result.maxFlowValue).toBe(core.utils.toFreckles(1));
    });

    it(`should return 0 max flow and no path when using too low ${transferStepsProperty} parameter in ${testPathfinderName} pathfinder`, async () => {
      const value = ethers.BigNumber.from(core.utils.toFreckles(1));
      const result = await core.token.findTransitiveTransfer(accounts[0], {
        from: safeAddresses[0],
        to: safeAddresses[4],
        value,
        [transferStepsProperty]: 1,
      });

      expect(result.transferSteps.length).toBe(0);
      // The `pathfinder` stops searching for max flow as soon as it found a
      // successful solution, therefore it returns a lower max flow than it
      // actually is (25).
      expect(result.maxFlowValue).toBe(core.utils.toFreckles(0));
    });
  });

  describe('Transitive Transactions', () => {
    it('should send Circles to someone directly', async () => {
      const sentCircles = 5;
      const value = ethers.BigNumber.from(core.utils.toFreckles(sentCircles));
      const indexFrom = 1;
      const indexTo = 2;
      const previousBalance = await core.token.getBalance(accounts[indexFrom], {
        safeAddress: safeAddresses[indexFrom],
      });

      // Transfer from 1 to 2
      const response = await core.token.transfer(accounts[indexFrom], {
        from: safeAddresses[indexFrom],
        to: safeAddresses[indexTo],
        value,
      });

      expect(ethers.utils.isHexString(response)).toBe(true);

      const accountBalance = await core.utils.loop(
        () =>
          core.token.getBalance(accounts[indexFrom], {
            safeAddress: safeAddresses[indexFrom],
          }),
        (balance) =>
          core.utils.fromFreckles(balance) ===
          core.utils.fromFreckles(previousBalance) - sentCircles,
        {
          label: 'Wait for balance to be lower after user transferred Circles',
        },
      );

      const otherAccountBalance = await core.token.getBalance(
        accounts[indexTo],
        {
          safeAddress: safeAddresses[indexTo],
        },
      );

      expect(core.utils.fromFreckles(accountBalance)).toBe(
        core.utils.fromFreckles(previousBalance) - sentCircles,
      );
      expect(core.utils.fromFreckles(otherAccountBalance)).toBe(
        core.utils.fromFreckles(signupBonus) + sentCircles,
      );
    });

    it('should send Circles to someone transitively', async () => {
      const sentCircles = 5;
      const value = ethers.BigNumber.from(core.utils.toFreckles(sentCircles));
      const indexFrom = 0;
      const indexTo = 4;
      const previousBalance = await core.token.getBalance(accounts[indexFrom], {
        safeAddress: safeAddresses[indexFrom],
      });

      const response = await core.token.transfer(accounts[indexFrom], {
        from: safeAddresses[indexFrom],
        to: safeAddresses[indexTo],
        value,
      });

      expect(ethers.utils.isHexString(response)).toBe(true);

      const accountBalance = await core.utils.loop(
        () =>
          core.token.getBalance(accounts[indexFrom], {
            safeAddress: safeAddresses[indexFrom],
          }),
        (balance) =>
          core.utils.fromFreckles(balance) ===
          core.utils.fromFreckles(previousBalance) - sentCircles,
        {
          label: 'Wait for balance to be lower after user transferred Circles',
        },
      );

      const otherAccountBalance = await core.token.getBalance(
        accounts[indexTo],
        {
          safeAddress: safeAddresses[indexTo],
        },
      );

      expect(core.utils.fromFreckles(accountBalance)).toBe(
        core.utils.fromFreckles(previousBalance) - sentCircles,
      );
      expect(core.utils.fromFreckles(otherAccountBalance)).toBe(
        core.utils.fromFreckles(signupBonus) + sentCircles,
      );
    });

    it('should fail sending Circles when maxflow is lower than requested transfer value', async () => {
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: ethers.BigNumber.from(core.utils.toFreckles('100')),
        }),
      ).rejects.toThrow();
    });

    it('should fail sending Circles when there is no trust path between sender and receiver', async () => {
      // Trust connection does not exist between node 0 and 5
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[5],
          value: ethers.BigNumber.from('1'),
        }),
      ).rejects.toThrow();
    });

    it(`should fail to send Circles to someone transitively if ${transferStepsProperty} value is too small to find a path`, async () => {
      await expect(
        core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: ethers.BigNumber.from(core.utils.toFreckles(5)),
          [transferStepsProperty]: 1,
        }),
      ).rejects.toThrow();
    });

    if (!isPathfinderServer) {
      it('should fail sending Circles when data error when using the pathfinder binary', async () => {
        // Update the edges.csv file simulating data error:
        // Direct path does not exist between safeAddress 0 and 4,
        // thus we create a false edge between safeAddress 0 and 4
        await Promise.resolve().then(() => {
          let edgesCSVdata = `${safeAddresses[0]},${safeAddresses[4]},${safeAddresses[0]},100000000000000000000`;
          execSync(
            `docker exec circles-api bash -c "echo '${edgesCSVdata}' >> edges-data/edges.csv" `,
          );
        });
        const valueToSend = '5';

        // Then we perform the transfer expecting it to fail:
        // Attempt to send an ammount which we know is higher
        // than the allowed by the blockchain data
        await expect(
          core.token.transfer(accounts[0], {
            from: safeAddresses[0],
            to: safeAddresses[4],
            value: ethers.BigNumber.from(core.utils.toFreckles(valueToSend)),
          }),
        ).rejects.toThrow();

        const updateResult = await core.token.updateTransferSteps(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: ethers.BigNumber.from(core.utils.toFreckles(valueToSend)),
        });
        await wait(3000);
        expect(updateResult.updated).toBe(true);

        // Only after updating the path, the transfer can succeed
        const response = await core.token.transfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value: ethers.BigNumber.from(core.utils.toFreckles(valueToSend)),
        });
        expect(ethers.utils.isHexString(response)).toBe(true);
      });
    }
  });

  describe('requestUBIPayout', () => {
    let previousBalance;
    let payout;

    beforeAll(async () => {
      previousBalance = await core.token.getBalance(accounts[5], {
        safeAddress: safeAddresses[5],
        tokenAddress: tokenAddresses[5],
      });
      payout = await core.token.checkUBIPayout(accounts[5], {
        safeAddress: safeAddresses[5],
      });
    });

    it('should add the next payout to our balance', async () => {
      const expectedBalance = previousBalance.add(payout);

      await core.token.requestUBIPayout(accounts[5], {
        safeAddress: safeAddresses[5],
      });

      const balance = await core.utils.loop(
        () =>
          core.token.getBalance(accounts[5], {
            safeAddress: safeAddresses[5],
            tokenAddress: tokenAddresses[5],
          }),
        (balance) => balance.gt(expectedBalance),
        {
          label: 'Wait for account to receive UBI payout.',
        },
      );

      // Do not check for the exact amount as payout is changing every second
      expect(balance.gt(expectedBalance)).toBe(true);
    });
  });
});
