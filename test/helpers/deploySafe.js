import web3 from './helpers/web3';

export default async function deploySafe(core, account) {
  const safeCreationNonce = new Date().getTime();

  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce: safeCreationNonce,
  });

  // @TODO: Later we will pay our gas fees to the relayer in Circles Token.
  await web3.eth.sendTransaction({
    from: account.address,
    to: safeAddress,
    value: web3.utils.toWei('1', 'ether'),
  });

  await core.safe.deploy(account, {
    address: safeAddress,
  });

  // .. wait for Relayer to really deploy Safe
  await new Promise(resolve => setTimeout(resolve, 1000));

  return safeAddress;
}
