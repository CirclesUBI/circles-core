require('dotenv').config();
if (!('crypto' in globalThis)) globalThis.crypto = require('crypto');

module.exports = {
  collectCoverage: true,
  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
  testEnvironment: 'node',
  testTimeout: 30 * 1000,
  verbose: true,
};
