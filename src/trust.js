import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import {
  DEFAULT_ORG_LIMIT_PERCENTAGE,
  DEFAULT_TRUST_LIMIT,
  DEFAULT_USER_LIMIT_PERCENTAGE,
  NO_LIMIT_PERCENTAGE,
} from './common/constants';

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
     * Get a Safe trust network with mutual trusts connections.
     * The network is created based on the people the safe trusts (incoming) and the people that trust this Safe (outgoing)
     * @namespace core.trust.getNetwork
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @return {Object} Safe trust network
     */
    getNetwork: (account, userOptions) => {
      checkAccount(web3, account);

      const { safeAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return utils
        .requestIndexedDB('trust_status', safeAddress.toLowerCase())
        .then(({ safe } = {}) => {
          let network = {};

          if (safe) {
            const trusters = safe.outgoing;
            const trustees = safe.incoming;
            // 1 Add direct truster connections
            trusters &&
              trusters.forEach((truster) => {
                // outgoing capacity, incoming trust
                const trusterAddress = web3.utils.toChecksumAddress(
                  truster.canSendToAddress,
                );
                const newConnection = {
                  safeAddress: trusterAddress,
                  isIncoming: false, // default
                  isOutgoing: true,
                  mutualConnections: [], // default
                };
                network[trusterAddress] = newConnection;
              });
            // 2 Add direct trustee connections
            trustees &&
              trustees.forEach((trustee) => {
                // incoming capacity, outgoing trust
                const trusteeAddress = web3.utils.toChecksumAddress(
                  trustee.userAddress,
                );
                const existingConnection = network[trusteeAddress];
                if (existingConnection) {
                  // trusterOfTrustee is already trusting "me" - update record
                  existingConnection.isIncoming = true;
                } else {
                  // new record
                  const newConnection = {
                    safeAddress: trusteeAddress,
                    isIncoming: true,
                    isOutgoing: false, // default
                    mutualConnections: [], // default
                  };
                  network[trusteeAddress] = newConnection;
                }
                // 3 Add mutual connections
                const trustersOfTrustee = trustee.user.outgoing;
                trustersOfTrustee &&
                  trustersOfTrustee.forEach((trusterOfTrustee) => {
                    const ttAddress = web3.utils.toChecksumAddress(
                      trusterOfTrustee.canSendToAddress,
                    );
                    if (ttAddress !== trusteeAddress) {
                      //console.log('3 - user that shares a mutual connection ', ttAddress, trusteeAddress)
                      const existingConnection = network[ttAddress];
                      if (existingConnection) {
                        // trusterOfTrustee is already trusted or trusting "me" - update record
                        const previousMutualConnections =
                          existingConnection.mutualConnections;
                        existingConnection.mutualConnections = [
                          ...previousMutualConnections,
                          trusteeAddress,
                        ];
                      } else {
                        const newConnection = {
                          safeAddress: ttAddress,
                          isIncoming: false,
                          isOutgoing: false,
                          mutualConnections: [trusteeAddress],
                        };
                        network[ttAddress] = newConnection;
                      }
                    }
                  });
              });
          }
          return Object.values(network);
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
