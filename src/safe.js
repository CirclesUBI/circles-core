import { ethers } from 'ethers';
import { Logger } from 'ethers/lib/utils';
import Safe, { SafeFactory, EthersAdapter } from '@safe-global/protocol-kit';

import {
  DEFAULT_TRUST_LIMIT,
  SAFE_LAST_VERSION,
  ZERO_ADDRESS,
} from '~/common/constants';
import { SafeAlreadyDeployedError, SafeNotTrustError } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeCRCVersionContract } from '~/common/getContracts';
import { getSafeContract } from '~/common/getContracts';

/**
 * Module to manage safes
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Safe module instance
 */
export default function createSafeModule({
  ethProvider,
  contracts: { safeMaster, proxyFactory },
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
  };

  /**
   * Prepare the contract networks data for the safe-core-sdk
   * @access private
   * @return {ContractNetworksConfig} - contract networks data
   */
  const _getContractNetworks = () =>
    ethProvider.getNetwork().then(({ chainId }) => ({
      [chainId]: _customContracts,
    }));

  /**
   * Create the ethAdapter for the safe-core-sdk
   * @access private
   * @param {string} signer - Account used to sign
   * @return {Web3Adapter} - ethAdapter
   */
  const _createEthAdapter = (signer) =>
    new EthersAdapter({ ethers, signerOrProvider: signer || ethProvider });

  /**
   * Create a Safe factory
   * @access private
   * @param {string} signer - Account used to sign
   * @return {SafeFactory} - Safe factory
   */
  const _createSafeFactory = (signer) =>
    _getContractNetworks().then((contractNetworks) =>
      SafeFactory.create({
        ethAdapter: _createEthAdapter(signer),
        contractNetworks,
      }),
    );

  /**
   * Instantiate a Safe
   * @access private
   * @param {Object} config - options
   * @param {string} config.signer - Account used to sign
   * @param {SafeConfig} config.params - Params to overwrite the Safe.create method
   * @return {Safe} - Instance of a Safe
   */
  const _getSafeSdk = ({ signer, ...params }) =>
    _getContractNetworks().then((contractNetworks) =>
      Safe.create({
        ethAdapter: _createEthAdapter(signer),
        contractNetworks,
        ...params,
      }),
    );

  /**
   * Prepare a transaction to be executed by a Safe while being funded
   * @access private
   * @param {string} config.safeAddress - Safe address
   * @param {Safe} config.safeSdk - Safe instance
   * @param {SafeTransaction} config.SafeTx - Safe transaction to prepare
   * @return {string} - Signed transaction execution data
   */
  const _prepareSafeTransaction = async ({ safeAddress, safeSdk, safeTx }) =>
    Promise.all([
      getSafeContract(ethProvider, safeAddress),
      safeSdk.signTransaction(safeTx),
    ])
      .then(([safeContract, signedSafeTx]) =>
        safeContract.populateTransaction.execTransaction(
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
        ),
      )
      .then(({ data }) => data);

  /**
   * Create the data needed to send a Safe transaction
   * @access private
   * @param {Object} options - options
   * @param {string} options.safeAddress - Safe address
   * @param {string} options.signer - Account used to sign
   * @param {string} options.data - Transaction data to be sent
   * @return {Object} - Relay response
   */
  const _createTransaction = async ({
    safeAddress,
    signer,
    ...transactionData
  }) => {
    const safeSdk = await _getSafeSdk({
      safeAddress,
      signer,
    });

    return safeSdk
      .createTransaction({
        safeTransactionData: { value: 0, ...transactionData },
      })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeAddress,
          safeSdk,
          safeTx,
        }),
      );
  };

  /**
   * Prepare and send a Safe transaction
   * @access private
   * @param {Object} options - options
   * @param {string} options.safeAddress - Safe address
   * @param {string} options.signer - Account used to sign
   * @param {string} options.target - Target address to send the transaction through the Relayer
   * @param {string} options.transactionData - Transaction data to be sent through Safe
   * @return {Object} - Relay response
   */
  const _sendTransaction = ({ safeAddress, signer, target, transactionData }) =>
    _createTransaction({
      signer,
      safeAddress,
      ...transactionData,
    }).then((data) =>
      utils.sendTransaction({
        target: target || safeAddress,
        data,
      }),
    );

  /**
   * Predict a Safe address
   * @access private
   * @param {string} ownerAddress - Safe owner address
   * @param {number} nonce - Safe saltNonce for deterministic address generation
   * @return {string} - predicted Safe address
   */
  const _predictAddress = (owner, nonce) =>
    _createSafeFactory(owner).then((safeFactory) =>
      safeFactory.predictSafeAddress(
        {
          owners: [owner.address],
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
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.ownerAddress - owner address to be added
   * @return {RelayResponse} - transaction response
   */
  const addOwner = async (account, userOptions) => {
    checkAccount(account);

    const { safeAddress, ownerAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
      ownerAddress: {
        type: ethers.utils.isAddress,
      },
    });

    const safeSdk = await _getSafeSdk({
      safeAddress,
      signer: account,
    });

    return safeSdk
      .createAddOwnerTx({ ownerAddress })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeAddress,
          safeSdk,
          safeTx,
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
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.to - Target address to send the transaction
   * @param {string} userOptions.data - Transaction data to be sent
   * @return {Object} - Relay response
   */
  const createTransaction = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress, to, data } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      data: {
        type: 'string',
      },
    });

    return _createTransaction({
      signer: account,
      safeAddress,
      to,
      data,
    });
  };

  /**
   * Deploy a new Safe
   * @namespace core.safe.deploySafe
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.nonce - nonce to predict address
   * @throws {SafeAlreadyDeployedError} - Safe must not exist
   * @throws {SafeNotTrustError} - Safe must be trusted
   * @return {string} - Safe address
   */
  const deploySafe = async (account, userOptions) => {
    checkAccount(account);

    const { nonce } = checkOptions(userOptions, {
      nonce: {
        type: 'number',
      },
    });

    const safeAddress = await _predictAddress(account, nonce);
    const isSafeDeployed = await _isDeployed(safeAddress);

    if (isSafeDeployed) {
      throw new SafeAlreadyDeployedError(
        `Safe with nonce ${nonce} is already deployed.`,
      );
    }

    const { data: initializer } = await safeMaster.populateTransaction.setup(
      [account.address],
      1,
      ZERO_ADDRESS,
      '0x',
      fallbackHandlerAddress,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    );
    const { data } =
      await proxyFactory.populateTransaction.createProxyWithNonce(
        safeMasterAddress,
        initializer,
        nonce,
      );

    await account
      .getTransactionCount()
      .then((walletNonce) =>
        account.sendTransaction({
          from: account.address,
          to: proxyFactoryAddress,
          value: 0,
          nonce: walletNonce,
          data,
        }),
      )
      .then((tx) => tx.wait())
      .catch(async (error) => {
        // console.log(error);
        // The account has not enough xDai to deploy the safe itself, so lets try to deploy it!
        if (error.code === Logger.errors.INSUFFICIENT_FUNDS) {
          const isTrusted = await utils
            .requestIndexedDB('trust_network', safeAddress.toLowerCase())
            .then(
              ({ trusts = [] } = {}) => trusts.length >= DEFAULT_TRUST_LIMIT,
            );

          if (!isTrusted) {
            throw new SafeNotTrustError(
              `The Safe has no minimun required trusts to be fund.`,
            );
          }

          await utils.sendTransaction({
            target: proxyFactoryAddress,
            data,
          });
        } else {
          // Throw unknown errors
          throw error;
        }
      });

    return safeAddress;
  };

  /**
   * List all Safe addresses of an owner
   * @namespace core.safe.getAddresses
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.ownerAddress - Safe owner address
   * @return {string[]} - List of Safe addresses
   */
  const getAddresses = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      ownerAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return utils
      .requestIndexedDB('safe_addresses', options)
      .then((response) =>
        response && response.user
          ? response.user.safeAddresses.map((address) =>
              ethers.utils.getAddress(address),
            )
          : [],
      );
  };

  /**
   * Get all Safe owners
   * @namespace core.safe.getOwners
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string[]} - list of owner addresses
   */
  const getOwners = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return _getSafeSdk({ safeAddress }).then((safeSdk) => safeSdk.getOwners());
  };

  /**
   * Instantiate a Safe
   * @namespace core.safe.getSafeSdk
   * @param {Object} account - Wallet account instance
   * @param {SafeConfig} userOptions - Params to overwrite the Safe.create method
   * @return {Safe} - Instance of a Safe
   */
  const getSafeSdk = (account, userOptions) => {
    checkAccount(account);

    return _getSafeSdk({ signer: account, ...userOptions });
  };

  /**
   * Get Safe version
   * @namespace core.safe.getVersion
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string} - Safe version
   */
  const getVersion = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return _getVersion(safeAddress);
  };

  /**
   * Check if a Safe address is deployed
   * @namespace core.safe.isDeployed
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {boolean} - if Safe is deployed
   */
  const isDeployed = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return _isDeployed(safeAddress);
  };

  /**
   * Predict a Safe address
   * @namespace core.safe.predictAddress
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.nonce - nonce to predict address
   * @return {string} - predicted Safe address
   */
  const predictAddress = async (account, userOptions) => {
    checkAccount(account);

    const { nonce } = checkOptions(userOptions, {
      nonce: {
        type: 'number',
      },
    });

    return _predictAddress(account, nonce);
  };

  /**
   * Remove an owner from a Safe
   * @namespace core.safe.removeOwner
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.ownerAddress - owner address to be removed
   * @return {RelayResponse} - transaction response
   */
  const removeOwner = async (account, userOptions) => {
    checkAccount(account);

    const { safeAddress, ownerAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
      ownerAddress: {
        type: ethers.utils.isAddress,
      },
    });

    const safeSdk = await _getSafeSdk({
      safeAddress,
      signer: account,
    });

    return safeSdk
      .createRemoveOwnerTx({
        ownerAddress,
        threshold: await safeSdk.getThreshold(),
      })
      .then((safeTx) =>
        _prepareSafeTransaction({
          safeAddress,
          safeSdk,
          safeTx,
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
   * Prepare and send a Safe transaction
   * @namespace core.safe.sendTransaction
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @param {string} userOptions.target - Target address to send the transaction through the Relayer
   * @param {string} userOptions.transactionData - Transaction data to be sent through Safe
   * @return {Object} - Relay response
   */
  const sendTransaction = (account, userOptions) => {
    checkAccount(account);

    const { safeAddress, target, transactionData } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
      target: {
        type: ethers.utils.isAddress,
        default: ZERO_ADDRESS,
      },
      transactionData: {
        type: 'object',
      },
    });

    return _sendTransaction({
      signer: account,
      safeAddress,
      transactionData,
      ...(target !== ZERO_ADDRESS && { target }),
    });
  };

  /**
   * Update Safe version to the last version (v1.3.0) by
   * changing the Master Copy and setting the Fallback Handler
   * @namespace core.safe.updateToLastVersion
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - Safe address
   * @return {string} - Safe version
   */
  const updateToLastVersion = async (account, userOptions) => {
    checkAccount(account);

    const { safeAddress } = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });
    let safeVersion = await _getVersion(safeAddress);

    if (safeVersion !== SAFE_LAST_VERSION) {
      // References:
      // https://github.com/safe-global/web-core/blob/main/src/services/tx/safeUpdateParams.ts
      // https://github.com/safe-global/safe-react/blob/main/src/logic/safe/utils/upgradeSafe.ts

      // Get the Safe contract with version v1.1.1+Circles
      const safeInstance = getSafeCRCVersionContract(ethProvider, safeAddress);

      // First we change the Master Copy to v1.3.0
      // @ts-expect-error this was removed in 1.3.0 but we need to support it for older safe versions
      await safeInstance.populateTransaction
        .changeMasterCopy(safeMaster.address)
        .then(({ data }) =>
          _sendTransaction({
            signer: account,
            safeAddress,
            transactionData: {
              to: safeAddress,
              data,
            },
          }),
        );

      await safeInstance.populateTransaction
        .setFallbackHandler(fallbackHandlerAddress)
        .then(({ data }) =>
          _sendTransaction({
            signer: account,
            safeAddress,
            transactionData: {
              to: safeAddress,
              data,
            },
          }),
        );

      // Wait to check that the version is updated
      safeVersion = await utils.loop(
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
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {number} userOptions.safeAddress - to-be-deployed Safe address
   *
   * @return {boolean} - returns true when successful
   */
  const deployForOrganization = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
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
    sendTransaction,
    updateToLastVersion,
  };
}
