import createCore from './helpers/core';
import getAccount from './helpers/account';
import { deploySafeAndToken } from './helpers/transactions';

let account;
let core;
let safeAddress;
let safeCreationNonce;
let username;
let email;

beforeAll(async () => {
  account = getAccount();
  core = createCore();
});

describe('User', () => {
  beforeAll(async () => {
    safeCreationNonce = new Date().getTime();

    safeAddress = await core.safe.prepareDeploy(account, {
      nonce: safeCreationNonce,
    });

    username = `panda${new Date().getTime()}`;
    email = 'panda@zoo.org';
  });

  describe('when a new user registers its Safe address', () => {
    it('should return a success response', async () => {
      const response = await core.user.register(account, {
        nonce: safeCreationNonce,
        email,
        safeAddress,
        username,
      });

      expect(response).toBe(true);
    });

    it('should be resolveable after registration', async () => {
      const first = await core.user.resolve(account, {
        usernames: [username],
      });

      expect(first.data[0].username).toEqual(username);

      const second = await core.user.resolve(account, {
        addresses: [safeAddress],
      });

      expect(second.data[0].username).toEqual(username);
    });

    it('should come up when searching for it', async () => {
      const result = await core.user.search(account, {
        query: username,
      });

      expect(result.data[0].username).toEqual(username);
    });

    it('should be resolveable after changing only username', async () => {
      // The Safe must be deployed and signedup to the Hub before trying to change the username
      const result = await deploySafeAndToken(core, account);

      const newUsername = `dolfin${new Date().getTime()}`;
      expect(
        // email not provided
        await core.user.update(account, {
          safeAddress: result.safeAddress,
          username: newUsername,
        }),
      ).toBe(true);

      const first = await core.user.resolve(account, {
        usernames: [newUsername],
      });

      expect(first.data[0].username).toEqual(newUsername);
    });
  });
});
