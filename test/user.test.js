import createCore from './helpers/core';
import getAccount from './helpers/account';
import { deploySafeAndToken } from './helpers/transactions';

let account;
let core;
let safeAddress;
let safeCreationNonce;
let username;
let email;
let deployedSafe;

beforeAll(async () => {
  core = createCore();
});

describe('User - register', () => {
  beforeAll(async () => {
    account = getAccount();

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
  });
});

describe('User - update', () => {
  beforeAll(async () => {
    account = getAccount(1);

    safeCreationNonce = new Date().getTime();

    // The Safe must be deployed and signedup to the Hub before trying to change the username
    deployedSafe = await deploySafeAndToken(core, account);
    safeAddress = deployedSafe.safeAddress;
    username = `doggy${new Date().getTime()}`;
    email = 'dogg@yyy.com';
  });

  describe('when a new user registers its Safe address', () => {
    it('should be resolveable after changing only username', async () => {
      expect(
        // This update acts as a register
        await core.user.update(account, {
          email,
          safeAddress,
          username,
        }),
      ).toBe(true);

      const newUsername = `dolfin${new Date().getTime()}`;
      expect(
        await core.user.update(account, {
          safeAddress,
          username: newUsername,
          email,
        }),
      ).toBe(true);

      const first = await core.user.resolve(account, {
        usernames: [newUsername],
      });

      expect(first.data[0].username).toEqual(newUsername);
    });

    it('should return email', async () => {
      expect(
        await core.user.getEmail(account, {
          safeAddress,
        }),
      ).toBe(email);
    });
  });
});
