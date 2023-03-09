import { SAFE_LAST_VERSION, ZERO_ADDRESS } from '~/common/constants';

import CoreError, { TransferError, ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getTokenContract } from '~/common/getContracts';
import { getVersion } from '~/safe';

/* Due to block gas limit of 12.500.000 a transitive transaction can have a
 * limited number of steps. The limit below gives a 50% buffer between the
 * gas estimate and the block gas limit.
 * For more information, see the Circles handbook.
 */
const MAX_TRANSFER_STEPS = 52;

/**
 * Find maximumFlow and transfer steps through a trust graph from someone to
 * someone else to transitively send an amount of Circles using the binary
 * version of pathfinder2 or the rpc server version
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - search arguments
 *
 * @return {Object[]} - transaction steps
 */
async function requestTransferSteps(web3, utils, userOptions, pathfinderType) {
  let result;
  if (pathfinderType == 'cli') {
    // call cli pathfinders
    result = await findTransitiveTransfer(web3, utils, userOptions);
  } else if (pathfinderType == 'server') {
    // call server
    result = await findTransitiveTransferServer(web3, utils, userOptions);
  }
  return result;
}

/**
 * Find maximumFlow and transfer steps through a trust graph from someone to
 * someone else to transitively send an amount of Circles using the binary
 * version of pathfinder2
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - search arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {BN} userOptions.value - value of Circles tokens
 * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
 *
 * @return {Object[]} - transaction steps
 */
export async function findTransitiveTransfer(web3, utils, userOptions) {
  const options = checkOptions(userOptions, {
    from: {
      type: web3.utils.checkAddressChecksum,
    },
    to: {
      type: web3.utils.checkAddressChecksum,
    },
    value: {
      type: web3.utils.isBN,
    },
    hops: {
      type: 'number',
      default: 3,
    },
  });
  try {
    const response = await utils.requestAPI({
      path: ['transfers'],
      method: 'POST',
      data: {
        from: options.from,
        to: options.to,
        value: options.value.toString(),
        hops: options.hops.toString(),
      },
    });
    return response.data;
  } catch (error) {
    throw new TransferError(error.message, ErrorCodes.UNKNOWN_ERROR);
  }
}

/**
 * Find maximumFlow and transfer steps through a trust graph from someone to
 * someone else to transitively send an amount of Circles using the server
 * version of pathfinder2
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - search arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {BN} userOptions.value - value of Circles tokens
 * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
 *
 * @return {Object[]} - transaction steps
 */
export async function findTransitiveTransferServer(web3, utils, userOptions) {
  const options = checkOptions(userOptions, {
    from: {
      type: web3.utils.checkAddressChecksum,
    },
    to: {
      type: web3.utils.checkAddressChecksum,
    },
    value: {
      type: web3.utils.isBN,
    },
    maxTransfers: {
      type: 'number',
      default: MAX_TRANSFER_STEPS,
    },
    pathfinderMethod: {
      type: 'string',
      default: 'compute_transfer',
    },
  });

  try {
    const response = await utils.requestPathfinderAPI({
      method: 'POST',
      data: {
        id: Date.now(),
        method: options.pathfinderMethod,
        params: {
          from: options.from,
          to: options.to,
          value: options.value.toString(),
          max_transfers: options.maxTransfers,
        },
      },
      isTrailingSlash: false,
    });
    return response.result;
  } catch (error) {
    throw new TransferError(error.message, ErrorCodes.UNKNOWN_ERROR);
  }
}

/**
 * Update the transitive transfer steps from someone to someone for
 * an amount of Circles.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - search arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {BN} userOptions.value - value of Circles tokens
 * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
 *
 * @return {boolean} - steps are updated
 */
export async function updateTransitiveTransfer(web3, utils, userOptions) {
  const options = checkOptions(userOptions, {
    from: {
      type: web3.utils.checkAddressChecksum,
    },
    to: {
      type: web3.utils.checkAddressChecksum,
    },
    value: {
      type: web3.utils.isBN,
    },
    hops: {
      type: 'number',
      default: 3,
    },
  });

  try {
    const response = await utils.requestAPI({
      path: ['transfers', 'update'],
      method: 'POST',
      data: {
        from: options.from,
        to: options.to,
        value: options.value.toString(),
        hops: options.hops.toString(),
      },
    });

    return response.data;
  } catch (error) {
    throw new TransferError(error.message, ErrorCodes.UNKNOWN_ERROR);
  }
}

