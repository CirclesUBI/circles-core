import checkAccount from '~/common/checkAccount';
import checkArrayEntries from '~/common/checkArrayEntries';
import checkOptions from '~/common/checkOptions';

/**
 * Username resolver submodule to register and find usernames.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - user module instance
 */
export default function createUserModule(web3, contracts, utils) {
  return {
    /**
     * Makes a dry-run registration to check if the username and email are valid.
     *
     * @namespace core.user.dryRegister
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.username - alphanumerical username
     * @param {string} userOptions.email - email address
     *
     * @return {boolean} - Returns true when successful, otherwise throws error
     */
    dryRegister: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        username: {
          type: 'string',
          default: '',
        },
        email: {
          type: 'string',
          default: '',
        },
        avatarUrl: {
          type: 'string',
          default: '',
        },
      });

      const { avatarUrl, username, email } = options;

      await utils.requestAPI({
        path: ['users'],
        method: 'POST',
        data: {
          email,
          username,
          avatarUrl,
        },
      });

      return true;
    },

    /**
     * Register a new username and email address and connect it to a Safe address.
     *
     * @namespace core.user.register
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce which was used to predict address, use it only when Safe was not deployed yet
     * @param {string} userOptions.safeAddress - owned Safe address
     * @param {string} userOptions.username - alphanumerical username
     * @param {string} userOptions.email - email address
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
          type: 'string',
          default: '',
        },
        email: {
          type: 'string',
          default: '',
        },
        avatarUrl: {
          type: 'string',
          default: '',
        },
      });

      const { address } = account;
      const { nonce, avatarUrl, safeAddress, username, email } = options;

      const { signature } = web3.eth.accounts.sign(
        [address, nonce, safeAddress, username].join(''),
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
            email,
            safeAddress,
            username,
            avatarUrl,
          },
        },
      });

      return true;
    },

    /**
     * Update username, email address, and/or image url, connected to a deployed Safe address.
     *
     * @namespace core.user.update
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owned Safe address
     * @param {string} userOptions.username - alphanumerical username
     * @param {string} userOptions.email - email address
     * @param {string} userOptions.avatarUrl - url of the avatar image
     *
     * @return {boolean} - Returns true when successful
     */
    update: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        username: {
          type: 'string',
          default: '',
        },
        email: {
          type: 'string',
          default: '',
        },
        avatarUrl: {
          type: 'string',
          default: '',
        },
      });

      const { address } = account;
      const { safeAddress, username, email, avatarUrl } = options;
      const { signature } = web3.eth.accounts.sign(
        [address, safeAddress, username].join(''),
        account.privateKey,
      );

      await utils.requestAPI({
        path: ['users', safeAddress],
        method: 'POST',
        data: {
          address: account.address,
          signature,
          data: {
            safeAddress,
            username,
            email,
            avatarUrl,
          },
        },
      });

      return true;
    },

    /**
     * Delete user entry connected to a deployed Safe address.
     *
     * @namespace core.user.delete
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owned Safe address
     *
     * @return {boolean} - Returns true when successful
     */
    delete: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const { address } = account;
      const { safeAddress } = options;
      const { signature } = web3.eth.accounts.sign(
        [address, safeAddress].join(''),
        account.privateKey,
      );

      await utils.requestAPI({
        path: ['users', safeAddress],
        method: 'DELETE',
        data: {
          address: account.address,
          signature,
        },
      });

      return true;
    },

    /**
     * Find multiple user entries by Safe address and username.
     *
     * @namespace core.user.resolve
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
          type: (arr) => {
            return checkArrayEntries(arr, web3.utils.checkAddressChecksum);
          },
          default: [],
        },
        usernames: {
          type: (arr) => {
            return checkArrayEntries(arr, (entry) => {
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

    /**
     * Search for users by username.
     *
     * @namespace core.user.search
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.query - Search query
     *
     * @return {Object[]} - List of users
     */
    search: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        query: {
          type: 'string',
        },
      });

      return await utils.requestAPI({
        path: ['users'],
        data: {
          query: options.query,
        },
      });
    },

    /**
     * Get email of user.
     *
     * @namespace core.user.getEmail
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owned Safe address
     * @param {string} userOptions.username - alphanumerical username
     *
     * @return {email} - Email of the user
     */
    getEmail: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const { address } = account;
      const { safeAddress } = options;
      const { signature } = web3.eth.accounts.sign(
        [address, safeAddress].join(''),
        account.privateKey,
      );

      try {
        const response = await utils.requestAPI({
          path: ['users', safeAddress, 'email'],
          method: 'POST',
          data: {
            address: account.address,
            signature,
          },
        });

        if (response && response.data && response.data.email) {
          return response.data.email;
        }
      } catch (error) {
        // Do nothing when not found or denied access ...
        if (
          !error.request ||
          (error.request.status !== 404 && error.request.status !== 403)
        ) {
          throw error;
        }
      }
      return null;
    },
  };
}
