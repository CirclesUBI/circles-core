import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_TRUST_LIMIT = 20;

/**
 * Trust submodule to add and remove trust connections.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - trust module instance
 */
export default function createTrustModule(web3, contracts, utils) {
  const { hub } = contracts;

  return {
    /**
     * Get the current state of a users trust network.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     *
     * @return {Object} Trust network state
     */
    getNetwork: async (account, userOptions) => {
      checkAccount(web3, account);

      // eslint-disable-next-line no-unused-vars
      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // @TODO: Implement this when Caching Service is ready.
      throw new Error('Not implemented');
    },

    /**
     * Trust user with a token.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - trust giver
     * @param {string} userOptions.to - trust receiver
     * @param {number} userOptions.limit - trust limit for transitive transactions
     */
    addConnection: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        from: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        limit: {
          type: 'number',
          default: DEFAULT_TRUST_LIMIT,
        },
      });

      const txData = await hub.methods
        .trust(options.to, options.limit)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Revoke a trust connection with a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - trust giver
     * @param {string} userOptions.to - trust receiver
     */
    removeConnection: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        from: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const txData = await hub.methods.trust(options.to, 0).encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },
  };
}
