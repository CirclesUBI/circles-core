import {
  SAFE_THRESHOLD,
  SENTINEL_ADDRESS,
  ZERO_ADDRESS,
} from '~/common/constants';

import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { getSafeContract } from '~/common/getContracts';

function encodeSafeABI(gnosisSafeMaster, owner) {
  return gnosisSafeMaster.methods
    .setup(
      [owner],
      SAFE_THRESHOLD,
      ZERO_ADDRESS,
      '0x',
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    )
    .encodeABI();
}

function generateAddress2(web3, address, salt, byteCode) {
  const data = ['ff', address, salt, web3.utils.keccak256(byteCode)]
    .map(x => x.replace(/0x/, ''))
    .join('');

  const result = web3.utils
    .keccak256(`0x${data}`)
    .slice(-40)
    .toLowerCase();

  return `0x${result}`;
}

async function getOwners(web3, address) {
  // Get Safe at given address
  const gnosisSafe = getSafeContract(web3, address);

  // Call 'getOwners' method and return list of owners
  return await gnosisSafe.methods.getOwners().call();
}

export default function createSafeModule(web3, contracts, utils) {
  const { gnosisSafeMaster, proxyFactory } = contracts;

  const safeMasterAddress = gnosisSafeMaster.options.address;
  const proxyAddress = proxyFactory.options.address;

  return {
    predictAddress: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      const data = encodeSafeABI(gnosisSafeMaster, account.address);

      const proxyCreationCode = await proxyFactory.methods
        .proxyCreationCode()
        .call();

      const constructorCode = web3.eth.abi
        .encodeParameter('address', safeMasterAddress)
        .replace(/0x/, '');

      const initCode = proxyCreationCode + constructorCode;

      const encodedNonce = web3.eth.abi
        .encodeParameter('uint256', options.nonce)
        .replace(/0x/, '');

      const salt = web3.utils
        .keccak256(`${web3.utils.keccak256(data)}${encodedNonce}`)
        .replace(/0x/, '');

      return generateAddress2(web3, proxyAddress, salt, initCode);
    },
    deploy: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        nonce: {
          type: 'number',
        },
      });

      const data = encodeSafeABI(gnosisSafeMaster, account.address);

      const txData = proxyFactory.methods
        .createProxyWithNonce(safeMasterAddress, data, options.nonce)
        .encodeABI();

      return utils.sendSignedRelayerTx(account, {
        to: proxyAddress,
        txData,
      });
    },
    getOwners: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.isHexStrict,
        },
      });

      return getOwners(web3, options.address);
    },
    addOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.isHexStrict,
        },
        owner: {
          type: web3.utils.isHexStrict,
        },
      });

      // Get Safe at given address
      const gnosisSafe = getSafeContract(web3, options.address);

      // Prepare 'addOwnerWithThreshold' method
      const txData = gnosisSafe.methods
        .addOwnerWithThreshold(options.owner, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeSafeTx({
        gnosisSafe,
        from: account.address,
        to: options.address,
        // @TODO: Check funder address (pass as option?)
        executor: account.address,
        txData,
      });
    },
    removeOwner: async (account, userOptions) => {
      checkAccount(web3, account);

      const options = checkOptions(userOptions, {
        address: {
          type: web3.utils.isHexStrict,
        },
        owner: {
          type: web3.utils.isHexStrict,
        },
      });

      // Get Safe at given address
      const gnosisSafe = getSafeContract(web3, options.address);

      // We need the list of owners before ...
      const owners = await getOwners(web3, options.address);

      // .. to find out which previous owner in the list is pointing at the one we want to remove
      const ownerIndex = owners.findIndex(owner => owner === options.owner);
      const prevOwner =
        ownerIndex > 0 ? owners[ownerIndex - 1] : SENTINEL_ADDRESS;

      // Prepare 'removeOwner' method by passing pointing owner and the owner to be removed
      const txData = await gnosisSafe.methods
        .removeOwner(prevOwner, options.owner, SAFE_THRESHOLD)
        .encodeABI();

      // Call method and return result
      return await utils.executeSafeTx({
        gnosisSafe,
        from: account.address,
        to: options.address,
        // @TODO: Check funder address (pass as option?)
        executor: account.address,
        txData,
      });
    },
  };
}
