import { SAFE_LAST_VERSION, SAFE_CRC_VERSION } from '~/common/constants';
import { SafeDeployedError } from '~/common/error';

import createCore from './helpers/core';
import accounts from './helpers/accounts';
import web3 from './helpers/web3';
import {
  addTrustConnection,
  fundSafe,
  deployCRCVersionSafe,
  deployToken,
} from './helpers/transactions';
import generateSaltNonce from './helpers/generateSaltNonce';

describe('Safe', () => {
  const core = createCore();

  describe('when a new Safe gets manually created', () => {
    const nonce = generateSaltNonce();
    let safeAddress;

    it('should deploy a Safe successfully', async () => {
      safeAddress = await core.safe.deploySafe(accounts[0], { nonce });

      expect(web3.utils.isAddress(safeAddress)).toBe(true);
    });

    it('should be deployed', () =>
      core.safe
        .isSafeDeployed(accounts[0], { nonce })
        .then((isDeployed) => expect(isDeployed).toBe(true)));

    it('should throw error when trying to deploy twice with same nonce', () =>
      expect(() =>
        core.safe.deploySafe(accounts[0], { nonce }),
      ).rejects.toThrow(SafeDeployedError));
  });

  describe('when I want to manage the owners of a Safe', () => {
    let safeAddress;

    beforeAll(async () => {
      safeAddress = await core.safe.deploySafe(accounts[0], {
        nonce: generateSaltNonce(),
      });
    });

    it('should return the current owners list', () =>
      core.safe
        .getOwners(accounts[0], { safeAddress })
        .then((owners) => expect(owners).toEqual([accounts[0].address])));

    it('should add owner to the Safe', async () => {
      const response = await core.safe.addOwner(accounts[0], {
        safeAddress,
        ownerAddress: accounts[1].address,
      });

      expect(typeof response.taskId).toBe('string');

      const owners = await core.utils.loop(
        () => core.safe.getOwners(accounts[0], { safeAddress }),
        (owners) => owners.length === 2,
        { label: 'Wait for new owner to be added' },
      );

      expect(owners).toContain(accounts[1].address);
      expect(owners).toHaveLength(2);
    });

    it('should remove owner from the Safe', async () => {
      const response = await core.safe.removeOwner(accounts[0], {
        safeAddress,
        ownerAddress: accounts[1].address,
      });

      expect(typeof response.taskId).toBe('string');

      const owners = await core.utils.loop(
        () => core.safe.getOwners(accounts[0], { safeAddress }),
        (owners) => owners.length === 1,
        { label: 'Wait for new owner to be added' },
      );

      expect(owners).not.toContain(accounts[1].address);
      expect(owners).toHaveLength(1);
    });
  });

  describe('when I want to update the Safe version', () => {
    let safeAddress;
    let CRCVersionSafeAddress;
    let CRCVersionSafeInstance;
    const ownerCRCVersion = accounts[2];

    beforeAll(async () => {
      // Deploy new version (v1.3.0)
      safeAddress = await core.safe.deploySafe(accounts[0], {
        nonce: generateSaltNonce(),
      });

      // Deploy a Safe with the CRC version (v1.1.1+Circles)
      CRCVersionSafeInstance = await deployCRCVersionSafe(ownerCRCVersion);
      CRCVersionSafeAddress = CRCVersionSafeInstance.options.address;
      await fundSafe(accounts[0], CRCVersionSafeAddress);
      await deployToken(core, ownerCRCVersion, {
        safeAddress: CRCVersionSafeAddress,
      });
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
      const { txHashChangeMasterCopy, txHashFallbackHandler } =
        await core.safe.updateToLastVersion(ownerCRCVersion, {
          safeAddress: CRCVersionSafeAddress,
        });

      expect(web3.utils.isHexStrict(txHashChangeMasterCopy)).toBe(true);
      expect(web3.utils.isHexStrict(txHashFallbackHandler)).toBe(true);

      const version = await core.safe.getVersion(ownerCRCVersion, {
        safeAddress: CRCVersionSafeAddress,
      });

      expect(version).toBe(SAFE_LAST_VERSION);
    });

    it('I should be able to trust', async () => {
      // The newly created Safe trusts the migrated Safe
      const trustTransactionHash = await addTrustConnection(core, accounts[0], {
        user: CRCVersionSafeAddress,
        canSendTo: safeAddress,
        limitPercentage: 65,
      });
      expect(web3.utils.isHexStrict(trustTransactionHash)).toBe(true);

      // The migrated Safe trusts the newly created Safe
      const trustTransactionHash2 = await addTrustConnection(
        core,
        ownerCRCVersion,
        {
          user: safeAddress,
          canSendTo: CRCVersionSafeAddress,
          limitPercentage: 65,
        },
      );
      expect(web3.utils.isHexStrict(trustTransactionHash2)).toBe(true);
    });

    it('I should be able to send Circles to someone directly', async () => {
      // Transfer from the migrated Safe to the newly created Safe
      const transferTransactionHash = await core.token.transfer(
        ownerCRCVersion,
        {
          from: CRCVersionSafeAddress,
          to: safeAddress,
          value: web3.utils.toBN(core.utils.toFreckles(5)),
        },
      );

      expect(web3.utils.isHexStrict(transferTransactionHash)).toBe(true);
    });

    it('I should be able to add a new owner', async () => {
      const response = await core.safe.addOwner(ownerCRCVersion, {
        safeAddress: CRCVersionSafeAddress,
        ownerAddress: accounts[1].address,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const owners = await core.utils.loop(
        () => {
          return core.safe.getOwners(accounts[0], {
            safeAddress: CRCVersionSafeAddress,
          });
        },
        (owners) => owners.length === 2,
        { label: 'Wait for newly added address to show up as Safe owner' },
      );

      expect(owners[0]).toBe(accounts[1].address);
      expect(owners[1]).toBe(ownerCRCVersion.address);
      expect(owners.length).toBe(2);

      await core.utils.loop(
        () => {
          return core.safe.getAddresses(accounts[0], {
            ownerAddress: accounts[1].address,
          });
        },
        (addresses) => addresses.includes(CRCVersionSafeAddress),
        { label: 'Wait for newly added address to show up as Safe owner' },
      );
    });
  });
});
