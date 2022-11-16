const Safe = require('@circles/safe-contracts/build/contracts/GnosisSafe.json');
const ProxyFactory = require('@circles/safe-contracts/build/contracts/ProxyFactory.json');

import { formatTypedData, signTypedData } from './typedData.js';
import loop, { getTrustConnection, isReady } from './loop';
import web3 from './web3';
import { ZERO_ADDRESS } from '~/common/constants';

const SAFE_DEPLOYMENT_GAS = web3.utils.toWei('0.01', 'ether');

let counter = 0;

export async function fundSafe(account, safeAddress) {
  // Fund deployment (we don't want to wait to have enough trust connections)
  return await web3.eth.sendTransaction({
    from: account.address,
    to: safeAddress,
    value: SAFE_DEPLOYMENT_GAS,
  });
}

export async function deploySafe(core, account) {
  counter += 1;

  const nonce = parseInt(`${counter}${Math.round(Math.random() * 10000)}`, 10);

  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce,
  });

  await fundSafe(account, safeAddress);

  await core.safe.deploy(account, {
    safeAddress,
  });

  await loop(`Wait until Safe ${safeAddress} got deployed`, () =>
    web3.eth.getCode(safeAddress),
  );

  return safeAddress;
}

export async function deployToken(core, account, userOptions) {
  await core.token.deploy(account, userOptions);

  const tokenAddress = await core.token.getAddress(account, userOptions);

  return tokenAddress;
}

export async function deploySafeAndToken(core, account) {
  const safeAddress = await deploySafe(core, account);
  const tokenAddress = await deployToken(core, account, { safeAddress });

  return {
    safeAddress,
    tokenAddress,
  };
}

export async function addTrustConnection(core, account, userOptions) {
  const transactionHash = await core.trust.addConnection(account, userOptions);

  await loop(
    `Wait for trust connection between ${userOptions.canSendTo} and ${userOptions.user} to show up in the Graph`,
    () => {
      return getTrustConnection(
        core,
        account,
        userOptions.canSendTo,
        userOptions.user,
      );
    },
    isReady,
  );

  return transactionHash;
}

export async function addSafeOwner(core, account, userOptions) {
  const transactionHash = await core.safe.addOwner(account, userOptions);

  await loop(
    'Wait for newly added address to be listed as Safe owner',
    () => {
      return core.safe.getOwners(account, {
        safeAddress: userOptions.safeAddress,
      });
    },
    (owners) => {
      return owners.includes(userOptions.ownerAddress);
    },
  );

  return transactionHash;
}

export async function deployCRCVersionSafe(account, owner) {
  // Get the CRC version contracts contract
  const safeContract = new web3.eth.Contract(
    Safe.abi,
    process.env.SAFE_CONTRACT_ADDRESS_CRC,
  );
  const proxyFactoryContract = new web3.eth.Contract(
    ProxyFactory.abi,
    process.env.PROXY_FACTORY_ADDRESS_CRC,
  );

  const gnosisSafeData = await safeContract.methods
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

  const proxyCreated = await proxyFactoryContract.methods
    .createProxy(safeContract.options.address, gnosisSafeData)
    .send({
      from: account.address,
      gas: 10000000,
    });

  return proxyCreated.events['ProxyCreation'].returnValues['proxy'];
}

async function execTransaction(account, safeInstance, { to, from, value = 0, txData }) {
  const operation = 0; // CALL
  const safeTxGas = '1239215'; // based on data // @TODO: CHANGE
  const baseGas = '1239215'; // general transaction // @TODO: CHANGE
  const gasPrice = 0; // no refund
  const gasToken = ZERO_ADDRESS; // Paying in Eth
  const refundReceiver = ZERO_ADDRESS;
  const nonce = await safeInstance.methods.nonce().call();
  const safeAddress = safeInstance.options.address;

  const typedData = formatTypedData({
      to,
      value,
      txData,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
      verifyingContract: safeAddress,
  });
  const signature = signTypedData(account.privateKey, typedData);
  const signatures = signature;

  return await safeInstance.methods
      .execTransaction(
      to,
      value,
      txData,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      signatures,
      )
      .send({ from, gas: '10000000' }); // @TODO: '1266349' ?  Need to change gas, safeTxGase, baseGas
}

export async function deployCRCVersionToken(web3, account, safe, hub) {
  await execTransaction(account, safe, {
    to: hub.options.address,
    from: account.address,
    txData: hub.methods.signup().encodeABI(),
  });

  return await hub.methods
    .userToToken(safe.options.address)
    .call();
}
