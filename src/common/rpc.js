/**
 * Make an RPC call to the blockchain.
 *
 * @param {Web3} web3 - web3 instance
 * @param {string} method - RPC method name
 * @param {any[]} params - RPC params
 *
 * @return {Object} - JSON RPC result
 */
export async function requestRPC(web3, method, params = []) {
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
