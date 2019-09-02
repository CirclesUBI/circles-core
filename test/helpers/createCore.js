import GnosisSafeContract from '../../build/contracts/GnosisSafe.json';
import HubContract from '../../build/contracts/Hub.json';
import ProxyFactoryContract from '../../build/contracts/ProxyFactory.json';

import CirclesCore from '~';

import web3 from './web3';

function deployContracts() {
  const networkId = process.env.NETWORK_ID || 5777;

  const hubAddress = HubContract.networks[networkId].address;
  const gnosisSafeAddress = GnosisSafeContract.networks[networkId].address;
  const proxyFactoryAddress = ProxyFactoryContract.networks[networkId].address;

  return {
    gnosisSafeAddress,
    hubAddress,
    proxyFactoryAddress,
  };
}

export default function createCore() {
  const addresses = deployContracts();

  return new CirclesCore({
    ...addresses,
    web3,
  });
}
