const LOOP_INTERVAL = 1000;

function defaultCondition(code) {
  return code !== '0x';
}

export default async function loop(request, condition = defaultCondition) {
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
