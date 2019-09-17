import fetch from 'isomorphic-fetch';

import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
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

  const url = `${endpoint}/${path.join('/')}/${paramsStr}`;

  try {
    return fetch(url, request).then(response => {
      if (response.status >= 400) {
        throw new Error(`Request failed with error ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');

      if (contentType && contentType.includes('application/json')) {
        return response.json().then(json => {
          return json;
        });
      } else {
        return response.body;
      }
    });
  } catch (err) {
    throw new Error(err);
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
  const { relayServiceEndpoint, usernameServiceEndpoint } = globalOptions;

  return {
    /**
     * Send an API request to the Gnosis Relayer.
     *
     * @param {string} relayServiceEndpoint - relayer endpoint URL
     * @param {Object} userOptions - global core options
     * @param {string[]} userOptions.path - API path as array
     * @param {number} userOptions.version - API version 1 or 2
     * @param {string} userOptions.method - API request method (GET, POST)
     * @param {Object} userOptions.data - data payload
     */
    requestRelayer: async userOptions => {
      return requestRelayer(relayServiceEndpoint, userOptions);
    },

    /**
     * Send a transaction to the relayer which will be executed by it.
     * The gas costs will be estimated by the relayer before.
     *
     * @param {Object} account - web3 account instance
     * @param {string} userOptions.safeAddress - address of Safe
     * @param {string} userOptions.to - forwarded address (from is the relayer)
     * @param {object} userOptions.txData - encoded transaction data
     * @param {number} userOptions.value - value in Wei
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
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
        value: {
          type: 'number',
          default: 0,
        },
      });

      const { to, txData, value, safeAddress } = options;
      const operation = CALL_OP;
      const gasToken = ZERO_ADDRESS;
      const refundReceiver = ZERO_ADDRESS;

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

      const signatureBytes = await signTypedData(
        web3,
        account.address,
        typedData,
      );

      const sig = signatureBytes.slice(2);

      const signature = {
        r: web3.utils.toBN(`0x${sig.slice(0, 64)}`).toString(10),
        s: web3.utils.toBN(`0x${sig.slice(64, 128)}`).toString(10),
        v: web3.utils.toDecimal(sig.slice(128, 130)),
      };

      return requestRelayer(relayServiceEndpoint, {
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
