require('dotenv').config();
if (!('crypto' in globalThis)) globalThis.crypto = require('crypto');

module.exports = {
  testEnvironment: 'node',
  testTimeout: 360 * 1000,

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
