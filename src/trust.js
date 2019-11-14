import CoreError, { ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_LIMIT_PERCENTAGE = 50;
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
     * Get the current state of a users trust network.
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
            trusts {
              limitPercentage
              from { id }
              to { id }
            }
            isTrustedBy {
              limitPercentage
              from { id }
              to { id }
            }
          }
        }`,
      });

      if (response.safe === null) {
        throw new CoreError(
          `Safe not found at address ${options.safeAddress}`,
          ErrorCodes.SAFE_NOT_FOUND,
        );
      }

      return []
        .concat(response.safe.isTrustedBy)
        .concat(response.safe.trusts)
        .reduce((acc, connection) => {
          const limitPercentage = parseInt(connection.limitPercentage, 10);

          if (limitPercentage === NO_LIMIT_PERCENTAGE) {
            return acc;
          }

          const from = web3.utils.toChecksumAddress(connection.from.id);
          const to = web3.utils.toChecksumAddress(connection.to.id);

          if (from === to) {
            return acc;
          }

          if (from === options.safeAddress) {
            acc.push({
              isTrustedByMe: true,
              isTrustingMe: false,
              limitPercentageTo: limitPercentage,
              limitPercentageFrom: NO_LIMIT_PERCENTAGE,
              safeAddress: to,
            });
          } else if (to === options.safeAddress) {
            acc.push({
              isTrustedByMe: false,
              isTrustingMe: true,
              limitPercentageTo: NO_LIMIT_PERCENTAGE,
              limitPercentageFrom: limitPercentage,
              safeAddress: from,
            });
          }

          return acc;
        }, [])
        .reduce((acc, connection) => {
          // Find duplicates ...
          const index = acc.findIndex(item => {
            return item.safeAddress === connection.safeAddress;
          });

          // ... and merge them
          if (index > -1) {
            const {
              isTrustedByMe,
              isTrustingMe,
              limitPercentageFrom,
              limitPercentageTo,
              safeAddress,
            } = acc[index];

            acc[index] = {
              isTrustedByMe: connection.isTrustedByMe || isTrustedByMe,
              isTrustingMe: connection.isTrustingMe || isTrustingMe,
              limitPercentageFrom:
                connection.limitPercentageFrom + limitPercentageFrom,
              limitPercentageTo:
                connection.limitPercentageTo + limitPercentageTo,
              safeAddress,
            };
          } else {
            acc.push(connection);
          }

          return acc;
        }, []);
    },

    /**
     * Trust user with a token.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - trust giver
     * @param {string} userOptions.to - trust receiver
     * @param {number} userOptions.limitPercentage - trust limit in % for transitive transactions
     *
     * @return {string} - transaction hash
     */
    addConnection: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        from: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        limitPercentage: {
          type: 'number',
          default: DEFAULT_LIMIT_PERCENTAGE,
        },
      });

      const txData = await hub.methods
        .trust(options.to, options.limitPercentage)
        .encodeABI();

      // Call method and return result
      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Revoke a trust connection with a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - trust giver
     * @param {string} userOptions.to - trust receiver
     *
     * @return {string} - transaction hash
     */
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

      const txData = await hub.methods
        .trust(options.to, NO_LIMIT_PERCENTAGE)
        .encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },
  };
}
