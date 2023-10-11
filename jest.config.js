require('dotenv').config();
if (!('crypto' in globalThis)) globalThis.crypto = require('crypto');

module.exports = {
  collectCoverage: true,
  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
  coveragePathIgnorePatterns: ['<rootDir>/test'],
  testEnvironment: 'node',
  testTimeout: 60 * 1000,
  // testMatch: ['**/user.test.js'],
  verbose: true,
};
