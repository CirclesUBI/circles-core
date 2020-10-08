import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';
import { deploySafe } from './helpers/transactions';

describe('Organization', () => {
  let account;
  let core;
  let safeAddress;

  beforeAll(async () => {
    account = getAccount(0);
    core = createCore();

    // First deploy users Safe ..
    await deploySafe(core, account);

    // .. to then deploy the second Safe for the organization
    safeAddress = await core.safe.prepareDeploy(account, {
      nonce: Date.now(),
    });

    await core.safe.deployForOrganization(account, {
      safeAddress,
    });

    await loop(() => web3.eth.getCode(safeAddress));
  });

  it('should check if safe has enough funds for organization to be created', async () => {
    expect(
      await core.organization.isFunded(account, {
        safeAddress,
      }),
    ).toBe(true);
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
});
