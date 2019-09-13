import privateKeys from '../accounts.json';
import web3 from './web3';

export default function getAccount(accountIndex = 0) {
  return web3.eth.accounts.privateKeyToAccount(privateKeys[accountIndex]);
}
