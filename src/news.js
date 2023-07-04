import checkOptions from '~/common/checkOptions';
import { CIRCLES_INCEPTION_TIMESTAMP } from '~/common/constants';

/**
 * Activity submodule to get latest news log events.
 *
 * @access private
 *
 * @return {Object} - news module instance
 */
export default function createNewsModule(utils) {
  return {
    /**
     * Get the last news activities.
     *
     * @namespace core.news.getLatestNews
     *
     * @param {number} userOptions.limit - pagination page size
     * @param {number} userOptions.offset - pagination start index
     * @param {number} userOptions.timestamp - show only messages after this time
     * @param {symbol} userOptions.filter - optional filter for message types
     *
     * @return {Object} List of latest activities
     */
    getLatestNews: async (userOptions) => {
      const options = checkOptions(userOptions, {
        afterDate: {
          type: 'string',
          default: CIRCLES_INCEPTION_TIMESTAMP.toString(),
        },
        isActive: {
          type: 'boolean',
          default: true,
        },
        limit: {
          type: 'number',
          default: 10,
        },
        offset: {
          type: 'number',
          default: 0,
        },
      });

      const { afterDate, isActive, limit, offset } = options;
      const response = await utils.requestAPI({
        path: ['news'],
        method: 'GET',
        data: {
          afterDate,
          isActive,
          limit,
          offset,
        },
      });

      return response?.data;
      // or whole response?
    },
  };
}
