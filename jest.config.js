require('dotenv').config();

module.exports = {
  testEnvironment: 'node',

  // Resolve modules with alias
  moduleNameMapper: {
    '^~(.*)$': '<rootDir>/src$1',
  },
};
