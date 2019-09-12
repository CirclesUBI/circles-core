import fetch from 'isomorphic-fetch';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import parameterize from '~/common/parameterize';
import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';
import { formatTypedData, signTypedData } from '~/common/typedData';
import { getSafeContract } from '~/common/getContracts';

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

  const url = `${endpoint}/api/v${version}/${path.join('/')}/${paramsStr}`;

  try {
    return fetch(url, request).then(response => {
      if (response.status >= 400) {
        throw new Error(`Relayer responded with error ${response.status}`);
      }

      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        return response.json().then(json => {
          return json;
        });
      } else {
        return response;
      }
    });
  } catch (err) {
    throw new Error(err);
  }
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

export default function createUtilsModule(web3, contracts, globalOptions) {
  const { relayServiceEndpoint } = globalOptions;

  return {
    requestRelayer: async userOptions => {
      return requestRelayer(relayServiceEndpoint, userOptions);
    },
    executeSafeTx: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.isAddress,
        },
        to: {
          type: web3.utils.isAddress,
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
  };
}
