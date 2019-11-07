const LOOP_INTERVAL = 1000;

export function isContractDeployed(code) {
  return code !== '0x';
}

export async function getTrustConnection(
  core,
  checkAccount,
  checkSafeAddress,
  checkOtherSafeAddress,
) {
  const network = await core.trust.getNetwork(checkAccount, {
    safeAddress: checkSafeAddress,
  });

  return network.find(item => item.safeAddress === checkOtherSafeAddress);
}

export default async function loop(request, condition = isContractDeployed) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await request();

        if (condition(response)) {
          clearInterval(interval);
          resolve(response);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, LOOP_INTERVAL);
  });
}
