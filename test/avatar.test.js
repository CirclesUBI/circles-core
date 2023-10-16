import createCore from './helpers/core';
import getAccount from './helpers/account';
import { deploySafeAndToken } from './helpers/transactions';
import { mockApiAvatarUpload, mockApiAvatarDelete } from './helpers/mocks';

let account;
let core;

beforeAll(async () => {
  core = createCore();
});

describe('Avatar - upload and delete', () => {
  beforeAll(async () => {
    account = getAccount(1);
    // The Safe must be deployed and signedup to the Hub before trying to delete the user entry
    await deploySafeAndToken(core, account);
  });

  describe('when a user wants to upload an image, and then remove it', () => {
    it('should return a success response', async () => {
      const data = {};
      mockApiAvatarUpload(data);
      const result = await core.avatar.upload(account, { data });
      expect(result.data.url).toEqual(expect.stringContaining('https://'));

      mockApiAvatarDelete(result.data.url);
      const result2 = await core.avatar.delete(account, {
        url: result.data.url,
      });
      expect(result2).toBe(true);
    });
  });
});
