import CirclesCore from '~';

import ethProvider from './ethProvider';

const core = new CirclesCore(ethProvider, {
  apiServiceEndpoint: process.env.API_SERVICE_ENDPOINT,
  fallbackHandlerAddress: process.env.SAFE_DEFAULT_CALLBACK_HANDLER,
  graphNodeEndpoint: process.env.GRAPH_NODE_ENDPOINT,
  hubAddress: process.env.HUB_ADDRESS,
  pathfinderServiceEndpoint: process.env.PATHFINDER_SERVICE_ENDPOINT,
  pathfinderType: process.env.PATHFINDER_TYPE,
  proxyFactoryAddress: process.env.PROXY_FACTORY_ADDRESS,
  relayServiceEndpoint: process.env.RELAY_SERVICE_ENDPOINT,
  safeMasterAddress: process.env.SAFE_ADDRESS,
  subgraphName: process.env.SUBGRAPH_NAME,
  multiSendAddress: process.env.MULTI_SEND_ADDRESS,
  multiSendCallOnlyAddress: process.env.MULTI_SEND_CALL_ONLY_ADDRESS,
});

export default core;
