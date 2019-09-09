import {
  SAFE_THRESHOLD,
  SENTINEL_ADDRESS,
  ZERO_ADDRESS,
} from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeContract } from '~/common/getContracts';

/**
 * Encode ABI for Gnosis Safe setup method.
 *
 * @param {Object} safeMaster - Safe master copy contract
 * @param {string} owner - first owner address
 *
 * @return {string} - encoded ABI
 */
function encodeSafeABI(safeMaster, owner) {
  return safeMaster.methods
    .setup(
      [owner],
      SAFE_THRESHOLD,
      ZERO_ADDRESS,
      '0x',
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    )
    .encodeABI();
}

/**
 * Predicts the address of a to-be-deployed contract via CREATE2.
 *
 * @param {Web3} web3 - web3 instance
 * @param {string} address
 * @param {string} salt
 * @param {string} byteCode
 *
 * @return {string} - predicted address
 */
function generateAddress2(web3, address, salt, byteCode) {
  const data = ['ff', address, salt, web3.utils.keccak256(byteCode)]
    .map(x => x.replace(/0x/, ''))
    .join('');

  const result = web3.utils
    .keccak256(`0x${data}`)
    .slice(-40)
    .toLowerCase();

  return `0x${result}`;
}

/**
 * Helper method to receive a list of all Gnosis Safe owners.
 *
 * @param {Web3} web3 - web3 instance
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
 */
export default function createSafeModule(web3, contracts, utils) {
  const { safeMaster, proxyFactory } = contracts;

  const safeMasterAddress = safeMaster.options.address;
  const proxyAddress = proxyFactory.options.address;

  return {
    /**
     * Predict a Gnosis Safe address before it got deployed.
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

    predictAddress2: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      const data = encodeSafeABI(safeMaster, account.address);

      const proxyCreationCode = await proxyFactory.methods
        .proxyCreationCode()
        .call();

      const constructorCode = web3.eth.abi
        .encodeParameter('address', safeMasterAddress)
        .replace(/0x/, '');

      const initCode = proxyCreationCode + constructorCode;

      const encodedNonce = web3.eth.abi
        .encodeParameter('uint256', options.nonce)
        .replace(/0x/, '');

      const salt = web3.utils
        .keccak256(`${web3.utils.keccak256(data)}${encodedNonce}`)
        .replace(/0x/, '');

      return generateAddress2(web3, proxyAddress, salt, initCode);
    },

    /**
     * Deploy a new Gnosis Safe on the predicted address.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce which was used to predict the address.
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      const data = encodeSafeABI(safeMaster, account.address);

      const txData = proxyFactory.methods
        .createProxyWithNonce(safeMasterAddress, data, options.nonce)
        .encodeABI();

      return utils.sendSignedRelayerTx(account, {
        to: proxyAddress,
        txData,
      });
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
          type: web3.utils.isHexStrict,
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
          type: web3.utils.isHexStrict,
        },
        owner: {
          type: web3.utils.isHexStrict,
        },
      });

      // Get Safe at given address
      const safe = getSafeContract(web3, options.address);

      // Prepare 'addOwnerWithThreshold' method
      const txData = safe.methods
        .addOwnerWithThreshold(options.owner, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeSafeTx({
        safe,
        from: account.address,
        to: options.address,
        // @TODO: Check funder address (pass as option?)
        executor: account.address,
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
          type: web3.utils.isHexStrict,
        },
        owner: {
          type: web3.utils.isHexStrict,
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
      return await utils.executeSafeTx({
        safe,
        from: account.address,
        to: options.address,
        // @TODO: Check funder address (pass as option?)
        executor: account.address,
        txData,
      });
    },
  };
}
