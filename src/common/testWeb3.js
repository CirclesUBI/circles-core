import Web3 from 'web3';

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
web3.eth.net
  .isListening()
  .then(() => console.log('is connected'))
  .catch((e) => console.log('error ' + e));
