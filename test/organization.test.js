import createCore from './helpers/core';
import getAccount from './helpers/account';
import web3 from './helpers/web3';
import isContractDeployed from './helpers/isContractDeployed';
import { deploySafeAndToken } from './helpers/transactions';

describe('Organization', () => {
  let account;
  let otherAccount;
  let core;
  let safeAddress;
  let userSafeAddress;
  let otherUserSafeAddress;

  beforeAll(async () => {
    account = getAccount(0);
    otherAccount = getAccount(1);
    core = createCore();

    // First deploy users Safe ..
    const user = await deploySafeAndToken(core, account);
    userSafeAddress = user.safeAddress;

    // .. to then prepare deployment of the second Safe for the organization
    safeAddress = await core.safe.prepareDeploy(account, {
      nonce: Date.now(),
    });

    await core.safe.deployForOrganization(account, {
      safeAddress,
    });

    await core.utils.loop(
      () => web3.eth.getCode(safeAddress),
      isContractDeployed,
      {
        label: 'Wait until Safe for organization got deployed',
        retryDelay: 4000,
      },
    );

    // Then deploy other users Safe .. to test trust connections
    const otherUser = await deploySafeAndToken(core, otherAccount);
    otherUserSafeAddress = otherUser.safeAddress;
  });

  it('should check if safe has enough funds for organization to be created', async () => {
    const value = await core.utils.loop(
      async () => {
        return await core.organization.isFunded(account, {
          safeAddress,
        });
      },
      (isFunded) => {
        return isFunded;
      },
      { label: 'Wait for organization to be funded', retryDelay: 4000 },
    );

    expect(value).toBe(true);
  });

  it('should create an organization and return true if it exists', async () => {
    // isOrganization should be false in the beginning
    let isOrganization = await core.organization.isOrganization(account, {
      safeAddress,
    });
    expect(isOrganization).toBe(false);

    // Deploy organization and expect a correct transaction hash
    const txHash = await core.organization.deploy(account, {
      safeAddress,
    });
    expect(web3.utils.isHexStrict(txHash)).toBe(true);

    // isOrganization should be true now
    isOrganization = await core.utils.loop(
      () => {
        return core.organization.isOrganization(account, {
          safeAddress,
        });
      },
      (isOrg) => isOrg,
      { label: 'Wait for newly added address to show up as Safe owner' },
    );
    expect(isOrganization).toBe(true);
  });

  it('should prefund the organization so it can pay for its transactions', async () => {
    const value = 3;

    await core.organization.prefund(account, {
      from: userSafeAddress,
      to: safeAddress,
      value: web3.utils.toBN(web3.utils.toWei(value.toString(), 'ether')),
    });

    const expectedValue = web3.utils.toBN(
      web3.utils.toWei(value.toString(), 'ether'),
    );

    const result = await core.utils.loop(
      async () => {
        return await core.token.listAllTokens(account, {
          safeAddress,
        });
      },
      (tokens) => {
        return tokens.length > 0 && tokens[0].amount.eq(expectedValue);
      },
      { label: 'Wait for organization to own some ether' },
    );

    expect(result[0].amount.eq(expectedValue)).toBe(true);
  });

  it('should use the funds to execute a transaction on its own', async () => {
    const txHash = await core.safe.addOwner(account, {
      safeAddress,
      ownerAddress: web3.utils.toChecksumAddress(web3.utils.randomHex(20)),
    });

    expect(web3.utils.isHexStrict(txHash)).toBe(true);
  });

  it('should be able to trust a user as an organization', async () => {
    const txHash = await core.trust.addConnection(account, {
      user: otherUserSafeAddress,
      canSendTo: safeAddress,
      limitPercentage: 44,
    });

    expect(web3.utils.isHexStrict(txHash)).toBe(true);
  });
});
