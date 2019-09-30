import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

/**
 * Activity submodule to get latest log events.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - activity module instance
 */
// eslint-disable-next-line no-unused-vars
export default function createActivityModule(web3, contracts, utils) {
  return {
    /**
     * Get the last activities of a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     *
     * @return {Object} List of latest activities
     */
    getActivities: async (account, userOptions) => {
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
  };
}
