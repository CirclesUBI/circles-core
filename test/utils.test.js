import core from './helpers/core';

describe('Utils', () => {
  describe('matchAddress', () => {
    it('should find a valid ethereum address in a string', () => {
      expect(
        core.utils.matchAddress(
          'Hello, this is an address somewhere 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1here.',
        ),
      ).toBe('0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1');

      expect(
        core.utils.matchAddress(
          'Hello, this is not a valid address 0x90F8bf6A479d074411a4B0e7944Ea8c9C1here.',
        ),
      ).toBe(null);
    });
  });
});
