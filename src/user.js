import checkAccount from '~/common/checkAccount';
import checkArrayEntries from '~/common/checkArrayEntries';
import checkOptions from '~/common/checkOptions';
import checkAddressChecksum from '~/common/checkAddressChecksum';

/**
 * Module to manage users
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - User module instance
 */
export default function createUserModule({ utils }) {
  /**
   * Register a new username and email address and connect it to a Safe address.
   *
   * @namespace core.user.register
   *
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.nonce - nonce which was used to predict address, use it only when Safe was not deployed yet
   * @param {string} userOptions.safeAddress - owned Safe address
   * @param {string} userOptions.username - alphanumerical username
   * @param {string} userOptions.email - email address
   *
   * @return {boolean} - Returns true when successful
   */
  const register = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      nonce: {
        type: 'number',
        default: 0,
      },
      safeAddress: {
        type: checkAddressChecksum,
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

    const signature = await account.signMessage(
      [address, nonce, safeAddress, username].join(''),
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
  };

  /**
   * Update username, email address, and/or image url, connected (or not) to a deployed Safe address.
   *
   * @namespace core.user.update
   *
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - owned Safe address
   * @param {string} userOptions.username - alphanumerical username
   * @param {string} userOptions.email - email address
   * @param {string} userOptions.avatarUrl - url of the avatar image
   *
   * @return {boolean} - Returns true when successful
   */
  const update = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: checkAddressChecksum,
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
    const signature = await account.signMessage(
      [address, safeAddress, username].join(''),
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
  };

  /**
   * Find multiple user entries by Safe address and username.
   *
   * @namespace core.user.resolve
   *
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string[]} userOptions.addresses - Array of safe addresses
   * @param {string[]} userOptions.usernames - Array of usernames
   *
   * @return {Object[]} - List of users
   */
  const resolve = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      addresses: {
        type: (arr) => {
          return checkArrayEntries(arr, checkAddressChecksum);
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

    return utils.requestAPI({
      path: ['users'],
      data: {
        address: options.addresses,
        username: options.usernames,
      },
    });
  };

  /**
   * Search for users by username.
   *
   * @namespace core.user.search
   *
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.query - Search query
   *
   * @return {Object[]} - List of users
   */
  const search = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      query: {
        type: 'string',
      },
    });

    return utils.requestAPI({
      path: ['users'],
      data: {
        query: options.query,
      },
    });
  };

  /**
   * Get email of user.
   *
   * @namespace core.user.getEmail
   *
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - owned Safe address
   * @param {string} userOptions.username - alphanumerical username
   *
   * @return {email} - Email of the user
   */
  const getEmail = async (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: checkAddressChecksum,
      },
    });

    const { address } = account;
    const signature = await account.signMessage(
      [address, safeAddress].join(''),
    );

    try {
      const response = await utils.requestAPI({
        path: ['users', safeAddress, 'email'],
        method: 'POST',
        data: {
          address,
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
  };

  return {
    register,
    resolve,
    search,
    update,
    getEmail,
  };
}
