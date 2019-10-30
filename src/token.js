import Graph from 'js-graph-algorithms';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getTokenContract } from '~/common/getContracts';

const DEFAULT_TOKEN_NAME = 'Circles';

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
 * @param {BN} userOptions.amount - value of Circles tokens
 * @param {Object[]} userOptions.network - trust network connections
 *
 * @return {Object[]} - transaction steps
 */
export function findTransitiveTransactionPath(web3, userOptions) {
  const options = checkOptions(userOptions, {
    from: {
      type: web3.utils.checkAddressChecksum,
    },
    to: {
      type: web3.utils.checkAddressChecksum,
    },
    amount: {
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
    throw new Error('No nodes given in trust graph');
  }

  // Create graph with nodes labelled after
  // the given addresses in trust network
  const graph = new Graph.FlowNetwork(nodes.length);

  nodes.forEach((nodeAddress, index) => {
    graph.node(index).label = nodeAddress;
  });

  // Create weighted edges in the graph based
  // on trust connections and trust limits
  network.forEach(connection => {
    const { limit } = connection;
    const indexFrom = nodes.indexOf(connection.from);
    const indexTo = nodes.indexOf(connection.to);

    graph.addEdge(new Graph.FlowEdge(indexFrom, indexTo, limit));
  });

  // Find maximum flow paths in graph
  const indexSender = nodes.indexOf(options.from);
  const indexReceiver = nodes.indexOf(options.to);

  const maximumFlow = new Graph.FordFulkerson(
    graph,
    indexSender,
    indexReceiver,
  );

  if (options.amount.gt(new web3.utils.BN(maximumFlow.value))) {
    throw new Error('Could not find possible transaction path');
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
    adjacentNodes.forEach(adjNode => {
      // Calculate how much flow this adjacent node can give, we've
      // sorted them above by flow capacity to prioritize larger ones
      const flowNode =
        adjNode.flow - Math.max(0, adjNode.flow - flowRequiredLeft);
      flowRequiredLeft -= flowNode;

      const innerPath = traversePath(adjNode.v, flowNode, path);
      path.concat(innerPath);

      if (!adjNode.isVisited && flowNode > 0) {
        const amount = new web3.utils.BN(flowNode);

        path.push({
          from: nodes[adjNode.v],
          to: nodes[adjNode.w],
          amount,
        });
      }

      adjNode.isVisited = true;
    });

    graph.node(index).isInPath = true;

    return path;
  };

  return traversePath(indexReceiver, options.amount.toNumber());
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
    signup: async (account, userOptions) => {
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
     * @param {string} userOptions.safeAddress - address of Token owner
     * @param {string} userOptions.tokenAddress - address of particular Token
     *
     * @return {string} - Current balance
     */
    getBalance: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        tokenAddress: {
          type: web3.utils.checkAddressChecksum,
          // default: ZERO_ADDRESS, // @TODO: Later we won't need this, see below
        },
      });

      // @TODO: This is not checking and summarizing the balance
      // yet of all Tokens we own from Circles users. Right now
      // we are only getting the Balance of our own deployed Token.
      //
      // One way to achieve this in the future is to 1. Get all Token
      // addresses we own from the Caching Service 2. Query the balances
      // with some sort of "balanceOfThrough" method in the Token contract
      // by passing on an array of all Token addresses and receive a
      // summarized balance from this.

      const token = getTokenContract(web3, options.tokenAddress);

      return await token.methods.balanceOf(options.safeAddress).call();
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
      });

      // @TODO: Call Transaction Graph Service before for transitive transfers

      // @TODO: Remove as soon as we use the 'transferThrough' Hub method:
      const tokenAddress = await hub.methods.userToToken(options.from).call();
      const token = getTokenContract(web3, tokenAddress);

      // @TODO: Use 'transferThrough' on Hub instead:
      // const addresses = [options.to];
      // const txData = await hub.methods
      //   .transferThrough(addresses, options.value)
      //   .encodeABI();
      const txData = await token.methods
        .transfer(options.to, options.value.toString())
        .encodeABI();

      return await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: tokenAddress,
        txData,
      });
    },
  };
}
