import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';

import createSafeModule from '~/safe';
import createTrustModule from '~/trust';
import createUbiModule from '~/ubi';
import createUserModule from '~/user';
import createUtilsModule from '~/utils';

/**
 * Base class of CirclesCore.
 */
export default class CirclesCore {
  /**
   * Create new CirclesCore instance to interact with Circles.
   *
   * @param {Web3} web3 - instance of Web3
   * @param {Object} options - global core options
   * @param {string} options.hubAddress - address of deployed Circles Hub contract
   * @param {string} options.proxyFactoryAddress - address of deployed Gnosis ProxyFactory contract
   * @param {string} options.safeMasterAddress - address of deployed Gnosis Safe master copy contract
   * @param {string} options.usernameServiceEndpoint - URL of the username resolver service
   * @param {string} options.relayServiceEndpoint - URL of the Relayer server
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
      hubAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      proxyFactoryAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      safeMasterAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      usernameServiceEndpoint: {
        type: 'string',
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
    this.trust = createTrustModule(web3, this.contracts, this.utils);
    this.ubi = createUbiModule(web3, this.contracts, this.utils);
    this.user = createUserModule(web3, this.utils);
  }
}
