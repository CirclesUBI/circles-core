import GnosisSafeContract from '@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json';
import HubContract from 'circles-contracts/build/contracts/Hub.json';
import ProxyFactoryContract from '@gnosis.pm/safe-contracts/build/contracts/ProxyFactory.json';
import TokenContract from 'circles-contracts/build/contracts/Token.json';

export default function getContracts(web3) {
  const GnosisSafe = new web3.eth.Contract(GnosisSafeContract.abi);
  const Hub = new web3.eth.Contract(HubContract.abi);
  const ProxyFactory = new web3.eth.Contract(ProxyFactoryContract.abi);
  const Token = new web3.eth.Contract(TokenContract.abi);

  return {
    GnosisSafe,
    Hub,
    ProxyFactory,
    Token,
  };
}
