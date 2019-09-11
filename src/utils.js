import fetch from 'isomorphic-fetch';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import parameterize from '~/common/parameterize';
import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';
import { getSafeContract } from '~/common/getContracts';

function formatTypedData(
  to,
  value,
  data,
  operation,
  safeTxGas,
  dataGas,
  gasPrice,
  gasToken,
  refundReceiver,
  nonce,
  verifyingContract,
) {
  return {
    types: {
      EIP712Domain: [{ type: 'address', name: 'verifyingContract' }],
      SafeTx: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'value' },
        { type: 'bytes', name: 'data' },
        { type: 'uint8', name: 'operation' },
        { type: 'uint256', name: 'safeTxGas' },
        { type: 'uint256', name: 'baseGas' },
        { type: 'uint256', name: 'gasPrice' },
        { type: 'address', name: 'gasToken' },
        { type: 'address', name: 'refundReceiver' },
        { type: 'uint256', name: 'nonce' },
      ],
    },
    domain: {
      verifyingContract,
    },
    primaryType: 'SafeTx',
    message: {
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas: dataGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
    },
  };
}

async function signTypedData(web3, address, typedData) {
  return await requestRPC(web3, 'eth_signTypedData', [address, typedData]);
}

async function requestRPC(web3, method, params = []) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: '2.0',
        id: new Date().getTime(),
        method,
        params,
      },
      (error, { result }) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      },
    );
  });
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
          type: web3.utils.isHexStrict,
        },
        to: {
          type: web3.utils.isHexStrict,
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
      const safeTxGas = 100000; // @TODO: Value tbc
      const dataGas = 100000; // @TODO: Value tbc
      const gasPrice = 300000000000; // @TODO: Value tbc
      const gasToken = ZERO_ADDRESS;
      const refundReceiver = ZERO_ADDRESS;

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
