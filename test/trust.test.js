import createCore from './helpers/createCore';
import deploySafe from './helpers/deploySafe';
import getAccount from './helpers/getAccount';
import loop from './helpers/loop';
import web3 from './helpers/web3';

let account;
let otherAccount;
let core;
let safeAddress;
let otherSafeAddress;

async function getTrustConnection(
  checkAccount,
  checkSafeAddress,
  checkOtherSafeAddress,
) {
  const network = await core.trust.getNetwork(checkAccount, {
    safeAddress: checkSafeAddress,
  });

  return network.find(item => item.safeAddress === checkOtherSafeAddress);
}

beforeAll(async () => {
  account = getAccount();
  otherAccount = getAccount(3);
  core = createCore();
});

describe('Trust', () => {
  beforeAll(async () => {
    safeAddress = await deploySafe(core, account);
    otherSafeAddress = await deploySafe(core, otherAccount);

    await core.token.signup(account, {
      safeAddress,
    });

    await core.token.signup(otherAccount, {
      safeAddress: otherSafeAddress,
    });
  });

  it('should trust someone', async () => {
    const response = await core.trust.addConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
      limit: 50,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const connection = await loop(
      () => {
        return getTrustConnection(account, safeAddress, otherSafeAddress);
      },
      connection => connection,
    );

    expect(connection.isTrustedByMe).toBe(true);
    expect(connection.isTrustingMe).toBe(false);
    expect(connection.limitTo).toBe(50);

    const otherConnection = await loop(
      () => {
        return getTrustConnection(otherAccount, otherSafeAddress, safeAddress);
      },
      connection => connection,
    );

    expect(otherConnection.isTrustedByMe).toBe(false);
    expect(otherConnection.isTrustingMe).toBe(true);
    expect(otherConnection.limitFrom).toBe(50);
  });

  it('should untrust someone', async () => {
    const response = await core.trust.removeConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    // @TODO: This does not work yet since the Subgraph needs to update the limit instead of adding a new entry every time
    // const connection = await loop(
    //   () => {
    //     return getTrustConnection(account, safeAddress, otherSafeAddress);
    //   },
    //   connection => connection.limitTo === 0,
    // );

    // expect(connection.isTrustedByMe).toBe(false);
    // expect(connection.isTrustingMe).toBe(false);
    // expect(connection.limitFrom).toBe(0);
    // expect(connection.limitTo).toBe(0);
  });
});
