import loop, { getTrustConnection, isReady } from './loop';
import web3 from './web3';

let counter = 0;

export async function deploySafe(core, account) {
  counter += 1;

  const nonce = parseInt(`${counter}${Math.round(Math.random() * 10000)}`, 10);

  const safeAddress = await core.safe.prepareDeploy(account, {
    nonce,
  });

  await core.safe.deploy(account, {
    safeAddress,
  });

  await loop(() => web3.eth.getCode(safeAddress));

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

  await loop(() => {
    return getTrustConnection(
      core,
      account,
      userOptions.canSendTo,
      userOptions.user,
    );
  }, isReady);

  return transactionHash;
}

export async function addSafeOwner(core, account, userOptions) {
  const transactionHash = await core.safe.addOwner(account, userOptions);

  await loop(
    () => {
      return core.safe.getOwners(account, {
        safeAddress: userOptions.safeAddress,
      });
    },
    owners => {
      return owners.includes(userOptions.ownerAddress);
    },
  );

  return transactionHash;
}
