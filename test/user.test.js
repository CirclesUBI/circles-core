import core from './helpers/core';
import accounts from './helpers/accounts';
import onboardAccount from './helpers/onboardAccount';
import generateSaltNonce from './helpers/generateSaltNonce';

describe('User', () => {
  const [account] = accounts;
  const username = `panda${new Date().getTime()}`;
  const email = 'panda@zoo.org';
  const nonce = generateSaltNonce();
  let safeAddress;

  beforeAll(async () => {
    safeAddress = await core.safe.predictAddress(account, { nonce });
  });

  describe('when a new user is registered', () => {
    it('should return a success response', async () => {
      const response = await core.user.register(account, {
        nonce,
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

  describe('when a user is updated', () => {
    beforeAll(() =>
      onboardAccount({
        account,
        nonce,
      }),
    );

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
