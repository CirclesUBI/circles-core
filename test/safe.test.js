import createCore from './helpers/core';
import getAccount from './helpers/account';
import loop from './helpers/loop';
import web3 from './helpers/web3';
import { fundSafe } from './helpers/transactions';

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
      await fundSafe(account, safeAddress);

      const result = await core.safe.deploy(account, {
        safeAddress,
      });

      // .. wait for Relayer to really deploy Safe
      await loop(() => web3.eth.getCode(safeAddress));

      // Deploy Token as well to pay our fees later
      await core.token.deploy(account, {
        safeAddress,
      });

      expect(result).toBe(true);
    });
  });

  describe('When I want to manage the owners of a Safe', () => {
    it('should return a list of the current owners', async () => {
      const owners = await core.safe.getOwners(account, {
        safeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });

    it('should add another owner to the Safe', async () => {
      const response = await core.safe.addOwner(account, {
        safeAddress,
        ownerAddress: otherAccount.address,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const owners = await core.safe.getOwners(account, {
        safeAddress,
      });

      expect(owners[0]).toBe(otherAccount.address);
      expect(owners[1]).toBe(account.address);
      expect(owners.length).toBe(2);

      const ownedSafeAddress = await loop(
        () => {
          return core.safe.getAddress(account, {
            ownerAddress: otherAccount.address,
          });
        },
        address => address,
      );

      expect(ownedSafeAddress).toBe(safeAddress);
    });

    it('should remove an owner from the Safe', async () => {
      const response = await core.safe.removeOwner(account, {
        safeAddress,
        ownerAddress: otherAccount.address,
      });

      expect(web3.utils.isHexStrict(response)).toBe(true);

      const owners = await core.safe.getOwners(account, {
        safeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });

    it('should return the Safe address owned by a wallet', async () => {
      const response = await core.safe.getAddress(account, {
        ownerAddress: account.address,
      });

      expect(response).toBe(safeAddress);
    });
  });
});
