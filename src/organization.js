import CoreError, { ErrorCodes } from '~/common/error';
import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { ZERO_ADDRESS } from '~/common/constants';
import { getOwners } from '~/safe';
import { getTokenContract } from '~/common/getContracts';

/**
 * Organization submodule to deploy and check organization accounts.
 *
 * @param {Web3} web3 - Web3 instance
 * @param {Object} contracts - common contract instances
 * @param {Object} utils - utils module instance
 *
 * @return {Object} - organization module instance
 */
export default function createOrganizationModule(web3, contracts, utils) {
  const { hub } = contracts;

  return {
    /**
     * Returns true if there are enough balance on this Safe address to create
     * an organization account.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.safeAddress - safe address to check
     *
     * @return {boolean} - has enough funds
     */
    isFunded: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      // Do not attempt asking the relayer when Safe does not exist yet
      if ((await web3.eth.getCode(options.safeAddress)) === '0x') {
        return false;
      }

      const txData = await hub.methods.organizationSignup().encodeABI();

      try {
        const signupCosts = await utils.estimateTransactionCosts(account, {
          safeAddress: options.safeAddress,
          to: hub.options.address,
          txData,
        });

        const balance = await web3.eth.getBalance(options.safeAddress);
        return web3.utils.toBN(balance).gte(signupCosts);
      } catch {
        return false;
      }
    },

    /**
     * Create a new organization account
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - owner of the organization
     *
     * @return {string} - transaction hash
     */
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const txData = await hub.methods.organizationSignup().encodeABI();

      return await utils.executeSafeTx(account, {
        safeAddress: options.safeAddress,
        to: hub.options.address,
        txData,
      });
    },

    /**
     * Find out if address is an organization
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - options
     * @param {string} userOptions.safeAddress - address
     *
     * @return {boolean} - True if organization
     */
    isOrganization: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      return await hub.methods.organizations(options.safeAddress).call();
    },

    /**
     * Organizations do not hold their own Token and need to be prefunded with
     * a Circles Token to be functional from the beginning (in case
     * transactions are going through the relayer. This method is a special
     * workaround to create a trust connection to a regular user to then
     * transfer Tokens from that user to the organization.
     *
     * This method only works if the user and the organization owner are the
     * same as transactions are signed with the same private key.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.from - safe address of user who funds
     * @param {string} userOptions.to - safe address of organization
     * @param {BN} userOptions.value - funding amount
     *
     * @return {string} - transaction hash
     */
    prefund: async (account, userOptions) => {
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
      const balance = await tokenContract.methods
        .balanceOf(options.from)
        .call();
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
      const txHashAddConnection = await utils.executeSafeTx(account, {
        safeAddress: options.to,
        to: hub.options.address,
        txData: txDataAddConnection,
      });

      if (!txHashAddConnection) {
        throw new CoreError('Organization failed to trust safe');
      }

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

      const txHash = await utils.executeTokenSafeTx(account, {
        safeAddress: options.from,
        to: hub.options.address,
        txData,
      });

      if (!txHash) {
        throw new CoreError('Failed transfer to fund organization');
      }

      return txHash;
    },

    /**
     * Returns a list of organization members.
     *
     * @param {Object} account - web3 account instance
     * @param {Object} userOptions - user arguments
     * @param {string} userOptions.safeAddress - address of the organization
     *
     * @return {array} - list of members with connected safes and owner address
     */
    getMembers: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        safeAddress: {
          type: web3.utils.checkAddressChecksum,
        },
      });

      const owners = await getOwners(web3, options.safeAddress);

      const promises = owners.map((ownerAddress) => {
        return utils.requestGraph({
          query: `{
            user(id: "${ownerAddress.toLowerCase()}") {
              id,
              safes {
                id
                organization
              }
            }
          }`,
        });
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
    },
  };
}
