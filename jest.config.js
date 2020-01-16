require('dotenv').config();

module.exports = {
  testEnvironment: 'node',
  testTimeout: 120 * 1000,

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
