const LOOP_INTERVAL = 1000;
const MAX_ATTEMPTS = 60;

export function isContractDeployed(code) {
  return code !== '0x';
}

export function isReady(value) {
  return value;
}

export async function getTrustConnection(
  core,
  account,
  safeAddress,
  otherSafeAddress,
) {
  const network = await core.trust.getNetwork(account, {
    safeAddress,
  });

  return network.find((item) => item.safeAddress === otherSafeAddress);
}

export default async function loop(
  label,
  request,
  condition = isContractDeployed,
) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const interval = setInterval(async () => {
      try {
        const response = await request();

        attempt += 1;

        if (condition(response)) {
          clearInterval(interval);
          resolve(response);
        } else if (attempt > MAX_ATTEMPTS) {
          throw new Error(
            `Tried too many times waiting for condition "${label}"`,
          );
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, LOOP_INTERVAL);
  });
}
