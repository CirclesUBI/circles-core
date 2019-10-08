import createCore from './helpers/createCore';
import getAccount from './helpers/getAccount';
import web3 from './helpers/web3';

let account;
let core;
let otherAccount;
let safeAddress;

beforeAll(async () => {
  account = getAccount();
  otherAccount = getAccount(1);
  core = createCore();
});

describe('Safe', () => {
  beforeAll(async () => {
    const safeCreationNonce = new Date().getTime();

    safeAddress = await core.safe.prepareDeploy(account, {
      nonce: safeCreationNonce,
    });
  });

  describe('when a new Safe gets created', () => {
    it('should have predicted its future Safe address', () => {
      expect(web3.utils.isAddress(safeAddress)).toBe(true);
    });

    it('should be manually triggered to get deployed', async () => {
      // @TODO: Get enough trust connections before,
      // tho this is not implemented yet in the relayer.
      const result = await core.safe.deploy(account, {
        address: safeAddress,
      });
      // .. wait for Relayer to really deploy Safe
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Deploy Token as well to pay our fees later
      await core.ubi.signup(account, {
        safeAddress,
      });

      expect(result).toBe(true);
    });
  });

  describe('When I want to manage the owners of a Safe', () => {
    beforeAll(async () => {
      const result = await core.safe.deploy(account, {
        address: safeAddress,
      });
      // .. wait for Relayer to really deploy Safe
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Deploy Token as well to pay our fees later
      await core.ubi.signup(account, {
        safeAddress,
      });
    });

    it('should return a list of the current owners', async () => {
      const owners = await core.safe.getOwners(account, {
        address: safeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });

    it('should add another owner to the Safe', async () => {
      await core.safe.addOwner(account, {
        address: safeAddress,
        owner: otherAccount.address,
      });

      const owners = await core.safe.getOwners(account, {
        address: safeAddress,
      });

      expect(owners[1]).toBe(account.address);
      expect(owners[0]).toBe(otherAccount.address);
      expect(owners.length).toBe(2);
    });

    it('should remove an owner from the Safe', async () => {
      await core.safe.removeOwner(account, {
        address: safeAddress,
        owner: otherAccount.address,
      });

      const owners = await core.safe.getOwners(account, {
        address: safeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });
  });
});
