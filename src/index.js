import Safe from '~/safe';
import getContracts from '~/common/contracts';

const REQUIRED_OPTIONS = [
  'gnosisSafeAddress',
  'hubAddress',
  'proxyFactoryAddress',
  'web3',
];

function checkOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Options missing');
  }

  REQUIRED_OPTIONS.forEach(key => {
    if (!(key in options) || !options[key]) {
      throw new Error(`"${key}" is missing in options`);
    }
  });
}

class Core {
  constructor({ web3, ...options }) {
    this.options = options;
    this.web3 = web3;
    this.contracts = getContracts(web3, options);
  }
}

export default class CirclesCore {
  constructor(options) {
    checkOptions(options);
    this.options = options;

    // Create sub modules and pass core methods to them
    const core = new Core(options);
    this.safe = new Safe(core);
  }
}
