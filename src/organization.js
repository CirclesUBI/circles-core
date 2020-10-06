import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

/**
 * Organization submodule to deploy and check organization accounts.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - organization module instance
 */
export default function createOrganizationModule(web3, contracts, utils) {
  const { hub } = contracts;

  return {
    /**
     * Returns true if there are enough balance on this Safe address to create
     * an organization account.
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

      // Do not attempt asking the relayer when Safe does not exist yet
      if ((await web3.eth.getCode(options.safeAddress)) === '0x') {
        return false;
      }

      const txData = await hub.methods.organizationSignup().encodeABI();

      try {
        const costs = await utils.estimateTransactionCosts(account, {
          safeAddress: options.safeAddress,
          to: hub.options.address,
          txData,
        });

        const balance = await web3.eth.getBalance(options.safeAddress);

        return web3.utils.toBN(balance).gte(costs);
      } catch {
        return false;
      }
    },

    /**
     * Create a new organization account
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owner of the organization
     *
     * @return {string} - transaction hash
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const txData = await hub.methods.organizationSignup().encodeABI();

      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Find out if address is an organization
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address
     *
     * @return {boolean} - True if organization
     */
    isOrganization: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await hub.methods.organizations(options.safeAddress).call();
    },
  };
}
