import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';

import {
  deploySafeAndToken,
  addTrustConnection,
  addSafeOwner,
} from './helpers/transactions';

let account;
let core;
let safeAddress;

let otherAccount;
let otherSafeAddress;

let secondOwnerAccount;
let thirdOwnerAccount;

let activities;
let otherActivities;

const findOwnerActivity = (accountAddress, items) => {
  return items.find(({ type, data }) => {
    return (
      type === core.activity.ActivityTypes.ADD_OWNER &&
      data.safeAddress === safeAddress &&
      data.ownerAddress === accountAddress
    );
  });
};

beforeAll(async () => {
  account = getAccount();
  secondOwnerAccount = getAccount(5);
  thirdOwnerAccount = getAccount(6);
  otherAccount = getAccount(7);
  core = createCore();
});

describe('Activity', () => {
  beforeAll(async () => {
    // Create two accounts
    const result = await deploySafeAndToken(core, account);
    safeAddress = result.safeAddress;

    const otherResult = await deploySafeAndToken(core, otherAccount);
    otherSafeAddress = otherResult.safeAddress;

    // .. and do some activity!
    await addTrustConnection(core, otherAccount, {
      user: safeAddress,
      canSendTo: otherSafeAddress,
    });

    await core.token.transfer(account, {
      from: safeAddress,
      to: otherSafeAddress,
      value: web3.utils.toBN(core.utils.toFreckles(3)),
    });

    await addSafeOwner(core, account, {
      safeAddress,
      ownerAddress: secondOwnerAccount.address,
    });

    await loop(
      () => {
        return core.activity.getLatest(account, {
          safeAddress,
        });
      },
      (result) => {
        return findOwnerActivity(secondOwnerAccount.address, result.activities);
      },
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
  });

  it('orders the activities by timestamp', () => {
    activities.forEach(({ timestamp }, index) => {
      if (index === 0) {
        return;
      }

      expect(timestamp > activities[index - 1].timestamp);
    });
  });

  it('returns activities based on pagination arguments', async () => {
    const transactionHash = await addSafeOwner(core, account, {
      safeAddress,
      ownerAddress: thirdOwnerAccount.address,
    });

    let activity;

    const latest = await loop(
      () => {
        return core.activity.getLatest(account, {
          safeAddress,
          limit: 1,
        });
      },
      (result) => {
        return findOwnerActivity(thirdOwnerAccount.address, result.activities);
      },
    );

    // Expect latest activity
    activity = findOwnerActivity(thirdOwnerAccount.address, latest.activities);
    expect(activity).toBeDefined();
    expect(activity.transactionHash).toBe(transactionHash);

    // .. but not the older ones
    activity = findOwnerActivity(secondOwnerAccount.address, latest.activities);
    expect(activity).toBeUndefined();

    activity = findOwnerActivity(account.address, latest.activities);
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
