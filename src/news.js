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
  /**
   * Get the last news activities.
   *
   * @namespace core.news.getLatestNews
   *
   * @param {number} userOptions.limit - pagination page size
   * @param {number} userOptions.offset - pagination start index
   * @param {string} userOptions.afterDate - show only messages after this time
   * @param {boolean} userOptions.isActive - show only active items
   *
   * @return {Object} List of latest activities
   */
  const getLatestNews = async (userOptions) => {
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
  };
  return {
    getLatestNews,
  };
}
