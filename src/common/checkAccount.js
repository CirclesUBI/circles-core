import { ethers } from 'ethers';

import checkOptions from '~/common/checkOptions';
import checkAddressChecksum from '~/common/checkAddressChecksum';

/**
 * Convenience wrapper function around checkOptions to validate eth accounts
 * @access private
 * @param {Object} account - Wallet account instance
 * @return {Object} - cleaned options
 */
export default function checkAccount(account) {
  return checkOptions(account, {
    address: checkAddressChecksum,
    privateKey: ethers.utils.isHexString,
  });
}
