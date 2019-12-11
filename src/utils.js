import fetch from 'isomorphic-fetch';

import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';

import CoreError, { RequestError, ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import loop from '~/common/loop';
import parameterize from '~/common/parameterize';
import { formatTypedData, signTypedData } from '~/common/typedData';
import { getSafeContract } from '~/common/getContracts';

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
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let paramsStr = '';
  if (method === 'GET') {
    paramsStr = parameterize(data);
  } else {
    request.body = JSON.stringify(data);
  }

  const slash = options.isTrailingSlash ? '/' : '';

  const url = `${endpoint}/${path.join('/')}${slash}${paramsStr}`;

  try {
    return fetch(url, request).then(response => {
      const contentType = response.headers.get('Content-Type');

      if (contentType && contentType.includes('application/json')) {
        return response.json().then(json => {
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
 * Utils submodule for common transaction and relayer methods.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} globalOptions - global core options
 *
 * @return {Object} - utils module instance
 */
export default function createUtilsModule(web3, contracts, globalOptions) {
  const {
    graphNodeEndpoint,
    relayServiceEndpoint,
    subgraphName,
    usernameServiceEndpoint,
  } = globalOptions;

  const { hub } = contracts;

  return {
    /**
     * Convert to fractional monetary unit of Circles
     * named Freckles.
     *
     * @param {string|number} value - value in Circles
     *
     * @return {string} - value in Freckles
     */
    toFreckles: value => {
      return web3.utils.toWei(`${value}`, 'ether');
    },

    /**
     * Convert from Freckles to Circles number.
     *
     * @param {string|number} value - value in Freckles
     *
     * @return {number} - value in Circles
     */
    fromFreckles: value => {
      return parseInt(web3.utils.fromWei(`${value}`, 'ether'), 10);
    },

    /**
     * Send an API request to the Gnosis Relayer.
     *
     * @param {Object} userOptions - request options
     * @param {string[]} userOptions.path - API path as array
     * @param {number} userOptions.version - API version 1 or 2
     * @param {string} userOptions.method - API request method (GET, POST)
     * @param {Object} userOptions.data - data payload
     */
    requestRelayer: async userOptions => {
      return requestRelayer(relayServiceEndpoint, userOptions);
    },

    /**
     * Query the Graph Node with GraphQL.
     *
     * @param {Object} userOptions - query options
     * @param {string} userOptions.query - GraphQL query
     * @param {Object} userOptions.variables - GraphQL variables
     */
    requestGraph: async userOptions => {
      return requestGraph(graphNodeEndpoint, subgraphName, userOptions);
    },

    /**
     * Send Transaction to Relayer and pay with Circles Token.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - query options
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {object} userOptions.txData - encoded transaction data
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
      });

      const { txData, safeAddress, to } = options;

      const operation = CALL_OP;
      const refundReceiver = ZERO_ADDRESS;
      const value = 0;

      // Get Circles Token of this Safe / User
      const tokenAddress = await hub.methods.userToToken(safeAddress).call();

      if (tokenAddress === ZERO_ADDRESS) {
        throw new CoreError(
          'Invalid Token address. Did you forget to deploy the Token?',
          ErrorCodes.TOKEN_NOT_FOUND,
        );
      }

      // Use Circles Token to pay for transaction fees
      const gasToken = tokenAddress;

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

      const nonce = await getSafeContract(web3, safeAddress)
        .methods.nonce()
        .call();

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
        safeAddress,
      );

      const signature = signTypedData(web3, account.privateKey, typedData);

      const response = await requestRelayer(relayServiceEndpoint, {
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

      return response.txHash;
    },

    /**
     * Send a transaction to the relayer which will be executed by it.
     * The gas costs will be estimated by the relayer before.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - query options
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {string} userOptions.to - forwarded address (from is the relayer)
     * @param {object} userOptions.txData - encoded transaction data
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

      const { dataGas, safeTxGas } = await estimateTransactionCosts(
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

      const gasPrice = web3.utils.toWei('2', 'gwei');

      // Wait until Relayer allocates enough funds to pay for transaction
      const totalGasEstimate =
        (parseInt(dataGas, 10) + parseInt(safeTxGas, 10)) *
        parseInt(gasPrice, 10);

      await loop(
        () => {
          return web3.eth.getBalance(safeAddress);
        },
        balance => {
          return balance >= totalGasEstimate;
        },
      );

      const nonce = await getSafeContract(web3, safeAddress)
        .methods.nonce()
        .call();

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
        safeAddress,
      );

      const signature = signTypedData(web3, account.privateKey, typedData);

      const response = await requestRelayer(relayServiceEndpoint, {
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

      return response.txHash;
    },
    requestAPI: async userOptions => {
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

      return request(usernameServiceEndpoint, {
        data: options.data,
        method: options.method,
        path: ['api'].concat(options.path),
      });
    },
  };
}
