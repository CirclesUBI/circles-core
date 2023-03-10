import Web3Adapter from '@gnosis.pm/safe-web3-lib';
import { SafeFactory } from '@gnosis.pm/safe-core-sdk';
import SafeServiceClient from '@gnosis.pm/safe-service-client';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getContractNetworks } from './common/createContractsNetworks';
import { ZERO_ADDRESS, CALL_OP } from '~/common/constants';
import {
  SAFE_THRESHOLD,
  SENTINEL_ADDRESS,
  TX_SERVICE_URL,
} from '~/common/constants';
import { getSafeContract } from '~/common/getContracts';

/**
 * Helper method to receive a list of all Gnosis Safe owners.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} safeAddress
 *
 * @return {string[]} - array of owner addresses
 */
export async function getOwners(web3, safeAddress) {
  // Get Safe at given address
  const safe = getSafeContract(web3, safeAddress);

  // Call 'getOwners' method and return list of owners
  return await safe.methods.getOwners().call();
}
/**
 * Deploy Safe
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {number} nonce - Safe creation salt nonce
 * @param {string} address - Safe owner address
 * @param {Object} globalOptions - global core options
 *
 * @return {string} - deployed Safe address
 */
async function deploySafe(web3, nonce, address, options) {
  const ethAdapter = new Web3Adapter({
    web3,
    signerAddress: address,
  });
  const chainId = await ethAdapter.getChainId();
  const contractNetworks = getContractNetworks(chainId, options);
  const threshold = SAFE_THRESHOLD;
  const strNonce = JSON.stringify(nonce['nonce']);
  const owners = [address];
  const safeAccountConfig = {
    owners,
    threshold,
  };
  const safeDeploymentConfig = { saltNonce: strNonce };
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });
  const callback = (txHash) => {
    console.log({ txHash });
  };
  const safeSDK = await safeFactory.deploySafe({
    safeAccountConfig,
    safeDeploymentConfig,
    callback,
  });
  const deployedSafeAddress = safeSDK.getAddress();
  return deployedSafeAddress;
}

/**
 * Predict safe address
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {number} nonce - Safe creation salt nonce
 * @param {string} address - Safe owner address
 * @param {Object} globalOptions - global core options
 *
 * @return {string} - predicted Safe address
 */
async function predictAddress(web3, nonce, address, options) {
  const ethAdapter = new Web3Adapter({
    web3,
    signerAddress: address,
  });
  const chainId = await ethAdapter.getChainId();
  const contractNetworks = getContractNetworks(chainId, options);
  const threshold = SAFE_THRESHOLD;
  const strNonce = JSON.stringify(nonce['nonce']);
  const owners = [address];
  const safeAccountConfig = {
    owners,
    threshold,
  };
  const safeDeploymentConfig = { saltNonce: strNonce };
  const predictSafeProps = { safeAccountConfig, safeDeploymentConfig };
  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });
  const predAddress = await safeFactory.predictSafeAddress(predictSafeProps);
  return web3.utils.toChecksumAddress(predAddress);
}

/**
 * Returns if the Safe is created.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} address - Safe owner address
 * @param {string} safeAddress - Safe address
 *
 * @return {Object} - Safe status
 */
async function getSafeStatus(web3, address, safeAddress) {
  console.log('getstatus');
  let isCreated = false;
  const ethAdapter = new Web3Adapter({
    web3,
    signerAddress: address,
  });
  const safeService = new SafeServiceClient({
    txServiceUrl: 'https://safe-transaction.xdai.gnosis.io',
    ethAdapter,
  });
  try {
    console.log('inside try');
    const safeCreationInfo = await safeService.getSafeCreationInfo(safeAddress);
    console.log(safeCreationInfo);
    const txHash = safeCreationInfo['transactionHash'];

    if (txHash !== null) isCreated = true;
  } catch (error) {
    // Ignore Not Found errors
    if (!error.request || error.request.status !== 404) {
      throw error;
    }
  }

  return {
    isCreated,
  };
}

/**
 * Safe submodule to deploy and interact with the Gnosis Safe.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} globalOptions - global core options
 *
 * @return {Object} - safe module instance
 */
export default function createSafeModule(web3, globalOptions) {
  return {
    /**
     * Predict Safe address.
     *
     * @namespace core.safe.predictAddress
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce to predict address
     *
     * @return {string} - Predicted Gnosis Safe address
     */
    predictAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      const nonce = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return await predictAddress(web3, nonce, account.address, globalOptions);
    },
    /**
     * Returns status of a Safe in the system. Is it created or already
     * deployed?
     *
     * @namespace core.safe.getSafeStatus
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - Safe address
     *
     * @return {Object} - Safe status
     */
    getSafeStatus: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await getSafeStatus(web3, account.address, options.safeAddress);
    },
    /**
     * Returns a list of all owners of the given Gnosis Safe.
     *
     * @namespace core.safe.getOwners
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     *
     * @return {string[]} - array of owner addresses
     */
    getOwners: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await getOwners(web3, options.safeAddress);
    },
    /**
     * Deploy Safe.
     *
     * @namespace core.safe.deploySafe
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce to predict address
     *
     * @return {string} - Predicted Gnosis Safe address
     */
    deploySafe: async (account, userOptions) => {
      checkAccount(web3, account);

      const nonce = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return await deploySafe(web3, nonce, account.address, globalOptions);
    },

    /**
     * Returns true if there are enough balance on this address to deploy
     * a Safe.
     *
     * @namespace core.safe.isFunded
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.safeAddress - safe address to check
     *
     * @return {boolean} - has enough funds
     */
    isFunded: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      try {
        const result = await utils.requestRelayer({
          path: ['safes', 'estimates'],
          data: {
            numberOwners: 1,
          },
          version: 3,
          method: 'POST',
        });

        const balance = await web3.eth.getBalance(options.safeAddress);

        return web3.utils.toBN(balance).gte(web3.utils.toBN(result[0].payment));
      } catch {
        return false;
      }
    },
  };
}

//  /**
//      * Returns a list of all owners of the given Gnosis Safe.
//      *
//      * @namespace core.safe.getOwners
//      *
//      * @param {Object} account - web3 account instance
//      * @param {Object} userOptions - options
//      * @param {number} userOptions.safeAddress - address of the Gnosis Safe
//      *
//      * @return {string[]} - array of owner addresses
//      */

//   getOwners: async (account, userOptions) => {
//     checkAccount(web3, account);

//     const options = checkOptions(userOptions, {
//       safeAddress: {
//         type: web3.utils.checkAddressChecksum,
//       },
//     });

//     return await getOwners(web3, options.safeAddress);
//   },
