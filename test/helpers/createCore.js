import CirclesCore from '~';

import web3 from './web3';

export default function createCore() {
  return new CirclesCore(web3, {
    safeMasterAddress: process.env.SAFE_ADDRESS,
    hubAddress: process.env.HUB_ADDRESS,
    proxyFactoryAddress: process.env.PROXY_FACTORY_ADDRESS,
    relayServiceEndpoint: process.env.RELAY_SERVICE_ENDPOINT,
  });
}
