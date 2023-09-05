import createCore from './helpers/core';
import getAccount from './helpers/account';
import getTrustConnection from './helpers/getTrustConnection';
import web3 from './helpers/web3';
import { deploySafeAndToken } from './helpers/transactions';

let accountA;
let accountB;
let accountC;
let core;
let safeAddressA;
let safeAddressB;
let safeAddressC;

beforeAll(async () => {
  accountA = getAccount();
  accountB = getAccount(3);
  accountC = getAccount(5);
  core = createCore();
});

describe('Trust', () => {
  beforeAll(() =>
    Promise.all([
      deploySafeAndToken(core, accountA),
      deploySafeAndToken(core, accountB),
      deploySafeAndToken(core, accountC),
    ]).then((result) => {
      safeAddressA = result[0].safeAddress;
      safeAddressB = result[1].safeAddress;
      safeAddressC = result[2].safeAddress;
    }),
  );

  xit('should trust someone', async () => {
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

  xit('should untrust someone', async () => {
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

  it('network should give no mutually trusted connections', async () => {
    // A trusts B
    await core.trust.addConnection(accountA, {
      user: safeAddressB,
      canSendTo: safeAddressA,
      limitPercentage: 100,
    });
    // A trusts C
    await core.trust.addConnection(accountA, {
      user: safeAddressC,
      canSendTo: safeAddressA,
      limitPercentage: 100,
    });

    const network = await core.utils.loop(
      async () => {
        return await core.trust.getNetwork(accountA, {
          safeAddress: safeAddressA,
        });
      },
      (network) => {
        // console.log(network)
        // console.log(safeAddressA, safeAddressB, safeAddressC)
        return network.length === 2;
      },
      { label: 'Wait for trust network to be updated' },
    );

    const mutualConnectionsAC = network.find(
      (element) => element.safeAddress === safeAddressC,
    ).mutualConnections;
    expect(mutualConnectionsAC.length).toBe(0);
  });

  it('network should give the correct mutually trusted connection', async () => {
    // C trust B
    await core.trust.addConnection(accountA, {
      user: safeAddressB,
      canSendTo: safeAddressC,
      limitPercentage: 100,
    });

    // Now both A and C trusts B and B should be a mutually trusted connection

    // B trust C - testing reverse logic
    await core.trust.addConnection(accountA, {
      user: safeAddressC,
      canSendTo: safeAddressB,
      limitPercentage: 50,
    });

    const network = await core.utils.loop(
      async () => {
        return await core.trust.getNetwork(accountA, {
          safeAddress: safeAddressA,
        });
      },
      (network) => {
        // console.log(network);

        return (
          network.find((element) => element.safeAddress === safeAddressC)
            .mutualConnections.length === 1
        );
      },
      { label: 'Wait for trust network to be updated' },
    );

    const mutualConnectionsAC = network.find(
      (element) => element.safeAddress === safeAddressC,
    ).mutualConnections;
    expect(mutualConnectionsAC.length).toBe(1);
    expect(mutualConnectionsAC).toContain(safeAddressB);
  });
});
