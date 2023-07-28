import GnosisSafeContract from '@gnosis.pm/safe-contracts/build/artifacts/contracts/GnosisSafeL2.sol/GnosisSafeL2.json';
import ProxyFactoryContract from '@gnosis.pm/safe-contracts/build/artifacts/contracts/proxies/GnosisSafeProxyFactory.sol/GnosisSafeProxyFactory.json';
import CompatibilityFallbackHandler from '@gnosis.pm/safe-contracts/build/artifacts/contracts/handler/CompatibilityFallbackHandler.sol/CompatibilityFallbackHandler.json';
import MultiSend from '@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/MultiSend.sol/MultiSend.json';
import MultiSendCallOnly from '@gnosis.pm/safe-contracts/build/artifacts/contracts/libraries/MultiSendCallOnly.sol/MultiSendCallOnly.json';

const abis = {
  safeMasterCopyAbi: GnosisSafeContract.abi,
  safeProxyFactoryAbi: ProxyFactoryContract.abi,
  fallbackHandlerAbi: CompatibilityFallbackHandler.abi,
  multiSendAbi: MultiSend.abi,
  multiSendCallOnlyAbi: MultiSendCallOnly.abi,
};
// TODO: docs
export default abis;