/**
 * UBI submodule to get current Token balance and send Circles to other users.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 * @param {Object} globalOptions - global core options
 *
 * @return {Object} - token module instance
 */
export default function createTokenModule(
  web3,
  contracts,
  utils,
  globalOptions,
) {
  const { hub } = contracts;
  const { pathfinderType } = globalOptions;
  return {
    /**
     * Returns true if there are enough balance on this Safe address to deploy
     * a Token contract.
     *
     * @namespace core.token.isFunded
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.safeAddress - safe address to check
     *
     * @return {boolean} - has enough funds
     */
    isFunded: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Do not attempt asking the relayer when Safe does not exist yet
      if ((await web3.eth.getCode(options.safeAddress)) === '0x') {
        return false;
      }

      const txData = await hub.methods.signup().encodeABI();

      try {
        const costs = await utils.estimateTransactionCosts(account, {
          safeAddress: options.safeAddress,
          to: hub.options.address,
          txData,
        });

        const balance = await web3.eth.getBalance(options.safeAddress);

        return web3.utils.toBN(balance).gte(costs);
      } catch {
        return false;
      }
    },

    /**
     * Returns the direct send limit to a user.
     *
     * @namespace core.token.checkSendLimit
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.from - send token from this address
     * @param {string} userOptions.to - to this address
     *
     * @return {BN} - send limit
     */
    checkSendLimit: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        from: {
          type: web3.utils.checkAddressChecksum,
        },
        to: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const sendLimit = await hub.methods
        .checkSendLimit(options.from, options.from, options.to)
        .call();

      return web3.utils.toBN(sendLimit);
    },

    /**
     * Deploy new Circles Token for a user.
     *
     * @namespace core.token.deploy
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owner of the Token
     *
     * @return {string} - transaction hash
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const txData = await hub.methods.signup().encodeABI();

      const safeVersion = await getVersion(web3, options.safeAddress);

      // Call method and return result
      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
        isCRCVersion: safeVersion != SAFE_LAST_VERSION,
      });
    },

    /**
     * Get Token address by passing owner address.
     *
     * @namespace core.token.getAddress
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address of Token owner
     *
     * @return {string} - Token address
     */
    getAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await hub.methods.userToToken(options.safeAddress).call();
    },

    /**
     * List all available tokens of this user.
     *
     * @namespace core.token.listAllTokens
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - safe address
     *
     * @return {Array} - list of all tokens with ownerAddress, address and amount
     */
    listAllTokens: async (account, userOptions) => {
      checkAccount(web3, account);
      return await utils.listAllTokens(userOptions);
    },

    /**
     * Get summarized balance of all or one Token owned by a user.
     *
     * @namespace core.token.getBalance
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - safe address
     * @param {string} userOptions.tokenAddress - optional token address in case only this one should be checked
     *
     * @return {BN} - current balance
     */
    getBalance: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        tokenAddress: {
          type: web3.utils.checkAddressChecksum,
          default: ZERO_ADDRESS,
        },
      });

      const { safeAddress, tokenAddress } = options;

      const response = await utils.requestIndexedDB('balances', safeAddress);

      if (!response || !response.safe) {
        throw new CoreError(
          `Could not find Safe with address ${safeAddress}`,
          ErrorCodes.SAFE_NOT_FOUND,
        );
      }

      // Return only the balance of a particular token
      if (tokenAddress !== ZERO_ADDRESS) {
        const token = response.safe.balances.find((item) => {
          return item.token.id === tokenAddress;
        });

        if (!token) {
          return web3.utils.toBN('0');
        }

        return web3.utils.toBN(token.amount);
      }

      // Summarize all given token amounts
      return response.safe.balances.reduce((acc, { amount }) => {
        return acc.iadd(web3.utils.toBN(amount));
      }, web3.utils.toBN('0'));
    },

    /**
     * This algorithm makes use of the Ford-Fulkerson method which computes the
     * maximum flow in a trust network between two users. It returns the
     * maximum flow and the transfer steps in the graph for a value (when
     * possible).
     *
     * This method does not execute any real transactions.
     *
     * @namespace core.token.findTransitiveTransfer
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - search arguments
     * @param {string} userOptions.from - sender Safe address
     * @param {string} userOptions.to - receiver Safe address
     * @param {BN} userOptions.value - value for transactions path
     *
     * @return {Object} - maximum possible Circles value and transactions path
     */
    // findTransitiveTransfer(web3, utils, userOptions)
    findTransitiveTransfer: async (account, userOptions) => {
      checkAccount(web3, account);
      return await findTransitiveTransfer(web3, utils, userOptions);
    },

    /**
     * Find Transitive Transfer Steps using either the cli or the server version
     * of the pathfinder2
     *
     * @namespace core.token.requestTransferSteps
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - search arguments
     * @param {string} userOptions.from - sender Safe address
     * @param {string} userOptions.to - receiver Safe address
     * @param {BN} userOptions.value - value for transactions path
     *
     * @return {Object} - maximum possible Circles value and transactions path
     */
    requestTransferSteps: async (account, userOptions) => {
      checkAccount(web3, account);
      return await requestTransferSteps(
        web3,
        utils,
        userOptions,
        pathfinderType,
      );
    },

    /**
     * Update the transitive transfer steps from someone to someone for
     * an amount of Circles.
     *
     * This method does not execute any real transactions.
     *
     * @namespace core.token.updateTransferSteps
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - search arguments
     * @param {string} userOptions.from - sender Safe address
     * @param {string} userOptions.to - receiver Safe address
     * @param {BN} userOptions.value - value for transactions path
     * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
     *
     * @return {boolean} - steps are updated
     */
    updateTransferSteps: async (account, userOptions) => {
      checkAccount(web3, account);
      return await updateTransitiveTransfer(web3, utils, userOptions);
    },

    /**
     * Transfer Circles from one user to another.
     *
     * @namespace core.token.transfer
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - sender address
     * @param {string} userOptions.to - receiver address
     * @param {BN} userOptions.value - value
     * @param {string} userOptions.paymentNote - optional payment note stored in API
     * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
     *
     * @return {string} - transaction hash
     */
    transfer: async (account, userOptions) => {
      checkAccount(web3, account);
      let fieldObject;
      if (pathfinderType == 'cli') {
        fieldObject = {
          from: {
            type: web3.utils.checkAddressChecksum,
          },
          to: {
            type: web3.utils.checkAddressChecksum,
          },
          value: {
            type: web3.utils.isBN,
          },
          paymentNote: {
            type: 'string',
            default: '',
          },
          hops: {
            type: 'number',
            default: 3,
          },
        };
      } else {
        fieldObject = {
          from: {
            type: web3.utils.checkAddressChecksum,
          },
          to: {
            type: web3.utils.checkAddressChecksum,
          },
          value: {
            type: web3.utils.isBN,
          },
          paymentNote: {
            type: 'string',
            default: '',
          },
          maxTransfers: {
            type: 'number',
            default: 40,
          },
          pathfinderMethod: {
            type: 'string',
            default: 'compute_transfer',
          },
        };
      }
      const options = checkOptions(userOptions, fieldObject);

      const transfer = {
        tokenOwners: [],
        sources: [],
        destinations: [],
        values: [],
      };

      // Try first to send the transaction directly, this saves us the
      // roundtrip through the api
      // Try first with the token of the 'to' address,
      // then try with the token of the 'from' address.
      const sendLimitTo = await hub.methods
        .checkSendLimit(options.to, options.from, options.to)
        .call();

      if (web3.utils.toBN(sendLimitTo).gte(options.value)) {
        // Direct transfer is possible, fill in the required transaction data
        transfer.tokenOwners.push(options.to);
        transfer.sources.push(options.from);
        transfer.destinations.push(options.to);
        transfer.values.push(options.value.toString());
      } else {
        const sendLimitFrom = await hub.methods
          .checkSendLimit(options.from, options.from, options.to)
          .call();
        if (web3.utils.toBN(sendLimitFrom).gte(options.value)) {
          // Direct transfer is possible, fill in the required transaction data
          transfer.tokenOwners.push(options.from);
          transfer.sources.push(options.from);
          transfer.destinations.push(options.to);
          transfer.values.push(options.value.toString());
        } else {
          // This seems to be a little bit more complicated ..., request API to
          // find transitive transfer path
          let response;
          try {
            response = await requestTransferSteps(
              web3,
              utils,
              options,
              pathfinderType,
            );
            if (web3.utils.toBN(response.maxFlowValue).lt(options.value)) {
              throw new TransferError(
                'No possible transfer found',
                ErrorCodes.TRANSFER_NOT_FOUND,
                {
                  ...options,
                  response,
                },
              );
            }
            if (response.transferSteps.length > MAX_TRANSFER_STEPS) {
              throw new TransferError(
                'Too many transfer steps',
                ErrorCodes.TOO_COMPLEX_TRANSFER,
                {
                  ...options,
                  response,
                },
              );
            }
            // Convert connections to contract argument format depending on the pathfinder used
            if (pathfinderType == 'cli') {
              response.transferSteps.forEach((transaction) => {
                transfer.tokenOwners.push(transaction.tokenOwnerAddress);
                transfer.sources.push(transaction.from);
                transfer.destinations.push(transaction.to);
                transfer.values.push(transaction.value);
              });
            } else if (pathfinderType == 'server') {
              response.transferSteps.forEach((transaction) => {
                transfer.tokenOwners.push(transaction.token_owner);
                transfer.sources.push(transaction.from);
                transfer.destinations.push(transaction.to);
                transfer.values.push(transaction.value);
              });
            }
          } catch (error) {
            if (!error.code) {
              throw new TransferError(
                error.message,
                ErrorCodes.INVALID_TRANSFER,
                {
                  ...options,
                  response,
                },
              );
            } else {
              throw error;
            }
          }
        }
      }

      const txData = await hub.methods
        .transferThrough(
          transfer.tokenOwners,
          transfer.sources,
          transfer.destinations,
          transfer.values,
        )
        .encodeABI();

      const txHash = await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });

      // Do not store the transfer in the API when there is no paymentNote
      if (options.paymentNote.length === 0) {
        return txHash;
      }

      // Something went wrong
      if (!txHash) {
        return null;
      }

      // If everything went well so far we can store the paymentNote in the API
      const { signature } = web3.eth.accounts.sign(
        [options.from, options.to, txHash].join(''),
        account.privateKey,
      );

      await utils.requestAPI({
        path: ['transfers'],
        method: 'PUT',
        data: {
          address: account.address,
          signature,
          data: {
            from: options.from,
            to: options.to,
            transactionHash: txHash,
            paymentNote: options.paymentNote,
          },
        },
      });

      return txHash;
    },

    /**
     * Return the payment Note of an transaction from or to the user.
     *
     * @namespace core.token.getPaymentNote
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user options
     * @param {string} userOptions.transactionHash - hash of transfer transaction
     *
     * @return {string} - Payment note, null when not given or not allowed
     */
    getPaymentNote: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        transactionHash: {
          type: (value) => {
            return /^0x([A-Fa-f0-9]{64})$/.test(value);
          },
        },
      });

      // Sign this request as we have to claim our wallet address
      const { signature } = web3.eth.accounts.sign(
        [options.transactionHash].join(''),
        account.privateKey,
      );

      try {
        const response = await utils.requestAPI({
          path: ['transfers', options.transactionHash],
          method: 'POST',
          data: {
            address: account.address,
            signature,
          },
        });

        if (response && response.data && response.data.paymentNote) {
          return response.data.paymentNote;
        }
      } catch (error) {
        // Do nothing when not found or denied access ...
        if (
          !error.request ||
          (error.request.status !== 404 && error.request.status !== 403)
        ) {
          throw error;
        }
      }

      return null;
    },

    /**
     * Return the current value of the pending UBI payout.
     *
     * @namespace core.token.checkUBIPayout
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user options
     * @param {string} userOptions.safeAddress - address of Token owner
     *
     * @return {BN} - payout value
     */
    checkUBIPayout: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const tokenAddress = await hub.methods
        .userToToken(options.safeAddress)
        .call();

      if (tokenAddress === ZERO_ADDRESS) {
        throw new CoreError(
          'Invalid Token address. Did you forget to deploy the Token?',
          ErrorCodes.TOKEN_NOT_FOUND,
        );
      }

      const token = await getTokenContract(web3, tokenAddress);
      const payout = await token.methods.look().call();

      return web3.utils.toBN(payout);
    },

    /**
     * Request a UBI payout.
     *
     * @namespace core.token.requestUBIPayout
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address of Token owner
     *
     * @return {string} - Transaction hash
     */
    requestUBIPayout: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const { safeAddress } = options;

      // Find out token address of this Safe
      const tokenAddress = await hub.methods.userToToken(safeAddress).call();

      if (tokenAddress === ZERO_ADDRESS) {
        throw new CoreError(
          'Invalid Token address. Did you forget to deploy the Token?',
          ErrorCodes.TOKEN_NOT_FOUND,
        );
      }

      // Get Token contract
      const token = await getTokenContract(web3, tokenAddress);

      // Request UBI payout
      const ubiTxData = await token.methods.update().encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.safeAddress,
        to: token.options.address,
        txData: ubiTxData,
      });
    },
  };
}
