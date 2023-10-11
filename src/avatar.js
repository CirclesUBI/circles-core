import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

/**
 * Avatar submodule to upload and delete images from storage.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - avatar module instance
 */
export default function createAvatarModule(web3, utils) {
  return {
    /**
     * Upload an avatar image to storage.
     *
     * @namespace core.avatar.upload
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {object} userOptions.data - avatar image file
     *
     * @return {object} - Returns url, file name and file type of the uploaded image
     */
    uploadAvatarImage: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        data: {
          type: 'object',
        },
      });

      const { data } = options;

      return await utils.requestAPI({
        path: ['uploads', 'avatar'],
        method: 'POST',
        data: {
          data,
        },
      });
    },

    /**
     * Delete from storage an avatar image whose url is not connected to any user entry.
     *
     * @namespace core.avatar.delete
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.url - url of the avatar image
     *
     * @return {boolean} - Returns true when successful
     */
    delete: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        url: {
          type: 'string',
        },
      });

      const { url } = options;

      await utils.requestAPI({
        path: ['uploads', 'avatar'],
        method: 'DELETE',
        data: {
          url,
        },
      });

      return true;
    },
  };
}
