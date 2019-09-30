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
      return await utils.executeSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },

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

      return await utils.executeSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },
  };
}
