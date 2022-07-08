import GnosisSafeContract from '@circles/safe-contracts/build/contracts/GnosisSafe.json';
import HubContract from '@circles/circles-contracts/build/contracts/Hub.json';
import ProxyFactoryContract from '@circles/safe-contracts/build/contracts/ProxyFactory.json';
import TokenContract from '@circles/circles-contracts/build/contracts/Token.json';

/**
 * Helper method to get a deployed smart contract instance.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} abi - contract abi
 * @param {Object} address - contract address
 *
 * @return {Object} - contract instance
 */
function getContract(web3, abi, address) {
  return new web3.eth.Contract(abi, address);
}

/**
 * Returns deployed Gnosis Safe smart contract instance.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} address - contract address
 *
 * @return {Object} - contract instance
 */
export function getSafeContract(web3, address) {
  return getContract(web3, GnosisSafeContract.abi, address);
}

/**
 * Returns deployed Circles Token smart contract instance.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} address - contract address
 *
 * @return {Object} - contract instance
 */
export function getTokenContract(web3, address) {
  return getContract(web3, TokenContract.abi, address);
}

/**
 * Helper method to get all required deployed contract instances.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} options - contract addresses
 *
 * @return {Object} - contract instances
 */
export default function getContracts(web3, options) {
  const { safeMasterAddress, proxyFactoryAddress, hubAddress } = options;

  // Gnosis master Safe copy
  const safeMaster = getSafeContract(web3, safeMasterAddress);

  // Gnosis ProxyFactory
  const proxyFactory = getContract(
    web3,
    ProxyFactoryContract.abi,
    proxyFactoryAddress,
  );

  // Circles Hub
  const hub = getContract(web3, HubContract.abi, hubAddress);

  return {
    hub,
    proxyFactory,
    safeMaster,
  };
}
