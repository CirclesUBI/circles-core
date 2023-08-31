import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import {
  DEFAULT_ORG_LIMIT_PERCENTAGE,
  DEFAULT_TRUST_LIMIT,
  DEFAULT_USER_LIMIT_PERCENTAGE,
  NO_LIMIT_PERCENTAGE,
} from './common/constants';

/**
 * Module to manage trusts
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Trust module instance
 */
export default function createTrustModule({
  web3,
  contracts: { hub },
  safe,
  utils,
  options: { hubAddress },
}) {
  /**
   * Send a trust transaction from a safe to the hub
   * @access private
   * @param {Object} account - web3 account instance
   * @param {Object} config - options
   * @param {string} userOptions.canSendTo - Safe address that trusts
   * @param {string} userOptions.user - Safe address that is being trusted
   * @param {number} config.limitPercentage - trust limit in % for transitive transactions
   * @return {RelayResponse} - gelato response
   */
  const _trust = (account, { canSendTo, user, limitPercentage }) =>
    safe.sendTransaction(account, {
      safeAddress: canSendTo,
      transactionData: {
        to: hubAddress,
        data: hub.methods.trust(user, limitPercentage).encodeABI(),
      },
    });

  /**
   * Trust a safe allowing that user's token to circulate to/through you
   * @namespace core.trust.addConnection
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.canSendTo - Safe address that trusts
   * @param {string} userOptions.user - Safe address that is being trusted
   * @param {number} userOptions.limitPercentage - trust limit in % for transitive transactions
   * @return {RelayResponse} - gelato response
   */
  const addConnection = async (account, userOptions) => {
    checkAccount(web3, account);

    const { user, canSendTo, limitPercentage } = checkOptions(userOptions, {
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

    const isOrgSignedup = await hub.methods.organizations(canSendTo).call();

    return _trust(account, {
      user,
      canSendTo,
      limitPercentage: !isOrgSignedup
        ? limitPercentage
        : DEFAULT_ORG_LIMIT_PERCENTAGE,
    });
  };

  /**
   * Get a Safe trust network
   * @namespace core.trust.getNetwork
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address of user
   * @return {Object} Trust network state
   */
  const getNetwork = (account, userOptions) => {
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
          const network = safe.incoming.reduce(
            (acc, { limitPercentage, userAddress }) => {
              const checksumSafeAddress =
                web3.utils.toChecksumAddress(userAddress);

              return {
                [checksumSafeAddress]: {
                  safeAddress: checksumSafeAddress,
                  mutualConnections: [],
                  isIncoming: true,
                  limitPercentageIn: parseInt(limitPercentage, 10),
                  isOutgoing: false,
                  limitPercentageOut: NO_LIMIT_PERCENTAGE,
                },
                ...acc,
              };
            },
            {},
          );

          // Add to network safes that trust us
          safe.outgoing.forEach(({ limitPercentage, canSendToAddress }) => {
            const checksumSafeAddress =
              web3.utils.toChecksumAddress(canSendToAddress);

            // If it does not exist in the network yet, create it
            if (!network[checksumSafeAddress]) {
              network[checksumSafeAddress] = {
                safeAddress: checksumSafeAddress,
                mutualConnections: [],
                isIncoming: false,
                limitPercentageIn: NO_LIMIT_PERCENTAGE,
              };
            }

            network[checksumSafeAddress].isOutgoing = true;
            network[checksumSafeAddress].limitPercentageOut = parseInt(
              limitPercentage,
              10,
            );
          });

          // Select mutual connections between safe trusts and trusts of safe trusts
          safe.incoming.forEach(({ userAddress, user }) => {
            const checksumSafeAddress =
              web3.utils.toChecksumAddress(userAddress);

            if (user) {
              network[checksumSafeAddress].mutualConnections.push(
                ...user.outgoing
                  .filter(
                    ({ canSendToAddress }) =>
                      // It is not self and is someone we trust
                      canSendToAddress !== userAddress &&
                      network[web3.utils.toChecksumAddress(canSendToAddress)],
                  )
                  .map(({ canSendToAddress }) =>
                    web3.utils.toChecksumAddress(canSendToAddress),
                  ),
              );
            }
          });

          result = Object.values(network);
        }

        return result;
      });
  };

  /**
   * Find out if safe address has enough incoming trust connections
   * @namespace core.trust.isTrusted
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.limit - Incoming trust limit
   * @return {Object} Number of connections and if the safe is trusted by minimun the limit
   */
  const isTrusted = (account, userOptions) => {
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

    return utils
      .requestIndexedDB('trust_network', options.safeAddress.toLowerCase())
      .then(({ trusts = [] } = {}) => ({
        trustConnections: trusts.length,
        isTrusted: trusts.length >= options.limit,
      }));
  };

  /**
   * Remove trust not allowing user's token to circulate to/through you anymore
   * @namespace core.trust.removeConnection
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.canSendTo - Safe address that trusts
   * @param {string} userOptions.user - Safe address that is being trusted
   * @return {RelayResponse} - gelato response
   */
  const removeConnection = async (account, userOptions) => {
    checkAccount(web3, account);

    const { user, canSendTo } = checkOptions(userOptions, {
      user: {
        type: web3.utils.checkAddressChecksum,
      },
      canSendTo: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return _trust(account, {
      user,
      canSendTo,
      limitPercentage: NO_LIMIT_PERCENTAGE,
    });
  };

  return {
    addConnection,
    getNetwork,
    isTrusted,
    removeConnection,
  };
}
