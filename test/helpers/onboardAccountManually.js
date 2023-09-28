import deploySafeManually from './deploySafeManually';

// Set up manually a Safe for being fully usable in Circles
export default async function onboardAccountManually(config, core) {
  const { token } = core;
  const { account } = config;
  const safeAddress = await deploySafeManually(config, core);

  return (
    token
      .deploy(account, { safeAddress })
      // Retrieve Token address for Safe
      .then(() => token.getAddress(account, { safeAddress }))
      // Return all stuff deployed
      .then((tokenAddress) => ({
        safeAddress,
        tokenAddress,
      }))
  );
}
