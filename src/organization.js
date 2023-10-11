import { ethers } from 'ethers';

import CoreError, { ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { ZERO_ADDRESS } from '~/common/constants';
import { getTokenContract } from '~/common/getContracts';

/**
 * Organization module to manage organizations
 * @access private
 * @param {CirclesCore} context - CirclesCore instance
 * @return {Object} - Organization module instance
 */
export default function createOrganizationModule({
  ethProvider,
  contracts: { hub },
  safe,
  trust,
  utils,
  options: { hubAddress },
}) {
  /**
   * Create a new organization account (shared wallet)
   * @namespace core.organization.deploy
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - safe address of the organization
   * @return {RelayResponse} - gelato response
   */
  const deploy = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return hub.populateTransaction.organizationSignup().then(({ data }) =>
      safe.sendTransaction(account, {
        safeAddress: options.safeAddress,
        transactionData: {
          to: hubAddress,
          data,
        },
      }),
    );
  };

  /**
   * Find out if address is an organization
   * @namespace core.organization.isOrganization
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - options
   * @param {string} userOptions.safeAddress - address
   * @return {boolean} - True if organization
   */
  const isOrganization = (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    return hub.organizations(options.safeAddress);
  };

  /**
   * Organizations do not hold their own Token and need to be prefunded with
   * a Circles Token to be functional from the beginning (in case
   * transactions are going through the relayer). This method is a special
   * workaround to create a trust connection to a regular user to then
   * transfer Tokens from that user to the organization.
   *
   * This method only works if the user and the organization owner are the
   * same as transactions are signed with the same private key
   * @namespace core.organization.prefund
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - user arguments
   * @param {string} userOptions.from - safe address of user who funds
   * @param {string} userOptions.to - safe address of organization
   * @param {BN} userOptions.value - funding amount
   *
   * @return {RelayResponse} - transaction response
   */
  const prefund = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      from: {
        type: ethers.utils.isAddress,
      },
      to: {
        type: ethers.utils.isAddress,
      },
      value: {
        type: ethers.BigNumber.isBigNumber,
      },
    });

    // Check if organization exists
    const isOrganization = await hub.organizations(options.to);
    if (!isOrganization) {
      throw new CoreError('Given address is not an organization');
    }

    // Check if the users token exists and has sufficient funds to transfer
    // the amount to the organization
    const tokenAddress = await hub.userToToken(options.from);
    if (tokenAddress === ZERO_ADDRESS) {
      throw new CoreError(
        'No token given to pay transaction',
        ErrorCodes.INSUFFICIENT_FUNDS,
      );
    }

    const tokenContract = getTokenContract(ethProvider, tokenAddress);
    const balance = await tokenContract.balanceOf(options.from);
    const value = options.value.toString();

    if (!ethers.BigNumber.from(balance).gte(value)) {
      throw new CoreError(
        'No sufficient funds to pay transaction',
        ErrorCodes.INSUFFICIENT_FUNDS,
      );
    }

    // Create a 100% trust connection from the organization to the user as
    // the transfer will take place in reverse direction
    await trust.addConnection(account, {
      user: options.from,
      canSendTo: options.to,
    });

    // Wait for the trust connection to be effective
    await utils.loop(
      () => hub.limits(options.to, options.from),
      (trustLimit) => trustLimit.toString() === '100',
      { label: 'Wait for trust connection.' },
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

    const { data } = await hub.populateTransaction.transferThrough(
      transfer.tokenOwners,
      transfer.sources,
      transfer.destinations,
      transfer.values,
    );

    return safe.sendTransaction(account, {
      safeAddress: options.from,
      transactionData: { to: hubAddress, data },
    });
  };

  /**
   * Returns a list of organization members
   * @namespace core.organization.getMembers
   * @param {Object} account - Wallet account instance
   * @param {Object} userOptions - user arguments
   * @param {string} userOptions.safeAddress - address of the organization
   * @return {Array} - list of members with connected safes and owner address
   */
  const getMembers = async (account, userOptions) => {
    checkAccount(account);

    const options = checkOptions(userOptions, {
      safeAddress: {
        type: ethers.utils.isAddress,
      },
    });

    const owners = await safe.getOwners(account, {
      safeAddress: options.safeAddress,
    });

    const promises = owners.map((ownerAddress) => {
      return utils.requestIndexedDB('organization_status', ownerAddress);
    });

    const results = await Promise.all(promises);

    return results.reduce((acc, result) => {
      if (!result || !result.user) {
        return;
      }

      acc.push({
        ownerAddress: ethers.utils.getAddress(result.user.id),
        safeAddresses: result.user.safes.reduce((acc, safe) => {
          // Only add safes which are not organizations
          if (!safe.organization) {
            acc.push(ethers.utils.getAddress(safe.id));
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
