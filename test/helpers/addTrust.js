import { getSafeContract } from '~/common/getContracts';

import getTrustConnection from './getTrustConnection';

export default async function addTrust(
  { account, safeAddress, safeAddressToTrust, limitPercentage },
  core,
) {
  const {
    contracts: { hub },
    options: { hubAddress },
    safe,
    utils,
    web3,
  } = core;
  // Retrieve safe
  const safeSdk = await safe.getSafeSdk(account, { safeAddress });

  // Prepare transaction to trust a Safe
  return (
    safeSdk
      .createTransaction({
        safeTransactionData: {
          to: hubAddress,
          value: 0,
          data: hub.methods
            .trust(safeAddressToTrust, limitPercentage)
            .encodeABI(),
        },
      })
      .then((safeTx) => safeSdk.signTransaction(safeTx))
      // Execute manually the transaction
      .then((signedSafeTx) =>
        web3.eth.sendTransaction({
          from: account.address,
          to: safeAddress,
          value: 0,
          data: getSafeContract(web3, safeAddress)
            .methods.execTransaction(
              signedSafeTx.data.to,
              signedSafeTx.data.value,
              signedSafeTx.data.data,
              signedSafeTx.data.operation,
              signedSafeTx.data.safeTxGas,
              signedSafeTx.data.baseGas,
              signedSafeTx.data.gasPrice,
              signedSafeTx.data.gasToken,
              signedSafeTx.data.refundReceiver,
              signedSafeTx.encodedSignatures(),
            )
            .encodeABI(),
        }),
      )
      .then(() =>
        utils.loop(
          () =>
            getTrustConnection(core, account, safeAddress, safeAddressToTrust),
          (isReady) => isReady,
          { label: 'Wait for the graph to index newly added trust connection' },
        ),
      )
  );
}
