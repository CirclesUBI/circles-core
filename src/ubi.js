import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_TOKEN_NAME = 'CCS';

/**
 * UBI submodule to get current Token balance and send Circles to other users.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - ubi module instance
 */
export default function createUbiModule(web3, contracts, utils) {
  const { hub } = contracts;

  return {
    signup: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        tokenName: {
          type: 'string',
          default: DEFAULT_TOKEN_NAME,
        },
      });

      const txData = await hub.methods.signup(options.tokenName).encodeABI();

      // Call method and return result
      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
      });
    },

    getBalance: async (account, userOptions) => {
      checkAccount(web3, account);

      // eslint-disable-next-line no-unused-vars
      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // @TODO
    },

    transfer: async (account, userOptions) => {
      checkAccount(web3, account);

      // eslint-disable-next-line no-unused-vars
      const options = checkOptions(userOptions, {
        from: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        value: {
          type: 'number',
        },
      });

      // @TODO: Call Transaction Graph Service before for transitive transfers
      const addresses = [options.to];

      const txData = await hub.methods
        .transferThrough(addresses, options.value)
        .encodeABI();

      // Call method and return result
      return await utils.executeSafeTx(account, {
        safeAddress: options.from,
        to: options.to,
        txData,
      });
    },
  };
}
