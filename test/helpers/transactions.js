import loop, { getTrustConnection, isReady } from './loop';
import web3 from './web3';

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
