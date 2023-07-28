require('dotenv').config();
if (!('crypto' in globalThis)) globalThis.crypto = require('crypto');

module.exports = {
  collectCoverage: true,
  globalTeardown: '<rootDir>/teardown.js',
  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/test/helpers'],
  testEnvironment: 'node',
  testMatch: ['**/safe.test.js'],
  testTimeout: 360 * 1000,
  verbose: true,
};
