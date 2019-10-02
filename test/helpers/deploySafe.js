export default async function deploySafe(core, account) {
  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce: new Date().getTime(),
  });

  await core.safe.deploy(account, {
    address: safeAddress,
  });

  // .. wait for Relayer to really deploy Safe
  await new Promise(resolve => setTimeout(resolve, 1000));

  return safeAddress;
}
