import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import createSymbolObject from '~/common/createSymbolObject';

const DEFAULT_TIMESTAMP = 0;

const ActivityTypes = createSymbolObject([
  'ADD_CONNECTION',
  'REMOVE_CONNECTION',
  'ADD_OWNER',
  'REMOVE_OWNER',
  'TRANSFER',
]);

/**
 * Activity submodule to get latest log events.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - activity module instance
 */
export default function createActivityModule(web3, contracts, utils) {
  return {
    /**
     * Activity type constants.
     */
    ActivityTypes,

    /**
     * Get the last activities of a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @param {number} userOptions.timestamp - show only messages after this time
     *
     * @return {Object} List of latest activities
     */
    getLatest: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        timestamp: {
          type: 'number',
          default: DEFAULT_TIMESTAMP,
        },
      });

      const filter = `
          orderBy: "time",
          where: {
            time_gt: ${options.timestamp},
            safe: "${options.safeAddress.toLowerCase()}"
          }
      `;

      const response = await utils.requestGraph({
        query: `{
          notifications(${filter}) {
            id
            transactionHash
            safe {
              id
            }
            type
            time
            trust {
              from
              to
              limitPercentage
            }
            transfer {
              from
              to
              amount
            }
            ownership {
              adds
              removes
            }
          }
        }`,
      });

      if (!response.notifications || response.notifications.length === 0) {
        return {
          activities: [],
          lastTimestamp: DEFAULT_TIMESTAMP,
        };
      }

      const activities = response.notifications.reduce((acc, notification) => {
        const timestamp = parseInt(notification.time, 10);
        let data;
        let type;

        if (notification.type === 'OWNERSHIP') {
          const { adds, removes } = notification.ownership;

          type = adds ? ActivityTypes.ADD_OWNER : ActivityTypes.REMOVE_OWNER;

          data = {
            ownerAddress: adds ? adds : removes,
            safeAddress: options.safeAddress,
          };

          data.ownerAddress = web3.utils.toChecksumAddress(data.ownerAddress);
        } else if (notification.type === 'TRANSFER') {
          const { from, to, amount } = notification.transfer;

          type = ActivityTypes.TRANSFER;

          data = {
            from: web3.utils.toChecksumAddress(from),
            to: web3.utils.toChecksumAddress(to),
            value: new web3.utils.BN(amount),
          };
        } else if (notification.type === 'TRUST') {
          const { from, to, limitPercentage } = notification.trust;

          if (limitPercentage === '0') {
            type = ActivityTypes.REMOVE_CONNECTION;
          } else {
            type = ActivityTypes.ADD_CONNECTION;
          }

          data = {
            from: web3.utils.toChecksumAddress(from),
            to: web3.utils.toChecksumAddress(to),
            limitPercentage: parseInt(limitPercentage, 10),
          };
        } else {
          // Unknown notification type, ignore it
          return acc;
        }

        // Filter trust events which are related to ourselves
        if (type === ActivityTypes.ADD_CONNECTION && data.from === data.to) {
          return acc;
        }

        const { transactionHash } = notification;

        acc.push({
          data,
          timestamp,
          transactionHash,
          type,
        });

        return acc;
      }, []);

      const lastActivity = activities[activities.length - 1];

      return {
        activities,
        lastTimestamp: lastActivity.timestamp,
      };
    },
  };
}
