export default async function loop(request, condition, cb=()=>{}) {
  return new Promise(res => {
    setTimeout(async () => {
      const response = await request();
      if (condition(response)) return res();
      return loop(request, condition, res);
    }, 1000)})
}
