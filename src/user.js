import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

function checkArrayEntries(arr, validatorFn) {
  if (!Array.isArray(arr)) {
    return false;
  }

  return (
    arr.find(entry => {
      return !validatorFn(entry);
    }) === undefined
  );
}

/**
 * Username resolver submodule to register and find usernames.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - safe module instance
 */
export default function createUserModule(web3, utils) {
  return {
    /**
     * Register a new username and connect it to a Safe address.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce which was used to predict address, use it only when Safe was not deployed yet
     * @param {string} userOptions.safeAddress - owned Safe address
     * @param {string} userOptions.username - alphanumerical username
     *
     * @return {boolean} - Returns true when successful
     */
    register: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
          default: 0,
        },
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        username: {
          type: value => {
            return /^[a-zA-Z0-9]+$/.test(value);
          },
        },
      });

      const { address } = account;
      const { nonce, safeAddress, username } = options;

      const { signature } = web3.eth.accounts.sign(
        `${address}${nonce}${safeAddress}${username}`,
        account.privateKey,
      );

      await utils.requestAPI({
        path: ['users'],
        method: 'PUT',
        data: {
          address: account.address,
          nonce: nonce > 0 ? nonce : null,
          signature,
          data: {
            safeAddress: options.safeAddress,
            username: options.username,
          },
        },
      });

      return true;
    },

    /**
     * Find multiple user entries by Safe address and username.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string[]} userOptions.addresses - Array of safe addresses
     * @param {string[]} userOptions.usernames - Array of usernames
     *
     * @return {Object[]} - List of users
     */
    resolve: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        addresses: {
          type: arr => {
            return checkArrayEntries(arr, web3.utils.checkAddressChecksum);
          },
          default: [],
        },
        usernames: {
          type: arr => {
            return checkArrayEntries(arr, entry => {
              return /^[a-zA-Z0-9]+$/.test(entry);
            });
          },
          default: [],
        },
      });

      return await utils.requestAPI({
        path: ['users'],
        data: {
          address: options.addresses,
          username: options.usernames,
        },
      });
    },
  };
}
