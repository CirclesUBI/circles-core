import core from './core';
import generateSaltNonce from './generateSaltNonce';
import getTrustConnection from './getTrustConnection';
import onboardAccount from './onboardAccount';

export default async function deployTestNetwork({ accounts, connections }) {
  // Deploy Safes and sign them up in Hub
  const addresses = await Promise.all(
    accounts.map((account) =>
      onboardAccount({ account, nonce: generateSaltNonce() }),
    ),
  );
  const [safeAddresses, tokenAddresses] = addresses.reduce(
    (acc, { safeAddress, tokenAddress }) => [
      [...acc[0], safeAddress],
      [...acc[1], tokenAddress],
    ],
    [[], []],
  );

  // Generate a promise chain per Safe trusting Safes one after the other.
  // If it is not done like this, with the same Safe trusting at the same time
  // multiple Safes, it will use the same nonce internally and crash with nonce collision
  const trustsPackCalls = Object.keys(connections).map((key) =>
    connections[key].reduce(
      (acc, curr) =>
        acc
          .then(() =>
            core.trust.addConnection(accounts[key], {
              canSendTo: safeAddresses[key],
              user: safeAddresses[curr[0]],
              limitPercentage: curr[1],
            }),
          )
          .then(() =>
            core.utils.loop(
              () =>
                getTrustConnection(
                  accounts[key],
                  safeAddresses[key],
                  safeAddresses[curr[0]],
                ),
              (isReady) => isReady,
              {
                label:
                  'Wait for the graph to index newly added trust connection',
              },
            ),
          ),
      Promise.resolve(),
    ),
  );

  // Wait for all Safe promise chains
  await Promise.all(trustsPackCalls);

  return {
    safeAddresses,
    tokenAddresses,
  };
}
