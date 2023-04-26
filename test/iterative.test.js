import { execSync } from 'child_process';

import { getTokenContract } from '~/common/getContracts';
import getContracts from '~/common/getContracts';
import { ZERO_ADDRESS } from '~/common/constants';
import createCore from './helpers/core';
import getAccount from './helpers/account';

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

const executeTests = (core) => {
  describe('Token', () => {
    let accounts;
    let signupBonus;
    let contracts;
    let hubAddress;
    let safeAddresses;
    let tokenAddresses;
    const isPathfinderServer = core.options.pathfinderType === 'server';
    const testPathfinderName = isPathfinderServer ? 'server' : 'binary';
    const tokenOwnerAddressProperty = isPathfinderServer
      ? 'token_owner'
      : 'tokenOwnerAddress';
    const transferStepsProperty = isPathfinderServer ? 'maxTransfers' : 'hops';

    beforeAll(async () => {
      accounts = new Array(6).fill({}).map((item, index) => {
        return getAccount(index);
      });
      // Retrieve the value of the initial UBI payout (called signupBonus) from the deployed Hub contract

      hubAddress = core.options.hubAddress;
      contracts = await getContracts(web3, {
        hubAddress: hubAddress,
        proxyFactoryAddress: ZERO_ADDRESS,
        safeMasterAddress: ZERO_ADDRESS,
      });
      const { hub } = contracts;
      signupBonus = await hub.methods.signupBonus().call();

      const result = await deployTestNetwork(core, accounts);

      safeAddresses = result.safeAddresses;
      tokenAddresses = result.tokenAddresses;
    });

    it('should check if safe has enough funds for token to be deployed', async () => {
      const safeAddress = await deploySafe(core, accounts[0]);

      expect(
        await core.token.isFunded(accounts[0], {
          safeAddress,
        }),
      ).toBe(true);
    });

    describe('Find transitive transfer steps', () => {
      it(`should return max flow and possible path when using ${testPathfinderName} pathfinder.`, async () => {
        const value = new web3.utils.BN(core.utils.toFreckles(1));
        console.log("hi");
        const result = await core.token.findTransitiveTransfer(accounts[0], {
          from: safeAddresses[0],
          to: safeAddresses[4],
          value,
        });
        // const text = result.text();
        // console.log(text);
        // console.log("end: ", text.toString());
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
    });
  });
};

// Execute tests with server pathfinder
executeTests(createCore());
// Execute tests with cli pathfinder
// executeTests(createCore({ pathfinderType: 'cli' }));
