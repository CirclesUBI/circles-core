import CoreError, { ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { ZERO_ADDRESS } from '~/common/constants';
import { getOwners } from '~/safe';
import { getTokenContract } from '~/common/getContracts';
import loop from '~/common/loop';

/**
 * Organization submodule to deploy and check organization accounts.
 *
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @param {Web3} web3 - Web3 instance
 * @return {Object} - organization module instance
 */
export default function createOrganizationModule({
  web3,
  contracts: { hub },
  safe,
  utils,
  options: { hubAddress },
}) {
  /**
   * Create a new organization account
   *
   * @namespace core.organization.deploy
   *
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - safe address of the organization
   * @return {RelayResponse} - gelato response
   */
  const deploy = async (account, userOptions) => {
    checkAccount(web3, account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    const result = await safe
      .createTransaction(account, {
        safeAddress: options.safeAddress,
        to: hubAddress,
        data: hub.methods.organizationSignup().encodeABI(),
      })
      .then((data) =>
        utils.sendTransaction({
          target: options.safeAddress,
          data,
        }),
      );
    return result;
  };

  /**
   * Find out if address is an organization
   *
   * @namespace core.organization.isOrganization
   *
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - address
   *
   * @return {boolean} - True if organization
   */
  const isOrganization = async (account, userOptions) => {
    checkAccount(web3, account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    return await hub.methods.organizations(options.safeAddress).call();
  };

  /**
   * Organizations do not hold their own Token and need to be prefunded with
   * a Circles Token to be functional from the beginning (in case
   * transactions are going through the relayer). This method is a special
   * workaround to create a trust connection to a regular user to then
   * transfer Tokens from that user to the organization.
   *
   * This method only works if the user and the organization owner are the
   * same as transactions are signed with the same private key.
   *
   * @namespace core.organization.prefund
   *
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - user arguments
   * @param {string} userOptions.from - safe address of user who funds
   * @param {string} userOptions.to - safe address of organization
   * @param {BN} userOptions.value - funding amount
   *
   * @return {string} - transaction hash
   */
  const prefund = async (account, userOptions) => {
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

    // Check if organization exists
    const isOrganization = await hub.methods.organizations(options.to).call();
    if (!isOrganization) {
      throw new CoreError('Given address is not an organization');
    }

    // Check if the users token exists and has sufficient funds to transfer
    // the amount to the organization
    const tokenAddress = await hub.methods.userToToken(options.from).call();
    if (tokenAddress === ZERO_ADDRESS) {
      throw new CoreError(
        'No token given to pay transaction',
        ErrorCodes.INSUFFICIENT_FUNDS,
      );
    }

    const tokenContract = getTokenContract(web3, tokenAddress);
    const balance = await tokenContract.methods.balanceOf(options.from).call();
    const value = options.value.toString();

    if (!web3.utils.toBN(balance).gte(web3.utils.toBN(value))) {
      throw new CoreError(
        'No sufficient funds to pay transaction',
        ErrorCodes.INSUFFICIENT_FUNDS,
      );
    }

    // Create a 100% trust connection from the organization to the user as
    // the transfer will take place in reverse direction
    const txDataAddConnection = await hub.methods
      .trust(options.from, 100)
      .encodeABI();

    // This first trust transaction is paid by the relayer
    const txHashAddConnection = await safe
      .createTransaction(account, {
        safeAddress: options.to,
        to: hub.options.address,
        data: txDataAddConnection,
      })
      .then((data) =>
        utils.sendTransaction({
          target: options.to,
          data,
        }),
      );

    if (!txHashAddConnection) {
      throw new CoreError('Organization failed to trust safe');
    }

    // Wait for the trust connection to be effective
    await loop(
      () => {
        return hub.methods.limits(options.to, options.from).call();
      },
      (trustLimit) => {
        return trustLimit === '100';
      },
    );

    // Prepare the transfer for the `transferThrough` Hub method, we don't go
    // through the api to get the transfer steps as we know there is a 100%
    // trust connection between the sender and receiver
    const transfer = {
      tokenOwners: [options.from],
      sources: [options.from],
      destinations: [options.to],
      values: [value],
    };

    const txData = await hub.methods
      .transferThrough(
        transfer.tokenOwners,
        transfer.sources,
        transfer.destinations,
        transfer.values,
      )
      .encodeABI();

    const txHash = await safe
      .createTransaction(account, {
        safeAddress: options.from,
        to: hub.options.address,
        data: txData,
      })
      .then((data) => utils.sendTransaction({ target: options.to, data }));

    if (!txHash) {
      throw new CoreError('Failed transfer to fund organization');
    }

    return txHash;
  };

  /**
   * Returns a list of organization members.
   *
   * @namespace core.organization.getMembers
   *
   * @param {Object} account - web3 account instance
   * @param {Object} userOptions - user arguments
   * @param {string} userOptions.safeAddress - address of the organization
   *
   * @return {Array} - list of members with connected safes and owner address
   */
  const getMembers = async (account, userOptions) => {
    checkAccount(web3, account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: web3.utils.checkAddressChecksum,
      },
    });

    const owners = await getOwners(web3, options.safeAddress);

    const promises = owners.map((ownerAddress) => {
      return utils.requestIndexedDB('organization_status', ownerAddress);
    });

    const results = await Promise.all(promises);

    return results.reduce((acc, result) => {
      if (!result || !result.user) {
        return;
      }

      acc.push({
        ownerAddress: web3.utils.toChecksumAddress(result.user.id),
        safeAddresses: result.user.safes.reduce((acc, safe) => {
          // Only add safes which are not organizations
          if (!safe.organization) {
            acc.push(web3.utils.toChecksumAddress(safe.id));
          }
          return acc;
        }, []),
      });

      return acc;
    }, []);
  };
  return {
    deploy,
    isOrganization,
    prefund,
    getMembers,
  };
}
// }
