// eslint-disable-next-line no-undef
const Migrations = artifacts.require('Migrations');

module.exports = deployer => {
  deployer.deploy(Migrations);
};
