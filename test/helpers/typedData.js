// Copied from circles-core src/common/
import { sign } from 'eth-lib/lib/account';

import web3 from 'web3';
import Web3EthAbi from 'web3-eth-abi';

// Format transaction hash data for signing.
export function formatTypedData({
  to,
  value,
  txData,
  operation,
  safeTxGas,
  baseGas,
  gasPrice,
  gasToken,
  refundReceiver,
  nonce,
  verifyingContract,
}) {
  return {
    types: {
      EIP712Domain: [{ type: 'address', name: 'verifyingContract' }],
      SafeTx: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'value' },
        { type: 'bytes', name: 'data' },
        { type: 'uint8', name: 'operation' },
        { type: 'uint256', name: 'safeTxGas' },
        { type: 'uint256', name: 'baseGas' },
        { type: 'uint256', name: 'gasPrice' },
        { type: 'address', name: 'gasToken' },
        { type: 'address', name: 'refundReceiver' },
        { type: 'uint256', name: 'nonce' },
      ],
    },
    domain: {
      verifyingContract,
    },
    primaryType: 'SafeTx',
    message: {
      to,
      value,
      data: txData,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
    },
  };
}

function dependencies(typedData, primaryType, found = []) {
  if (found.includes(primaryType)) {
    return found;
  }

  if (typedData.types[primaryType] === undefined) {
    return found;
  }

  found.push(primaryType);

  for (let field of typedData.types[primaryType]) {
    for (let dep of dependencies(typedData, field.type, found)) {
      if (!found.includes(dep)) {
        found.push(dep);
      }
    }
  }

  return found;
}

function encodeType(typedData, primaryType) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(typedData, primaryType);
  deps = deps.filter((t) => t != primaryType);
  deps = [primaryType].concat(deps.sort());

  // Format as a string with fields
  let result = '';
  for (let type of deps) {
    result += `${type}(${typedData.types[type]
      .map(({ name, type }) => `${type} ${name}`)
      .join(',')})`;
  }
  return result;
}

function typeHash(typedData, primaryType) {
  return web3.utils.keccak256(encodeType(typedData, primaryType));
}

function encodeData(typedData, primaryType, data) {
  let types = [];
  let values = [];

  types.push('bytes32');
  values.push(typeHash(typedData, primaryType));

  for (let field of typedData.types[primaryType]) {
    let value = data[field.name];

    if (field.type == 'string' || field.type == 'bytes') {
      types.push('bytes32');
      value = web3.utils.keccak256(value);
    } else if (typedData.types[field.type] !== undefined) {
      types.push('bytes32');
      const test = encodeData(typedData, field.type, data[field.name]);
      value = web3.utils.keccak256(test);
    } else {
      types.push(field.type);
    }

    values.push(value);
  }

  return Web3EthAbi.encodeParameters(types, values);
}

function structHash(typedData, primaryType, data) {
  const hash = encodeData(typedData, primaryType, data);
  return web3.utils.keccak256(hash).slice(2);
}

// Hash and sign EIP 712 transaction for relayer.
export function signTypedData(privateKey, typedData) {
  const typedDataHash = web3.utils.keccak256(
    [
      '0x1901',
      structHash(typedData, 'EIP712Domain', typedData.domain),
      structHash(typedData, typedData.primaryType, typedData.message),
    ].join(''),
  );

  return sign(typedDataHash, privateKey);
}
