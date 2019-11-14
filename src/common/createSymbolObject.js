export default function createSymbolObject(values) {
  return values.reduce((acc, type) => {
    acc[type] = Symbol(type);
    return acc;
  }, {});
}
