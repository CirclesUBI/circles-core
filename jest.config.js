require('dotenv').config();

module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
