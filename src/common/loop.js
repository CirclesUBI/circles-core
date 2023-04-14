import CoreError, { ErrorCodes } from '~/common/error';

export default async function loop(
  request,
  condition,
  { label, maxAttempts = 10, retryDelay = 6000 } = {},
) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const run = () => {
      if (attempt > maxAttempts) {
        throw new CoreError(
          `Tried too many times waiting for condition${label && `: "${label}"`
          }`,
          ErrorCodes.TOO_MANY_ATTEMPTS,
        );
      }

      return request().then((data) => {
        if (condition(data)) {
          return data;
        } else {
          attempt += 1;

          return new Promise((resolve) => setTimeout(resolve, retryDelay)).then(
            run,
          );
        }
      });
    };

    run().then(resolve).catch(reject);
  });
}
