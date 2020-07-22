import { SAFE_THRESHOLD, SENTINEL_ADDRESS } from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeContract } from '~/common/getContracts';

/**
 * Helper method to receive a list of all Gnosis Safe owners.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} safeAddress
 *
 * @return {string[]} - array of owner addresses
 */
async function getOwners(web3, safeAddress) {
  // Get Safe at given address
  const safe = getSafeContract(web3, safeAddress);

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
     * Returns true if there are enough balance on this address to deploy
     * a Safe.
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
          version: 2,
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
     * Finds the Safe addresses of an owner.
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

      const response = await utils.requestGraph({
        query: `{
          user(id: "${options.ownerAddress.toLowerCase()}") {
            safeAddresses,
          }
        }`,
      });

      if (!response.user) {
        return [];
      }

      return response.user.safeAddresses.map((address) => {
        return web3.utils.toChecksumAddress(address);
      });
    },

    /**
     * Returns a list of all owners of the given Gnosis Safe.
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
  };
}
