import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getTokenContract } from '~/common/getContracts';

const DEFAULT_TOKEN_NAME = 'Circles';

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
    /**
     * Deploy new Circles Token for a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owner of the Token
     * @param {string} userOptions.tokenName - Optional token name
     */
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

    /**
     * Get Token address by passing on owner address.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address of Token owner
     *
     * @return {string} - Token address
     */
    getTokenAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await hub.methods.userToToken(options.safeAddress).call();
    },

    /**
     * Get summarized balance of all or one Token
     * owned by a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address of Token owner
     * @param {string} userOptions.tokenAddress - address of particular Token
     *
     * @return {string} - Current balance
     */
    getBalance: async (account, userOptions) => {
      checkAccount(web3, account);

      // eslint-disable-next-line no-unused-vars
      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        tokenAddress: {
          type: web3.utils.checkAddressChecksum,
          // default: ZERO_ADDRESS, // @TODO: Later we won't need this, see below
        },
      });

      // @TODO: This is not checking and summarizing the balance
      // yet of all Tokens we own from Circles users. Right now
      // we are only getting the Balance of our own deployed Token.
      //
      // One way to achieve this in the future is to 1. Get all Token
      // addresses we own from the Caching Service 2. Query the balances
      // with some sort of "balanceOfThrough" method in the Token contract
      // by passing on an array of all Token addresses and receive a
      // summarized balance from this.

      const token = getTokenContract(web3, options.tokenAddress);

      return await token.methods.balanceOf(options.safeAddress).call();
    },

    /**
     * Transfer Circles from one user to another.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - sender address
     * @param {string} userOptions.to - receiver address
     * @param {number} userOptions.value - value
     */
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
