import createAccount from './helpers/createAccount';
import createCore from './helpers/createCore';
import web3 from './helpers/web3';

let core;
let account;

beforeAll(() => {
  account = createAccount();
  core = createCore();
});

describe('Safe', () => {
  describe('predictAddress', () => {
    it('should return a valid address', () => {
      const nonce = 5;

      const predicted = core.safe.predictAddress(account, {
        nonce,
      });

      expect(web3.utils.isHexStrict(predicted)).toBe(true);
    });
  });
});
