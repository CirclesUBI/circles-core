import CirclesCore from '~';

export default function createCore(web3, opts) {
  return new CirclesCore(web3, {
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
    ...opts,
  });
}
