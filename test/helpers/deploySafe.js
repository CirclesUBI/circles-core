import loop from './loop';
import web3 from './web3';

let counter = 0;

export default async function deploySafe(core, account) {
  counter += 1;

  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce: parseInt(`${counter}${Math.round(Math.random() * 10000)}`, 10),
  });

  await core.safe.deploy(account, {
    safeAddress,
  });

  // .. wait for Relayer to really deploy Safe
  await loop(() => web3.eth.getCode(safeAddress));

  return safeAddress;
}
