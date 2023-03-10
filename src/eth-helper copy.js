import Web3 from 'web3';
import Web3Adapter from '@gnosis.pm/safe-web3-lib';
import { SafeFactory } from '@gnosis.pm/safe-core-sdk';
import GnosisSafeContract from '@circles/safe-contracts/build/contracts/GnosisSafe.json';
import MultiSendContract from '@circles/safe-contracts/build/contracts/MultiSend.json';
import MasterCopyContract from '@circles/safe-contracts/build/contracts/MasterCopy.json';
import ProxyFactoryContract from '@circles/safe-contracts/build/contracts/ProxyFactory.json';
import getContracts from './common/getContracts.js';

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const PROXY_FACTORY_ADDRESS = '0x26b4AFb60d6C903165150C6F0AA14F8016bE4aec';
const MULTISEND_ADDRESS = '0x67B5656d60a809915323Bf2C40A8bEF15A152e3e';
const MASTERCOPY_ADDRESS = '0x2612Af3A521c2df9EAF28422Ca335b04AdF3ac66';

async function getChainId() {
  return web3.eth.getChainId();
}

let chainID = await getChainId();
//console.log(chainID);
const { proxyFactory, masterCopy } = getContracts(web3, {
  proxyFactoryAddress: PROXY_FACTORY_ADDRESS,
  multiSendAddress: MULTISEND_ADDRESS,
  masterCopyAddress: MASTERCOPY_ADDRESS,
});

const contractNetworks = {
  [chainID]: {
    multiSendAddress: MULTISEND_ADDRESS,
    multiSendAbi: MultiSendContract.abi,
    safeMasterCopyAddress: MASTERCOPY_ADDRESS,
    safeMasterCopyAbi: MasterCopyContract.abi,
    safeProxyFactoryAddress: PROXY_FACTORY_ADDRESS,
    safeProxyFactoryAbi: ProxyFactoryContract.abi,
  },
};
// const safeOwner = '0x9a0bbbbd3789f184CA88f2F6A40F42406cb842AB';
const owners = '0x9a0bbbbd3789f184CA88f2F6A40F42406cb842AB';
const threshold = 1;
const saltNonce = '1';
const safeAccountConfig = {
  owners,
  threshold,
};
const safeDeploymentConfig = { saltNonce };
const ethAdapter = new Web3Adapter.default({
  web3,
  owners,
});
console.log(ethAdapter.getChainId());
const predictSafeProps = { safeAccountConfig, safeDeploymentConfig };
async function createFactory() {
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });
  const predAddress = await safeFactory.predictSafeAddress(predictSafeProps);
  console.log('predAddress' + predAddress);
  const d = await safeFactory.getEthAdapter().getSignerAddress();
  console.log('safeFactory --- ' + d);

  const safeSdk = await safeFactory.deploySafe({
    safeAccountConfig,
    safeDeploymentConfig,
  });
  //  const newSafeAddress = await safeSdk.getAddress();
  console.log(safeSdk);
  //console.log(newSafeAddress);
}
createFactory();
