import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';

import createSafeModule from '~/safe';
import createUtilsModule from '~/utils';

const DEFAULT_GAS_LIMIT = 10000;

/**
 * Base class of CirclesCore.
 */
export default class CirclesCore {
  /**
   * Create new CirclesCore instance to interact with Circles.
   *
   * @param {Web3} web3 - instance of Web3
   * @param {Object} options - global core options
   * @param {number} options.gas - gas limit
   * @param {string} options.hubAddress - address of deployed Circles Hub contract
   * @param {string} options.proxyFactoryAddress - address of deployed Gnosis ProxyFactory contract
   * @param {string} options.safeMasterAddress - address of deployed Gnosis Safe master copy contract
   * @param {string} options.relayServiceEndpoint - URL of the Relayer Server
   */
  constructor(web3, options) {
    // Check web3 instance
    if (!web3) {
      throw new Error('Web3 instance missing');
    }

    /** @type {Web3} - instance of Web3 */
    this.web3 = web3;

    // Check options
    /** @type {Object} - global core options */
    this.options = checkOptions(options, {
      gas: {
        type: 'number',
        default: DEFAULT_GAS_LIMIT,
      },
      hubAddress: {
        type: web3.utils.isHexStrict,
      },
      proxyFactoryAddress: {
        type: web3.utils.isHexStrict,
      },
      safeMasterAddress: {
        type: web3.utils.isHexStrict,
      },
      relayServiceEndpoint: {
        type: 'string',
      },
    });

    // Create contracts once
    /** @type {Object} - smart contract instances */
    this.contracts = getContracts(web3, this.options);

    // Create common utils for submodules
    /** @type {Object} - utils module */
    this.utils = createUtilsModule(web3, this.contracts, this.options);

    // Create submodules and pass utils and options to them
    /** @type {Object} - safe module */
    this.safe = createSafeModule(web3, this.contracts, this.utils);
  }
}
