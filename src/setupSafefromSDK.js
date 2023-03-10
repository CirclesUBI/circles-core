import Web3 from 'web3';
import Web3WsProvider from 'web3-providers-ws';
import Web3Adapter from '@gnosis.pm/safe-web3-lib';
import { SafeFactory } from '@gnosis.pm/safe-core-sdk';
import GnosisSafeContract from '@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafe.sol/GnosisSafe.json';
import MultiSendContract from '@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json';
import MultiSendCallOnly from '@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/MultiSendCallOnly.sol/MultiSendCallOnly.json';
import ProxyFactoryContract from '@gnosis.pm/safe-contracts/build/artifacts/contracts/proxies/GnosisSafeProxyFactory.sol/GnosisSafeProxyFactory.json';
import getContracts from './common/getContracts.js';
import { ZERO_ADDRESS, CALL_OP } from './common/constants.js';
import SafeServiceClient from '@gnosis.pm/safe-service-client';
const PROXY_FACTORY_ADDRESS = '0xe982E462b094850F12AF94d21D470e21bE9D0E9C';
const MULTISEND_ADDRESS = '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550';
const SAFE_ADDRESS = '0xD833215cBcc3f914bD1C9ece3EE7BF8B14f841bb';
const MULTISENDCALL_ADDRESS = '0x26b4AFb60d6C903165150C6F0AA14F8016bE4aec';
import { getSafeContract } from './common/getContracts.js';

const web3 = new Web3(new Web3WsProvider('http://localhost:8545'));

const safeOwner = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';

const safe = getSafeContract(
  web3,
  '0x61C0244A253CDf4cBDC8e7D50636ef2cb86DcC68',
);

//Call 'getOwners' method and return list of owners
async function testtt() {
  const owner = await safe.methods.getOwners().call();
  console.log(owner);
}
testtt();
// const contracts = await getContracts(web3, {
//   hubAddress: ZERO_ADDRESS,
//   proxyFactoryAddress: ZERO_ADDRESS,
//   safeMasterAddress: '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
// });
// const { safeMaster } = contracts;
// console.log('safeMaster.abi' + JSON.stringify(safeMaster.abi));

const checksumSafeOwner = web3.utils.toChecksumAddress(
  '0xDeE1914C49458799fFD25DB3960d521a42D80731',
);
const ethAdapter = new Web3Adapter.default({
  web3,
  signerAddress: safeOwner,
});
const safeService = new SafeServiceClient.default({
  txServiceUrl: 'https://safe-transaction.xdai.gnosis.io',
  ethAdapter,
});
console.log(safeService);
async function createFactory() {
  const id = await ethAdapter.getChainId();
  const contractNetworks = {
    [id]: {
      multiSendAddress: MULTISEND_ADDRESS,
      multiSendAbi: MultiSendContract.abi,
      safeMasterCopyAddress: SAFE_ADDRESS,
      safeMasterCopyAbi: GnosisSafeContract.abi,
      safeProxyFactoryAddress: PROXY_FACTORY_ADDRESS,
      safeProxyFactoryAbi: ProxyFactoryContract.abi,
      multiSendCallOnlyAddress: MULTISENDCALL_ADDRESS,
      multiSendCallOnlyAbi: MultiSendCallOnly.abi,
    },
  };

  const owners = [safeOwner];
  const threshold = 1;
  const safeAccountConfig = {
    owners,
    threshold,
  };
  const safeDeploymentConfig = { saltNonce: '1234288723137' };
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });

  const predAddress = await safeFactory.predictSafeAddress(predictSafeProps);
  console.log('predAddress -- ' + predAddress);
  const callback = (txHash) => {
    console.log({ txHash });
  };
  const predictSafeProps = {
    safeAccountConfig,
    safeDeploymentConfig,
    callback,
  };

  const safeSdk = await safeFactory.deploySafe(predictSafeProps);
  const safeAddress = safeSdk.getAddress();
  console.log('safeAddress---' + safeAddress);
  //const newSafeAddress = await safeSdk.getAddress();
  // console.log(safeFactory.getAddress());
  // console.log(contractNetworks[networkId].safeProxyFactoryAddress);
  // console.log(await safeFactory.getEthAdapter().getSignerAddress());
  const deployedSafeOwners = await safeSdk.getOwners();
  console.log('deployedSafeOwners   ' + deployedSafeOwners);
  console.log('Owners' + owners);
  const deployedSafeThreshold = await safeSdk.getThreshold();
  console.log('deployedSafeThreshold    ' + deployedSafeThreshold);
  const safeInitialBalance = await safeSdk.getBalance();
  console.log('balance   ' + safeInitialBalance.toHexString());

  // const serviceInfo = await safeService.getServiceInfo();
  // console.log('serviceInfo' + JSON.stringify(serviceInfo));

  // const checksumSafeOwner = web3.utils.toChecksumAddress(
  //   '0xDeE1914C49458799fFD25DB3960d521a42D80731',
  // );

  // const safesOwner = await safeService.getSafesByOwner(
  //   '0xDeE1914C49458799fFD25DB3960d521a42D80731',
  // );
  // console.log('safes owners ' + JSON.stringify(safesOwner));
  // //safeinfo {"safes":["0x4415fA0D3851179D7eC9EBeE1A1D36181c615124","0x3A8e7d40a9E294dd765220A5c29aAbFa4716b06d","0x94A621b66807365192cca0C87B42f77Cdfb9a915","0xA983f49294fA911Cf5d20817D16A01B7d45A4a76","0xAa924c1329dB88767BD7d14Faf9894363C3cd5D6","0xC5B3F34045922f86e9055547BaF9a4B0884a4E4a","0x9BA1Bcd88E99d6E1E03252A70A63FEa83Bf1208c","0x9f5FF18027ADBB65A53086CDc09D12ce463daE0B"]}
  // const safeCreationInfo = await safeService.getSafeCreationInfo(
  //   '0x4415fA0D3851179D7eC9EBeE1A1D36181c615124',
  // );
  // console.log('safe creation info :' + JSON.stringify(safeCreationInfo));
  // const safeOnfo = await safeService.getSafeInfo(
  //   '0x4415fA0D3851179D7eC9EBeE1A1D36181c615124',
  // );
  // console.log('safe info :' + safeCreationInfo['transactionHash']);
}

createFactory();

// // web3.eth.net
// //   .isListening()
// //   .then(() => console.log('is connected'))
// //   .catch((e) => console.log('Wow. Something went wrong: ' + e));

// // hub_address: 0xCfEB869F69431e42cdB54A4F4f105C19C080A601

// ///
