require('dotenv').config();

module.exports = {
  testEnvironment: 'node',
  testTimeout: 60 * 1000,

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
