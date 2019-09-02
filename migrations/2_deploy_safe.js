// eslint-disable-next-line no-undef
const GnosisSafe = artifacts.require(
  '@gnosis.pm/safe-contracts/GnosisSafe.sol',
);

// eslint-disable-next-line no-undef
const ProxyFactory = artifacts.require(
  '@gnosis.pm/safe-contracts/ProxyFactory.sol',
);

const ZERO_ADDRESS = '0x00000000000000000000000000000000';

module.exports = async (deployer, network, accounts) => {
  await deployer.deploy(ProxyFactory);

  await deployer.deploy(GnosisSafe).then(safe => {
    safe.setup([accounts[0]], 1, ZERO_ADDRESS, 0, 0, 0, 0);
    return safe;
  });
};
