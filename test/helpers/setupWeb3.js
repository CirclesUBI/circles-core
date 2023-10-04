import Web3 from 'web3';
import HDWalletProvider from '@truffle/hdwallet-provider';

import privateKeys from './accounts.json';

export default function setupWeb3({ additionalAccountsAmount = 0 } = {}) {
  let additionalAccounts = [];

  if (additionalAccountsAmount > 0) {
    const auxWeb3 = new Web3();

    additionalAccounts = Array.from(Array(additionalAccountsAmount).keys()).map(
      () => auxWeb3.eth.accounts.create(),
    );
  }

  const provider = new HDWalletProvider({
    privateKeys: [
      ...privateKeys,
      ...additionalAccounts.map((account) => account.privateKey),
    ],
    providerOrUrl: process.env.RPC_URL,
  });
  const web3 = new Web3(provider);

  return {
    web3,
    provider,
    additionalAccounts,
  };
}
