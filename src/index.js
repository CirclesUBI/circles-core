import CoreError, {
  ErrorCodes,
  RequestError,
  TransferError,
} from '~/common/error';

import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';

import createActivityModule from '~/activity';
import createOrganizationModule from '~/organization';
import createSafeModule from '~/safe_v2';
import createTokenModule from '~/token';
import createTrustModule from '~/trust';
import createUserModule from '~/user';
import createUtilsModule from '~/utils';
//import createTransactionsModule from '~/transactions';

/**
 * Base class of CirclesCore.
 */
export default class CirclesCore {
  /**
   * Create new CirclesCore instance to interact with Circles.
   *
   * @param {Web3} web3 - instance of Web3
   * @param {Object} options - global core options
   * @param {string} options.apiServiceEndpoint - URL of the username resolver service
   * @param {string} options.databaseSource - database source type
   * @param {string} options.graphNodeEndpoint - URL of the graph node
   * @param {string} options.hubAddress - address of deployed Circles Hub contract
   * @param {string} options.proxyFactoryAddress - address of deployed Gnosis ProxyFactory contract
   * @param {string} options.relayServiceEndpoint - address of deployed Gnosis ProxyFactory contract
   * @param {string} options.multiSendAddress - address of deployed Gnosis Multisend contract
   * @param {string} options.multiSendCallAddress -  address of deployed Gnosis MultisendCall contract
   * @param {string} options.safeMasterAddress - address of deployed Gnosis Safe master copy contract
   */
  constructor(web3, options) {
    // Check web3 instance
    if (!web3 || !web3.version) {
      throw new CoreError('Web3 instance missing');
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
      multiSendAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      multiSendCallAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      graphNodeEndpoint: {
        type: 'string',
      },
      databaseSource: {
        type: 'string',
        default: 'graph',
      },
      apiServiceEndpoint: {
        type: 'string',
      },
      relayServiceEndpoint: {
        type: 'string',
      },
      subgraphName: {
        type: 'string',
      },
    });

    // Expose error classes and constants
    /** @type {Error} - main error class */
    this.CoreError = CoreError;
    /** @type {Error} - transfer error class */
    this.TransferError = TransferError;
    /** @type {Error} - network request error class */
    this.RequestError = RequestError;
    /** @type {Object} - error code constants */
    this.ErrorCodes = ErrorCodes;

    // Create contracts once
    /** @type {Object} - smart contract instances */
    this.contracts = getContracts(web3, this.options);

    // Create common utils for submodules
    /** @type {Object} - utils module */
    this.utils = createUtilsModule(web3, this.contracts, this.options);

    // Create submodules and pass utils and options to them
    /** @type {Object} - activity module */
    this.activity = createActivityModule(web3, this.contracts, this.utils);
    /** @type {Object} - organization module */
    this.organization = createOrganizationModule(
      web3,
      this.contracts,
      this.utils,
    );
    /** @type {Object} - safe module */
    this.safe = createSafeModule(web3, this.options);
    /** @type {Object} - token module */
    this.token = createTokenModule(web3, this.contracts, this.utils);
    /** @type {Object} - trust module */
    this.trust = createTrustModule(web3, this.contracts, this.utils);
    /** @type {Object} - user module */
    this.user = createUserModule(web3, this.contracts, this.utils);
    /** @type {Object} - transactions module */
    //    this.transactions = createTransactionsModule(web3, this.contracts);
  }
}
