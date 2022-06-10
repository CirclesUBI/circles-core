// Wait ms before checking condition again
const LOOP_INTERVAL = 1000;
// Times condition is checked before its considered a fail
const MAX_ATTEMPTS = 60;

// Times the method will repeat the request after an error or condition failure
const RETRIES_ON_FAIL_DEFAULT = 3;
// When a request fails wait a few ms before we do it again
const WAIT_AFTER_FAIL_DEFAULT = 5000;

// Error message used to indicate failed condition check
const TRIED_TOO_MANY_TIMES = 'Tried too many times waiting for condition.';

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

// Helper method to wait for a few milliseconds before we move on
export async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// This helper method repeats calling a request when it fails or when a
// condition was not reached after some attempts.
//
// Use this method if you want to make a crucial request for creating or
// updating data somewhere. When this request fails, for example because of
// networking issues or server outage, this helper method will try to repeat
// the request for you until it succeeded.
export async function waitAndRetryOnFail(
  requestFn,
  loopFn,
  {
    maxAttemptsOnFail = RETRIES_ON_FAIL_DEFAULT,
    waitAfterFail = WAIT_AFTER_FAIL_DEFAULT,
  } = {},
  onErrorFn,
) {
  // Count all attempts to retry when something failed
  let attempt = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Make request and wait for response
      const response = await requestFn();

      // Wait for a few seconds until our condition arrives
      await loopFn();

      // Finish when request was successful and condition arrived!
      return response;
    } catch (error) {
      // When there is an error I want to do something
      if (onErrorFn) {
        await onErrorFn();
      }
      // Something went wrong, either the condition did not arrive or the
      // request failed
      if (attempt >= maxAttemptsOnFail) {
        // We tried too often, propagate error and stop here
        throw error;
      }

      // Wait when request failed to prevent calling the request too fast again
      if (error.message !== TRIED_TOO_MANY_TIMES) {
        await wait(waitAfterFail);
      }

      // Lets try again ..
      attempt += 1;
    }
  }
}
