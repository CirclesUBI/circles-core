import checkOptions from '~/common/checkOptions';
import getContracts from '~/common/getContracts';

import createSafeModule from '~/safe';
import createUtilsModule from '~/utils';

const DEFAULT_GAS_LIMIT = 10000;

export default class CirclesCore {
  constructor(web3, options) {
    // Check web3 instance
    if (!web3) {
      throw new Error('Web3 instance missing');
    }

    this.web3 = web3;

    // Check options
    this.options = checkOptions(options, {
      gas: {
        type: 'number',
        default: DEFAULT_GAS_LIMIT,
      },
      gnosisSafeAddress: {
        type: web3.utils.isHexStrict,
      },
      hubAddress: {
        type: web3.utils.isHexStrict,
      },
      proxyFactoryAddress: {
        type: web3.utils.isHexStrict,
      },
    });

    // Create contracts once
    this.contracts = getContracts(web3, this.options);

    // Create common utils for submodules
    this.utils = createUtilsModule(web3, this.contracts, this.options);

    // Create submodules and pass utils and options to them
    this.safe = createSafeModule(web3, this.contracts, this.utils);
  }
}
