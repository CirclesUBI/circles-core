import privateKeys from './accounts.json';
import web3 from './web3';

const accounts = privateKeys.map((key) =>
  web3.eth.accounts.privateKeyToAccount(key),
);

export default accounts;
