import CoreError, {
  ErrorCodes,
  RequestError,
  TransferError,
} from '~/common/error';

import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';
import checkAddressChecksum from '~/common/checkAddressChecksum';

import createActivityModule from '~/activity';
import createNewsModule from '~/news';
import createOrganizationModule from '~/organization';
import createSafeModule from '~/safe';
import createTokenModule from '~/token';
import createTrustModule from '~/trust';
import createUserModule from '~/user';
import createUtilsModule from '~/utils';

/**
 * Base class of CirclesCore
 */
export default class CirclesCore {
  /**
   * Create new CirclesCore instance to interact with Circles
   * @param {BaseProvider} ethProvider - instance of Ethers BaseProvider
   * @param {Object} options - global core options
   * @param {string} options.apiServiceEndpoint - URL of the username resolver service
   * @param {string} options.pathfinderServiceEndpoint - URL of the pathfinder service
   * @param {string} options.pathfinderType - Type of pathfinder used to get transfer steps ("cli" or "server")
   * @param {string} options.databaseSource - database source type
   * @param {string} options.fallbackHandlerAddress - address of the fallback handler of the Safe contract
   * @param {string} options.multiSendAddress - address of the multi send Safe contract
   * @param {string} options.multiSendCallOnlyAddress - address of the multi send call Safe contract
   * @param {string} options.graphNodeEndpoint - URL of the graph node
   * @param {string} options.hubAddress - address of deployed Circles Hub contract
   * @param {string} options.proxyFactoryAddress - address of deployed Gnosis ProxyFactory contract
   * @param {string} options.relayServiceEndpoint - URL of the Relayer server
   * @param {string} options.safeMasterAddress - address of deployed Gnosis Safe master copy contract
   * @param {string} options.subgraphName - name of the subgraph used
   * @param {number} options.pathfinderMaxTransferSteps - max allowed steps for transitive pathfinding
   */
  constructor(ethProvider, options) {
    // Check ethProvider instance
    if (!ethProvider) {
      throw new CoreError('Ethers BaseProvider instance missing');
    }

    /** @type {BaseProvider} - instance of Ethers BaseProvider */
    this.ethProvider = ethProvider;

    // Check options
    /** @type {Object} - global core options */
    this.options = checkOptions(options, {
      hubAddress: {
        type: checkAddressChecksum,
      },
      proxyFactoryAddress: {
        type: checkAddressChecksum,
      },
      safeMasterAddress: {
        type: checkAddressChecksum,
      },
      fallbackHandlerAddress: {
        type: checkAddressChecksum,
      },
      multiSendAddress: {
        type: checkAddressChecksum,
      },
      multiSendCallOnlyAddress: {
        type: checkAddressChecksum,
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
      pathfinderServiceEndpoint: {
        type: 'string',
      },
      relayServiceEndpoint: {
        type: 'string',
      },
      subgraphName: {
        type: 'string',
      },
      pathfinderType: {
        type: 'string',
        default: 'server',
      },
      pathfinderMaxTransferSteps: {
        type: 'number',
        /* Due to block gas limit of 12.500.000 a transitive transaction can have a
         * limited number of steps. The limit below gives a 50% buffer between the
         * gas estimate and the block gas limit.
         * For more information, see the Circles handbook.
         */
        default: 30,
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
    this.contracts = getContracts(ethProvider, this.options);

    // Create modules
    /** @type {Object} - utils module */
    this.utils = createUtilsModule(this);
    /** @type {Object} - activity module */
    this.activity = createActivityModule(this);
    /** @type {Object} - safe module */
    this.safe = createSafeModule(this);
    /** @type {Object} - trust module */
    this.trust = createTrustModule(this);
    /** @type {Object} - token module */
    this.token = createTokenModule(this);
    /** @type {Object} - user module */
    this.user = createUserModule(this);
    /** @type {Object} - organization module */
    this.organization = createOrganizationModule(this);
    /** @type {Object} - news module */
    this.news = createNewsModule(this.utils);
  }
}
