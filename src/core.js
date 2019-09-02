import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';
import { CALL_OP, ZERO_ADDRESS } from '~/common/constants';

export default class Core {
  constructor({ web3, contracts, ...options }) {
    this.options = options;
    this.web3 = web3;
    this.contracts = contracts;
  }

  check(account, options, required) {
    checkAccount(account);
    checkOptions(options, required);
  }

  async executeSafeTx({
    gnosisSafe,
    from,
    to,
    executor,
    valueInWei = 0,
    txData = '0x',
  }) {
    const signatures = `0x000000000000000000000000${from.replace(
      '0x',
      '',
    )}000000000000000000000000000000000000000000000000000000000000000001`;

    const operation = CALL_OP;
    const safeTxGas = 0;
    const baseGas = 0;
    const gasPrice = 0;
    const gasToken = ZERO_ADDRESS;
    const refundReceiver = executor;

    return await gnosisSafe.methods
      .execTransaction(
        to,
        valueInWei,
        txData,
        operation,
        safeTxGas,
        baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        signatures,
      )
      .send({
        from: executor,
        gas: this.options.gas,
      });
  }
}
