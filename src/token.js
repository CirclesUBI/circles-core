import { ZERO_ADDRESS } from '~/common/constants';

import CoreError, { TransferError, ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getTokenContract } from '~/common/getContracts';

const MAX_TRANSFER_STEPS = 5; // The contracts have a complexity limit due to block gas limits

/**
 * Find maximumFlow and transfer steps through a trust graph from someone to
 * someone else to transitively send an amount of Circles.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - search arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {BN} userOptions.value - value of Circles tokens
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
  });

  try {
    const response = await utils.requestAPI({
      path: ['transfers'],
      method: 'POST',
      data: {
        from: options.from,
        to: options.to,
        value: parseFloat(
          web3.utils.fromWei(options.value.toString(), 'ether'),
        ),
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
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - token module instance
 */
export default function createTokenModule(web3, contracts, utils) {
  const { hub } = contracts;

  return {
    /**
     * Returns true if there are enough balance on this Safe address to deploy
     * a Token contract.
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
     * Deploy new Circles Token for a user.
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

      // Call method and return result
      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Get Token address by passing owner address.
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
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - safe address
     *
     * @return {array} - list of all tokens with ownerAddress, address and amount
     */
    listAllTokens: async (account, userOptions) => {
      checkAccount(web3, account);
      return await utils.listAllTokens(userOptions);
    },

    /**
     * Get summarized balance of all or one Token owned by a user.
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

      const response = await utils.requestGraph({
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
      });

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
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - search arguments
     * @param {string} userOptions.from - sender Safe address
     * @param {string} userOptions.to - receiver Safe address
     * @param {BN} userOptions.value - value for transactions path
     *
     * @return {Object} - maximum possible Circles value and transactions path
     */
    findTransitiveTransfer: async (account, userOptions) => {
      checkAccount(web3, account);
      return await findTransitiveTransfer(web3, utils, userOptions);
    },

    /**
     * Transfer Circles from one user to another.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - sender address
     * @param {string} userOptions.to - receiver address
     * @param {BN} userOptions.value - value
     * @param {string} userOptions.paymentNote - optional payment note stored in API
     *
     * @return {string} - transaction hash
     */
    transfer: async (account, userOptions) => {
      checkAccount(web3, account);

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
        paymentNote: {
          type: 'string',
          default: '',
        },
      });

      // Request API to find transitive transfer path
      let response;
      try {
        response = await findTransitiveTransfer(web3, utils, options);

        if (response.transferSteps.length === 0) {
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
      } catch (error) {
        if (!error.code) {
          throw new TransferError(error.message, ErrorCodes.INVALID_TRANSFER, {
            ...options,
            response,
          });
        } else {
          throw error;
        }
      }

      // Convert connections to contract argument format
      const transfer = response.transferSteps.reduce(
        (acc, transaction) => {
          // Convert to Smart Contract method format
          acc.tokenOwners.push(transaction.tokenOwnerAddress);
          acc.sources.push(transaction.from);
          acc.destinations.push(transaction.to);
          acc.values.push(
            web3.utils.toWei(transaction.value.toString(), 'ether'),
          );

          return acc;
        },
        {
          tokenOwners: [],
          sources: [],
          destinations: [],
          values: [],
        },
      );

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
     * @param {Object} account - web3 account instance
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
     * @param {Object} account - web3 account instance
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
     * @param {Object} account - web3 account instance
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
