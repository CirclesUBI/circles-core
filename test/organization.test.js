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
    safeAddress = await deploySafe(core, account);
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

    // Wait until it exists ..
    await loop(() => web3.eth.getCode(safeAddress));

    // isOrganization should be true now
    isOrganization = await core.organization.isOrganization(account, {
      safeAddress,
    });
    expect(isOrganization).toBe(true);
  });
});
