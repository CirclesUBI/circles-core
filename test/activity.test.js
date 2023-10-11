import { ethers } from 'ethers';

import core from './helpers/core';
import accounts from './helpers/accounts';
import generateSaltNonce from './helpers/generateSaltNonce';
import onboardAccount from './helpers/onboardAccount';

const findOwnerActivity = (safeAddress, accountAddress, items) => {
  return items.find(({ type, data }) => {
    return (
      type === core.activity.ActivityTypes.ADD_OWNER &&
      data.safeAddress === safeAddress &&
      data.ownerAddress === accountAddress
    );
  });
};

describe('Activity', () => {
  const account = accounts[0];
  const otherAccount = accounts[1];
  const secondOwnerAccount = accounts[2];
  const thirdOwnerAccount = accounts[3];
  let safeAddress;
  let otherSafeAddress;
  let activities;
  let otherActivities;
  let mutualActivities;

  beforeAll(async () => {
    safeAddress = await onboardAccount({
      account,
      nonce: generateSaltNonce(),
    }).then(({ safeAddress }) => safeAddress);
    otherSafeAddress = await onboardAccount({
      account: otherAccount,
      nonce: generateSaltNonce(),
    }).then(({ safeAddress }) => safeAddress);

    // .. and do some activity!
    await core.trust
      .addConnection(otherAccount, {
        user: safeAddress,
        canSendTo: otherSafeAddress,
      })
      .then(() =>
        core.token.transfer(account, {
          from: safeAddress,
          to: otherSafeAddress,
          value: ethers.BigNumber.from(core.utils.toFreckles(3)),
        }),
      )
      .then(() =>
        core.safe.addOwner(account, {
          safeAddress,
          ownerAddress: secondOwnerAccount.address,
        }),
      )
      .then(() =>
        core.safe.addOwner(account, {
          safeAddress,
          ownerAddress: thirdOwnerAccount.address,
        }),
      );

    const latest = await core.utils.loop(
      () => {
        return core.activity.getLatest(account, {
          safeAddress,
        });
      },
      (result) => {
        return findOwnerActivity(
          safeAddress,
          account.address,
          result.activities,
        );
      },
      { label: 'Wait for graph to index latest activities' },
    );

    // Get activities!
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

  it('returns mutual activities connected with transfer action', () => {
    const foundTransferItems = mutualActivities.filter(
      (item) => item.type === core.activity.ActivityTypes.HUB_TRANSFER,
    );
    expect(foundTransferItems.length).toEqual(1);
  });

  it('returns mutual activities connected with trust action', () => {
    const foundTrustItems = mutualActivities.filter(
      (item) => item.type === core.activity.ActivityTypes.ADD_CONNECTION,
    );
    expect(foundTrustItems.length).toEqual(1);
  });

  it('returns activities based on pagination arguments', async () => {
    let activity;
    const latest = await core.activity.getLatest(account, {
      safeAddress,
      limit: 2,
    });

    // Expect latest activity
    activity = findOwnerActivity(
      safeAddress,
      thirdOwnerAccount.address,
      latest.activities,
    );
    expect(activity).toBeDefined();

    // .. but not the older ones
    activity = findOwnerActivity(
      safeAddress,
      secondOwnerAccount.address,
      latest.activities,
    );
    expect(activity).toBeDefined();

    activity = findOwnerActivity(
      safeAddress,
      account.address,
      latest.activities,
    );
    expect(activity).toBeUndefined();
  });

  it('returns the first added owner event', () => {
    const activity = activities.find(({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.ADD_OWNER &&
        data.safeAddress === safeAddress &&
        data.ownerAddress === account.address
      );
    });

    expect(activity).toBeDefined();
  });

  it('returns the second added owner event', () => {
    const activity = activities.find(({ type, data }) => {
      return (
        type === core.activity.ActivityTypes.ADD_OWNER &&
        data.safeAddress === safeAddress &&
        data.ownerAddress === secondOwnerAccount.address
      );
    });

    expect(activity).toBeDefined();
  });

  it('returns the trust event for both Safes', () => {
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

  it('returns the hub transfer event for both Safes', () => {
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
      ethers.BigNumber.from(core.utils.toFreckles(3)),
    );
  });
});
