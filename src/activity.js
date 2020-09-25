import { ZERO_ADDRESS } from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import createSymbolObject from '~/common/createSymbolObject';

const DEFAULT_LIMIT = 20;
const DEFAULT_TIMESTAMP = 0;

const ActivityTypes = createSymbolObject([
  'ADD_CONNECTION',
  'ADD_OWNER',
  'HUB_TRANSFER',
  'REMOVE_CONNECTION',
  'REMOVE_OWNER',
  'TRANSFER',
]);

const ActivityFilterTypes = createSymbolObject([
  'DISABLED',
  'CONNECTIONS',
  'OWNERS',
  'TRANSFERS',
]);

const TYPE_HUB_TRANSFER = 'HUB_TRANSFER';
const TYPE_OWNERSHIP = 'OWNERSHIP';
const TYPE_TRANSFER = 'TRANSFER';
const TYPE_TRUST = 'TRUST';

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
     * Activity filter type constants.
     */
    ActivityFilterTypes,

    /**
     * Get the last activities of a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - Safe address of user
     * @param {number} userOptions.limit - pagination page size
     * @param {number} userOptions.offset - pagination start index
     * @param {number} userOptions.timestamp - show only messages after this time
     * @param {symbol} userOptions.filter - optional filter for message types
     *
     * @return {Object} List of latest activities
     */
    getLatest: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        limit: {
          type: 'number',
          default: DEFAULT_LIMIT,
        },
        offset: {
          type: 'number',
          default: 0,
        },
        timestamp: {
          type: 'number',
          default: DEFAULT_TIMESTAMP,
        },
        filter: {
          type: (value) => {
            return !!Object.keys(ActivityFilterTypes).find(
              (key) => ActivityFilterTypes[key] === value,
            );
          },
          default: ActivityFilterTypes.DISABLED,
        },
      });

      const getNotifications = async (filterString) => {
        const parameters = `
            orderBy: "time",
            orderDirection: "desc",
            first: ${options.limit},
            skip: ${options.offset},
            where: {
              time_gt: ${options.timestamp},
              safeAddress: "${options.safeAddress.toLowerCase()}",
              ${filterString ? `type: ${filterString}` : ''}
            }
        `;

        const response = await utils.requestGraph({
          query: `{
            notifications(${parameters}) {
              id
              transactionHash
              safeAddress
              type
              time
              trust {
                user
                canSendTo
                limitPercentage
              }
              transfer {
                from
                to
                amount
              }
              hubTransfer {
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
          return [];
        }

        return response.notifications.reduce((acc, notification) => {
          const timestamp = parseInt(notification.time, 10);
          let data;
          let type;

          if (notification.type === TYPE_OWNERSHIP) {
            const { adds, removes } = notification.ownership;
            type = adds ? ActivityTypes.ADD_OWNER : ActivityTypes.REMOVE_OWNER;

            data = {
              ownerAddress: adds ? adds : removes,
              safeAddress: options.safeAddress,
            };

            data.ownerAddress = web3.utils.toChecksumAddress(data.ownerAddress);
          } else if (notification.type === TYPE_TRANSFER) {
            const { from, to, amount } = notification.transfer;
            type = ActivityTypes.TRANSFER;

            data = {
              from: web3.utils.toChecksumAddress(from),
              to: web3.utils.toChecksumAddress(to),
              value: new web3.utils.BN(amount),
            };
          } else if (notification.type === TYPE_HUB_TRANSFER) {
            const { from, to, amount } = notification.hubTransfer;
            type = ActivityTypes.HUB_TRANSFER;

            data = {
              from: web3.utils.toChecksumAddress(from),
              to: web3.utils.toChecksumAddress(to),
              value: new web3.utils.BN(amount),
            };
          } else if (notification.type === TYPE_TRUST) {
            const { user, canSendTo, limitPercentage } = notification.trust;

            if (limitPercentage === '0') {
              type = ActivityTypes.REMOVE_CONNECTION;
            } else {
              type = ActivityTypes.ADD_CONNECTION;
            }

            data = {
              user: web3.utils.toChecksumAddress(user),
              canSendTo: web3.utils.toChecksumAddress(canSendTo),
              limitPercentage: parseInt(limitPercentage, 10),
            };
          } else {
            // Unknown notification type, ignore it
            return acc;
          }

          // Filter trust events which are related to ourselves
          if (
            type === ActivityTypes.ADD_CONNECTION &&
            data.canSendTo === data.user
          ) {
            return acc;
          }

          // Filter transfer events which are not UBI payout as we have them
          // covered through HUB_TRANSFER events
          if (type === ActivityTypes.TRANSFER && data.from !== ZERO_ADDRESS) {
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
      };

      let activities = [];

      // We consider HUB_TRANSFER and TRANSFER events the same inside the core
      // even though they are separate in the subgraph, therefore we have to
      // merge them here!
      if (options.filter === ActivityFilterTypes.TRANSFERS) {
        activities = (
          await Promise.all([
            getNotifications(TYPE_TRANSFER),
            getNotifications(TYPE_HUB_TRANSFER),
          ])
        )
          .flat()
          .sort(({ timestamp: itemA }, { timestamp: itemB }) => {
            return itemA - itemB;
          });
      } else {
        let filterString;
        if (options.filter === ActivityFilterTypes.CONNECTIONS) {
          filterString = TYPE_TRUST;
        } else if (options.filter === ActivityFilterTypes.OWNERS) {
          filterString = TYPE_TRANSFER;
        }
        activities = await getNotifications(filterString);
      }

      // Results are empty after filtering
      if (activities.length === 0) {
        return {
          activities: [],
          lastTimestamp: 0,
        };
      }

      return {
        activities,
        lastTimestamp: activities[0].timestamp,
      };
    },
  };
}
