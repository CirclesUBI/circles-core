import Safe, {
  getSafeContract as _getSafeContract,
  SafeFactory,
  Web3Adapter,
} from '@safe-global/protocol-kit';

import { SAFE_LAST_VERSION, ZERO_ADDRESS } from '~/common/constants';
import { SafeAlreadyDeployedError, SafeNotTrustError } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeCRCVersionContract } from '~/common/getContracts';
import loop from '~/common/loop';
import safeContractAbis from '~/common/safeContractAbis';

/**
 * Module to manage Gnosis Safes
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Safe module instance
 */
export default function createSafeModule({
  web3,
  contracts: { safeMaster, proxyFactory },
  trust,
  utils,
  options: {
    proxyFactoryAddress,
    safeMasterAddress,
    fallbackHandlerAddress,
    multiSendAddress,
    multiSendCallOnlyAddress,
  },
}) {
  /**
   * Custom contracts configuration
   * @access private
   * @type {ContractNetworkConfig}
   */
  const _customContracts = {
    safeMasterCopyAddress: safeMasterAddress,
    safeProxyFactoryAddress: proxyFactoryAddress,
    fallbackHandlerAddress: fallbackHandlerAddress,
    multiSendAddress,
    multiSendCallOnlyAddress,
    ...safeContractAbis,
  };

  /**
   * Prepare the contract networks data for the safe-core-sdk
   * @access private
   * @return {ContractNetworksConfig} - contract networks data
   */
  const _getContractNetworks = () =>
    web3.eth.getChainId().then((chainId) => ({
      [chainId]: _customContracts,
    }));

  /**
   * Create the ethAdapter for the safe-core-sdk
   * @access private
   * @param {string} signerAddress - Address of the transactions signer
   * @return {Web3Adapter} - ethAdapter
   */
  const _createEthAdapter = (signerAddress) =>
    new Web3Adapter({ web3, signerAddress });

  /**
   * Create a Safe factory
   * @access private
   * @param {string} signerAddress - Address of the transactions signer
   * @return {SafeFactory} - Safe factory
   */
  const _createSafeFactory = (signerAddress) =>
    _getContractNetworks().then((contractNetworks) =>
      SafeFactory.create({
        ethAdapter: _createEthAdapter(signerAddress),
        contractNetworks,
      }),
    );

  /**
   * Instantiate a Safe
   * @access private
   * @param {Object} config - options
   * @param {string} config.signerAddress - Address of a signer for transactions if needed
   * @param {SafeConfig} config.params - Params to overwrite the Safe.create method
   * @return {Safe} - Instance of a Safe
   */
  const _getSafeSdk = ({ signerAddress, ...params }) =>
    _getContractNetworks().then((contractNetworks) =>
      Safe.create({
        ethAdapter: _createEthAdapter(signerAddress),
        contractNetworks,
        ...params,
      }),
    );

  /**
   * Prepare a Safe transaction to be funded. The transaction is signed and then encoded
   * @access private
   * @param {Safe} config.safeSdk - Safe instance
   * @param {SafeTransaction} config.SafeTx - Params to overwrite the Safe.create method
   * @param {string} config.signerAddress - Address of the transactions signer for the adapter
   * @return {string} - Encoded signed transaction
   */
  const _prepareSafeTransaction = async ({ safeSdk, safeTx, signerAddress }) =>
    Promise.all([
      _getSafeContract({
        ethAdapter: _createEthAdapter(signerAddress),
        safeVersion: await safeSdk.getContractVersion(),
        customContracts: _customContracts,
      }),
      safeSdk.signTransaction(safeTx),
    ]).then(([safeSingletonContract, signedSafeTx]) =>
      safeSingletonContract.encode('execTransaction', [
        signedSafeTx.data.to,
        signedSafeTx.data.value,
        signedSafeTx.data.data,
        signedSafeTx.data.operation,
        signedSafeTx.data.safeTxGas,
        signedSafeTx.data.baseGas,
        signedSafeTx.data.gasPrice,
        signedSafeTx.data.gasToken,
        signedSafeTx.data.refundReceiver,
        signedSafeTx.encodedSignatures(),
      ]),
    );

  /**
   * Create the data needed to send a Safe transaction
   * @access private
   * @param {Object} options - options
   * @param {string} options.safeAddress - Safe address
   * @param {string} options.signerAddress - Safe owner address
   * @param {string} options.data - Transaction data to be sent
   * @return {string} - Encoded and signed transaction data
   */
  const _createTransaction = async ({ safeAddress, signerAddress, data }) => {
    const safeSdk = await _getSafeSdk({
      safeAddress,
      signerAddress,
    });

    return safeSdk
      .createTransaction({
        safeTransactionData: {
          to: safeAddress,
          value: 0,
          data,
        },
      })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeTx,
          safeSdk,
          signerAddress,
        }),
      );
  };

  /**
   * Predict a Safe address
   * @access private
   * @param {string} ownerAddress - Safe owner address
   * @param {number} nonce - Safe saltNonce for deterministic address generation
   * @return {string} - predicted Safe address
   */
  const _predictAddress = (ownerAddress, nonce) =>
    _createSafeFactory(ownerAddress).then((safeFactory) =>
      safeFactory.predictSafeAddress(
        {
          owners: [ownerAddress],
          threshold: 1,
        },
        nonce,
      ),
    );

  /**
   * Check if a Safe address is deployed
   * @access private
   * @param {string} safeAddress - Safe address
   * @return {boolean} - if Safe is deployed
   */
  const _isDeployed = (safeAddress) =>
    _createEthAdapter().isContractDeployed(safeAddress);

  /**
   * Get Safe version
   * @access private
   * @param {string} safeAddress
   * @return {string} - version of the Safe
   */
  const _getVersion = (safeAddress) =>
    _getSafeSdk({ safeAddress }).then((safeSdk) =>
      safeSdk.getContractVersion(),
    );

  /**
   * Add an owner to a Safe
   * @namespace core.safe.addOwner
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.ownerAddress - owner address to be added
   * @return {RelayResponse} - transaction response
   */
  const addOwner = async (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress, ownerAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      ownerAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    const safeSdk = await _getSafeSdk({
      safeAddress,
      signerAddress: account.address,
    });

    return safeSdk
      .createAddOwnerTx({ ownerAddress })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeTx,
          safeSdk,
          signerAddress: account.address,
        }),
      )
      .then((data) =>
        utils.sendTransaction({
          target: safeAddress,
          data,
        }),
      );
  };

  /**
   * Create the data needed to send a Safe transaction
   * @namespace core.safe.createTransaction
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.data - Transaction data to be sent
   * @return {string} - Encoded and signed transaction data
   */
  const createTransaction = (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress, data } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      data: {
        type: 'string',
      },
    });

    return _createTransaction({
      safeAddress,
      signerAddress: account.address,
      data,
    });
  };

  /**
   * Deploy a new Safe
   * @namespace core.safe.deploySafe
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.nonce - nonce to predict address
   * @throws {SafeAlreadyDeployedError} - Safe must not exist
   * @throws {SafeNotTrustError} - Safe must be trusted
   * @return {string} - Safe address
   */
  const deploySafe = async (account, userOptions) => {
    checkAccount(web3, account);

    const { nonce } = checkOptions(userOptions, {
      nonce: {
        type: 'number',
      },
    });

    const safeAddress = await _predictAddress(account.address, nonce);
    const isSafeDeployed = await _isDeployed(safeAddress);

    if (isSafeDeployed) {
      throw new SafeAlreadyDeployedError(
        `Safe with nonce ${nonce} is already deployed.`,
      );
    }

    const { isTrusted } = await trust.isTrusted(account, {
      safeAddress,
    });

    if (!isTrusted) {
      throw new SafeNotTrustError(`The Safe has no minimun required trusts.`);
    }

    const initializer = safeMaster.methods
      .setup(
        [account.address],
        1,
        ZERO_ADDRESS,
        '0x',
        fallbackHandlerAddress,
        ZERO_ADDRESS,
        0,
        ZERO_ADDRESS,
      )
      .encodeABI();
    const data = proxyFactory.methods
      .createProxyWithNonce(safeMasterAddress, initializer, nonce)
      .encodeABI();

    await utils.sendTransaction({
      target: proxyFactoryAddress,
      data,
    });

    return safeAddress;
  };

  /**
   * List all Safe addresses of an owner
   * @namespace core.safe.getAddresses
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.ownerAddress - Safe owner address
   * @return {string[]} - List of Safe addresses
   */
  const getAddresses = (account, userOptions) => {
    checkAccount(web3, account);

    const options = checkOptions(userOptions, {
      ownerAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return utils
      .requestIndexedDB('safe_addresses', options)
      .then((response) =>
        response && response.user
          ? response.user.safeAddresses.map((address) =>
              web3.utils.toChecksumAddress(address),
            )
          : [],
      );
  };

  /**
   * Get all Safe owners
   * @namespace core.safe.getOwners
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string[]} - list of owner addresses
   */
  const getOwners = (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return _getSafeSdk({ safeAddress }).then((safeSdk) => safeSdk.getOwners());
  };

  /**
   * Instantiate a Safe
   * @namespace core.safe.getSafeSdk
   * @param {Object} account - web3 account instance
   * @param {SafeConfig} userOptions - Params to overwrite the Safe.create method
   * @return {Safe} - Instance of a Safe
   */
  const getSafeSdk = (account, userOptions) => {
    checkAccount(web3, account);

    return _getSafeSdk({ signerAddress: account.address, ...userOptions });
  };

  /**
   * Get Safe version
   * @namespace core.safe.getVersion
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string} - Safe version
   */
  const getVersion = (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return _getVersion(safeAddress);
  };

  /**
   * Check if a Safe address is deployed
   * @namespace core.safe.isDeployed
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {boolean} - if Safe is deployed
   */
  const isDeployed = (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return _isDeployed(safeAddress);
  };

  /**
   * Predict a Safe address
   * @namespace core.safe.predictAddress
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.nonce - nonce to predict address
   * @return {string} - predicted Safe address
   */
  const predictAddress = async (account, userOptions) => {
    checkAccount(web3, account);

    const { nonce } = checkOptions(userOptions, {
      nonce: {
        type: 'number',
      },
    });

    return _predictAddress(account.address, nonce);
  };

  /**
   * Remove an owner from a Safe
   * @namespace core.safe.removeOwner
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.ownerAddress - owner address to be removed
   * @return {RelayResponse} - transaction response
   */
  const removeOwner = async (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress, ownerAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
      ownerAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    const safeSdk = await _getSafeSdk({
      safeAddress,
      signerAddress: account.address,
    });

    return safeSdk
      .createRemoveOwnerTx({
        ownerAddress,
        threshold: await safeSdk.getThreshold(),
      })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeTx,
          safeSdk,
          signerAddress: account.address,
        }),
      )
      .then((data) =>
        utils.sendTransaction({
          target: safeAddress,
          data,
        }),
      );
  };

  /**
   * Update Safe version to the last version (v1.3.0) by
   * changing the Master Copy and setting the Fallback Handler
   * @namespace core.safe.updateToLastVersion
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string} - Safe version
   */
  const updateToLastVersion = async (account, userOptions) => {
    checkAccount(web3, account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });
    let safeVersion = await _getVersion(safeAddress);

    if (safeVersion !== SAFE_LAST_VERSION) {
      // References:
      // https://github.com/safe-global/web-core/blob/main/src/services/tx/safeUpdateParams.ts
      // https://github.com/safe-global/safe-react/blob/main/src/logic/safe/utils/upgradeSafe.ts

      // Get the Safe contract with version v1.1.1+Circles
      const safeInstance = getSafeCRCVersionContract(web3, safeAddress);

      // First we change the Master Copy to v1.3.0
      // @ts-expect-error this was removed in 1.3.0 but we need to support it for older safe versions
      await utils.sendTransaction({
        target: safeAddress,
        data: await _createTransaction({
          safeAddress,
          signerAddress: account.address,
          data: safeInstance.methods
            .changeMasterCopy(safeMaster.options.address)
            .encodeABI(),
        }),
      });

      await utils.sendTransaction({
        target: safeAddress,
        data: await _createTransaction({
          safeAddress,
          signerAddress: account.address,
          data: safeInstance.methods
            .setFallbackHandler(fallbackHandlerAddress)
            .encodeABI(),
        }),
      });

      // Wait to check that the version is updated
      safeVersion = await loop(
        () => _getVersion(safeAddress),
        (version) => version === SAFE_LAST_VERSION,
        { label: 'Waiting for CRC Safe to upgrade version' },
      );
    }

    return safeVersion;
  };

  // TODO: this method is missing to be implemented because it will be moved and replaced into organization.js.
  // Makes more sense to have it there.
  /**
   * Requests the relayer to deploy a Safe for an organization. The relayer
   * funds the deployment of this Safe when the account is already known and
   * verified / already has a deployed Safe from before.
   *
   * @namespace core.safe.deployForOrganization
   *
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.safeAddress - to-be-deployed Safe address
   *
   * @return {boolean} - returns true when successful
   */
  const deployForOrganization = async (account, userOptions) => {
    checkAccount(web3, account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    await utils.requestRelayer({
      path: ['safes', options.safeAddress, 'organization'],
      version: 2,
      method: 'PUT',
    });

    return true;
  };

  return {
    addOwner,
    createTransaction,
    deployForOrganization,
    deploySafe,
    getAddresses,
    getOwners,
    getSafeSdk,
    getVersion,
    isDeployed,
    predictAddress,
    removeOwner,
    updateToLastVersion,
  };
}
