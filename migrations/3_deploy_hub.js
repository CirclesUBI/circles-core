// eslint-disable-next-line no-undef
const Hub = artifacts.require('circles-contracts/Hub.sol');

module.exports = async (deployer, network, accounts) => {
  await deployer.deploy(Hub, accounts[0], 1736111111111111, 0, 'CRC', 100);
};
