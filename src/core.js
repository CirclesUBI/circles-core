import checkAccount from '~/common/checkAccount';
import checkOptions from '~/common/checkOptions';

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
}
