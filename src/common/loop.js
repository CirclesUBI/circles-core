import CoreError, { ErrorCodes } from '~/common/error';

const LOOP_INTERVAL = 2500;
const MAX_ATTEMPTS = 10;

export default async function loop(request, condition) {
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
          throw new CoreError(
            'Tried too many times waiting for condition',
            ErrorCodes.TOO_MANY_ATTEMPTS,
          );
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, LOOP_INTERVAL);
  });
}
