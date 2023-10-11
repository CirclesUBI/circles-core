import { ethers } from 'ethers';
const Safe = require('@circles/safe-contracts/build/contracts/GnosisSafe.json');
const ProxyFactory = require('@circles/safe-contracts/build/contracts/ProxyFactory.json');

import { ZERO_ADDRESS } from '~/common/constants';

import ethProvider from './ethProvider';

const createSafeWithProxy = async (proxy, safe, owner) => {
  const { data: initializer } = await safe.populateTransaction.setup(
    [owner.address],
    1,
    ZERO_ADDRESS,
    '0x',
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    0,
    ZERO_ADDRESS,
  );

  const { data } = await proxy.populateTransaction.createProxy(
    process.env.SAFE_CONTRACT_ADDRESS_CRC,
    initializer,
  );
  const { logs } = await owner
    .getTransactionCount()
    .then((nonce) =>
      owner.sendTransaction({
        from: owner.address,
        to: process.env.PROXY_FACTORY_ADDRESS_CRC,
        value: 0,
        nonce,
        data,
      }),
    )
    .then((tx) => tx.wait());

  return new ethers.Contract(
    `0x${logs[1].data.substring(26, 66)}`,
    Safe.abi,
    ethProvider,
  );
};

export default function deployCRCVersionSafe(owner) {
  // Get the CRC version contracts contract
  const safeContract = new ethers.Contract(
    process.env.SAFE_CONTRACT_ADDRESS_CRC,
    Safe.abi,
    ethProvider,
  );
  const proxyFactoryContract = new ethers.Contract(
    process.env.PROXY_FACTORY_ADDRESS_CRC,
    ProxyFactory.abi,
    ethProvider,
  );

  return createSafeWithProxy(proxyFactoryContract, safeContract, owner);
}
