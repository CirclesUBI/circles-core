const Web3 = require('web3');

// import Web3Adapter from '@gnosis.pm/safe-web3-lib';
const Web3Adapter = require('@gnosis.pm/safe-web3-lib').default;
const { SafeFactory } = require('@gnosis.pm/safe-core-sdk');
const { default: create } = require('keccak');

const web3 = new Web3.providers.HttpProvider('http://localhost:8545');
const safeOwner = '0x9a0bbbbd3789f184CA88f2F6A40F42406cb842AB';

const owners = '0x9a0bbbbd3789f184CA88f2F6A40F42406cb842AB';
const threshold = 1;
const saltNonce = '1';
const safeAccountConfig = {
  owners,
  threshold,
};
const safeDeploymentConfig = { saltNonce };
const ethAdapter = new Web3Adapter({
  web3,
  safeOwner,
});

// async function createFactory() {
//   const safeFactory = await SafeFactory.create({ ethAdapter });
//   console.log('safeFactory --- :' + safeFactory);
//   const safeSdk = safeFactory.deploySafe({
//     safeAccountConfig,
//     safeDeploymentConfig,
//   });
//   const newSafeAddress = await safeSdk.getAddress();
//   console.log(safeSdk);
//   console.log(newSafeAddress);
// }
// createFactory();
const createSafe = async () => {
  const safeFactory = await SafeFactory.create({ ethAdapter });
  console.log(safeFactory);
  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
  console.log(safeSdk);
  const newSafeAddress = await safeSdk.getAddress();
  safeSdk();
  console.log(newSafeAddress);
};
createSafe();
