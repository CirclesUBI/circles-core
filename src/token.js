import { ZERO_ADDRESS } from '~/common/constants';

import CoreError, { ErrorCodes } from '~/common/error';
import MaxFlow, { FlowEdge, FlowNetwork } from '~/common/maxFlow';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

const DEFAULT_TOKEN_NAME = 'Circles';
const DEFAULT_TRUST_NETWORK_HOPS = 4;

/**
 * Gather data from the graph node to get all information we need
 * for transitive transactions.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} utils - core utils
 * @param {Object} userOptions - arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {number} userOptions.networkHops - max number of network hops
 *
 * @return {Object[]} - traversable trust network
 */
export async function getNetwork(web3, utils, userOptions) {
  const options = checkOptions(userOptions, {
    from: {
      type: web3.utils.checkAddressChecksum,
    },
    to: {
      type: web3.utils.checkAddressChecksum,
    },
    networkHops: {
      type: 'number',
      default: DEFAULT_TRUST_NETWORK_HOPS,
    },
  });

  // Methods to parse the data we get to break all down into
  // given safe addresses, the tokens they own, the trust connections
  // they have between each other and finally a list of all tokens
  const connections = [];
  const safes = [];
  const tokens = [];

  const findToken = tokenAddress => {
    return tokens.find(node => node.address === tokenAddress);
  };

  const findSafe = safeAddress => {
    return safes.find(node => node.address === safeAddress);
  };

  const findConnection = (from, to) => {
    return connections.find(edge => edge.from === from && edge.to === to);
  };

  const addConnection = (from, to, limit, limitPercentage) => {
    connections.push({
      from,
      limit,
      limitPercentage,
      to,
    });
  };

  const addConnections = connections => {
    connections.forEach(connection => {
      const from = web3.utils.toChecksumAddress(connection.from.id);
      const to = web3.utils.toChecksumAddress(connection.to.id);
      const { limit, limitPercentage } = connection;

      if (!findConnection(from, to)) {
        addConnection(from, to, limit, limitPercentage);
      }
    });
  };

  const addToken = (address, safeAddress) => {
    tokens.push({
      address,
      safeAddress,
    });
  };

  const addSafe = (safeAddress, balances) => {
    const safe = balances.reduce(
      (acc, { token, amount }) => {
        const tokenAddress = web3.utils.toChecksumAddress(token.id);
        const tokenSafeAddress = web3.utils.toChecksumAddress(token.owner.id);

        acc.tokens.push({
          address: tokenAddress,
          balance: new web3.utils.BN(amount),
        });

        if (!findToken(tokenAddress)) {
          addToken(tokenAddress, tokenSafeAddress);
        }

        addConnections(token.owner.trusts);
        addConnections(token.owner.isTrustedBy);

        return acc;
      },
      {
        address: web3.utils.toChecksumAddress(safeAddress),
        tokens: [],
      },
    );

    safes.push(safe);
  };

  // Get trust network information from the graph node
  const requestSafe = async safeAddress => {
    const safeQuery = `{
      limit
      limitPercentage
      from { id }
      to { id }
    }`;

    const response = await utils.requestGraph({
      query: `{
        safe(id: "${safeAddress.toLowerCase()}") {
          trusts ${safeQuery}
          isTrustedBy ${safeQuery}
          balances {
            amount
            token {
              id
              owner {
                id
                trusts ${safeQuery}
                isTrustedBy ${safeQuery}
              }
            }
          }
        }
      }`,
    });

    if (!response.safe) {
      throw new CoreError(
        `Could not find Safe with address ${safeAddress}`,
        ErrorCodes.SAFE_NOT_FOUND,
      );
    }

    // Parse all received data when we haven't done this yet
    if (!findSafe(safeAddress)) {
      addSafe(safeAddress, response.safe.balances);

      addConnections(response.safe.trusts);
      addConnections(response.safe.isTrustedBy);
    }
  };

  // Go through network until we found the
  // receiver node or reached the limit of hops
  let isReceiverFound = false;

  const requestedSafeAddresses = {};

  const hop = async (queue = [], currentHopIndex = 0) => {
    // Process the next batch of requests to be made
    queue.forEach(safeAddress => {
      requestedSafeAddresses[safeAddress] = true;
    });

    await Promise.all(
      queue.map(safeAddress => {
        // Did we reach the final receiver node?
        if (safeAddress === options.to) {
          isReceiverFound = true;
        }

        return requestSafe(safeAddress);
      }),
    );

    //  Add more requests to queue when possible
    if (!isReceiverFound && currentHopIndex < options.networkHops) {
      const newQueue = connections.reduce((acc, connection) => {
        if (!requestedSafeAddresses[connection.from]) {
          acc.push(connection.from);
          requestedSafeAddresses[connection.from] = true;
        }

        if (!requestedSafeAddresses[connection.to]) {
          acc.push(connection.to);
          requestedSafeAddresses[connection.to] = true;
        }

        return acc;
      }, []);

      // .. explore the trust network a little more
      return await hop(newQueue, currentHopIndex + 1);
    }
  };

  // Start exploring the trust network
  await hop([options.from]);

  if (!isReceiverFound) {
    throw new CoreError(
      'Receiver is not in reach within senders trust network',
      ErrorCodes.NETWORK_TOO_SMALL,
    );
  }

  // Find tokens for each connection we can actually use
  // for transitive transactions
  return connections.reduce((acc, connection) => {
    const senderSafeAddress = connection.from;
    const receiverSafeAddress = connection.to;

    // Ignore connections where we trust ourselves
    if (senderSafeAddress === receiverSafeAddress) {
      return acc;
    }

    // Get the receivers Safe
    const receiverSafe = findSafe(receiverSafeAddress);

    if (!receiverSafe) {
      return acc;
    }

    // Get tokens the sender owns
    const receiverTokens = receiverSafe.tokens;

    // Which of them are trusted by the receiving node?
    const trustedTokens = receiverTokens.reduce((tokenAcc, receiverToken) => {
      const token = findToken(receiverToken.address);

      const tokenConnection = connections.find(trustConnection => {
        const limit = web3.utils.BN.min(
          web3.utils.toBN(trustConnection.limit),
          web3.utils.toBN(receiverToken.balance),
        );

        return (
          trustConnection.from === senderSafeAddress &&
          trustConnection.to === token.safeAddress &&
          limit !== '0'
        );
      });

      if (tokenConnection) {
        // @TODO: We can do this better ..
        const limit = web3.utils.BN.min(
          web3.utils.toBN(tokenConnection.limit),
          web3.utils.toBN(receiverToken.balance),
        );

        tokenAcc.push({
          limit,
          limitPercentage: tokenConnection.limitPercentage,
          tokenOwnerAddress: token.safeAddress,
        });
      }

      return tokenAcc;
    }, []);

    // `from` and `to` are flipped here as a
    // trust direction is the reverse of a
    // transfer direction!
    trustedTokens.forEach(token => {
      acc.push({
        from: receiverSafeAddress,
        to: senderSafeAddress,
        limit: token.limit,
        limitPercentage: token.limitPercentage,
        tokenOwnerAddress: token.tokenOwnerAddress,
      });
    });

    return acc;
  }, []);
}

