import Web3 from 'web3';
import HDWalletProvider from '@truffle/hdwallet-provider';

import privateKeys from './accounts.json';

export const provider = new HDWalletProvider({
  privateKeys,
  providerOrUrl: process.env.RPC_URL || 'http://localhost:8545',
});

const web3 = new Web3(provider);

export default web3;
