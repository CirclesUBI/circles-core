export default async function getTrustConnection(
  core,
  account,
  safeAddress,
  otherSafeAddress,
) {
  const network = await core.trust.getNetwork(account, {
    safeAddress,
  });

  return network.find((item) => item.safeAddress === otherSafeAddress);
}
