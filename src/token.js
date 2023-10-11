import { ethers } from 'ethers';

import { ZERO_ADDRESS } from '~/common/constants';
import CoreError, { TransferError, ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getTokenContract } from '~/common/getContracts';

/**
 * Module to manage Circles tokens
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Token module instance
 */
export default function createTokenModule({
  ethProvider,
  contracts: { hub },
  safe,
  utils,
  options: { hubAddress, pathfinderType, pathfinderMaxTransferSteps },
}) {
  const isPathfinderServer = pathfinderType === 'server';

  /**
   * Get Safe's Token address
   * @access private
   * @param {string} safeAddress - Owner Safe address
   * @return {string} - Token address or zero address when none is deployed
   */
  const _getAddress = (safeAddress) => hub.userToToken(safeAddress);

  /**
   * Find maximumFlow and transfer steps through a trust graph from someone to
   * someone else to transitively send an amount of Circles using the binary
   * version of pathfinder2
   * @access private
   * @param {Object} options - search arguments
   * @param {string} options.from - sender Safe address
   * @param {string} options.to - receiver Safe address
   * @param {BN} options.value - value of Circles tokens
   * @param {number} options.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
   * @return {Object[]} - transaction steps
   */
  const _findTransitiveTransferCli = ({ from, to, value, hops }) =>
    utils
      .requestAPI({
        path: ['transfers'],
        method: 'POST',
        data: {
          from,
          to,
          value: value.toString(),
          hops: hops.toString(),
        },
      })
      .then(({ data }) => data);

  /**
   * Find maximumFlow and transfer steps through a trust graph from someone to
   * someone else to transitively send an amount of Circles using the server
   * version of pathfinder2
   * @access private
   * @param {Object} options - search arguments
   * @param {string} options.from - sender Safe address
   * @param {string} options.to - receiver Safe address
   * @param {BN} options.value - value of Circles tokens
   * @param {number} options.maxTransfers - limit of steps returned by the pathfinder service
   * @return {Object[]} - transaction steps
   */
  const _findTransitiveTransferServer = ({ from, to, value, maxTransfers }) =>
    utils
      .requestPathfinderAPI({
        method: 'POST',
        data: {
          id: crypto.randomUUID(),
          method: 'compute_transfer',
          params: {
            from,
            to,
            value: value.toString(),
            max_transfers: maxTransfers,
          },
        },
        isTrailingSlash: false,
      })
      .then(({ result }) => result);

  /**
   * Find maximumFlow and transfer steps through a trust graph from someone to
   * someone else to transitively send an amount of Circles using the binary
   * version of pathfinder2 or the rpc server version
   * @access private
   * @param {Object} options - search arguments
   * @param {string} options.from - sender Safe address
   * @param {string} options.to - receiver Safe address
   * @param {BN} options.value - value for transactions path
   * @param {number} options.hops - max number of trust hops away from 'from' to find transfer steps. Ignored if pathfinderType is 'server'
   * @param {number} options.maxTransfers - limit of steps returned by the pathfinder service. Ignored if pathfinderType is 'cli'
   * @throws {TransferError} - Unkown error
   * @return {Object[]} - transaction steps
   */
  const _findTransitiveTransfer = (options) => {
    const targetMethod = isPathfinderServer
      ? _findTransitiveTransferServer
      : _findTransitiveTransferCli;

    return targetMethod(options).catch((error) => {
      throw new TransferError(error.message, ErrorCodes.UNKNOWN_ERROR);
    });
  };

  /**
   * Return the limit available to send from one Safe to another of a specific Token
   * @access private
   * @param {Object} options - arguments
   * @param {string} options.from - send token from this address
   * @param {string} options.to - to this address
   * @param {string} options.token - token address to check
   * @return {BN} - limit available
   */
  const _checkSendLimit = ({ from, to, token }) =>
    hub
      .checkSendLimit(token, from, to)
      .then((sendLimit) => ethers.BigNumber.from(sendLimit));

  /**
   * Check if the target value can be transfer from one Safe to another with a specific Token
   * @access private
   * @param {Object} options - arguments
   * @param {string} options.from - send token from this address
   * @param {string} options.to - to this address
   * @param {string} options.value - quantity to transfer
   * @param {string} options.token - token address to check
   * @return {boolean} - if value can be transfered or not
   */
  const _canTransferDirectly = ({ from, to, value, token }) =>
    _checkSendLimit({ token, from, to }).then((sendLimit) =>
      sendLimit.gte(value),
    );

  /**
   * Return the limit available to send from one Safe to another of a specific Token
   * @namespace core.token.checkSendLimit
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - user arguments
   * @param {string} userOptions.from - send token from this address
   * @param {string} userOptions.to - to this address
   * @param {string} userOptions.token - token address to check, if none is passed the 'from' token will be used as default
   * @return {BN} - limit available
   */
  const checkSendLimit = async (account, userOptions) => {
    checkAccount(account);

    const { from, to, token } = checkOptions(userOptions, {
      from: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      token: {
        type: ethers.utils.isAddress,
        default: ZERO_ADDRESS,
      },
    });

    return _checkSendLimit({
      from,
      to,
      // defaulting to old behaviour if no token is provided
      token: token !== ZERO_ADDRESS ? token : from,
    });
  };

  /**
   * Return the pending UBI payout value in the current moment
   * @namespace core.token.checkUBIPayout
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - user options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @throws {CoreError} - Token does not exist
   * @return {BN} - payout value
   */
  const checkUBIPayout = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    const tokenAddress = await _getAddress(options.safeAddress);

    if (tokenAddress === ZERO_ADDRESS) {
      throw new CoreError(
        'Invalid Token address. Did you forget to deploy the Token?',
        ErrorCodes.TOKEN_NOT_FOUND,
      );
    }

    const token = await getTokenContract(ethProvider, tokenAddress);
    const payout = await token.look();

    return ethers.BigNumber.from(payout);
  };

  /**
   * Deploy the Token for a Safe signing the Safe in the Hub
   * @namespace core.token.deploy
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @return {RelayResponse} - gelato response
   */
  const deploy = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return hub.populateTransaction.signup().then(({ data }) =>
      safe.sendTransaction(account, {
        safeAddress,
        transactionData: {
          to: hubAddress,
          data,
        },
      }),
    );
  };

  /**
   * Get Safe's Token address
   * @namespace core.token.getAddress
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @return {string} - Token address or zero address when none is deployed
   */
  const getAddress = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return _getAddress(safeAddress);
  };

  /**
   * Get summarized balance of all or one Token owned by a Safe
   * @namespace core.token.getBalance
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @param {string=} userOptions.tokenAddress - Token address for filtering the balance
   * @throws {CoreError} - Safe does not exist
   * @return {BN} - Safe balance
   */
  const getBalance = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
      tokenAddress: {
        type: ethers.utils.isAddress,
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

    let balance = ethers.BigNumber.from('0');

    // Return only the balance of a particular token
    if (tokenAddress !== ZERO_ADDRESS) {
      const lowerCaseAddress = tokenAddress.toLowerCase();
      const tokenBalance = response.safe.balances.find(
        (item) => item.token.id === lowerCaseAddress,
      );

      if (tokenBalance) {
        balance = ethers.BigNumber.from(tokenBalance.amount);
      }
    } else {
      // Summarize all given token amounts
      balance = response.safe.balances.reduce(
        (acc, { amount }) => acc.add(ethers.BigNumber.from(amount)),
        balance,
      );
    }

    return balance;
  };

  /**
   * Return the Payment Note of a transaction
   * @namespace core.token.getPaymentNote
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - user options
   * @param {string} userOptions.transactionHash - transfer transaction hash
   * @throws {CoreError} - Unknown error
   * @return {string|null} - Payment note or null if none exists or Safe has no access
   */
  const getPaymentNote = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      transactionHash: {
        type: (value) => {
          return /^0x([A-Fa-f0-9]{64})$/.test(value);
        },
      },
    });

    // Sign this request as we have to claim our wallet address
    const signature = await account.signMessage(
      ethers.utils.arrayify(options.transactionHash),
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
  };

  /**
   * Find Transitive Transfer Steps using either the cli or the server version
   * of the pathfinder2.
   * The algorithms compute the maximum flow in a trust network between
   * two users. It returns the maximum flow and the transfer steps in the
   * graph for a value (when possible).
   * This method does not execute any real transactions
   * @namespace core.token.findTransitiveTransfer
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - search arguments
   * @param {string} userOptions.from - sender Safe address
   * @param {string} userOptions.to - receiver Safe address
   * @param {BN} userOptions.value - value for transactions path
   * @param {number} userOptions.hops - max number of trust hops away from 'from' to find transfer steps. Ignored if pathfinderType is 'server'
   * @param {number} userOptions.maxTransfers - limit of steps returned by the pathfinder service. Ignored if pathfinderType is 'cli'
   * @return {Object} - maximum possible Circles value and transactions path
   */
  const findTransitiveTransfer = (account, userOptions) => {
    checkAccount(account);

    let fieldObject = {
      from: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      value: {
        type: ethers.BigNumber.isBigNumber,
      },
    };

    if (isPathfinderServer) {
      fieldObject.maxTransfers = {
        type: 'number',
        default: pathfinderMaxTransferSteps,
      };
    } else {
      fieldObject.hops = {
        type: 'number',
        default: 3,
      };
    }

    const options = checkOptions(userOptions, fieldObject);

    return _findTransitiveTransfer(options);
  };

  /**
   * List all available tokens of a Safe
   * @namespace core.token.listAllTokens
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @return {Object[]} - list of tokens formed by ownerAddress, address and amount
   */
  const listAllTokens = (account, userOptions) => {
    checkAccount(account);

    return utils.listAllTokens(userOptions);
  };

  /**
   * Request the UBI payout
   * @namespace core.token.requestUBIPayout
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Owner Safe address
   * @throws {CoreError} - Token does not exist
   * @return {RelayResponse} - gelato response
   */
  const requestUBIPayout = async (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    // Find out token address of this Safe
    const tokenAddress = await _getAddress(safeAddress);

    if (tokenAddress === ZERO_ADDRESS) {
      throw new CoreError(
        'Invalid Token address. Did you forget to deploy the Token?',
        ErrorCodes.TOKEN_NOT_FOUND,
      );
    }

    // Get Token contract
    const token = await getTokenContract(ethProvider, tokenAddress);

    return token.populateTransaction.update().then(({ data }) =>
      safe.sendTransaction(account, {
        safeAddress,
        transactionData: {
          to: tokenAddress,
          data,
        },
      }),
    );
  };

  /**
   * Transfer CRC from one Safe to another
   * @namespace core.token.transfer
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.from - sender address
   * @param {string} userOptions.to - receiver address
   * @param {BN} userOptions.value - value
   * @param {string} userOptions.paymentNote - optional payment note stored in API
   * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
   * @param {number} userOptions.maxTransfers - limit of steps returned by the pathfinder service. Ignored if pathfinderType is 'cli'
   * @throws {TransferError} - No possible transfer found
   * @throws {TransferError} - Too many transfer steps
   * @throws {TransferError} - Invalid transfer
   * @throws {CoreError} - Unknown error
   * @return {string} - transaction hash
   */
  const transfer = async (account, userOptions) => {
    checkAccount(account);

    let fieldObject = {
      from: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      value: {
        type: ethers.BigNumber.isBigNumber,
      },
      paymentNote: {
        type: 'string',
        default: '',
      },
    };

    if (isPathfinderServer) {
      fieldObject.maxTransfers = {
        type: 'number',
        default: pathfinderMaxTransferSteps,
      };
    } else {
      fieldObject.hops = {
        type: 'number',
        default: 3,
      };
    }

    const options = checkOptions(userOptions, fieldObject);
    const { from, to, value, paymentNote } = options;

    const tokenOwners = [];
    const sources = [];
    const destinations = [];
    const values = [];

    // Check if the transaction can be done directly between users, so there is no need to use the pathfinder.
    // Try first with the 'to' token as we want to prioritize returning tokens to their owners,
    // if not, try with the 'from' token. Both are supposed to be interchangeable
    if (await _canTransferDirectly({ from, to, value, token: to })) {
      tokenOwners.push(to);
      sources.push(from);
      destinations.push(to);
      values.push(value.toString());
    } else if (await _canTransferDirectly({ from, to, value, token: from })) {
      tokenOwners.push(from);
      sources.push(from);
      destinations.push(to);
      values.push(value.toString());
    } else {
      // The transaction cannot be done directly, we need to call the pathfinder to find a transitive path
      let response;

      try {
        response = await _findTransitiveTransfer(options);

        if (ethers.BigNumber.from(response.maxFlowValue).lt(value)) {
          throw new TransferError(
            'No possible transfer found',
            ErrorCodes.TRANSFER_NOT_FOUND,
            {
              ...options,
              response,
            },
          );
        }

        if (response.transferSteps.length > pathfinderMaxTransferSteps) {
          throw new TransferError(
            'Too many transfer steps',
            ErrorCodes.TOO_COMPLEX_TRANSFER,
            {
              ...options,
              response,
            },
          );
        }

        const targetProperty = isPathfinderServer
          ? 'token_owner'
          : 'tokenOwnerAddress';

        response.transferSteps.forEach((transaction) => {
          sources.push(transaction.from);
          destinations.push(transaction.to);
          values.push(transaction.value);
          tokenOwners.push(transaction[targetProperty]);
        });
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
    }

    const { receipt: { transactionHash } = {} } = await hub.populateTransaction
      .transferThrough(tokenOwners, sources, destinations, values)
      .then(({ data }) =>
        safe.sendTransaction(account, {
          safeAddress: from,
          transactionData: {
            to: hubAddress,
            data,
          },
        }),
      );

    // Store the transfer in the API if there is a paymentNote
    if (transactionHash && paymentNote.length > 0) {
      // If everything went well so far we can store the paymentNote in the API
      const signature = await account.signMessage(
        [from, to, transactionHash].join(''),
      );

      await utils.requestAPI({
        path: ['transfers'],
        method: 'PUT',
        data: {
          address: account.address,
          signature,
          data: {
            from,
            to,
            transactionHash,
            paymentNote,
          },
        },
      });
    }

    return transactionHash || null;
  };

  /**
   * Update the transitive transfer steps from someone to someone for an amount of Circles.
   * This method does not execute any real transactions
   * @namespace core.token.updateTransferSteps
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - search arguments
   * @param {string} userOptions.from - sender Safe address
   * @param {string} userOptions.to - receiver Safe address
   * @param {BN} userOptions.value - value for transactions path
   * @param {number} userOptions.hops - maximum number of trust hops away from them sending user inside the trust network for finding transaction steps
   * @throws {TransferError} - Unknown error
   * @return {boolean} - if steps are updated or not
   */
  const updateTransferSteps = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      from: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      value: {
        type: ethers.BigNumber.isBigNumber,
      },
      hops: {
        type: 'number',
        default: 3,
      },
    });

    return utils
      .requestAPI({
        path: ['transfers', 'update'],
        method: 'POST',
        data: {
          from: options.from,
          to: options.to,
          value: options.value.toString(),
          hops: options.hops.toString(),
        },
      })
      .then(({ data }) => data)
      .catch((error) => {
        throw new TransferError(error.message, ErrorCodes.UNKNOWN_ERROR);
      });
  };

  return {
    checkSendLimit,
    checkUBIPayout,
    deploy,
    findTransitiveTransfer,
    getAddress,
    getBalance,
    getPaymentNote,
    listAllTokens,
    requestUBIPayout,
    transfer,
    updateTransferSteps,
  };
}
