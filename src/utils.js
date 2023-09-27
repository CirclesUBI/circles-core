import fetch from 'isomorphic-fetch';

import { RequestError } from '~/common/error';
import checkOptions from '~/common/checkOptions';
import loop from '~/common/loop';
import parameterize from '~/common/parameterize';
import { NO_LIMIT_PERCENTAGE, ZERO_ADDRESS } from '~/common/constants';
import { getTokenContract } from '~/common/getContracts';

async function request(endpoint, userOptions) {
  const options = checkOptions(userOptions, {
    path: {
      type: 'array',
    },
    method: {
      type: 'string',
      default: 'GET',
    },
    data: {
      type: 'object',
      default: {},
    },
    isTrailingSlash: {
      type: 'boolean',
      default: true,
    },
  });

  const { path, method, data } = options;

  const request = {
    method,
  };

  let paramsStr = '';
  if (data) {
    if (options.method === 'GET') {
      paramsStr = parameterize(data);
    } else if (typeof window !== 'undefined' && data instanceof FormData) {
      request.body = data;
    } else {
      request.body = JSON.stringify(data);
      request.headers = {
        'Content-Type': 'application/json',
      };
    }
  }

  const slash = options.isTrailingSlash ? '/' : '';
  const url = `${endpoint}/${path.join('/')}${slash}${paramsStr}`;

  try {
    return fetch(url, request).then((response) => {
      const contentType = response.headers.get('Content-Type');

      if (contentType && contentType.includes('application/json')) {
        return response.json().then((json) => {
          if (response.status >= 400) {
            throw new RequestError(url, json, response.status);
          }

          return json;
        });
      } else if (contentType && contentType.includes('text/plain')) {
        return response.text().then((text) => {
          if (response.status >= 400) {
            throw new RequestError(url, text, response.status);
          }

          return text;
        });
      } else {
        if (response.status >= 400) {
          throw new RequestError(url, response.body, response.status);
        }

        return response.body;
      }
    });
  } catch (err) {
    throw new RequestError(url, err.message);
  }
}

async function requestGraph(endpoint, subgraphName, userOptions) {
  const options = checkOptions(userOptions, {
    query: {
      type: 'string',
    },
    variables: {
      type: 'object',
      default: {},
    },
  });

  const query = options.query.replace(/\s\s+/g, ' ');

  const variables =
    Object.keys(options.variables).length === 0 ? undefined : options.variables;

  const response = await request(endpoint, {
    path: ['subgraphs', 'name', subgraphName],
    method: 'POST',
    data: {
      query,
      variables,
    },
    isTrailingSlash: false,
  });

  return response.data;
}

