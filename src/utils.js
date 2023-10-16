import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';

import CoreError, { ErrorCodes, RequestError } from '~/common/error';
import checkOptions from '~/common/checkOptions';
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

async function _requestGraph(endpoint, subgraphName, userOptions) {
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
  return _requestGraph(graphNodeEndpoint, subgraphName, query);
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
  return _requestGraph(graphNodeEndpoint, subgraphName, query);
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

  return _requestGraph(graphNodeEndpoint, subgraphName, query);
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

  return _requestGraph(graphNodeEndpoint, subgraphName, query);
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

  return _requestGraph(graphNodeEndpoint, subgraphName, query);
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

  return _requestGraph(graphNodeEndpoint, subgraphName, query);
}

/**
 * Module to offer common utilities
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Utils module instance
 */
export default function createUtilsModule({
  ethProvider,
  contracts: { hub },
  options: {
    apiServiceEndpoint,
    pathfinderServiceEndpoint,
    databaseSource,
    graphNodeEndpoint,
    relayServiceEndpoint,
    subgraphName,
  },
}) {
  // Get a list of all Circles Token owned by this address to find out with
  // which we can pay this transaction
  async function _listAllTokens(safeAddress) {
    const tokens = [];

    // Fetch token balance directly from Ethereum node to start with
    const tokenAddress = await hub.userToToken(safeAddress);
    if (tokenAddress !== ZERO_ADDRESS) {
      const tokenContract = getTokenContract(ethProvider, tokenAddress);
      const amount = await tokenContract.balanceOf(safeAddress);

      tokens.push({
        amount: ethers.BigNumber.from(amount.toString()),
        address: ethers.utils.getAddress(tokenAddress),
        ownerAddress: safeAddress,
      });
    }

    // Additionally get all other tokens from the Graph
    try {
      const tokensResponse = await _requestGraph(
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
          const tokenAddress = ethers.utils.getAddress(balance.token.id);
          const ownerAddress = ethers.utils.getAddress(balance.token.owner.id);

          if (tokens.find(({ address }) => address === tokenAddress)) {
            return;
          }

          tokens.push({
            amount: ethers.BigNumber.from(balance.amount),
            address: tokenAddress,
            ownerAddress,
          });
        });
      }
    } catch {
      // Do nothing ..
    }

    return tokens.sort(({ amount: amountA }, { amount: amountB }) => {
      let result = 0;

      if (amountA.lt(amountB)) {
        result = -1;
      } else if (amountA.gt(amountB)) {
        result = 1;
      }

      return result;
    });
  }

  /**
   * Iterate on a request until a response condition is met and then, returns the response.
   * @namespace core.utils.loop
   * @param {function} request - request to iterate on
   * @param {function} condition - condition function that checks if request will be call again
   * @param {Object} [options] - options
   * @param {string} [options.label] - Debug label that will be shown when the maxAttemps error is thrown
   * @param {number} [options.maxAttempts=10] - Maximun attemps until giving up
   * @param {number} [options.retryDelay=6000] - Delay time between attemps in milliseconds
   * @return {*} - response of the target request
   */
  const loop = (
    request,
    condition,
    { label, maxAttempts = 10, retryDelay = 6000 } = {},
  ) =>
    new Promise((resolve, reject) => {
      let attempt = 0;

      const run = () => {
        if (attempt > maxAttempts) {
          throw new CoreError(
            `Tried too many times waiting for condition${
              label && `: "${label}"`
            }`,
            ErrorCodes.TOO_MANY_ATTEMPTS,
          );
        }

        return request().then((data) => {
          if (condition(data)) {
            return data;
          } else {
            attempt += 1;

            return new Promise((resolve) =>
              setTimeout(resolve, retryDelay),
            ).then(run);
          }
        });
      };

      run().then(resolve).catch(reject);
    });

  /**
   * Detect an Ethereum address in any string.
   * @namespace core.utils.matchAddress
   * @param {string} str - string
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
   * Convert to fractional monetary unit of Circles named Freckles
   * @namespace core.utils.toFreckles
   * @param {string|number} value - value in Circles
   * @return {string} - value in Freckles
   */
  const toFreckles = (value) => ethers.utils.parseUnits(`${value}`).toString();

  /**
   * Convert from Freckles to Circles number
   * @namespace core.utils.fromFreckles
   * @param {string|number} value - value in Freckles
   * @return {number} - value in Circles
   */
  const fromFreckles = (value) => Number(ethers.utils.formatEther(`${value}`));

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
   * @namespace core.utils.requestGraph
   * @param {Object} userOptions - query options
   * @param {string} userOptions.query - GraphQL query
   * @param {Object} userOptions.variables - GraphQL variables
   */
  const requestGraph = (userOptions) =>
    _requestGraph(graphNodeEndpoint, subgraphName, userOptions);

  /**
   * Query the Graph Node or Land Graph Node with GraphQL.
   * @namespace core.utils.requestIndexedDB
   * @param {string} data - data to obtain
   * @param {Object} parameters - parameters needed for query
   */
  const requestIndexedDB = (data, parameters) =>
    _requestIndexedDB(
      graphNodeEndpoint,
      subgraphName,
      databaseSource,
      data,
      parameters,
    );

  /**
   * Get a list of all tokens and their current balance a user owns. This can
   * be used to find the right token for a transaction.
   * @namespace core.utils.listAllTokens
   * @param {Object} userOptions - query options
   * @param {string} userOptions.safeAddress - address of Safe
   * @return {Array} - List of tokens with current balance and address
   */
  const listAllTokens = (userOptions) => {
    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return _listAllTokens(options.safeAddress);
  };

  /**
   * Make a request to the Circles server API.
   * @namespace core.utils.requestAPI
   * @param {Object} userOptions - API query options
   * @param {string} userOptions.path - API route
   * @param {string} userOptions.method - HTTP method
   * @param {Object} userOptions.data - Request body (JSON)
   * @return {Object} - API response
   */
  const requestAPI = (userOptions) => {
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
   * @namespace core.utils.requestPathfinderAPI
   * @param {Object} userOptions - Pathfinder API query options
   * @param {string} userOptions.method - HTTP method
   * @param {Object} userOptions.data - Request body (JSON)
   * @return {Object} - API response
   */
  const requestPathfinderAPI = (userOptions) => {
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
    loop,
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