/**
 * Find at least one (or more) paths through a trust graph
 * from someone to someone else to transitively
 * send an amount of Circles.
 *
 * This algorithm makes use of the Ford-Fulkerson method which
 * computes the maximum flow in a network.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} userOptions - search arguments
 * @param {string} userOptions.from - sender Safe address
 * @param {string} userOptions.to - receiver Safe address
 * @param {BN} userOptions.value - value of Circles tokens
 * @param {Object[]} userOptions.network - trust network connections
 *
 * @return {Object[]} - transaction steps
 */
export function findTransitiveTransactions(web3, utils, userOptions) {
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
    network: {
      type: 'array',
    },
  });

  const { network } = options;

  // Find unique addresses in trust network
  // and define them as nodes in the graph
  const nodes = network.reduce((acc, edge) => {
    if (!acc.includes(edge.from)) {
      acc.push(edge.from);
    }

    if (!acc.includes(edge.to)) {
      acc.push(edge.to);
    }

    return acc;
  }, []);

  if (nodes.length === 0) {
    throw new CoreError(
      'No nodes given in trust graph',
      ErrorCodes.NETWORK_TOO_SMALL,
    );
  }

  // Create graph with nodes labelled after
  // the given addresses in trust network
  const graph = new FlowNetwork(nodes.length);

  // Create weighted edges in the graph based
  // on trust connections and flow limits
  network.forEach(connection => {
    const flow = utils.fromFreckles(connection.limit);
    const indexFrom = nodes.indexOf(connection.from);
    const indexTo = nodes.indexOf(connection.to);

    const edge = new FlowEdge(indexFrom, indexTo, flow);
    edge.tokenOwnerAddress = connection.tokenOwnerAddress;

    graph.addEdge(edge);
  });

  // Find maximum flow paths in graph
  const indexSender = nodes.indexOf(options.from);
  const indexReceiver = nodes.indexOf(options.to);

  const maximumFlow = new MaxFlow(graph, indexSender, indexReceiver);
  const maximumFlowWei = new web3.utils.BN(utils.toFreckles(maximumFlow.value));

  if (options.value.gt(maximumFlowWei)) {
    throw new CoreError(
      'Could not find possible transaction path',
      ErrorCodes.NETWORK_NO_PATH,
    );
  }

  // We found a possible way! Traverse flow graph backwards
  // to find out in which order transactions should take place
  const traversePath = (index, flowRequired, path = []) => {
    // Filter out unneeded nodes and sort them by flow capacity
    const adjacentNodes = graph
      .adj(index)
      .reduce((acc, adjNode) => {
        // Does our path already contain this?
        if (adjNode.isInPath) {
          return acc;
        }

        // Is this edge starting at current node?
        if (adjNode.w !== index) {
          return acc;
        }

        // Do we actually send any Tokens?
        if (adjNode.flow === 0) {
          return acc;
        }

        acc.push(adjNode);

        return acc;
      }, [])
      .sort((nodeA, nodeB) => {
        return nodeB.flow - nodeA.flow;
      });

    // Set the required flow for this node
    // (we usually don't need the maximum)
    let flowRequiredLeft = flowRequired;

    // We recursively look for adjacent nodes until there are none
    adjacentNodes.forEach(edge => {
      // Calculate how much flow this adjacent node can give, we've
      // sorted them above by flow capacity to prioritize larger ones
      const edgeFlow = edge.flow - Math.max(0, edge.flow - flowRequiredLeft);
      flowRequiredLeft -= edgeFlow;

      const innerPath = traversePath(edge.v, edgeFlow, path);
      path.concat(innerPath);

      if (!edge.isVisited && edgeFlow > 0) {
        const value = new web3.utils.BN(utils.toFreckles(edgeFlow));

        path.push({
          from: nodes[edge.v],
          to: nodes[edge.w],
          tokenOwnerAddress: edge.tokenOwnerAddress,
          value,
        });
      }

      edge.isVisited = true;
    });

    graph.node(index).isInPath = true;

    return path;
  };

  return traversePath(indexReceiver, utils.fromFreckles(options.value));
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
     * Deploy new Circles Token for a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owner of the Token
     * @param {string} userOptions.tokenName - Optional token name
     *
     * @return {string} - transaction hash
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        tokenName: {
          type: 'string',
          default: DEFAULT_TOKEN_NAME,
        },
      });

      const txData = await hub.methods.signup(options.tokenName).encodeABI();

      // Call method and return result
      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Get Token address by passing on owner address.
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
     * Get summarized balance of all or one Token
     * owned by a user.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - safe address
     * @param {string} userOptions.tokenAddress - optional token address in case only this one should be checked
     *
     * @return {BN} - Current balance
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
              amount
            }
          }
        }`,
      });

      if (!response.safe) {
        throw new CoreError(
          `Could not find Safe with address ${safeAddress}`,
          ErrorCodes.SAFE_NOT_FOUND,
        );
      }

      // Return only the balance of a particular token
      if (tokenAddress !== ZERO_ADDRESS) {
        const token = response.safe.balances.find(item => {
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
     * Transfer Circles from one user to another.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.from - sender address
     * @param {string} userOptions.to - receiver address
     * @param {BN} userOptions.value - value
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
        networkHops: {
          type: 'number',
          default: DEFAULT_TRUST_NETWORK_HOPS,
        },
      });

      // Get trust network
      const network = await getNetwork(web3, utils, options);

      // Calculate transactions for transitive payment
      const transactions = findTransitiveTransactions(web3, utils, {
        ...options,
        network,
      });

      // Convert connections to contract argument format
      const transfer = transactions.reduce(
        (acc, transaction) => {
          // Convert to Smart Contract method format
          acc.tokenOwners.push(transaction.tokenOwnerAddress);
          acc.sources.push(transaction.from);
          acc.destinations.push(transaction.to);
          acc.values.push(transaction.value.toString());

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

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });
    },
  };
}
