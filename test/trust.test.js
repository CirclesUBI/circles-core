import createCore from './helpers/core';
import getAccount from './helpers/account';
import getTrustConnection from './helpers/getTrustConnection';
import web3 from './helpers/web3';
import { deploySafeAndToken } from './helpers/transactions';

let accountA;
let accountB;
let accountC;
let accountD;
let core;
let safeAddressA;
let safeAddressB;
let safeAddressC;
let safeAddressD;

beforeAll(async () => {
  accountA = getAccount();
  accountB = getAccount(3);
  accountC = getAccount(5);
  accountD = getAccount(6);
  core = createCore();
});

describe('Trust', () => {
  beforeAll(() =>
    Promise.all([
      deploySafeAndToken(core, accountA),
      deploySafeAndToken(core, accountB),
      deploySafeAndToken(core, accountC),
      deploySafeAndToken(core, accountD),
    ]).then((result) => {
      safeAddressA = result[0].safeAddress;
      safeAddressB = result[1].safeAddress;
      safeAddressC = result[2].safeAddress;
      safeAddressD = result[3].safeAddress;
    }),
  );

  it('should trust someone', async () => {
    // A trusts B
    const response = await core.trust.addConnection(accountA, {
      user: safeAddressB,
      canSendTo: safeAddressA,
      limitPercentage: 44,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    const connection = await core.utils.loop(
      () => {
        return getTrustConnection(core, accountA, safeAddressA, safeAddressB);
      },
      (isReady) => isReady,
      { label: 'Wait for the graph to index newly added trust connection' },
    );

    expect(connection.safeAddress).toBe(safeAddressB);
    expect(connection.isIncoming).toBe(true);
    expect(connection.isOutgoing).toBe(false);

    let otherConnection = await core.utils.loop(
      () => {
        return getTrustConnection(core, accountB, safeAddressB, safeAddressA);
      },
      (isReady) => isReady,
      { label: 'Wait for trust connection to be indexed by the graph' },
    );

    expect(otherConnection.safeAddress).toBe(safeAddressA);
    expect(otherConnection.isIncoming).toBe(false);
    expect(otherConnection.isOutgoing).toBe(true);

    // Test bidirectional trust connections
    // B trusts A
    await core.trust.addConnection(accountB, {
      user: safeAddressA,
      canSendTo: safeAddressB,
      limitPercentage: 72,
    });

    otherConnection = await core.utils.loop(
      () => {
        return getTrustConnection(core, accountB, safeAddressB, safeAddressA);
      },
      ({ isIncoming, isOutgoing }) => {
        return isIncoming && isOutgoing;
      },
      { label: 'Wait for trust connection to be indexed by the Graph' },
    );

    expect(otherConnection.safeAddress).toBe(safeAddressA);
    expect(otherConnection.isIncoming).toBe(true);
    expect(otherConnection.isOutgoing).toBe(true);

    // This should not be true as we don't have enough
    // trust connections yet
    const { isTrusted } = await core.trust.isTrusted(accountB, {
      safeAddress: safeAddressA,
    });

    expect(isTrusted).toBe(false);

    // This should be true as we lowered the limit
    const { isTrusted: isTrustedLowLimit } = await core.trust.isTrusted(
      accountB,
      {
        safeAddress: safeAddressA,
        limit: 1,
      },
    );

    expect(isTrustedLowLimit).toBe(true);
  });

  it('should untrust someone', async () => {
    const response = await core.trust.removeConnection(accountA, {
      user: safeAddressB,
      canSendTo: safeAddressA,
    });

    expect(web3.utils.isHexStrict(response)).toBe(true);

    await core.trust.removeConnection(accountB, {
      user: safeAddressA,
      canSendTo: safeAddressB,
    });

    const network = await core.utils.loop(
      async () => {
        return await core.trust.getNetwork(accountA, {
          safeAddress: safeAddressA,
        });
      },
      (network) => network.length === 0,
      { label: 'Wait for trust network to be empty after untrusting user' },
    );

    expect(network.length).toBe(0);
  });

  it('should generate a correct trust network for a safe', async () => {
    // create initial network
    // A trusts B
    await core.trust.addConnection(accountA, {
      user: safeAddressB,
      canSendTo: safeAddressA,
    });
    // A trusts C
    await core.trust.addConnection(accountA, {
      user: safeAddressC,
      canSendTo: safeAddressA,
    });
    // B trusts C
    await core.trust.addConnection(accountB, {
      user: safeAddressC,
      canSendTo: safeAddressB,
    });
    // B trusts D
    await core.trust.addConnection(accountB, {
      user: safeAddressD,
      canSendTo: safeAddressB,
    });
    // D trusts A
    await core.trust.addConnection(accountD, {
      user: safeAddressA,
      canSendTo: safeAddressD,
    });
    // D trusts B
    await core.trust.addConnection(accountD, {
      user: safeAddressB,
      canSendTo: safeAddressD,
    });
    // D trusts C
    await core.trust.addConnection(accountD, {
      user: safeAddressC,
      canSendTo: safeAddressD,
    });

    await core.utils.loop(
      () => getTrustConnection(core, accountB, safeAddressB, safeAddressA),
      ({ mutualConnections }) => mutualConnections.length === 1,
      { label: 'Wait for trust connection to be indexed by the Graph' },
    );

    await core.utils.loop(
      () => getTrustConnection(core, accountB, safeAddressB, safeAddressD),
      ({ mutualConnections }) => mutualConnections.length === 2,
      { label: 'Wait for trust connection to be indexed by the Graph' },
    );

    // retrieve Safe B network
    const network = await core.utils.loop(
      () =>
        core.trust.getNetwork(accountB, {
          safeAddress: safeAddressB,
        }),
      (network) => network.length === 3,
      { label: 'Wait for trust network to be updated' },
    );

    const connectionWithA = network.find(
      (element) => element.safeAddress === safeAddressA,
    );
    const connectionWithC = network.find(
      (element) => element.safeAddress === safeAddressC,
    );
    const connectionWithD = network.find(
      (element) => element.safeAddress === safeAddressD,
    );

    // Check outgoing with mutual connections
    expect(connectionWithA.isOutgoing).toBe(true);
    expect(connectionWithA.isIncoming).toBe(false);
    expect(connectionWithA.mutualConnections).toStrictEqual([safeAddressC]);

    // Check connection with no mutual connections
    expect(connectionWithC.isOutgoing).toBe(false);
    expect(connectionWithC.isIncoming).toBe(true);
    expect(connectionWithC.mutualConnections.length).toBe(0);

    // Check outgoing/incoming with mutual connections
    expect(connectionWithD.isOutgoing).toBe(true);
    expect(connectionWithD.isIncoming).toBe(true);
    expect(connectionWithD.mutualConnections.length).toBe(2);
    expect(connectionWithD.mutualConnections).toContain(safeAddressA);
    expect(connectionWithD.mutualConnections).toContain(safeAddressC);
  });
});
