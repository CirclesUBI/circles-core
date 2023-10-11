import { ethers } from 'ethers';

import { SAFE_LAST_VERSION, SAFE_CRC_VERSION } from '~/common/constants';
import { SafeAlreadyDeployedError, SafeNotTrustError } from '~/common/error';

import core from './helpers/core';
import deployCRCSafe from './helpers/deployCRCSafe';
import generateSaltNonce from './helpers/generateSaltNonce';
import onboardAccount from './helpers/onboardAccount';
import getTrustConnection from './helpers/getTrustConnection';
import ethProvider from './helpers/ethProvider';
import accounts from './helpers/accounts';

describe('Safe', () => {
  let predeployedSafes;

  beforeAll(async () => {
    // Predeploy manually 3 accounts because of the minimun trusting requirement
    predeployedSafes = await Promise.all(
      Array.from(Array(3).keys()).map((index) =>
        onboardAccount({
          account: accounts[index + 1],
          nonce: generateSaltNonce(),
        }).then(({ safeAddress }) => safeAddress),
      ),
    );
  });

  describe('when deploying Safes', () => {
    const nonce = generateSaltNonce();
    const newAccount = ethers.Wallet.createRandom().connect(ethProvider);
    let safeAddress;

    it('should throw error when trying to deploy without xDai and no required trusts', () =>
      expect(() =>
        core.safe.deploySafe(newAccount, {
          nonce: generateSaltNonce(),
        }),
      ).rejects.toThrow(SafeNotTrustError.message));

    it('should deploy a Safe successfully without xDai but having the required trusts', async () => {
      const poorNonce = generateSaltNonce();

      safeAddress = await core.safe.predictAddress(newAccount, {
        nonce: poorNonce,
      });

      expect(ethers.utils.isAddress(safeAddress)).toBe(true);

      // Let's make the trust connections needed to get the Safe deployed
      await Promise.all(
        predeployedSafes.map((predeployedAddress, index) =>
          core.trust.addConnection(accounts[index + 1], {
            canSendTo: predeployedAddress,
            user: safeAddress,
          }),
        ),
      );

      await core.safe.deploySafe(newAccount, { nonce: poorNonce });

      return core.safe
        .isDeployed(newAccount, { safeAddress })
        .then((isDeployed) => expect(isDeployed).toBe(true));
    });

    it('should deploy a Safe successfully with xDai', async () => {
      safeAddress = await core.safe.predictAddress(accounts[0], { nonce });

      expect(ethers.utils.isAddress(safeAddress)).toBe(true);

      await core.safe.deploySafe(accounts[0], { nonce });

      return core.safe
        .isDeployed(accounts[0], { safeAddress })
        .then((isDeployed) => expect(isDeployed).toBe(true));
    });

    it('should get the last version of Safe Contract by default', () =>
      core.safe
        .getVersion(accounts[0], { safeAddress })
        .then((version) => expect(version).toBe(SAFE_LAST_VERSION)));

    it('should throw error when trying to deploy twice with same nonce', () =>
      expect(() =>
        core.safe.deploySafe(accounts[0], { nonce }),
      ).rejects.toThrow(SafeAlreadyDeployedError.message));
  });

  describe('when managing owners of a Safe', () => {
    let safeAddress;

    beforeAll(async () => {
      const nonce = generateSaltNonce();

      safeAddress = await core.safe.predictAddress(accounts[0], { nonce });

      await core.safe.deploySafe(accounts[0], {
        nonce,
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
    const otherAccount = accounts[1];
    let otherSafeAddress;

    beforeAll(async () => {
      // Deploy a Safe with the CRC version (v1.1.1+Circles)
      const CRCSafeContractInstance = await deployCRCSafe(CRCSafeOwner);
      CRCSafeAddress = ethers.utils.getAddress(CRCSafeContractInstance.address);
      otherSafeAddress = predeployedSafes[0];
    });

    it('should get the CRC version when deploying with CRC contract', () =>
      core.safe
        .getVersion(CRCSafeOwner, {
          safeAddress: CRCSafeAddress,
        })
        .then((version) => expect(version).toBe(SAFE_CRC_VERSION)));

    it('should get the lastest version of an updated CRC Safe', () =>
      core.safe
        .updateToLastVersion(CRCSafeOwner, {
          safeAddress: CRCSafeAddress,
        })
        .then((version) => expect(version).toBe(SAFE_LAST_VERSION)));

    it('I should be able to trust', () =>
      core.contracts.hub.populateTransaction
        .signup()
        .then(({ data }) =>
          core.safe.sendTransaction(CRCSafeOwner, {
            safeAddress: CRCSafeAddress,
            transactionData: {
              to: core.options.hubAddress,
              data,
            },
          }),
        )
        .then(() =>
          Promise.all([
            // The newly created Safe trusts the migrated Safe
            core.trust.addConnection(otherAccount, {
              canSendTo: otherSafeAddress,
              user: CRCSafeAddress,
              limitPercentage: 65,
            }),
            // The migrated Safe trusts the newly created Safe
            core.trust.addConnection(CRCSafeOwner, {
              canSendTo: CRCSafeAddress,
              user: otherSafeAddress,
              limitPercentage: 65,
            }),
          ]),
        )
        .then(() =>
          core.utils.loop(
            () =>
              getTrustConnection(
                CRCSafeOwner,
                CRCSafeAddress,
                otherSafeAddress,
              ),
            ({ isIncoming, isOutgoing }) => isIncoming && isOutgoing,
            { label: 'Wait for trust connection to be indexed by the Graph' },
          ),
        )
        .then((otherConnection) => {
          expect(otherConnection.safeAddress).toBe(otherSafeAddress);
          expect(otherConnection.isIncoming).toBe(true);
          expect(otherConnection.isOutgoing).toBe(true);
          expect(otherConnection.limitPercentageIn).toBe(65);
          expect(otherConnection.limitPercentageOut).toBe(65);
        }));

    it('I should be able to send Circles to someone directly', async () => {
      const sentCircles = 5;
      const previousBalance = await core.token.getBalance(CRCSafeOwner, {
        safeAddress: CRCSafeAddress,
      });
      const otherAccountPreviousBalance = await core.token.getBalance(
        otherAccount,
        {
          safeAddress: otherSafeAddress,
        },
      );
      // Transfer from the migrated Safe to the newly created Safe
      const transferTransactionHash = await core.token.transfer(CRCSafeOwner, {
        from: CRCSafeAddress,
        to: otherSafeAddress,
        value: ethers.BigNumber.from(core.utils.toFreckles(sentCircles)),
      });

      expect(ethers.utils.isHexString(transferTransactionHash)).toBe(true);

      const accountBalance = await core.utils.loop(
        () =>
          core.token.getBalance(CRCSafeOwner, {
            safeAddress: CRCSafeAddress,
          }),
        (balance) =>
          core.utils.fromFreckles(balance) ===
          core.utils.fromFreckles(previousBalance) - sentCircles,
        {
          label: 'Wait for balance to be lower after user transferred Circles',
        },
      );

      const otherAccountBalance = await core.token.getBalance(otherAccount, {
        safeAddress: otherSafeAddress,
      });

      expect(core.utils.fromFreckles(accountBalance)).toBe(
        core.utils.fromFreckles(previousBalance) - sentCircles,
      );
      expect(core.utils.fromFreckles(otherAccountBalance)).toBe(
        core.utils.fromFreckles(otherAccountPreviousBalance) + sentCircles,
      );
    });

    it('I should be able to add a new owner', () =>
      core.safe
        .addOwner(CRCSafeOwner, {
          safeAddress: CRCSafeAddress,
          ownerAddress: otherAccount.address,
        })
        .then(() =>
          core.safe.getOwners(CRCSafeOwner, { safeAddress: CRCSafeAddress }),
        )
        .then((owners) => {
          expect(owners).toContain(otherAccount.address);
          expect(owners).toHaveLength(2);

          return core.safe.getAddresses(CRCSafeOwner, {
            ownerAddress: otherAccount.address,
          });
        })
        .then((safeAddresses) =>
          expect(safeAddresses).toContain(CRCSafeAddress),
        ));
  });
});
