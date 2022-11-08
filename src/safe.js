import {
  SAFE_THRESHOLD,
  SENTINEL_ADDRESS,
  // eslint-disable-next-line no-unused-vars
  SAFE_LAST_VERSION,
  // eslint-disable-next-line no-unused-vars
  SAFE_BASE_VERSION,
} from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
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
 * Helper method to get the Safe version.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} safeAddress
 *
 * @return {string} - version of the Safe
 */
export async function getVersion(web3, safeAddress) {
  // Get Safe at given address
  const safe = getSafeContract(web3, safeAddress);

  // Call 'VERSION' method and return it
  return await safe.methods.VERSION().call();
}

/**
 * Predict Safe address
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - utils module instance
 * @param {number} nonce - Safe creation salt nonce
 * @param {string} address - Safe owner address
 *
 * @return {string} - predicted Safe address
 */
async function predictAddress(web3, utils, nonce, address) {
  const { safe } = await utils.requestRelayer({
    path: ['safes', 'predict'],
    version: 3,
    method: 'POST',
    data: {
      saltNonce: nonce,
      owners: [address],
      threshold: SAFE_THRESHOLD,
    },
  });

  return web3.utils.toChecksumAddress(safe);
}

/**
 * Returns if the Safe is created and / or deployed.
 *
 * @access private
 *
 * @param {Object} utils - utils module instance
 * @param {string} safeAddress - Safe address
 *
 * @return {Object} - Safe status
 */
async function getSafeStatus(utils, safeAddress) {
  let isCreated = false;
  let isDeployed = false;

  try {
    const { txHash } = await utils.requestRelayer({
      path: ['safes', safeAddress, 'funded'],
      version: 2,
    });
    isCreated = true;
    isDeployed = txHash !== null;
  } catch (error) {
    // Ignore Not Found errors
    if (!error.request || error.request.status !== 404) {
      throw error;
    }
  }

  return {
    isCreated,
    isDeployed,
  };
}

/**
 * Safe submodule to deploy and interact with the Gnosis Safe.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - safe module instance
 */
export default function createSafeModule(web3, contracts, utils) {
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

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return await predictAddress(web3, utils, options.nonce, account.address);
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

      return await getSafeStatus(utils, options.safeAddress);
    },

    /**
     * Register a to-be-created Safe in the Relayer and receive a predicted
     * Safe address.
     *
     * @namespace core.safe.prepareDeploy
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce to predict address
     *
     * @return {string} - Predicted Gnosis Safe address
     */
    prepareDeploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      // Check if Safe already exists
      const predictedSafeAddress = await predictAddress(
        web3,
        utils,
        options.nonce,
        account.address,
      );

      // Return predicted Safe address when Safe is already in the system
      const status = await getSafeStatus(utils, predictedSafeAddress);
      if (status.isCreated) {
        return predictedSafeAddress;
      }

      // .. otherwise start creation of Safe
      const { safe } = await utils.requestRelayer({
        path: ['safes'],
        version: 3,
        method: 'POST',
        data: {
          saltNonce: options.nonce,
          owners: [account.address],
          threshold: SAFE_THRESHOLD,
        },
      });

      return web3.utils.toChecksumAddress(safe);
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

    /**
     * Requests the relayer to not wait for the Safe deployment task.
     * This might still fail when the Safe is not funded or does not
     * have enough trust connections yet.
     *
     * @namespace core.safe.deploy
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - to-be-deployed Safe address
     *
     * @return {boolean} - returns true when successful
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      await utils.requestRelayer({
        path: ['safes', options.safeAddress, 'funded'],
        version: 2,
        method: 'PUT',
      });

      return true;
    },

    /**
     * Requests the relayer to deploy a Safe for an organization. The relayer
     * funds the deployment of this Safe when the account is already known and
     * verified / already has a deployed Safe from before.
     *
     * @namespace core.safe.deployForOrganization
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - to-be-deployed Safe address
     *
     * @return {boolean} - returns true when successful
     */
    deployForOrganization: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      await utils.requestRelayer({
        path: ['safes', options.safeAddress, 'organization'],
        version: 2,
        method: 'PUT',
      });

      return true;
    },

    /**
     * Finds the Safe addresses of an owner.
     *
     * @namespace core.safe.getAddresses
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.ownerAddress - address of the Safe owner
     *
     * @return {string} - Safe address
     */
    getAddresses: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const response = await utils.requestIndexedDB('safe_addresses', options);

      if (!response || !response.user) {
        return [];
      }

      return response.user.safeAddresses.map((address) => {
        return web3.utils.toChecksumAddress(address);
      });
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
     * Add an address as an owner of a given Gnosis Safe.
     *
     * @namespace core.safe.addOwner
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     * @param {number} userOptions.ownerAddress - owner address to be added
     *
     * @return {string} - transaction hash
     */
    addOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Get Safe at given address
      const safe = getSafeContract(web3, options.safeAddress);

      // Prepare 'addOwnerWithThreshold' method
      const txData = safe.methods
        .addOwnerWithThreshold(options.ownerAddress, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.safeAddress,
        to: options.safeAddress,
        txData,
      });
    },

    /**
     * Remove owner of a given Gnosis Safe.
     *
     * @namespace core.safe.removeOwner
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     * @param {number} userOptions.ownerAddress - owner address to be removed
     *
     * @return {string} - transaction hash
     */
    removeOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Get Safe at given address
      const safe = getSafeContract(web3, options.safeAddress);

      // We need the list of owners before ...
      const owners = await getOwners(web3, options.safeAddress);

      // .. to find out which previous owner in the list is pointing at the one we want to remove
      const ownerIndex = owners.findIndex(
        (owner) => owner === options.ownerAddress,
      );

      const prevOwner =
        ownerIndex > 0 ? owners[ownerIndex - 1] : SENTINEL_ADDRESS;

      // Prepare 'removeOwner' method by passing pointing owner and the owner to be removed
      const txData = await safe.methods
        .removeOwner(prevOwner, options.ownerAddress, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.safeAddress,
        to: options.safeAddress,
        txData,
      });
    },

    /**
     * Get Safe version.
     *
     * @namespace core.safe.getVersion
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     *
     * @return {string} - transaction hash
     */
    getVersion: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await getVersion(web3, options.safeAddress);
    },
  };
}
