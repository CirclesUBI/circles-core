import web3 from './web3';

export default function createAccount() {
  return web3.eth.accounts.create();
}
