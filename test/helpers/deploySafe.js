import loop from './loop';
import web3 from './web3';

export default async function deploySafe(core, account) {
  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce: new Date().getTime(),
  });

  await core.safe.deploy(account, {
    safeAddress,
  });

  // .. wait for Relayer to really deploy Safe
  await loop(() => web3.eth.getCode(safeAddress));

  return safeAddress;
}
