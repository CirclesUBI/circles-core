import createCore from './helpers/core';
import setupWeb3 from './helpers/setupWeb3';
import getAccounts from './helpers/getAccounts';
import onboardAccountManually from './helpers/onboardAccountManually';
import generateSaltNonce from './helpers/generateSaltNonce';

describe('User', () => {
  const { web3, provider } = setupWeb3();
  const core = createCore(web3);
  const [account] = getAccounts(web3);
  let onboardedAccount;
  let safeAddress;
  let username;
  let email;
  let nonce;
  afterAll(() => provider.engine.stop());

  beforeAll(async () => {
    nonce = generateSaltNonce();
    // Predeploy manually an account (safe and token)
    onboardedAccount = await onboardAccountManually(
      { account: account, nonce: nonce },
      core,
    );
    safeAddress = onboardedAccount.safeAddress;
    username = `panda${new Date().getTime()}`;
    email = 'panda@zoo.org';
  });

  describe('when a new user registers its Safe address', () => {
    it('should return a success response', async () => {
      const response = await core.user.register(account, {
        nonce: nonce,
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
