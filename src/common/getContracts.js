import GnosisSafeContract from '@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json';
import HubContract from 'circles-contracts/build/contracts/Hub.json';
import ProxyFactoryContract from '@gnosis.pm/safe-contracts/build/contracts/ProxyFactory.json';
import TokenContract from 'circles-contracts/build/contracts/Token.json';

function getContract(web3, abi, address) {
  return new web3.eth.Contract(abi, address);
}

export function getSafeContract(web3, address) {
  return getContract(web3, GnosisSafeContract.abi, address);
}

export function getTokenContract(web3, address) {
  return getContract(web3, TokenContract.abi, address);
}

export default function getContracts(web3, options) {
  const { gnosisSafeAddress, proxyFactoryAddress, hubAddress } = options;

  const gnosisSafeMaster = getSafeContract(web3, gnosisSafeAddress);

  const proxyFactory = getContract(
    web3,
    ProxyFactoryContract.abi,
    proxyFactoryAddress,
  );

  const hub = getContract(web3, HubContract.abi, hubAddress);

  return {
    gnosisSafeMaster,
    hub,
    proxyFactory,
  };
}
