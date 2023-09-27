import createCore from './helpers/core';
import getAccount from './helpers/account';
import getTrustConnection from './helpers/getTrustConnection';
import web3 from './helpers/web3';
import { deploySafeAndToken } from './helpers/transactions';

let accountA;
let accountB;
let accountMe;
let accountTrustee;
let accountTruster;
let accountMutualTrust;
let accountNoTrust;
let core;
let safeAddressA;
let safeAddressB;
let safeAddressMe;
let safeAddressTrustee;
let safeAddressTruster;
let safeAddressMutualTrust;
let safeAddressNoTrust;
let network;

beforeAll(async () => {
  accountA = getAccount();
  accountB = getAccount(3);
  accountMe = getAccount(5);
  accountTrustee = getAccount(6);
  accountTruster = getAccount(7);
  core = createCore();
});

describe('Trust', () => {
  beforeAll(() =>
    Promise.all([
      deploySafeAndToken(core, accountA),
      deploySafeAndToken(core, accountB),
    ]).then((result) => {
      safeAddressA = result[0].safeAddress;
      safeAddressB = result[1].safeAddress;
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

  describe('Network', () => {
    beforeAll(() =>
      Promise.all([
        deploySafeAndToken(core, accountMe),
        deploySafeAndToken(core, accountTrustee),
        deploySafeAndToken(core, accountTruster),
        deploySafeAndToken(core, accountMutualTrust),
        deploySafeAndToken(core, accountNoTrust),
      ]).then((result) => {
        safeAddressMe = result[2].safeAddress;
        safeAddressTrustee = result[3].safeAddress;
        safeAddressTruster = result[4].safeAddress;
        safeAddressMutualTrust = result[5].safeAddress;
        safeAddressNoTrust = result[6].safeAddress;
      }),
    );
    it('should create trust connections', async () => {
      // create initial network
      // Me trusts Trustee
      await core.trust.addConnection(accountMe, {
        user: safeAddressTrustee,
        canSendTo: safeAddressMe,
      });
      // Truster trusts Me
      await core.trust.addConnection(accountTruster, {
        user: safeAddressMe,
        canSendTo: safeAddressTruster,
      });
      // Me trust MutualTrust
      await core.trust.addConnection(accountMe, {
        user: safeAddressMutualTrust,
        canSendTo: safeAddressMe,
      });
      // MutualTrust trusts Me
      await core.trust.addConnection(accountMutualTrust, {
        user: safeAddressMe,
        canSendTo: safeAddressMutualTrust,
      });
      // Truster trusts A
      await core.trust.addConnection(accountTruster, {
        user: safeAddressA,
        canSendTo: safeAddressTruster,
      });
      // Truster trusts B
      await core.trust.addConnection(accountTruster, {
        user: safeAddressB,
        canSendTo: safeAddressTruster,
      });
      // Truster trusts Trustee
      await core.trust.addConnection(accountTruster, {
        user: safeAddressTrustee,
        canSendTo: safeAddressTruster,
      });
      // Trustee trusts A
      await core.trust.addConnection(accountTrustee, {
        user: safeAddressA,
        canSendTo: safeAddressTrustee,
      });
      // MutualTrust trusts A
      await core.trust.addConnection(accountMutualTrust, {
        user: safeAddressA,
        canSendTo: safeAddressMutualTrust,
      });
      // NoTrust trusts A
      await core.trust.addConnection(accountNoTrust, {
        user: safeAddressA,
        canSendTo: safeAddressNoTrust,
      });
      // NoTrust trusts B
      await core.trust.addConnection(accountNoTrust, {
        user: safeAddressB,
        canSendTo: safeAddressNoTrust,
      });
      // B trusts NoTrust
      await core.trust.addConnection(accountB, {
        user: safeAddressNoTrust,
        canSendTo: safeAddressB,
      });
    });

    it('should generate a correct trust network for a safe', async () => {
      // To represent a SW we have an account that only trusts others but no-one trusts them
      // console.log("1")
      // await core.utils.loop(
      //   () => getTrustConnection(core, accountB, safeAddressB, safeAddressA),
      //   ({ mutualConnections }) => mutualConnections.length === 1,
      //   { label: 'Wait for trust connection to be indexed by the Graph' },
      // );
      // console.log("2")
      // await core.utils.loop(
      //   () => getTrustConnection(core, accountB, safeAddressB, safeAddressTrustee),
      //   ({ mutualConnections }) => mutualConnections.length === 1,
      //   { label: 'Wait for trust connection to be indexed by the Graph' },
      // );
      // console.log("3")
      // retrieve Safe B network
      network = await core.utils.loop(
        () =>
          core.trust.getNetwork(accountMe, {
            safeAddress: safeAddressMe,
          }),
        (network) => network.length === 5,
        { label: 'Wait for trust network to be updated' },
      );
      // one trust, one trustee, one dual trust, one account with mutual connection and self
      expect(network.length).toBe(5);
    });

    it('should generate a correct trust info for unconnected accounts', async () => {
      const connectionWithA = network.find(
        (element) => element.safeAddress === safeAddressA,
      );
      const connectionWithB = network.find(
        (element) => element.safeAddress === safeAddressA,
      );
      expect(connectionWithA).toBe(null);
      expect(connectionWithB).toBe(null);
    });

    it('should generate a correct trust info with own account', async () => {
      const connectionWithMe = network.find(
        (element) => element.safeAddress === safeAddressMe,
      );
      expect(connectionWithMe.isOutgoing).toBe(false);
      expect(connectionWithMe.isIncoming).toBe(false);
      expect(connectionWithMe.mutualConnections.length).toBe(4);
      expect(connectionWithMe.mutualConnections).toContain([safeAddressA]);
      expect(connectionWithMe.mutualConnections).toContain([safeAddressB]);
      expect(connectionWithMe.mutualConnections).toContain([
        safeAddressTrustee,
      ]);
      expect(connectionWithMe.mutualConnections).toContain([
        safeAddressMutualTrust,
      ]);
    });

    it('should generate a correct trust info with a trustee', async () => {
      const connectionWithTrustee = network.find(
        (element) => element.safeAddress === safeAddressTrustee,
      );
      expect(connectionWithTrustee.isOutgoing).toBe(false);
      expect(connectionWithTrustee.isIncoming).toBe(true);
      expect(connectionWithTrustee.mutualConnections).toStrictEqual([
        safeAddressA,
      ]);
    });

    it('should generate a correct trust info with a truster', async () => {
      const connectionWithTruster = network.find(
        (element) => element.safeAddress === safeAddressTruster,
      );

      expect(connectionWithTruster.isOutgoing).toBe(true);
      expect(connectionWithTruster.isIncoming).toBe(false);
      expect(connectionWithTruster.mutualConnections.length).toBe(3);
      expect(connectionWithTruster.mutualConnections).toContain([safeAddressA]);
      expect(connectionWithTruster.mutualConnections).toContain([safeAddressB]);
      expect(connectionWithTruster.mutualConnections).toContain([
        safeAddressTrustee,
      ]);
    });

    it('should generate a correct trust info with a truster who is also a trustee', async () => {
      const connectionWithMutualTrust = network.find(
        (element) => element.safeAddress === safeAddressMutualTrust,
      );

      expect(connectionWithMutualTrust.isOutgoing).toBe(true);
      expect(connectionWithMutualTrust.isIncoming).toBe(true);
      expect(connectionWithMutualTrust.mutualConnections).toStrictEqual([
        safeAddressA,
      ]);
    });

    it('should generate a correct trust info with an account that is neither directly trusted or directly trusting', async () => {
      const connectionWithNoTrust = network.find(
        (element) => element.safeAddress === safeAddressNoTrust,
      );

      expect(connectionWithNoTrust.isOutgoing).toBe(false);
      expect(connectionWithNoTrust.isIncoming).toBe(false);
      expect(connectionWithNoTrust.mutualConnections.length).toBe(2);
      expect(connectionWithNoTrust.mutualConnections).toContain([safeAddressA]);
      expect(connectionWithNoTrust.mutualConnections).toContain([safeAddressB]);
    });
  });
});
