import privateKeys from './accounts.json';

const getAccounts = (web3) =>
  privateKeys.map((key) => web3.eth.accounts.privateKeyToAccount(key));

export default getAccounts;
