require('dotenv').config();
if (!('crypto' in globalThis)) globalThis.crypto = require('crypto');

module.exports = {
  collectCoverage: true,
  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/test/helpers'],
  testEnvironment: 'node',
  testMatch: [
    '**/safe.test.js',
    '**/trust.test.js',
    '**/token.test.js',
    '**/organization.test.js',
    '**/user.test.js',
    '**/utils.test.js',
  ],
  testTimeout: 30 * 1000,
  verbose: true,
};
