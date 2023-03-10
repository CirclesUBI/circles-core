import Web3 from 'web3';
import GnosisSafeContract from '../node_modules/@circles/safe-contracts/build/contracts/GnosisSafe.json';
import { ZERO_ADDRESS } from './common/constants.js';
import getContracts from './common/getContracts.js';
const web3 = new Web3(
  new Web3.providers.WebsocketProvider('http://localhost:8545'),
);

function getEventSignature(contract, eventName) {
  const { signature } = contract._jsonInterface.find((item) => {
    console.log(item);
    return item.name === eventName && item.type === 'event';
  });
  return signature;
}
function handleSafeSetup({ address, topics, transactionHash }) {
  console.log('address in safeSetup ' + address);
  console.log('topics address in safeSetup ' + topics);
  console.log('transactionHash in safeSetup ' + transactionHash);
}
function subscribeEvent(contract, address, eventName, callbackFn) {
  const handleCallback = (error, result) => {
    if (error) {
      console.log(`Web3 subscription error: ${error}`);
      // Subscribe again with same parameters when disconnected
      subscription.subscribe(handleCallback);
    } else {
      callbackFn(result);
    }
  };

  const subscription = web3.eth.subscribe(
    'logs',
    {
      address,
      topics: [getEventSignature(contract, eventName)],
    },
    handleCallback,
  );
}

const gnosisContract = new web3.eth.Contract(GnosisSafeContract.abi);

//subscribeEvent(gnosisContract, null, 'SafeSetup', handleSafeSetup);

const contracts = await getContracts(web3, {
  hubAddress: ZERO_ADDRESS,
  proxyFactoryAddress: ZERO_ADDRESS,
  safeMasterAddress: '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
});
const { safeMaster } = contracts;
safeMaster.events
  .allEvents()
  .on('data', (event) => {
    console.log(event);
  })
  .on('error', console.error);
