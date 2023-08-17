import { ZERO_ADDRESS } from '~/common/constants';
import { getSafeContract } from '~/common/getContracts';

// Set up manually a Safe for being fully usable in Circles
export default async function setupAccount({ account, nonce }, core) {
  const {
    contracts: { safeMaster, hub, proxyFactory },
    options: {
      fallbackHandlerAddress,
      hubAddress,
      proxyFactoryAddress,
      safeMasterAddress,
    },
    safe,
    web3,
  } = core;
  const safeAddress = await safe.predictAddress(account, { nonce });
  let safeSdk;

  return (
    // Deploy manually a Safe
    web3.eth
      .sendTransaction({
        from: account.address,
        to: proxyFactoryAddress,
        value: 0,
        data: proxyFactory.methods
          .createProxyWithNonce(
            safeMasterAddress,
            safeMaster.methods
              .setup(
                [account.address],
                1,
                ZERO_ADDRESS,
                '0x',
                fallbackHandlerAddress,
                ZERO_ADDRESS,
                0,
                ZERO_ADDRESS,
              )
              .encodeABI(),
            nonce,
          )
          .encodeABI(),
      })
      // Instantiate deployed Safe
      .then(async () => {
        safeSdk = await safe.getSafeSdk(account, { safeAddress });
      })
      // Prepare transaction for Safe to be signed up
      .then(() =>
        safeSdk.createTransaction({
          safeTransactionData: {
            to: hubAddress,
            value: 0,
            data: hub.methods.signup().encodeABI(),
          },
        }),
      )
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
      .then(() => safeAddress)
  );
}
