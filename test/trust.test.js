import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop, { getTrustConnection, isReady } from './helpers/loop';
import web3 from './helpers/web3';
import { deploySafe, deployToken } from './helpers/transactions';

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

    await deployToken(core, account, { safeAddress });
    await deployToken(core, otherAccount, { safeAddress: otherSafeAddress });
  });

  it('should trust someone', async () => {
    const response = await core.trust.addConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
      limitPercentage: 44,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const connection = await loop(() => {
      return getTrustConnection(core, account, safeAddress, otherSafeAddress);
    }, isReady);

    expect(connection.isTrustedByMe).toBe(true);
    expect(connection.isTrustingMe).toBe(false);
    expect(connection.limitPercentageTo).toBe(44);

    const otherConnection = await loop(() => {
      return getTrustConnection(
        core,
        otherAccount,
        otherSafeAddress,
        safeAddress,
      );
    }, isReady);

    expect(otherConnection.isTrustedByMe).toBe(false);
    expect(otherConnection.isTrustingMe).toBe(true);
    expect(otherConnection.limitPercentageFrom).toBe(44);
  });

  it('should untrust someone', async () => {
    const response = await core.trust.removeConnection(account, {
      from: safeAddress,
      to: otherSafeAddress,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const network = await loop(
      async () => {
        return await core.trust.getNetwork(account, {
          safeAddress,
        });
      },
      network => network.length === 0,
    );

    expect(network.length).toBe(0);
  });
});
