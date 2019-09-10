import fetch from 'isomorphic-fetch';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import parameterize from '~/common/parameterize';
import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';

async function sendSignedTx(web3, account, rawTx) {
  const signedTx = await web3.eth.accounts.signTransaction(
    rawTx,
    account.privateKey,
  );

  return await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

export default function createUtilsModule(web3, contracts, globalOptions) {
  const { gas } = globalOptions;

  return {
    requestRelayer: async userOptions => {
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

      const endpoint = globalOptions.relayServiceEndpoint;
      const url = `${endpoint}/api/v${version}/${path.join('/')}/${paramsStr}`;

      try {
        return fetch(url, request).then(response => {
          if (response.status !== 200) {
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
    },
    sendSignedTx: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        to: {
          type: web3.utils.isHexStrict,
        },
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
      });

      return sendSignedTx(web3, account, {
        from: account.address,
        to: options.to,
        data: options.txData,
        gas,
      });
    },
    sendSignedRelayerTx: async (account, userOptions) => {
      // @TODO: Integrate Relayer Service
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        to: {
          type: web3.utils.isHexStrict,
        },
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
      });

      if (!('relayServiceEndpoint' in globalOptions)) {
        // No RelayerService given, do the transaction directly
        return sendSignedTx(web3, account, {
          from: account.address,
          to: options.to,
          data: options.txData,
          gas,
        });
      }
    },
    executeSafeTx: async userOptions => {
      const options = checkOptions(userOptions, {
        safe: {
          type: 'object',
        },
        from: {
          type: web3.utils.isHexStrict,
        },
        to: {
          type: web3.utils.isHexStrict,
        },
        executor: {
          type: web3.utils.isHexStrict,
        },
        valueInWei: {
          type: 'number',
          default: 0,
        },
        txData: {
          type: web3.utils.isHexStrict,
          default: '0x',
        },
      });

      const { gas } = globalOptions;
      const { from, to, valueInWei, txData } = options;

      const signatures = `0x000000000000000000000000${from.replace(
        '0x',
        '',
      )}000000000000000000000000000000000000000000000000000000000000000001`;

      const operation = CALL_OP;
      const safeTxGas = 0;
      const baseGas = 0;
      const gasPrice = 0;
      const gasToken = ZERO_ADDRESS;
      const refundReceiver = options.executor;

      return await options.safe.methods
        .execTransaction(
          to,
          valueInWei,
          txData,
          operation,
          safeTxGas,
          baseGas,
          gasPrice,
          gasToken,
          refundReceiver,
          signatures,
        )
        .send({
          from: options.executor,
          gas,
        });
    },
  };
}
