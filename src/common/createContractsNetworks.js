import { getAbis } from '~/common/getContracts';

/**
 * Create Contract Networks object
 *
 * @access private
 *
 * @param {string} chainId - Safe owner address
 * @param {Object} options - contract addresses
 *
 * @return {Object} - Contract Network configuration
 */

export function getContractNetworks(chainId, options) {
  const {
    safeMasterAddress,
    proxyFactoryAddress,
    multiSendAddress,
    multiSendCallAddress,
  } = options;
  const {
    safeMasterCopyAbi,
    safeProxyFactoryAbi,
    multiSendAbi,
    multiSendCallOnlyAbi,
  } = getAbis();
  return {
    [chainId]: {
      multiSendAddress: multiSendAddress,
      multiSendAbi: multiSendAbi,
      multiSendCallOnlyAddress: multiSendCallAddress,
      multiSendCallOnlyAbi: multiSendCallOnlyAbi,
      safeMasterCopyAddress: safeMasterAddress,
      safeMasterCopyAbi: safeMasterCopyAbi,
      safeProxyFactoryAddress: proxyFactoryAddress,
      safeProxyFactoryAbi: safeProxyFactoryAbi,
    },
  };
}
