import Web3 from 'web3';
export interface CirclesCoreOptions {
    web3: Web3;
}
export default class CirclesCore {
    constructor(options: CirclesCoreOptions);
    private options;
}
