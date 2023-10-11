import { DEFAULT_USER_LIMIT_PERCENTAGE } from '~/common/constants';

import core from './helpers/core';
import getTrustConnection from './helpers/getTrustConnection';
import accounts from './helpers/accounts';
import onboardAccountManually from './helpers/onboardAccountManually';
import generateSaltNonce from './helpers/generateSaltNonce';

describe('Trust', () => {
  const [account, otherAccount] = accounts;
  let safeAddress;
  let otherSafeAddress;

  beforeAll(async () => {
    [safeAddress, otherSafeAddress] = await Promise.all([
      onboardAccountManually({ account, nonce: generateSaltNonce() }).then(
        ({ safeAddress }) => safeAddress,
      ),
      onboardAccountManually({
        account: otherAccount,
        nonce: generateSaltNonce(),
      }).then(({ safeAddress }) => safeAddress),
    ]);
  });

  describe('when trusting', () => {
    it('should trust a safeAddress', () =>
      core.trust
        .addConnection(account, {
          user: otherSafeAddress,
          canSendTo: safeAddress,
        })
        .then(() =>
          core.utils.loop(
            () => getTrustConnection(account, safeAddress, otherSafeAddress),
            (isReady) => isReady,
            {
              label: 'Wait for the graph to index newly added trust connection',
            },
          ),
        )
        .then((connection) => {
          expect(connection.safeAddress).toBe(otherSafeAddress);
          expect(connection.isIncoming).toBe(true);
          expect(connection.isOutgoing).toBe(false);
          expect(connection.limitPercentageIn).toBe(
            DEFAULT_USER_LIMIT_PERCENTAGE,
          );
          expect(connection.limitPercentageOut).toBe(0);
        }));

    it('the other safeAddress should be trusted', () =>
      core.utils
        .loop(
          () => getTrustConnection(otherAccount, otherSafeAddress, safeAddress),
          (isReady) => isReady,
          { label: 'Wait for trust connection to be indexed by the graph' },
        )
        .then((otherConnection) => {
          expect(otherConnection.safeAddress).toBe(safeAddress);
          expect(otherConnection.isIncoming).toBe(false);
          expect(otherConnection.isOutgoing).toBe(true);
          expect(otherConnection.limitPercentageIn).toBe(0);
          expect(otherConnection.limitPercentageOut).toBe(
            DEFAULT_USER_LIMIT_PERCENTAGE,
          );
        }));

    it('bidirectional trust should be possible', () =>
      core.trust
        .addConnection(otherAccount, {
          user: safeAddress,
          canSendTo: otherSafeAddress,
          limitPercentage: 72,
        })
        .then(() =>
          core.utils.loop(
            () =>
              getTrustConnection(otherAccount, otherSafeAddress, safeAddress),
            ({ isIncoming, isOutgoing }) => isIncoming && isOutgoing,
            { label: 'Wait for trust connection to be indexed by the Graph' },
          ),
        )
        .then((otherConnection) => {
          expect(otherConnection.safeAddress).toBe(safeAddress);
          expect(otherConnection.isIncoming).toBe(true);
          expect(otherConnection.isOutgoing).toBe(true);
          expect(otherConnection.limitPercentageIn).toBe(72);
          expect(otherConnection.limitPercentageOut).toBe(
            DEFAULT_USER_LIMIT_PERCENTAGE,
          );
        }));

    it('safeAddress should be trusted', () =>
      core.trust
        .isTrusted(otherAccount, {
          safeAddress,
          limit: 1,
        })
        .then(({ isTrusted }) => expect(isTrusted).toBe(true)));
  });

  describe('when untrusting', () => {
    it('should untrust someone', () =>
      Promise.all([
        core.trust.removeConnection(account, {
          user: otherSafeAddress,
          canSendTo: safeAddress,
        }),
        core.trust.removeConnection(otherAccount, {
          user: safeAddress,
          canSendTo: otherSafeAddress,
        }),
      ])
        .then(() =>
          core.utils.loop(
            () =>
              core.trust.getNetwork(account, {
                safeAddress,
              }),
            (network) => network.length === 0,
            {
              label: 'Wait for trust network to be empty after untrusting user',
            },
          ),
        )
        .then((network) => expect(network.length).toBe(0)));

    it('safeAddress should be untrusted', () =>
      core.trust
        .isTrusted(otherAccount, {
          safeAddress,
          limit: 1,
        })
        .then(({ trustConnections }) => expect(trustConnections).toBe(1)));
  });
});
