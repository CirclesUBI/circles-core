import GnosisSafeContract from '../../build/contracts/GnosisSafe.json';
import HubContract from '../../build/contracts/Hub.json';
import ProxyFactoryContract from '../../build/contracts/ProxyFactory.json';

import CirclesCore from '~';

import web3 from './web3';

const DEFAULT_NETWORK_ID = 5777;
const DEFAULT_GAS_LIMIT = 1000000;

function getContractAddresses() {
  const networkId = process.env.NETWORK_ID || DEFAULT_NETWORK_ID;

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
  const addresses = getContractAddresses();

  return new CirclesCore(web3, {
    ...addresses,
    gas: DEFAULT_GAS_LIMIT,
  });
}
