import createCore from './helpers/core';
import getAccounts from './helpers/getAccounts';
import setupWeb3 from './helpers/setupWeb3';
import generateSaltNonce from './helpers/generateSaltNonce';
import onboardAccountManually from './helpers/onboardAccountManually';

const findOwnerActivity = (core, safeAddress, accountAddress, items) => {
  return items.find(({ type, data }) => {
    return (
      type === core.activity.ActivityTypes.ADD_OWNER &&
      data.safeAddress === safeAddress &&
      data.ownerAddress === accountAddress
    );
  });
};

describe('Activity', () => {
  const { web3, provider } = setupWeb3();
  const core = createCore(web3);
  const accounts = getAccounts(web3).slice(0, 4);
  let safeAddress;
  let otherSafeAddress;
  let account;
  let otherAccount;
  let secondOwnerAccount;
  let thirdOwnerAccount;
  let activities;
  let otherActivities;
  let mutualActivities;

  afterAll(() => provider.engine.stop());
  beforeAll(async () => {
    secondOwnerAccount = accounts[2];
    thirdOwnerAccount = accounts[3];

    // Create two accounts
    account = accounts[0];
    otherAccount = accounts[1];
    [safeAddress, otherSafeAddress] = await Promise.all([
      onboardAccountManually(
        { account, nonce: generateSaltNonce() },
        core,
      ).then(({ safeAddress }) => safeAddress),
      onboardAccountManually(
        { account: otherAccount, nonce: generateSaltNonce() },
        core,
      ).then(({ safeAddress }) => safeAddress),
    ]);

    // .. and do some activity!
    await core.trust.addConnection(otherAccount, {
      user: safeAddress,
      canSendTo: otherSafeAddress,
    });

    await core.token.transfer(account, {
      from: safeAddress,
      to: otherSafeAddress,
      value: web3.utils.toBN(core.utils.toFreckles(3)),
    });

    await core.safe.addOwner(account, {
      safeAddress,
      ownerAddress: secondOwnerAccount.address,
    });

    await core.utils.loop(
      () => {
        return core.activity.getLatest(account, {
          safeAddress,
        });
      },
      (result) => {
        return findOwnerActivity(
          core,
          safeAddress,
          secondOwnerAccount.address,
          result.activities,
        );
      },
      { label: 'Wait for graph to index latest activities' },
    );

    // Get activities!
    const latest = await core.activity.getLatest(account, {
      safeAddress,
    });

    activities = latest.activities;

    const otherLatest = await core.activity.getLatest(otherAccount, {
      safeAddress: otherSafeAddress,
    });

    otherActivities = otherLatest.activities;

    const mutualLatest = await core.activity.getLatest(account, {
      safeAddress,
      otherSafeAddress,
    });

    mutualActivities = mutualLatest.activities;
  });

  it('orders the activities by timestamp', () => {
    activities.forEach(({ timestamp }, index) => {
      if (index === 0) {
        return;
      }

      expect(timestamp > activities[index - 1].timestamp);
    });
  });

  it('filters them by type', async () => {
    const result = await core.activity.getLatest(account, {
      safeAddress,
      filter: core.activity.ActivityFilterTypes.TRANSFERS,
    });
    const wrongResult = result.activities.find(({ type }) => {
      return (
        type !== core.activity.ActivityTypes.HUB_TRANSFER &&
        type !== core.activity.ActivityTypes.TRANSFER
      );
    });

    expect(wrongResult).toBeUndefined();
  });

  it('returns mutual activities connected with transfer action', async () => {
    const foundTransferItems = mutualActivities.filter(
      (item) => item.type === core.activity.ActivityTypes.HUB_TRANSFER,
    );
    expect(foundTransferItems.length).toEqual(1);
  });

  it('returns mutual activities connected with trust action', async () => {
    const foundTrustItems = mutualActivities.filter(
      (item) => item.type === core.activity.ActivityTypes.ADD_CONNECTION,
    );
    expect(foundTrustItems.length).toEqual(1);
  });

  it('returns activities based on pagination arguments', async () => {
    core.safe.addOwner(account, {
      safeAddress,
      ownerAddress: thirdOwnerAccount.address,
    });

    let activity;
    const latest = await core.utils.loop(() =>
      core.activity.getLatest(account, { safeAddress, limit: 2 }),
    );

    core.activity.getLatest(account, {
      safeAddress,
      limit: 2,
    });

    expect(latest.activities.length).toBe(1);

    // Expect latest activity
    activity = findOwnerActivity(
      core,
      safeAddress,
      thirdOwnerAccount.address,
      latest.activities,
    );
    expect(activity).toBeDefined();

    // .. but not the older ones
    activity = findOwnerActivity(
      core,
      safeAddress,
      secondOwnerAccount.address,
      latest.activities,
    );
    expect(activity).toBeUndefined();

    activity = findOwnerActivity(
      core,
      safeAddress,
      account.address,
      latest.activities,
    );
    expect(activity).toBeUndefined();
  });

  it('returns the first added owner event', async () => {
    const activity = activities.find(({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.ADD_OWNER &&
        data.safeAddress === safeAddress &&
        data.ownerAddress === account.address
      );
    });

    expect(activity).toBeDefined();
  });

  it('returns the second added owner event', async () => {
    const activity = activities.find(({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.ADD_OWNER &&
        data.safeAddress === safeAddress &&
        data.ownerAddress === secondOwnerAccount.address
      );
    });

    expect(activity).toBeDefined();
  });

  it('returns the trust event for both Safes', async () => {
    const query = ({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.ADD_CONNECTION &&
        data.canSendTo === otherSafeAddress &&
        data.user === safeAddress
      );
    };

    expect(activities.find(query)).toBeDefined();
    expect(otherActivities.find(query)).toBeDefined();
  });

  it('returns the hub transfer event for both Safes', async () => {
    const query = ({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.HUB_TRANSFER &&
        data.from === safeAddress &&
        data.to === otherSafeAddress
      );
    };

    const activity = activities.find(query);

    expect(activity).toBeDefined();
    expect(otherActivities.find(query)).toBeDefined();

    expect(activity.data.value).toMatchObject(
      new web3.utils.BN(core.utils.toFreckles(3)),
    );
  });
});
