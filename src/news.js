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
      return [];
    }
  }
}
