import CirclesCore from '~';

import web3 from './web3';

export default function createCore() {
  return new CirclesCore(web3, {
    apiServiceEndpoint: process.env.API_SERVICE_ENDPOINT,
    graphNodeEndpoint: process.env.GRAPH_NODE_ENDPOINT,
    hubAddress: process.env.HUB_ADDRESS,
    proxyFactoryAddress: process.env.PROXY_FACTORY_ADDRESS,
    relayServiceEndpoint: process.env.RELAY_SERVICE_ENDPOINT,
    multiSendAddress: process.env.MULTISEND_ADDRESS,
    multiSendCallAddress: process.env.MULTSENDCALL_ADDRESS,
    safeMasterAddress: process.env.SAFE_ADDRESS,
    subgraphName: process.env.SUBGRAPH_NAME,
  });
}
