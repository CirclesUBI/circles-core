import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';
import { deploySafeAndToken } from './helpers/transactions';

describe('Organization', () => {
  let account;
  let core;
  let safeAddress;
  let userSafeAddress;

  beforeAll(async () => {
    account = getAccount(0);
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

    await loop(() => web3.eth.getCode(safeAddress));
  });

  it('should check if safe has enough funds for organization to be created', async () => {
    const value = await loop(
      async () => {
        return await core.organization.isFunded(account, {
          safeAddress,
        });
      },
      (isFunded) => {
        return isFunded;
      },
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
    isOrganization = await core.organization.isOrganization(account, {
      safeAddress,
    });
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

    const result = await loop(
      async () => {
        return await core.token.listAllTokens(account, {
          safeAddress,
        });
      },
      (tokens) => {
        return tokens.length > 0 && tokens[0].amount.eq(expectedValue);
      },
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
});
