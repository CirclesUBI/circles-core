import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_TRUST_LIMIT = 20;
const NO_TRUST_LIMIT = 0;

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
            trusts { limit to { id } }
            isTrustedBy { limit from { id } }
          }
        }`,
      });

      if (response.safe === null) {
        throw new Error(`Safe not found at address ${options.safeAddress}`);
      }

      return []
        .concat(response.safe.isTrustedBy)
        .concat(response.safe.trusts)
        .map(({ from, to, limit }) => {
          const limitFrom = (from && parseInt(limit)) || NO_TRUST_LIMIT;
          const limitTo = (to && parseInt(limit)) || NO_TRUST_LIMIT;

          const isTrustingMe = limitFrom > NO_TRUST_LIMIT;
          const isTrustedByMe = limitTo > NO_TRUST_LIMIT;

          const safeAddress = to ? to.id : from.id;

          return {
            safeAddress: web3.utils.toChecksumAddress(safeAddress),
            isTrustedByMe,
            isTrustingMe,
            limitFrom,
            limitTo,
          };
        })
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
              limitFrom,
              limitTo,
              safeAddress,
            } = acc[index];

            acc[index] = {
              safeAddress,
              isTrustedByMe: connection.isTrustedByMe || isTrustedByMe,
              isTrustingMe: connection.isTrustingMe || isTrustingMe,
              limitFrom: connection.limitFrom + limitFrom,
              limitTo: connection.limitTo + limitTo,
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
     * @param {number} userOptions.limit - trust limit for transitive transactions
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
        limit: {
          type: 'number',
          default: DEFAULT_TRUST_LIMIT,
        },
      });

      const txData = await hub.methods
        .trust(options.to, options.limit)
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
        .trust(options.to, NO_TRUST_LIMIT)
        .encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },
  };
}
