import Core from '~/core';

import {
  SAFE_THRESHOLD,
  SENTINEL_ADDRESS,
  ZERO_ADDRESS,
} from '~/common/constants';

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

export default class Safe extends Core {
  async predictAddress(account, options) {
    this.check(account, options, ['nonce']);

    const { nonce } = options;
    const { gnosisSafeMaster, proxyFactory } = this.contracts;
    const { eth, utils } = this.web3;

    const data = encodeSafeABI(gnosisSafeMaster, account.address);

    const proxyCreationCode = await proxyFactory.methods
      .proxyCreationCode()
      .call();

    const constructorCode = eth.abi
      .encodeParameter('address', gnosisSafeMaster.options.address)
      .replace(/0x/, '');

    const initCode = proxyCreationCode + constructorCode;

    const encodedNonce = eth.abi
      .encodeParameter('uint256', nonce)
      .replace(/0x/, '');

    const salt = utils
      .keccak256(`${utils.keccak256(data)}${encodedNonce}`)
      .replace(/0x/, '');

    return generateAddress2(
      this.web3,
      proxyFactory.options.address,
      salt,
      initCode,
    );
  }

  async deploy(account, options) {
    this.check(account, options, ['nonce']);

    const { gnosisSafeMaster, proxyFactory } = this.contracts;
    const data = encodeSafeABI(gnosisSafeMaster, account.address);

    // Call 'createProxyWithNonce' method via Gnosis Safe Proxy
    return proxyFactory.methods
      .createProxyWithNonce(
        gnosisSafeMaster.options.address,
        data,
        options.nonce,
      )
      .send({
        // @TODO: Check funder address (pass as option?)
        from: account.address,
        gas: this.options.gas,
      });
  }

  async getOwners(account, options) {
    this.check(account, options, ['address']);

    // Get Safe at given address
    const gnosisSafe = getSafeContract(this.web3, options.address);

    // Call 'getOwners' method and return list of owners
    return await gnosisSafe.methods.getOwners().call();
  }

  async addOwner(account, options) {
    this.check(account, options, ['address', 'owner']);

    // Get Safe at given address
    const gnosisSafe = getSafeContract(this.web3, options.address);

    // Prepare 'addOwnerWithThreshold' method
    const txData = gnosisSafe.methods
      .addOwnerWithThreshold(options.owner, SAFE_THRESHOLD)
      .encodeABI();

    // Call method and return result
    return await this.executeSafeTx({
      gnosisSafe,
      from: account.address,
      to: options.address,
      // @TODO: Check funder address (pass as option?)
      executor: account.address,
      txData,
    });
  }

  async removeOwner(account, options) {
    this.check(account, options, ['address', 'owner']);

    // Get Safe at given address
    const gnosisSafe = getSafeContract(this.web3, options.address);

    // We need the list of owners before ...
    const owners = await this.getOwners(account, { address: options.address });

    // .. to find out which previous owner in the list is pointing at the one we want to remove
    const ownerIndex = owners.findIndex(owner => owner === options.owner);
    const prevOwner =
      ownerIndex > 0 ? owners[ownerIndex - 1] : SENTINEL_ADDRESS;

    // Prepare 'removeOwner' method by passing pointing owner and the owner to be removed
    const txData = await gnosisSafe.methods
      .removeOwner(prevOwner, options.owner, SAFE_THRESHOLD)
      .encodeABI();

    // Call method and return result
    return await this.executeSafeTx({
      gnosisSafe,
      from: account.address,
      to: options.address,
      // @TODO: Check funder address (pass as option?)
      executor: account.address,
      txData,
    });
  }
}
