import createCore from './helpers/createCore';
import getAccount from './helpers/getAccount';

let account;
let core;
let safeAddress;
let safeCreationNonce;
let username;

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
  });

  describe('when a new user registers its Safe address', () => {
    it('should return a success response', async () => {
      const response = await core.user.register(account, {
        nonce: safeCreationNonce,
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
  });
});
