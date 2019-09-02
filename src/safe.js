import { generateAddress2, keccak256 } from 'ethereumjs-util';
import { rawEncode } from 'ethereumjs-abi';

import Core from '~/core';
import { ZERO_ADDRESS } from '~/common/constants';

export default class Safe extends Core {
  async predictAddress(account, options) {
    this.check(account, options, ['nonce']);

    const { nonce } = options;
    const { GnosisSafe, ProxyFactory } = this.contracts;

    const data = GnosisSafe.methods
      .setup(
        [account.address],
        1,
        ZERO_ADDRESS,
        '0x',
        ZERO_ADDRESS,
        0,
        ZERO_ADDRESS,
      )
      .encodeABI();

    const proxyCreationCode = await ProxyFactory.methods
      .proxyCreationCode()
      .call();

    const constructorCode = rawEncode(
      ['address'],
      [GnosisSafe.options.address],
    ).toString('hex');

    const initCode = proxyCreationCode + constructorCode;

    const encodedNonce = rawEncode(['uint256'], [nonce]).toString('hex');

    const salt = keccak256(
      `0x${keccak256(data).toString('hex')}${encodedNonce}`,
    );

    const predictedAddress = generateAddress2(
      ProxyFactory.options.address,
      salt,
      initCode,
    );

    return `0x${predictedAddress.toString('hex')}`;
  }
}
