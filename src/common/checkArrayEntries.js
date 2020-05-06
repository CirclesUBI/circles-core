export default function checkArrayEntries(arr, validatorFn) {
  if (!Array.isArray(arr)) {
    return false;
  }

  return (
    arr.find((entry) => {
      return !validatorFn(entry);
    }) === undefined
  );
}
