export default async function loop(request, condition) {
  return new Promise(resolve => {
    const interval = setInterval(async () => {
      const response = await request();

      if (condition(response)) {
        clearInterval(interval);
        resolve(response);
      }
    }, 1000);
  });
}
