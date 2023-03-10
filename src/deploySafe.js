import Web3 from 'web3';
import Web3Adapter from '@gnosis.pm/safe-web3-lib';
import { SafeFactory } from '@gnosis.pm/safe-core-sdk';
const PROXY_FACTORY_ADDRESS = '0xD833215cBcc3f914bD1C9ece3EE7BF8B14f841bb';
import GnosisSafeContract from '@circles/safe-contracts/build/contracts/GnosisSafe.json';
import MultiSendContract from '@circles/safe-contracts/build/contracts/MultiSend.json';
import MasterCopyContract from '@circles/safe-contracts/build/contracts/MasterCopy.json';
import ProxyFactoryContract from '@circles/safe-contracts/build/contracts/ProxyFactory.json';

/**
 * Transactions submodule execute tx with the Gnosis Safe.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 *
 * @return {Object} - safe module instance
 */

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
web3.eth.net
  .isListening()
  .then(() => console.log('is connected'))
  .catch((e) => console.log('error ' + e));

const contractNetworks = {
  1337: {
    multiSendAddress: '0x9a0bbbbd3789f184CA88f2F6A40F42406cb842AB',
    multiSendAbi: MultiSendContract.abi,
    safeMasterCopyAddress: '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
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

async function createFactory() {
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });
  console.log('safeFactory --- ' + JSON.stringify(safeFactory));

  const safeSdk = await safeFactory.deploySafe({
    safeAccountConfig,
    safeDeploymentConfig,
  });
  //  const newSafeAddress = await safeSdk.getAddress();
  console.log(safeSdk);
  //console.log(newSafeAddress);
}
createFactory();
