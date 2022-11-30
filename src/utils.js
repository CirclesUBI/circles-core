import fetch from 'isomorphic-fetch';

import CoreError, { RequestError, ErrorCodes } from '~/common/error';
import TransactionQueue from '~/common/queue';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import loop from '~/common/loop';
import parameterize from '~/common/parameterize';
import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';
import {
  formatTypedData,
  formatTypedDataCRCVersion,
  signTypedData,
} from '~/common/typedData';
import { getTokenContract, getSafeContract } from '~/common/getContracts';

/** @access private */
const transactionQueue = new TransactionQueue();

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

async function requestRelayer(endpoint, userOptions) {
  const options = checkOptions(userOptions, {
    path: {
      type: 'array',
    },
    version: {
      type: 'number',
      default: 1,
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

  const { path, method, data, version } = options;

  return request(endpoint, {
    path: ['api', `v${version}`].concat(path),
    method,
    data,
  });
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

async function requestIndexedDB(
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
          user(id: "${ownerAddress.toLowerCase()}") {
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
            balances {
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
          trusts(where: { userAddress: "${safeAddress}" }) {
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
            outgoing {
              limitPercentage
              userAddress
              canSendToAddress
            }
            incoming {
              limitPercentage
              userAddress
              user {
                outgoing {
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

async function estimateTransactionCosts(
  endpoint,
  {
    safeAddress,
    to,
    txData,
    value = 0,
    gasToken = ZERO_ADDRESS,
    operation = CALL_OP,
  },
) {
  return await requestRelayer(endpoint, {
    path: ['safes', safeAddress, 'transactions', 'estimate'],
    method: 'POST',
    version: 2,
    data: {
      safe: safeAddress,
      data: txData,
      to,
      value,
      operation,
      gasToken,
    },
  });
}

/**
 * Manages transaction queue to finalize currently running tasks and starts the
 * next one when ready.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} endpoint - URL of relayer Service
 * @param {string} safeAddress - address of Safe
 * @param {number} pendingTicketId - id of the task
 */
async function waitForPendingTransactions(
  web3,
  endpoint,
  safeAddress,
  pendingTicketId,
) {
  await loop(
    async () => {
      // Check if transaction is ready and leave loop if yes
      if (!transactionQueue.isLocked(safeAddress)) {
        return transactionQueue.isNextInQueue(safeAddress, pendingTicketId);
      }

      // .. otherwise check what task is currently running
      const {
        txHash,
        nonce,
        ticketId: currentTicketId,
      } = transactionQueue.getCurrentTransaction(safeAddress);

      // Ask relayer if it finished
      try {
        const response = await requestRelayer(endpoint, {
          path: ['safes', safeAddress, 'transactions'],
          method: 'GET',
          version: 1,
          data: {
            limit: 1,
            ethereum_tx__tx_hash: txHash,
            nonce,
          },
        });

        // ... and unqueue the task in case it did!
        if (response.results.length === 1) {
          transactionQueue.unlockTransaction(safeAddress, currentTicketId);
          transactionQueue.unqueue(safeAddress, currentTicketId);
        }
      } catch {
        // Do nothing
      }

      return false;
    },
    (isReady) => {
      return isReady;
    },
  );
}

/**
 * Retreive an nonce and make sure it does not collide with currently
 * pending transactions already using it.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {string} endpoint - URL of Relayer Service
 * @param {string} safeAddress - address of Safe
 */
async function requestNonce(web3, endpoint, safeAddress) {
  let nonce = null;

  try {
    const response = await requestRelayer(endpoint, {
      path: ['safes', safeAddress],
      method: 'GET',
      version: 1,
      data: {
        limit: 1,
      },
    });

    nonce = response.nonce || null;
  } catch (err) {
    // Do nothing!
  }

  // Fallback to retreive nonce from Safe contract method (already incremented)
  if (nonce === null) {
    return await getSafeContract(web3, safeAddress).methods.nonce().call();
  }

  return `${parseInt(nonce, 10)}`;
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
    databaseSource,
    graphNodeEndpoint,
    relayServiceEndpoint,
    subgraphName,
  } = globalOptions;

  const { hub } = contracts;

  // Get a list of all Circles Token owned by this address to find out with
  // which we can pay this transaction
  async function listAllTokens(safeAddress) {
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
              balances {
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

  return {
    /**
     * Detect an Ethereum address in any string.
     *
     * @namespace core.utils.matchAddress
     *
     * @param {string} str - string
     *
     * @return {string} - Ethereum address or null
     */
    matchAddress: (str) => {
      const results = str.match(/0x[a-fA-F0-9]{40}/);

      if (results && results.length > 0) {
        return results[0];
      } else {
        return null;
      }
    },

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
    toFreckles: (value) => {
      return web3.utils.toWei(`${value}`, 'ether');
    },

    /**
     * Convert from Freckles to Circles number.
     *
     * @namespace core.utils.fromFreckles
     *
     * @param {string|number} value - value in Freckles
     *
     * @return {number} - value in Circles
     */
    fromFreckles: (value) => {
      return parseInt(web3.utils.fromWei(`${value}`, 'ether'), 10);
    },

    /**
     * Send an API request to the Gnosis Relayer.
     *
     * @namespace core.utils.requestRelayer
     *
     * @param {Object} userOptions - request options
     * @param {string[]} userOptions.path - API path as array
     * @param {number} userOptions.version - API version 1 or 2
     * @param {string} userOptions.method - API request method (GET, POST)
     * @param {Object} userOptions.data - data payload
     */
    requestRelayer: async (userOptions) => {
      return requestRelayer(relayServiceEndpoint, userOptions);
    },

    /**
     * Query the Graph Node with GraphQL.
     *
     * @namespace core.utils.requestGraph
     *
     * @param {Object} userOptions - query options
     * @param {string} userOptions.query - GraphQL query
     * @param {Object} userOptions.variables - GraphQL variables
     */
    requestGraph: async (userOptions) => {
      return requestGraph(graphNodeEndpoint, subgraphName, userOptions);
    },

    /**
     * Query the Graph Node or Land Graph Node with GraphQL.
     *
     * @namespace core.utils.requestIndexedDB
     *
     * @param {string} data - data to obtain
     * @param {Object} parameters - parameters needed for query
     */
    requestIndexedDB: async (data, parameters) => {
      return requestIndexedDB(
        graphNodeEndpoint,
        subgraphName,
        databaseSource,
        data,
        parameters,
      );
    },

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
    listAllTokens: async (userOptions) => {
      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await listAllTokens(options.safeAddress);
    },

    /**
     * Send Transaction to Relayer and pay with Circles Token.
     *
     * @namespace core.utils.executeTokenSafeTx
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - query options
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {string} userOptions.to - forwarded address
     * @param {Object} userOptions.txData - encoded transaction data
     * @param {boolean} userOptions.isCRCVersion - is the Safe v1.1.1+Cirlces, false by default
     *
     * @return {string} - transaction hash
     */
    executeTokenSafeTx: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        txData: {
          type: web3.utils.isHexStrict,
        },
        isCRCVersion: {
          type: 'boolean',
          default: false,
        },
        operation: {
          type: 'string',
          default: CALL_OP,
        },
      });

      const { txData, safeAddress, to, isCRCVersion, operation } = options;
      const refundReceiver = ZERO_ADDRESS;
      const value = 0;

      // Estimate gas costs and find out if we have a token with enough balance
      // to pay them. We use the ZERO_ADDRESS as a gasToken for now as we
      // didn't select the actual Circles Token yet to pay the transaction for
      // the relayer
      const preEstimation = await estimateTransactionCosts(
        relayServiceEndpoint,
        {
          gasToken: ZERO_ADDRESS,
          operation,
          safeAddress,
          to,
          txData,
          value,
        },
      );

      const totalGasEstimate = web3.utils
        .toBN(preEstimation.dataGas)
        .add(new web3.utils.BN(preEstimation.safeTxGas))
        .mul(new web3.utils.BN(preEstimation.gasPrice));

      const tokens = await listAllTokens(safeAddress);

      if (tokens.length === 0) {
        throw new CoreError(
          'No tokens given to pay transaction',
          ErrorCodes.INSUFFICIENT_FUNDS,
        );
      }

      const foundToken = tokens.find(({ amount }) => {
        return web3.utils.toBN(amount).gte(totalGasEstimate);
      });

      if (!foundToken) {
        throw new CoreError(
          'No token found with sufficient funds to pay transaction',
          ErrorCodes.INSUFFICIENT_FUNDS,
        );
      }

      // Estimate the costs again, this time with the actual token we will use
      // in the Relayer. This is a little bit cumbersome, but the relayer will
      // throw an exception otherwise, as gas estimations might diverge a
      // little when using different tokens
      const { dataGas, safeTxGas, gasPrice } = await estimateTransactionCosts(
        relayServiceEndpoint,
        {
          gasToken: foundToken.address,
          operation,
          safeAddress,
          to,
          txData,
          value,
        },
      );

      const gasToken = foundToken.address;

      // Register transaction in waiting queue
      const ticketId = transactionQueue.queue(safeAddress);

      // Wait until transaction can be executed
      await waitForPendingTransactions(
        web3,
        relayServiceEndpoint,
        safeAddress,
        ticketId,
      );

      // Request nonce for Safe
      const nonce = await requestNonce(web3, relayServiceEndpoint, safeAddress);

      let typedData;
      if (isCRCVersion == true) {
        // Prepare EIP712 transaction data and sign it
        typedData = formatTypedDataCRCVersion(
          to,
          value,
          txData,
          operation,
          safeTxGas,
          dataGas,
          gasPrice,
          gasToken,
          refundReceiver,
          nonce,
          safeAddress,
        );
      } else {
        const chainId = await web3.eth.getChainId();
        // Prepare EIP712 transaction data and sign it
        typedData = formatTypedData(
          to,
          value,
          txData,
          operation,
          safeTxGas,
          dataGas,
          gasPrice,
          gasToken,
          refundReceiver,
          nonce,
          chainId,
          safeAddress,
        );
      }

      const signature = signTypedData(web3, account.privateKey, typedData);

      // Send transaction to relayer
      try {
        const { txHash } = await requestRelayer(relayServiceEndpoint, {
          path: ['safes', safeAddress, 'transactions'],
          method: 'POST',
          version: 1,
          data: {
            to,
            value,
            data: txData,
            operation,
            signatures: [signature],
            safeTxGas,
            dataGas,
            gasPrice,
            nonce,
            gasToken,
          },
        });

        // Register transaction so we can check later if it finished
        transactionQueue.lockTransaction(safeAddress, {
          nonce,
          ticketId,
          txHash,
        });

        return txHash;
      } catch {
        transactionQueue.unlockTransaction(safeAddress, ticketId);
        transactionQueue.unqueue(safeAddress, ticketId);

        return null;
      }
    },

    /**
     * Send a transaction to the relayer which will be executed by it.
     * The gas costs will be estimated by the relayer before.
     *
     * @namespace core.utils.executeSafeTx
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - query options
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {string} userOptions.to - forwarded address (from is the relayer)
     * @param {string} userOptions.gasToken - address of ERC20 token
     * @param {Object} userOptions.txData - encoded transaction data
     * @param {number} userOptions.value - value in Wei
     *
     * @return {string} - transaction hash
     */
    executeSafeTx: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        gasToken: {
          type: web3.utils.checkAddressChecksum,
          default: ZERO_ADDRESS,
        },
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
        value: {
          type: 'number',
          default: 0,
        },
      });

      const { to, gasToken, txData, value, safeAddress } = options;
      const operation = CALL_OP;
      const refundReceiver = ZERO_ADDRESS;

      const { dataGas, gasPrice, safeTxGas } = await estimateTransactionCosts(
        relayServiceEndpoint,
        {
          gasToken,
          operation,
          safeAddress,
          to,
          txData,
          value,
        },
      );

      // Register transaction in waiting queue
      const ticketId = transactionQueue.queue(safeAddress);

      // Wait until Relayer allocates enough funds to pay for transaction
      const totalGasEstimate = web3.utils
        .toBN(dataGas)
        .add(new web3.utils.BN(safeTxGas))
        .mul(new web3.utils.BN(gasPrice));

      await loop(
        () => {
          return web3.eth.getBalance(safeAddress);
        },
        (balance) => {
          return web3.utils.toBN(balance).gte(totalGasEstimate);
        },
      );

      // Wait until transaction can be executed
      await waitForPendingTransactions(
        web3,
        relayServiceEndpoint,
        safeAddress,
        ticketId,
      );

      // Request nonce for Safe
      const nonce = await requestNonce(web3, relayServiceEndpoint, safeAddress);

      // Get the chainId from the network
      const chainId = await web3.eth.getChainId();

      // Prepare EIP712 transaction data and sign it
      const typedData = formatTypedData(
        to,
        value,
        txData,
        operation,
        safeTxGas,
        dataGas,
        gasPrice,
        gasToken,
        refundReceiver,
        nonce,
        chainId,
        safeAddress,
      );

      const signature = signTypedData(web3, account.privateKey, typedData);

      // Send transaction to relayer
      try {
        const { txHash } = await requestRelayer(relayServiceEndpoint, {
          path: ['safes', safeAddress, 'transactions'],
          method: 'POST',
          version: 1,
          data: {
            to,
            value,
            data: txData,
            operation,
            signatures: [signature],
            safeTxGas,
            dataGas,
            gasPrice,
            nonce,
            gasToken,
          },
        });

        // Register transaction so we can check later if it finished
        transactionQueue.lockTransaction(safeAddress, {
          nonce,
          ticketId,
          txHash,
        });

        return txHash;
      } catch {
        transactionQueue.unlockTransaction(safeAddress, ticketId);
        transactionQueue.unqueue(safeAddress, ticketId);

        return null;
      }
    },

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
    requestAPI: async (userOptions) => {
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
    },

    /**
     * Estimates the total gas fees for a relayer transaction.
     *
     * @namespace core.utils.estimateTransactionCosts
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - transaction options
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {string} userOptions.to - forwarded address (from is the relayer)
     * @param {string} userOptions.gasToken - address of ERC20 token
     * @param {Object} userOptions.txData - encoded transaction data
     * @param {number} userOptions.value - value in Wei
     *
     * @return {BN} - estimated gas fees
     */
    estimateTransactionCosts: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
        gasToken: {
          type: web3.utils.checkAddressChecksum,
          default: ZERO_ADDRESS,
        },
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
        value: {
          type: 'number',
          default: 0,
        },
      });

      const { txData, gasToken, safeAddress, to, value } = options;
      const operation = CALL_OP;

      const { dataGas, safeTxGas, gasPrice } = await estimateTransactionCosts(
        relayServiceEndpoint,
        {
          gasToken,
          operation,
          safeAddress,
          to,
          txData,
          value,
        },
      );

      return web3.utils
        .toBN(dataGas)
        .add(new web3.utils.BN(safeTxGas))
        .mul(new web3.utils.BN(gasPrice));
    },
  };
}
