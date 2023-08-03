import { SAFE_LAST_VERSION, SAFE_CRC_VERSION } from '~/common/constants';
import { SafeDeployedError } from '~/common/error';

import createCore from './helpers/core';
import accounts from './helpers/accounts';
import web3 from './helpers/web3';
import { deployCRCVersionSafe } from './helpers/transactions';
import generateSaltNonce from './helpers/generateSaltNonce';

describe('Safe', () => {
  const core = createCore();

  describe('when a new Safe gets manually created', () => {
    const nonce = generateSaltNonce();
    let safeAddress;

    it('should deploy a Safe successfully', async () => {
      safeAddress = await core.safe.deploySafe(accounts[0], { nonce });

      expect(web3.utils.isAddress(safeAddress)).toBe(true);

      return core.safe
        .isSafeDeployed(accounts[0], { nonce })
        .then((isDeployed) => expect(isDeployed).toBe(true));
    });

    it('should get the last version of Safe Contract by default', () =>
      core.safe
        .getVersion({ safeAddress })
        .then((version) => expect(version).toBe(SAFE_LAST_VERSION)));

    it('should get the safe address of the owner', () =>
      core.safe
        .getAddresses(accounts[0], {
          ownerAddress: accounts[0].address,
        })
        .then((safeAddresses) => expect(safeAddresses).toContain(safeAddress)));

    it('should throw error when trying to deploy twice with same nonce', () =>
      expect(() =>
        core.safe.deploySafe(accounts[0], { nonce }),
      ).rejects.toThrow(SafeDeployedError));
  });

  describe('when managing the owners of a Safe', () => {
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

    it('should add owner to the Safe', () =>
      core.safe
        .addOwner(accounts[0], {
          safeAddress,
          ownerAddress: accounts[1].address,
        })
        .then(() => core.safe.getOwners(accounts[0], { safeAddress }))
        .then((owners) => {
          expect(owners).toContain(accounts[1].address);
          expect(owners).toHaveLength(2);

          return core.safe.getAddresses(accounts[0], {
            ownerAddress: accounts[1].address,
          });
        })
        .then((safeAddresses) => expect(safeAddresses).toContain(safeAddress)));

    it('should remove owner from the Safe', () =>
      core.safe
        .removeOwner(accounts[0], {
          safeAddress,
          ownerAddress: accounts[1].address,
        })
        .then(() => core.safe.getOwners(accounts[0], { safeAddress }))
        .then((owners) => {
          expect(owners).not.toContain(accounts[1].address);
          expect(owners).toHaveLength(1);

          return core.safe.getAddresses(accounts[0], {
            ownerAddress: accounts[1].address,
          });
        })
        .then((safeAddresses) =>
          expect(safeAddresses).not.toContain(safeAddress),
        ));
  });

  describe('when updating a CRC Safe to latest version', () => {
    let CRCSafeAddress;
    const CRCSafeOwner = accounts[2];

    beforeAll(async () => {
      // Deploy a Safe with the CRC version (v1.1.1+Circles)
      const CRCSafeContractInstance = await deployCRCVersionSafe(CRCSafeOwner);
      CRCSafeAddress = CRCSafeContractInstance.options.address;
    });

    it('should get the CRC version when deploying with CRC contract', () =>
      core.safe
        .getVersion({
          safeAddress: CRCSafeAddress,
        })
        .then((version) => expect(version).toBe(SAFE_CRC_VERSION)));

    it('should get the lastest version of an updated CRC Safe', () =>
      core.safe
        .updateToLastVersion(CRCSafeOwner, {
          safeAddress: CRCSafeAddress,
        })
        .then((version) => expect(version).toBe(SAFE_LAST_VERSION)));

    // TODO: this cannot be done yet
    // it('I should be able to trust', async () => {
    //   // The newly created Safe trusts the migrated Safe
    //   const trustTransactionHash = await addTrustConnection(core, accounts[0], {
    //     user: CRCVersionSafeAddress,
    //     canSendTo: safeAddress,
    //     limitPercentage: 65,
    //   });
    //   expect(web3.utils.isHexStrict(trustTransactionHash)).toBe(true);

    //   // The migrated Safe trusts the newly created Safe
    //   const trustTransactionHash2 = await addTrustConnection(
    //     core,
    //     ownerCRCVersion,
    //     {
    //       user: safeAddress,
    //       canSendTo: CRCVersionSafeAddress,
    //       limitPercentage: 65,
    //     },
    //   );
    //   expect(web3.utils.isHexStrict(trustTransactionHash2)).toBe(true);
    // });

    // it('I should be able to send Circles to someone directly', async () => {
    //   // Transfer from the migrated Safe to the newly created Safe
    //   const transferTransactionHash = await core.token.transfer(
    //     ownerCRCVersion,
    //     {
    //       from: CRCVersionSafeAddress,
    //       to: safeAddress,
    //       value: web3.utils.toBN(core.utils.toFreckles(5)),
    //     },
    //   );

    //   expect(web3.utils.isHexStrict(transferTransactionHash)).toBe(true);
    // });

    // it('I should be able to add a new owner', async () => {
    //   const response = await core.safe.addOwner(ownerCRCVersion, {
    //     safeAddress: CRCVersionSafeAddress,
    //     ownerAddress: accounts[1].address,
    //   });

    //   expect(web3.utils.isHexStrict(response)).toBe(true);

    //   const owners = await core.utils.loop(
    //     () => {
    //       return core.safe.getOwners(accounts[0], {
    //         safeAddress: CRCVersionSafeAddress,
    //       });
    //     },
    //     (owners) => owners.length === 2,
    //     { label: 'Wait for newly added address to show up as Safe owner' },
    //   );

    //   expect(owners[0]).toBe(accounts[1].address);
    //   expect(owners[1]).toBe(ownerCRCVersion.address);
    //   expect(owners.length).toBe(2);

    //   await core.utils.loop(
    //     () => {
    //       return core.safe.getAddresses(accounts[0], {
    //         ownerAddress: accounts[1].address,
    //       });
    //     },
    //     (addresses) => addresses.includes(CRCVersionSafeAddress),
    //     { label: 'Wait for newly added address to show up as Safe owner' },
    //   );
    // });
  });
});
