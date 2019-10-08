import { SAFE_THRESHOLD, SENTINEL_ADDRESS } from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeContract } from '~/common/getContracts';

/**
 * Helper method to receive a list of all Gnosis Safe owners.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} address
 *
 * @return {string[]} - array of owner addresses
 */
async function getOwners(web3, address) {
  // Get Safe at given address
  const safe = getSafeContract(web3, address);

  // Call 'getOwners' method and return list of owners
  return await safe.methods.getOwners().call();
}

/**
 * Safe submodule to deploy and interact with the Gnosis Safe.
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
     * Register a to-be-created Safe in the Relayer and receive
     * a predicted Safe address.
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

      const response = await utils.requestRelayer({
        path: ['safes'],
        version: 2,
        method: 'POST',
        data: {
          saltNonce: options.nonce,
          owners: [account.address],
          threshold: SAFE_THRESHOLD,
        },
      });

      return response.safe;
    },

    /**
     * Requests the relayer to not wait for the Safe deployment task.
     * This might still fail when the Safe is not funded or does not
     * have enough trust connections yet.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.address - to-be-deployed Safe address
     *
     * @return {boolean} - returns true when successful
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      await utils.requestRelayer({
        path: ['safes', options.address, 'funded'],
        version: 2,
        method: 'PUT',
      });

      return true;
    },

    /**
     * Finds the Safe address of an owner.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.address - address of the Safe owner
     *
     * @return {string} - Safe address
     */
    getSafeAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      // eslint-disable-next-line no-unused-vars
      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // @TODO: Implement this when Caching Service is ready.

      throw new Error('Not implemented');
    },

    /**
     * Returns a list of all owners of the given Gnosis Safe.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.address - address of the Gnosis Safe
     *
     * @return {string[]} - array of owner addresses
     */
    getOwners: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return getOwners(web3, options.address);
    },

    /**
     * Add an address as an owner of a given Gnosis Safe.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.address - address of the Gnosis Safe
     * @param {number} userOptions.owner - owner address to be added
     */
    addOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.checkAddressChecksum,
        },
        owner: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Get Safe at given address
      const safe = getSafeContract(web3, options.address);

      // Prepare 'addOwnerWithThreshold' method
      const txData = safe.methods
        .addOwnerWithThreshold(options.owner, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.address,
        to: options.address,
        txData,
      });
    },

    /**
     * Remove owner of a given Gnosis Safe.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.address - address of the Gnosis Safe
     * @param {number} userOptions.owner - owner address to be removed
     */
    removeOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.checkAddressChecksum,
        },
        owner: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Get Safe at given address
      const safe = getSafeContract(web3, options.address);

      // We need the list of owners before ...
      const owners = await getOwners(web3, options.address);

      // .. to find out which previous owner in the list is pointing at the one we want to remove
      const ownerIndex = owners.findIndex(owner => owner === options.owner);
      const prevOwner =
        ownerIndex > 0 ? owners[ownerIndex - 1] : SENTINEL_ADDRESS;

      // Prepare 'removeOwner' method by passing pointing owner and the owner to be removed
      const txData = await safe.methods
        .removeOwner(prevOwner, options.owner, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.address,
        to: options.address,
        txData,
      });
    },
  };
}
