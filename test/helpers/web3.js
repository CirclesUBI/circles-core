import Web3 from 'web3';

const provider = Web3.providers.HttpProvider(
  process.env.RPC_URL || 'http://localhost:8485',
);

const web3 = new Web3(provider);

export default web3;
