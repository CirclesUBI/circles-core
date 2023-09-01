import { ZERO_ADDRESS } from '~/common/constants';

// Set up manually a Safe for being fully usable in Circles
export default async function setupAccountManual({ account, nonce }, core) {
  const {
    contracts: { safeMaster, proxyFactory },
    options: { fallbackHandlerAddress, proxyFactoryAddress, safeMasterAddress },
    safe,
    utils,
  } = core;
  const safeAddress = await safe.predictAddress(account, { nonce });

  return (
    // Deploy manually a Safe
    utils
      .sendTransaction({
        target: proxyFactoryAddress,
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
      .then(() => safeAddress)
  );
}
