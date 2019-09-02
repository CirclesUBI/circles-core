import Safe from '~/safe';
import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';

export default class CirclesCore {
  constructor(coreOptions) {
    // Check options
    const { web3, ...options } = checkOptions(coreOptions, [
      'gnosisSafeAddress',
      'hubAddress',
      'proxyFactoryAddress',
      'web3',
    ]);

    // Create contracts once
    const contracts = getContracts(web3, options);

    this.contracts = contracts;
    this.options = options;
    this.web3 = web3;

    // Create sub modules and pass options to them
    const moduleOptions = {
      contracts,
      web3,
      ...options,
    };

    this.safe = new Safe(moduleOptions);
  }
}
