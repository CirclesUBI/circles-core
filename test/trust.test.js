import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';

let account;
let otherAccount;
let core;
let safeAddress;
let otherSafeAddress;

beforeAll(async () => {
  account = getAccount();
  otherAccount = getAccount(3);
  core = createCore();
});

describe('Trust', () => {
  beforeAll(async () => {
    safeAddress = await deploySafe(core, account);
    otherSafeAddress = await deploySafe(core, otherAccount);

    await core.ubi.signup(account, {
      safeAddress,
    });

    await core.ubi.signup(otherAccount, {
      safeAddress: otherSafeAddress,
    });
  });

  it('should trust someone', async () => {
    await core.trust.addConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
      limit: 50,
    });
  });

  it('should untrust someone', async () => {
    await core.trust.removeConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
    });
  });
});
