import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';
import {
  addTrustConnection,
  deploySafeAndToken,
  fundSafe,
  deployCRCVersionSafe,
  deployCRCVersionToken,
} from './helpers/transactions';

import { SAFE_LAST_VERSION, SAFE_CRC_VERSION, ZERO_ADDRESS } from '~/common/constants';
import getContracts, { getSafeCRCVersionContract } from '~/common/getContracts';

describe('Safe', () => {
  let core;
  let accounts;

  beforeAll(() => {
    accounts = new Array(4).fill({}).map((item, index) => {
      return getAccount(index);
    });

    core = createCore();
  });

  describe('when a new Safe gets manually created', () => {
    let safeAddress;
    let nonce;

    beforeAll(async () => {
      nonce = Date.now();
      safeAddress = await core.safe.prepareDeploy(accounts[0], {
        nonce,
      });
    });

    it('should be a valid address', () => {
      expect(web3.utils.isAddress(safeAddress)).toBe(true);
    });

    it('should have predicted its future Safe address', async () => {
      const predictedSafeAddress = await core.safe.predictAddress(accounts[0], {
        nonce,
      });

      expect(web3.utils.isAddress(predictedSafeAddress)).toBe(true);
      expect(predictedSafeAddress).toBe(safeAddress);
    });

    it('should return the correct status', async () => {
      const status = await core.safe.getSafeStatus(accounts[0], {
        safeAddress,
      });

      expect(status.isCreated).toBe(true);
      expect(status.isDeployed).toBe(false);
    });

    it('should recover the same Safe address when doing it again', async () => {
      const safeAddressAgain = await core.safe.prepareDeploy(accounts[0], {
        nonce,
      });

      expect(safeAddressAgain).toBe(safeAddress);
    });

    it('should be able to manually fund it for deployment', async () => {
      expect(
        await core.safe.isFunded(accounts[0], {
          safeAddress,
        }),
      ).toBe(false);

      await fundSafe(accounts[0], safeAddress);

      expect(
        await core.safe.isFunded(accounts[0], {
          safeAddress,
        }),
      ).toBe(true);

      const result = await core.safe.deploy(accounts[0], {
        safeAddress,
      });

      // .. wait for Relayer to really deploy Safe
      await loop('Wait until Safe got deployed', () =>
        web3.eth.getCode(safeAddress),
      );

      // Deploy Token as well to pay our fees later
      await core.token.deploy(accounts[0], {
        safeAddress,
      });

      expect(result).toBe(true);

      // Check if the status is correct
      const status = await core.safe.getSafeStatus(accounts[0], {
        safeAddress,
      });

      expect(status.isCreated).toBe(true);
      expect(status.isDeployed).toBe(true);
    });
  });

  describe('when a new Safe gets created through collecting trust connections', () => {
    let safeAddress;
    let trustAccounts;
    let trustSafeAddresses;

    beforeAll(async () => {
      trustAccounts = [accounts[1], accounts[2], accounts[3]];
      trustSafeAddresses = [];

      const safeCreationNonce = new Date().getTime();

      safeAddress = await core.safe.prepareDeploy(accounts[0], {
        nonce: safeCreationNonce,
      });

      // Create manually funded accounts for trust connections
      const tasks = trustAccounts.map((account) => {
        return deploySafeAndToken(core, account);
      });

      const results = await Promise.all(tasks);
      results.forEach((result) => {
        trustSafeAddresses.push(result.safeAddress);
      });
    });

    it('should get funded through the relayer', async () => {
      // It should not be funded
      expect(
        await core.safe.isFunded(accounts[0], {
          safeAddress,
        }),
      ).toBe(false);

      // Receive 3 incoming trust connections from other users
      const connectionTasks = trustAccounts.map((account, index) => {
        return addTrustConnection(core, account, {
          user: safeAddress,
          canSendTo: trustSafeAddresses[index],
          limitPercentage: 10,
        });
      });

      await Promise.all(connectionTasks);

      // Deploy Safe
      await core.safe.deploy(accounts[0], {
        safeAddress,
      });

      // .. wait for Relayer to really deploy Safe
      await loop('Wait until Safe got deployed', () =>
        web3.eth.getCode(safeAddress),
      );

      // Deploy Token
      await core.token.deploy(accounts[0], {
        safeAddress,
      });

      const tokenAddress = await core.token.getAddress(accounts[0], {
        safeAddress,
      });

      const code = await web3.eth.getCode(tokenAddress);
      expect(code).not.toBe('0x');
      expect(web3.utils.isAddress(tokenAddress)).toBe(true);
    });
  });

  describe('when I want to manage the owners of a Safe', () => {
    let safeAddress;

    beforeAll(async () => {
      const result = await deploySafeAndToken(core, accounts[0]);
      safeAddress = result.safeAddress;
    });

    it('should return a list of the current owners', async () => {
      const owners = await core.safe.getOwners(accounts[0], {
        safeAddress,
      });

      expect(owners[0]).toBe(accounts[0].address);
      expect(owners.length).toBe(1);
    });

    it('should add another owner to the Safe', async () => {
      const response = await core.safe.addOwner(accounts[0], {
        safeAddress,
        ownerAddress: accounts[1].address,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const owners = await core.safe.getOwners(accounts[0], {
        safeAddress,
      });

      expect(owners[0]).toBe(accounts[1].address);
      expect(owners[1]).toBe(accounts[0].address);
      expect(owners.length).toBe(2);

      await loop(
        'Wait for newly added address to show up as Safe owner',
        () => {
          return core.safe.getAddresses(accounts[0], {
            ownerAddress: accounts[1].address,
          });
        },
        (addresses) => addresses.includes(safeAddress),
      );
    });

    it('should remove an owner from the Safe', async () => {
      const response = await core.safe.removeOwner(accounts[0], {
        safeAddress,
        ownerAddress: accounts[1].address,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const owners = await core.safe.getOwners(accounts[0], {
        safeAddress,
      });

      expect(owners[0]).toBe(accounts[0].address);
      expect(owners.length).toBe(1);
    });
  });

  describe('when I want to update the Safe version', () => {
    let safeAddress;
    let ownerCRCVersion;
    let CRCVersionSafeAddress;
    let CRCVersionSafeInstance;
    let contracts;


    beforeAll(async () => {

      // Deploy new version (v1.3.0)
      const result = await deploySafeAndToken(core, accounts[0]);
      safeAddress = result.safeAddress;

      // Get the hub
      const hubAddress = core.options.hubAddress;
      contracts = await getContracts(web3, {
        hubAddress: hubAddress,
        proxyFactoryAddress: ZERO_ADDRESS,
        safeMasterAddress: ZERO_ADDRESS,
      });
      const { hub } = contracts;


      // Deploy a Safe with the CRC version (v1.1.1+Circles)
      ownerCRCVersion = getAccount(8);
      CRCVersionSafeInstance = await deployCRCVersionSafe(accounts[0], ownerCRCVersion);
      CRCVersionSafeAddress = CRCVersionSafeInstance.options.address;
      await fundSafe(accounts[0], CRCVersionSafeAddress);
      await deployCRCVersionToken(web3, ownerCRCVersion, CRCVersionSafeInstance, hub);
      const ownersList = await core.safe.getOwners(accounts[0], {
        safeAddress: CRCVersionSafeAddress,
      });
      console.log({ownersList});
      console.log({CRCVersionSafeAddress});

    });

    it('I should get the last version by default', async () => {
      const version = await core.safe.getVersion(accounts[0], {
        safeAddress,
      });
      expect(version).toBe(SAFE_LAST_VERSION);
    });

    it('I should get the CRC version when I deploy with CRC version contracts', async () => {
      const version = await core.safe.getVersion(ownerCRCVersion, {
        safeAddress: CRCVersionSafeAddress,
      });
      expect(version).toBe(SAFE_CRC_VERSION);
    });

    it('I should get the last version when update the Safe version of a deployed Safe', async () => {
      const version = await core.safe.updateToLastVersion(ownerCRCVersion, {
        safeAddress: CRCVersionSafeAddress,
      });
      console.log({ownerCRCVersion});
      console.log({CRCVersionSafeInstance});
      console.log({safeAddress});
      expect(version).toBe(SAFE_LAST_VERSION);
    });

    it('I should be able to trust', async () => {
      // The newly created Safe trusts the migrated Safe 
      const trustTransactionHash = await addTrustConnection(core, accounts[0], {
        user: CRCVersionSafeAddress,
        canSendTo: safeAddress,
        limitPercentage: 65,
      });
      console.log({CRCVersionSafeAddress});
      console.log({safeAddress});
      expect(web3.utils.isHexStrict(trustTransactionHash)).toBe(true);

      // The migrated Safe trusts the newly created Safe
      const trustTransactionHash2 = await addTrustConnection(core, ownerCRCVersion, {
        user: safeAddress,
        canSendTo: CRCVersionSafeAddress,
        limitPercentage: 65,
      });
      console.log({CRCVersionSafeAddress});
      console.log({safeAddress});
      expect(web3.utils.isHexStrict(trustTransactionHash2)).toBe(true);
    });

    it('I should be able to send Circles to someone directly', async () => {
      // Transfer from the migrated Safe to the newly created Safe
      const transferTransactionHash = await core.token.transfer(ownerCRCVersion, {
        from: CRCVersionSafeAddress,
        to: safeAddress,
        value: web3.utils.toBN(core.utils.toFreckles(5)),
      });

      expect(web3.utils.isHexStrict(transferTransactionHash)).toBe(true);
    });
  });
});
