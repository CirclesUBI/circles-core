require('dotenv').config();

module.exports = {
  testEnvironment: 'node',
  testTimeout: 30 * 1000,

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
