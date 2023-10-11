import core from './core';
import deploySafeManually from './deploySafeManually';

// Set up manually a Safe for being fully usable in Circles
export default async function onboardAccountManually(config) {
  const { account } = config;
  const safeAddress = await deploySafeManually(config);

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
