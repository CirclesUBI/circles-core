import { ethers } from 'ethers';

import checkOptions from '~/common/checkOptions';

/**
 * Convenience wrapper function around checkOptions to validate eth accounts
 * @access private
 * @param {Object} account - Wallet account instance
 * @return {Object} - cleaned options
 */
export default function checkAccount(account) {
  return checkOptions(account, {
    address: ethers.utils.isAddress,
    privateKey: ethers.utils.isHexString,
  });
}