async function _requestIndexedDB(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  data,
  parameters,
) {
  let response;

  switch (data) {
    case 'activity_stream':
      response = getNotificationsStatus(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
    case 'organization_status':
      response = getOrganizationStatus(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
    case 'safe_addresses':
      response = getSafeAddresses(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
    case 'balances':
      response = getBalancesStatus(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
    case 'trust_network':
      response = getTrustNetworkStatus(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
    case 'trust_limits':
      response = getTrustLimitsStatus(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        parameters,
      );
      break;
  }
  return response;
}

function getNotificationsStatus(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  parameters,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          notifications(${parameters}) {
            id
            transactionHash
            safeAddress
            type
            time
            trust {
              user
              canSendTo
              limitPercentage
            }
            transfer {
              from
              to
              amount
            }
            hubTransfer {
              from
              to
              amount
            }
            ownership {
              adds
              removes
            }
          }
        }`,
      };
      break;
  }
  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

function getOrganizationStatus(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  ownerAddress,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          user(first: 1000 id: "${ownerAddress.toLowerCase()}") {
            id,
            safes {
              id
              organization
            }
          }
        }`,
      };
      break;
  }
  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

function getSafeAddresses(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  parameters,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          user(id: "${parameters.ownerAddress.toLowerCase()}") {
            safeAddresses,
          }
        }`,
      };
      break;
  }

  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

function getBalancesStatus(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  safeAddress,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          safe(id: "${safeAddress.toLowerCase()}") {
            balances(first: 1000) {
              token {
                id
              }
              amount
            }
          }
        }`,
      };
      break;
  }

  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

function getTrustNetworkStatus(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  safeAddress,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          trusts(where: { userAddress: "${safeAddress}", limitPercentage_not: ${NO_LIMIT_PERCENTAGE} }) {
            id
            limitPercentage
          }
        }`,
      };
      break;
  }

  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

function getTrustLimitsStatus(
  graphNodeEndpoint,
  subgraphName,
  databaseSource,
  safeAddress,
) {
  let query;
  switch (databaseSource) {
    case 'graph':
    default:
      query = {
        query: `{
          safe(id: "${safeAddress}") {
            outgoing (where: { limitPercentage_not: ${NO_LIMIT_PERCENTAGE}, canSendToAddress_not: "${safeAddress}" }) {
              limitPercentage
              userAddress
              canSendToAddress
            }
            incoming (where: { limitPercentage_not: ${NO_LIMIT_PERCENTAGE}, userAddress_not: "${safeAddress}" }) {
              limitPercentage
              userAddress
              user {
                outgoing (where: { limitPercentage_not: ${NO_LIMIT_PERCENTAGE}, canSendToAddress_not: "${safeAddress}" }) {
                  canSendToAddress
                  limitPercentage
                }
              }
              canSendToAddress
            }
          }
        }`,
      };
      break;
  }

  return requestGraph(graphNodeEndpoint, subgraphName, query);
}

/**
 * Utils submodule for common transaction and relayer methods.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} globalOptions - global core options
 *
 * @return {Object} - utils module instance
 */
export default function createUtilsModule(web3, contracts, globalOptions) {
  const {
    apiServiceEndpoint,
    pathfinderServiceEndpoint,
    databaseSource,
    graphNodeEndpoint,
    relayServiceEndpoint,
    subgraphName,
  } = globalOptions;
  const { hub } = contracts;

  // Get a list of all Circles Token owned by this address to find out with
  // which we can pay this transaction
  async function _listAllTokens(safeAddress) {
    const tokens = [];

    // Fetch token balance directly from Ethereum node to start with
    const tokenAddress = await hub.methods.userToToken(safeAddress).call();
    if (tokenAddress !== ZERO_ADDRESS) {
      const tokenContract = getTokenContract(web3, tokenAddress);
      const amount = await tokenContract.methods.balanceOf(safeAddress).call();

      tokens.push({
        amount: web3.utils.toBN(amount.toString()),
        address: web3.utils.toChecksumAddress(tokenAddress),
        ownerAddress: safeAddress,
      });
    }

    // Additionally get all other tokens from the Graph
    try {
      const tokensResponse = await requestGraph(
        graphNodeEndpoint,
        subgraphName,
        {
          query: `{
            safe(id: "${safeAddress.toLowerCase()}") {
              balances(first: 1000) {
                token {
                  id
                  owner {
                    id
                  }
                }
                amount
              }
            }
          }`,
        },
      );

      if (tokensResponse && tokensResponse.safe) {
        tokensResponse.safe.balances.forEach((balance) => {
          const tokenAddress = web3.utils.toChecksumAddress(balance.token.id);
          const ownerAddress = web3.utils.toChecksumAddress(
            balance.token.owner.id,
          );

          if (tokens.find(({ address }) => address === tokenAddress)) {
            return;
          }

          tokens.push({
            amount: web3.utils.toBN(balance.amount),
            address: tokenAddress,
            ownerAddress,
          });
        });
      }
    } catch {
      // Do nothing ..
    }

    return tokens.sort(({ amount: amountA }, { amount: amountB }) => {
      return web3.utils.toBN(amountA).cmp(web3.utils.toBN(amountB));
    });
  }

  /**
   * Iterate on a request until a response condition is met and then, returns the response.
   *
   * @namespace core.utils.loop
   *
   * @param {function} request - request to iterate on
   * @param {function} condition - condition function that checks if request will be call again
   * @param {Object} [options] - options
   * @param {string} [options.label] - Debug label that will be shown when the maxAttemps error is thrown
   * @param {number} [options.maxAttempts=10] - Maximun attemps until giving up
   * @param {number} [options.retryDelay=6000] - Delay time between attemps in milliseconds
   *
   * @return {*} - response of the target request
   */
  loop;
  /**
   * Detect an Ethereum address in any string.
   *
   * @namespace core.utils.matchAddress
   *
   * @param {string} str - string
   *
   * @return {string} - Ethereum address or null
   */
  const matchAddress = (str) => {
    const results = str.match(/0x[a-fA-F0-9]{40}/);

    if (results && results.length > 0) {
      return results[0];
    } else {
      return null;
    }
  };

  /**
   * Convert to fractional monetary unit of Circles
   * named Freckles.
   *
   * @namespace core.utils.toFreckles
   *
   * @param {string|number} value - value in Circles
   *
   * @return {string} - value in Freckles
   */
  const toFreckles = (value) => {
    return web3.utils.toWei(`${value}`, 'ether');
  };

  /**
   * Convert from Freckles to Circles number.
   *
   * @namespace core.utils.fromFreckles
   *
   * @param {string|number} value - value in Freckles
   *
   * @return {number} - value in Circles
   */
  const fromFreckles = (value) => {
    return parseInt(web3.utils.fromWei(`${value}`, 'ether'), 10);
  };

  /**
   * Send a transaction though the relayer to be funded
   * @namespace core.utils.sendTransaction
   * @param {SponsoredCallRequest} data - gelato request payload data
   * @param {string} data.target - address of the target smart contract
   * @param {Object} data.data - encoded payload data (usually a function selector plus the required arguments) used to call the required target address
   * @return {RelayResponse} - gelato response
   */
  const sendTransaction = (data) =>
    request(relayServiceEndpoint, {
      path: ['transactions'],
      method: 'POST',
      isTrailingSlash: false,
      data,
    });

  /**
   * Query the Graph Node with GraphQL.
   *
   * @namespace core.utils.requestGraph
   *
   * @param {Object} userOptions - query options
   * @param {string} userOptions.query - GraphQL query
   * @param {Object} userOptions.variables - GraphQL variables
   */
  const requestGraph = async (userOptions) => {
    return requestGraph(graphNodeEndpoint, subgraphName, userOptions);
  };

  /**
   * Query the Graph Node or Land Graph Node with GraphQL.
   *
   * @namespace core.utils.requestIndexedDB
   *
   * @param {string} data - data to obtain
   * @param {Object} parameters - parameters needed for query
   */
  const requestIndexedDB = async (data, parameters) => {
    return _requestIndexedDB(
      graphNodeEndpoint,
      subgraphName,
      databaseSource,
      data,
      parameters,
    );
  };

  /**
   * Get a list of all tokens and their current balance a user owns. This can
   * be used to find the right token for a transaction.
   *
   * @namespace core.utils.listAllTokens
   *
   * @param {Object} userOptions - query options
   * @param {string} userOptions.safeAddress - address of Safe
   *
   * @return {Array} - List of tokens with current balance and address
   */
  const listAllTokens = async (userOptions) => {
    const options = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return await _listAllTokens(options.safeAddress);
  };

  /**
   * Make a request to the Circles server API.
   *
   * @namespace core.utils.requestAPI
   *
   * @param {Object} userOptions - API query options
   * @param {string} userOptions.path - API route
   * @param {string} userOptions.method - HTTP method
   * @param {Object} userOptions.data - Request body (JSON)
   *
   * @return {Object} - API response
   */
  const requestAPI = async (userOptions) => {
    const options = checkOptions(userOptions, {
      path: {
        type: 'array',
      },
      method: {
        type: 'string',
        default: 'GET',
      },
      data: {
        type: 'object',
        default: {},
      },
    });

    return request(apiServiceEndpoint, {
      data: options.data,
      method: options.method,
      path: ['api'].concat(options.path),
    });
  };

  /**
   * Make a request to the Circles server API.
   *
   * @namespace core.utils.requestPathfinderAPI
   *
   * @param {Object} userOptions - Pathfinder API query options
   * @param {string} userOptions.method - HTTP method
   * @param {Object} userOptions.data - Request body (JSON)
   *
   * @return {Object} - API response
   */
  const requestPathfinderAPI = async (userOptions) => {
    const options = checkOptions(userOptions, {
      method: {
        type: 'string',
        default: 'GET',
      },
      data: {
        type: 'object',
        default: {},
      },
    });
    return request(pathfinderServiceEndpoint, {
      data: options.data,
      method: options.method,
      path: [],
      isTrailingSlash: false,
    });
  };
  return {
    matchAddress,
    toFreckles,
    sendTransaction,
    requestGraph,
    requestIndexedDB,
    fromFreckles,
    listAllTokens,
    requestAPI,
    requestPathfinderAPI,
  };
}
