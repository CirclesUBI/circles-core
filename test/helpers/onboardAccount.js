import core from './core';
import deploySafe from './deploySafe';

// Set up manually a Safe for being fully usable in Circles
export default async function onboardAccount(config) {
  const { account } = config;
  const safeAddress = await deploySafe(config);

  return (
    core.token
      .deploy(account, { safeAddress })
      // Retrieve Token address for Safe
      .then(() => core.token.getAddress(account, { safeAddress }))
      // Return all stuff deployed
      .then((tokenAddress) => ({
        safeAddress,
        tokenAddress,
      }))
  );
}
