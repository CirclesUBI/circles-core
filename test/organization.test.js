import { ethers } from 'ethers';

import core from './helpers/core';
import generateSaltNonce from './helpers/generateSaltNonce';
import onboardAccountManually from './helpers/onboardAccountManually';
import deploySafeManually from './helpers/deploySafeManually';
import getTrustConnection from './helpers/getTrustConnection';
import accounts from './helpers/accounts';

describe('Organization', () => {
  const [account, otherAccount] = accounts;
  let safeAddress;
  let userSafeAddress;
  let otherUserSafeAddress;

  beforeAll(async () => {
    // Predeploy manually accounts (safes and token)
    [userSafeAddress, otherUserSafeAddress] = await Promise.all([
      onboardAccountManually({ account, nonce: generateSaltNonce() }).then(
        ({ safeAddress }) => safeAddress,
      ),
      onboardAccountManually({
        account: otherAccount,
        nonce: generateSaltNonce(),
      }).then(({ safeAddress }) => safeAddress),
    ]);

    // Prepare address to deploy safe manually for organisation
    safeAddress = await deploySafeManually({
      account: account,
      nonce: generateSaltNonce(),
    });
  });

  it('should create an organization and return true if it exists', async () => {
    // isOrganization should be false in the beginning
    let isOrganization = await core.organization.isOrganization(account, {
      safeAddress,
    });
    expect(isOrganization).toBe(false);

    // Wait until organisation is deployed
    await core.organization.deploy(account, {
      safeAddress,
    });

    // isOrganization should be true now
    isOrganization = await core.utils.loop(
      () => {
        return core.organization.isOrganization(account, {
          safeAddress,
        });
      },
      (isOrg) => isOrg,
      { label: 'Wait for newly added address to show up as Safe owner' },
    );
    expect(isOrganization).toBe(true);
  });

  it('should prefund the organization so it can pay for its transactions', async () => {
    const value = ethers.BigNumber.from(core.utils.toFreckles(3));

    await core.organization.prefund(account, {
      from: userSafeAddress,
      to: safeAddress,
      value,
    });

    const result = await core.utils.loop(
      () =>
        core.token.listAllTokens(account, {
          safeAddress,
        }),
      (tokens) => tokens.length > 0 && tokens[0].amount.eq(value),
      { label: 'Wait for organization to own some ether' },
    );

    expect(result[0].amount.eq(value)).toBe(true);
  });

  it('should use the funds to execute a transaction on its own', () =>
    core.safe
      .addOwner(account, {
        safeAddress,
        ownerAddress: otherAccount.address,
      })
      .then(() => core.safe.getOwners(account, { safeAddress }))
      .then((owners) => {
        expect(owners).toContain(account.address);
        expect(owners).toHaveLength(2);
        return core.safe.getAddresses(account, {
          ownerAddress: otherAccount.address,
        });
      })
      .then((safeAddresses) => expect(safeAddresses).toContain(safeAddress)));

  it('should be able to trust a user as an organization', () =>
    core.trust
      .addConnection(account, {
        user: otherUserSafeAddress,
        canSendTo: safeAddress,
      })
      .then(() =>
        core.utils.loop(
          () => getTrustConnection(account, safeAddress, otherUserSafeAddress),
          (isReady) => isReady,
          {
            label: 'Wait for the graph to index newly added trust connection',
          },
        ),
      )
      .then((connection) => {
        expect(connection.safeAddress).toBe(otherUserSafeAddress);
        expect(connection.isIncoming).toBe(true);
        expect(connection.isOutgoing).toBe(false);
        expect(connection.limitPercentageIn).toBe(100);
        expect(connection.limitPercentageOut).toBe(0);
      }));

  it('should return the current members(owners) for the organisation', () =>
    core.organization.getMembers(account, { safeAddress }).then((owners) => {
      expect(owners[1].ownerAddress).toEqual(account.address);
    }));
});
