import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_USER_LIMIT_PERCENTAGE = 100;
const DEFAULT_ORG_LIMIT_PERCENTAGE = 100;

const DEFAULT_TRUST_LIMIT = 3;
const NO_LIMIT_PERCENTAGE = 0;

/**
 * Trust submodule to add and remove trust connections.
 *
 * @access private
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
     * @namespace core.trust.isTrusted
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @param {string} userOptions.limit - Incoming trust limit
     *
     * @return {Object} Trust state and number of connections
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

      const response = await utils.requestIndexedDB(
        'trust_network',
        safeAddress,
      );

      if (!response) {
        return {
          trustConnections: 0,
          isTrusted: false,
        };
      }

      const trustConnections = response.trusts.filter((connection) => {
        return parseInt(connection.limitPercentage, 10) !== NO_LIMIT_PERCENTAGE;
      });

      return {
        trustConnections: trustConnections.length,
        isTrusted: trustConnections.length >= options.limit,
      };
    },

    /**
     * Get a Safe trust status
     * @namespace core.trust.getTrustStatus
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @return {Object} Trust status
     */
    getNetwork: (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const safeAddress = options.safeAddress.toLowerCase();

      return utils
        .requestIndexedDB('trust_limits', safeAddress)
        .then(({ safe } = {}) => {
          let result = [];

          if (safe) {
            // Create first network iteration with all addresses we trust, so after, we can select mutual trusts with them
            const network = safe.incoming.reduce((acc, { userAddress }) => {
              const checksumSafeAddress =
                web3.utils.toChecksumAddress(userAddress);

              return {
                [checksumSafeAddress]: {
                  safeAddress: checksumSafeAddress,
                  mutualConnections: [],
                  isIncoming: true,
                  isOutgoing: false,
                },
                ...acc,
              };
            }, {});

            // Add to network safes that trust us
            safe.outgoing.forEach(({ canSendToAddress }) => {
              const checksumSafeAddress =
                web3.utils.toChecksumAddress(canSendToAddress);

              // If it does not exist in the network yet, create it
              if (!network[checksumSafeAddress]) {
                network[checksumSafeAddress] = {
                  safeAddress: checksumSafeAddress,
                  mutualConnections: [],
                  isIncoming: false,
                };
              }

              network[checksumSafeAddress].isOutgoing = true;
            });

            // Select mutual connections between safe trusts and trusts of safe trusts
            safe.incoming.forEach(({ userAddress, user }) => {
              const checksumSafeAddress =
                web3.utils.toChecksumAddress(userAddress);

              if (user) {
                network[checksumSafeAddress].mutualConnections.push(
                  ...user.incoming.reduce((acc, curr) => {
                    const target = web3.utils.toChecksumAddress(
                      curr.userAddress,
                    );

                    return curr.userAddress !== userAddress && target
                      ? [...acc, target]
                      : acc;
                  }, []),
                );
              }
            });

            result = Object.values(network);
          }

          return result;
        });
    },

    /**
     * Give other users possibility to send their Circles to you by
     * giving them your trust.
     *
     * @namespace core.trust.addConnection
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
          default: DEFAULT_USER_LIMIT_PERCENTAGE,
        },
      });

      const isOrgSignedup = await hub.methods
        .organizations(options.canSendTo)
        .call();

      if (isOrgSignedup) {
        options.limitPercentage = DEFAULT_ORG_LIMIT_PERCENTAGE;
      }

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
     * @namespace core.trust.removeConnection
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
