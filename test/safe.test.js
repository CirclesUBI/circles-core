import getAccount from './helpers/getAccount';
import createCore from './helpers/createCore';
import web3 from './helpers/web3';

let NONCE = 123456789;

let core;
let account;
let otherAccount;

beforeAll(() => {
  account = getAccount();
  otherAccount = getAccount(1);
  core = createCore();
});

describe('Safe', () => {
  let predictedSafeAddress;

  beforeEach(async () => {
    predictedSafeAddress = await core.safe.predictAddress(account, {
      nonce: NONCE,
    });
  });

  describe('predictAddress', () => {
    it('should return valid address', () => {
      expect(web3.utils.isHexStrict(predictedSafeAddress)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy safe at predicted address', async () => {
      await core.safe.deploy(account, {
        nonce: NONCE,
      });

      const proxyRuntimeCode = await core.contracts.proxyFactory.methods
        .proxyRuntimeCode()
        .call();

      const predictedCode = await web3.eth.getCode(predictedSafeAddress);

      expect(predictedCode).toBe(proxyRuntimeCode);
    });
  });

  describe('getOwners', () => {
    it('should return a list of owners', async () => {
      const owners = await core.safe.getOwners(account, {
        address: predictedSafeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });
  });

  describe('addOwner', () => {
    it('should add another owner to the Safe', async () => {
      await core.safe.addOwner(account, {
        address: predictedSafeAddress,
        owner: otherAccount.address,
      });

      const owners = await core.safe.getOwners(account, {
        address: predictedSafeAddress,
      });

      expect(owners[1]).toBe(account.address);
      expect(owners[0]).toBe(otherAccount.address);
      expect(owners.length).toBe(2);
    });
  });

  describe('removeOwner', () => {
    it('should remove owner from the Safe', async () => {
      await core.safe.removeOwner(account, {
        address: predictedSafeAddress,
        owner: otherAccount.address,
      });

      const owners = await core.safe.getOwners(account, {
        address: predictedSafeAddress,
      });

      expect(owners[0]).toBe(account.address);
      expect(owners.length).toBe(1);
    });
  });
});
