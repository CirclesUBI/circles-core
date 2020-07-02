import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_LIMIT_PERCENTAGE = 50;
const DEFAULT_TRUST_LIMIT = 3;
const NO_LIMIT_PERCENTAGE = 0;

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
     * Find out if safe address has enough incoming trust connections.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @param {string} userOptions.limit - Incoming trust limit
     *
     * @return {boolean} Safe has enough incoming trust connections
     */
    isTrusted: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        limit: {
          type: 'number',
          default: DEFAULT_TRUST_LIMIT,
        },
      });

      const safeAddress = options.safeAddress.toLowerCase();

      const response = await utils.requestGraph({
        query: `{
          trusts(where: { userAddress: "${safeAddress}" }) {
            id
          }
        }`,
      });

      if (!response) {
        return false;
      }

      return response.trusts.length >= options.limit;
    },

    /**
     * Get the current state of a users trust network, containing
     * data to find transfer path between users.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     *
     * @return {Object} Trust network state
     */
    getNetwork: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const safeAddress = options.safeAddress.toLowerCase();

      const response = await utils.requestGraph({
        query: `{
          safe(id: "${safeAddress}") {
            outgoing {
              limitPercentage
              userAddress
              canSendToAddress
            }
            incoming {
              limitPercentage
              userAddress
              canSendToAddress
            }
          }
        }`,
      });

      if (!response || response.safe === null) {
        // Fail silently with empty response / no trust connections
        // when Safe does not exist yet
        return [];
      }

      return []
        .concat(response.safe.incoming)
        .concat(response.safe.outgoing)
        .reduce((acc, connection) => {
          const limitPercentage = parseInt(connection.limitPercentage, 10);

          if (limitPercentage === NO_LIMIT_PERCENTAGE) {
            return acc;
          }

          const userAddress = web3.utils.toChecksumAddress(
            connection.userAddress,
          );

          const canSendToAddress = web3.utils.toChecksumAddress(
            connection.canSendToAddress,
          );

          // Filter connections to ourselves
          if (userAddress === canSendToAddress) {
            return acc;
          }

          // Merge incoming and outgoing connections
          if (userAddress === options.safeAddress) {
            acc.push({
              isIncoming: false,
              isOutgoing: true,
              limitPercentageIn: NO_LIMIT_PERCENTAGE,
              limitPercentageOut: limitPercentage,
              safeAddress: canSendToAddress,
            });
          } else if (canSendToAddress === options.safeAddress) {
            acc.push({
              isIncoming: true,
              isOutgoing: false,
              limitPercentageIn: limitPercentage,
              limitPercentageOut: NO_LIMIT_PERCENTAGE,
              safeAddress: userAddress,
            });
          }

          return acc;
        }, [])
        .reduce((acc, connection) => {
          // Find duplicates ...
          const index = acc.findIndex((item) => {
            return item.safeAddress === connection.safeAddress;
          });

          // ... and merge them
          if (index > -1) {
            const {
              isIncoming,
              isOutgoing,
              limitPercentageIn,
              limitPercentageOut,
              safeAddress,
            } = acc[index];

            acc[index] = {
              isIncoming: connection.isIncoming || isIncoming,
              isOutgoing: connection.isOutgoing || isOutgoing,
              limitPercentageIn:
                connection.limitPercentageIn + limitPercentageIn,
              limitPercentageOut:
                connection.limitPercentageOut + limitPercentageOut,
              safeAddress,
            };
          } else {
            acc.push(connection);
          }

          return acc;
        }, []);
    },

    /**
     * Give other users possibility to send their Circles to you by
     * giving them your trust.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.user - trust receiver / sender
     * @param {string} userOptions.canSendTo - trust giver / receiver
     * @param {number} userOptions.limitPercentage - trust limit in % for transitive transactions
     *
     * @return {string} - transaction hash
     */
    addConnection: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        user: {
          type: web3.utils.checkAddressChecksum,
        },
        canSendTo: {
          type: web3.utils.checkAddressChecksum,
        },
        limitPercentage: {
          type: 'number',
          default: DEFAULT_LIMIT_PERCENTAGE,
        },
      });

      const txData = await hub.methods
        .trust(options.user, options.limitPercentage)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.canSendTo,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Revoke a trust connection with a user. You don't allow this
     * user to transfer their Token to or through you.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.user - trust receiver / sender
     * @param {string} userOptions.canSendTo - trust giver / receiver
     *
     * @return {string} - transaction hash
     */
    removeConnection: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        user: {
          type: web3.utils.checkAddressChecksum,
        },
        canSendTo: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const txData = await hub.methods
        .trust(options.user, NO_LIMIT_PERCENTAGE)
        .encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.canSendTo,
        to: hub.options.address,
        txData,
      });
    },
  };
}
