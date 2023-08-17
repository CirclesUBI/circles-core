const Safe = require('@circles/safe-contracts/build/contracts/GnosisSafe.json');
const ProxyFactory = require('@circles/safe-contracts/build/contracts/ProxyFactory.json');

import { ZERO_ADDRESS } from '~/common/constants';

const signAndSendRawTransaction = async (
  web3,
  account,
  to,
  data,
  gas = 10000000,
) => {
  const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
  const payload = {
    nonce,
    data,
    from: account.address,
    to,
    gas,
    gasPrice: '0x3b9aca00',
    value: 0,
  };
  if (gas == 0) {
    payload.gas = await web3.eth.estimateGas(payload);
  } else {
    payload.gas = gas;
  }

  const signedTx = await web3.eth.accounts.signTransaction(
    payload,
    account.privateKey,
  );
  const { rawTransaction } = signedTx;

  return web3.eth.sendSignedTransaction(rawTransaction);
};

const createSafeWithProxy = async (web3, proxy, safe, owner) => {
  const proxyData = safe.methods
    .setup(
      [owner.address],
      1,
      ZERO_ADDRESS,
      '0x',
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    )
    .encodeABI();

  const data = proxy.methods
    .createProxy(safe.options.address, proxyData)
    .encodeABI();

  const tx = await signAndSendRawTransaction(
    web3,
    owner,
    proxy.options.address,
    data,
  );

  const { logs } = tx;

  const userSafeAddress = `0x${logs[1].data.substring(26, 66)}`;

  return new web3.eth.Contract(Safe.abi, userSafeAddress);
};

export async function deployCRCVersionSafe(web3, owner) {
  // Get the CRC version contracts contract
  const safeContract = new web3.eth.Contract(
    Safe.abi,
    process.env.SAFE_CONTRACT_ADDRESS_CRC,
  );
  const proxyFactoryContract = new web3.eth.Contract(
    ProxyFactory.abi,
    process.env.PROXY_FACTORY_ADDRESS_CRC,
  );

  return await createSafeWithProxy(
    web3,
    proxyFactoryContract,
    safeContract,
    owner,
  );
}
