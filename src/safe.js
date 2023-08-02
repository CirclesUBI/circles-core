import { SAFE_LAST_VERSION, ZERO_ADDRESS } from '~/common/constants';
import CoreError, { SafeDeployedError } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeCRCVersionContract } from '~/common/getContracts';
import loop from '~/common/loop';
import Safe, {
  getSafeContract as _getSafeContract,
} from '@safe-global/protocol-kit';

/**
 * Safe submodule to deploy and interact with the Gnosis Safe.
 *
 * @access private
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 * @param {Object} globalOptions - global core options
 *
 * @return {Object} - safe module instance
 */
export default function createSafeModule(
  web3,
  contracts,
  utils,
  globalOptions,
) {
  const { fallbackHandlerAddress, proxyFactoryAddress, safeMasterAddress } =
    globalOptions;
  const { safeMaster, proxyFactory } = contracts;

  /////////////////////////
  /* Safe Module Methods */
  /////////////////////////
  const getSafe = ({
    predictedSafe,
    safeAddress,
    signerAddress,
    params = {},
  }) =>
    utils.getContractNetworks().then((contractNetworks) =>
      Safe.create({
        ethAdapter: utils.createEthAdapter(signerAddress),
        contractNetworks,
        ...(predictedSafe && { predictedSafe }),
        ...(safeAddress && { safeAddress }),
        ...params,
      }),
    );

  /**
   * Predict Safe address
   *
   * @access private
   *
   * @param {string} ownerAddress - Safe owner address
   * @param {number} nonce - Safe creation salt nonce
   *
   * @return {string} - predicted Safe address
   */
  const predictAddress = (ownerAddress, nonce) =>
    utils.createSafeFactory(ownerAddress).then((safeFactory) =>
      safeFactory.predictSafeAddress(
        {
          owners: [ownerAddress],
          threshold: 1,
        },
        nonce,
      ),
    );

  const isSafeDeployed = (accountAddress, nonce) =>
    getSafe({
      predictedSafe: {
        safeAccountConfig: {
          owners: [accountAddress],
          threshold: 1,
        },
        safeDeploymentConfig: {
          saltNonce: nonce,
        },
      },
    }).then((safeSdk) => safeSdk.isSafeDeployed());

  const deploySafe = async (ownerAddress, nonce) => {
    const isDeployed = await isSafeDeployed(ownerAddress, nonce);

    if (isDeployed) {
      throw new SafeDeployedError(
        `Safe with nonce ${nonce} is already deployed.`,
      );
    }

    const initializer = safeMaster.methods
      .setup(
        [ownerAddress],
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

    await utils.requestNewRelayer({
      path: ['transactions'],
      method: 'POST',
      isTrailingSlash: false,
      data: {
        target: proxyFactoryAddress,
        data,
      },
    });

    return predictAddress(ownerAddress, nonce);
  };

  /**
   * Helper method to get the Safe version.
   *
   * @access private
   *
   * @param {string} safeAddress
   *
   * @return {string} - version of the Safe
   */
  const getVersion = (safeAddress) =>
    getSafe({ safeAddress }).then((safeSdk) => safeSdk.getContractVersion());

  /**
   * Helper method to receive a list of all Gnosis Safe owners.
   *
   * @access private
   *
   * @param {string} safeAddress
   *
   * @return {string[]} - array of owner addresses
   */
  const getOwners = (safeAddress) =>
    getSafe({ safeAddress }).then((safeSdk) => safeSdk.getOwners());

  const encodeSafeTransaction = ({
    signedSafeTx,
    signerAddress,
    safeVersion,
  }) =>
    _getSafeContract({
      ethAdapter: utils.createEthAdapter(signerAddress),
      safeVersion,
      customContracts: utils.getCustomContracts(),
    }).then((safeSingletonContract) =>
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

  return {
    /**
     * Predict Safe address.
     *
     * @namespace core.safe.predictAddress
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce to predict address
     *
     * @return {string} - Predicted Gnosis Safe address
     */
    predictAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      const { nonce } = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return predictAddress(account.address, nonce);
    },

    /**
     * Deploy a new Safe with the Relayer.
     *
     * @namespace core.safe.deploySafe
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.nonce - nonce to predict address
     *
     * @return {string} - Gnosis Safe address
     */
    deploySafe: (account, userOptions) => {
      checkAccount(web3, account);

      const { nonce } = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return deploySafe(account.address, nonce);
    },

    isSafeDeployed: (account, userOptions) => {
      checkAccount(web3, account);

      const { nonce } = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      return isSafeDeployed(account.address, nonce);
    },

    /**
     * Returns a list of all owners of the given Gnosis Safe.
     *
     * @namespace core.safe.getOwners
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     *
     * @return {string[]} - array of owner addresses
     */
    getOwners: (account, userOptions) => {
      checkAccount(web3, account);

      const { safeAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return getOwners(safeAddress);
    },

    /**
     * Add an address as an owner of a given Gnosis Safe.
     *
     * @namespace core.safe.addOwner
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     * @param {number} userOptions.ownerAddress - owner address to be added
     *
     * @return {string} - transaction hash
     */
    addOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const { safeAddress, ownerAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const safeSdk = await getSafe({
        safeAddress,
        signerAddress: account.address,
      });
      const data = await safeSdk
        .createAddOwnerTx({ ownerAddress })
        .then((addOwnerTx) => safeSdk.signTransaction(addOwnerTx))
        .then(async (signedSafeTx) =>
          encodeSafeTransaction({
            signedSafeTx,
            signerAddress: account.address,
            safeVersion: await safeSdk.getContractVersion(),
          }),
        );

      return utils.requestNewRelayer({
        path: ['transactions'],
        method: 'POST',
        isTrailingSlash: false,
        data: {
          target: safeAddress,
          data,
        },
      });
    },

    /**
     * Remove owner of a given Gnosis Safe.
     *
     * @namespace core.safe.removeOwner
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     * @param {number} userOptions.ownerAddress - owner address to be removed
     *
     * @return {string} - transaction hash
     */
    removeOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const { safeAddress, ownerAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const safeSdk = await getSafe({
        safeAddress,
        signerAddress: account.address,
      });
      const data = await safeSdk
        .createRemoveOwnerTx({
          ownerAddress,
          threshold: await safeSdk.getThreshold(),
        })
        .then((addOwnerTx) => safeSdk.signTransaction(addOwnerTx))
        .then(async (signedSafeTx) =>
          encodeSafeTransaction({
            signedSafeTx,
            signerAddress: account.address,
            safeVersion: await safeSdk.getContractVersion(),
          }),
        );

      return utils.requestNewRelayer({
        path: ['transactions'],
        method: 'POST',
        isTrailingSlash: false,
        data: {
          target: safeAddress,
          data,
        },
      });
    },

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
    deployForOrganization: async (account, userOptions) => {
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
    },

    /**
     * Finds the Safe addresses of an owner.
     *
     * @namespace core.safe.getAddresses
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.ownerAddress - address of the Safe owner
     *
     * @return {string} - Safe address
     */
    getAddresses: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        ownerAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const response = await utils.requestIndexedDB('safe_addresses', options);

      if (!response || !response.user) {
        return [];
      }

      return response.user.safeAddresses.map((address) => {
        return web3.utils.toChecksumAddress(address);
      });
    },

    /**
     * Get Safe version.
     *
     * @namespace core.safe.getVersion
     *
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     *
     * @return {string} - transaction hash
     */
    getVersion: (userOptions) => {
      const { safeAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return getVersion(safeAddress);
    },

    /**
     * Update Safe version to the last version (v1.3.0) by changing the the Master Copy.
     *
     * @namespace core.safe.updateSafeVersion
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {number} userOptions.safeAddress - address of the Gnosis Safe
     *
     * @return {string} - transaction hash
     */
    updateToLastVersion: async (account, userOptions) => {
      checkAccount(web3, account);

      const { safeAddress } = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const safeVersion = await getVersion(safeAddress);
      let txHashChangeMasterCopy;
      let txHashFallbackHandler;

      if (safeVersion != SAFE_LAST_VERSION) {
        // References:
        // https://github.com/safe-global/web-core/blob/main/src/services/tx/safeUpdateParams.ts
        // https://github.com/safe-global/safe-react/blob/main/src/logic/safe/utils/upgradeSafe.ts

        // Get the Safe contract with version v1.1.1+Circles
        const safeInstance = getSafeCRCVersionContract(web3, safeAddress);
        const signerAddress = account.address;
        const safeSdk = await getSafe({
          safeAddress,
          signerAddress: account.address,
        });

        // First we change the Master Copy to v1.3.0
        // @ts-expect-error this was removed in 1.3.0 but we need to support it for older safe versions
        txHashChangeMasterCopy = await utils.requestNewRelayer({
          path: ['transactions'],
          method: 'POST',
          isTrailingSlash: false,
          data: {
            target: safeAddress,
            data: await safeSdk
              .createTransaction({
                safeTransactionData: {
                  to: safeAddress,
                  value: 0,
                  data: safeInstance.methods
                    .changeMasterCopy(safeMaster.options.address)
                    .encodeABI(),
                },
              })
              .then((tx) => safeSdk.signTransaction(tx))
              .then((signedSafeTx) =>
                encodeSafeTransaction({
                  signedSafeTx,
                  signerAddress,
                  safeVersion,
                }),
              ),
          },
        });

        if (!txHashChangeMasterCopy) {
          throw new CoreError(
            `Safe with version ${safeVersion} failed to change the Master Copy`,
          );
        }

        txHashFallbackHandler = await utils.requestNewRelayer({
          path: ['transactions'],
          method: 'POST',
          isTrailingSlash: false,
          data: {
            target: safeAddress,
            data: await safeSdk
              .createTransaction({
                safeTransactionData: {
                  to: safeAddress,
                  value: 0,
                  data: safeInstance.methods
                    .setFallbackHandler(fallbackHandlerAddress)
                    .encodeABI(),
                },
              })
              .then((tx) => safeSdk.signTransaction(tx))
              .then((signedSafeTx) =>
                encodeSafeTransaction({
                  signedSafeTx,
                  signerAddress,
                  safeVersion,
                }),
              ),
          },
        });

        if (!txHashFallbackHandler) {
          throw new CoreError(
            `Safe with version ${safeVersion} failed to change the FallbackHandler`,
          );
        }

        // Wait to check that the version is updated
        await loop(
          () => getVersion(safeAddress),
          (version) => version === SAFE_LAST_VERSION,
        );
      }

      return { txHashChangeMasterCopy, txHashFallbackHandler };
    },
  };
}
