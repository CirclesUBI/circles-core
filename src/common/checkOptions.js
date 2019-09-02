export default function checkOptions(options, required) {
  if (!options || typeof options !== 'object') {
    throw new Error('Options missing');
  }

  return required.reduce((acc, key) => {
    if (!(key in options) || !options[key]) {
      throw new Error(`"${key}" is missing in options`);
    }

    acc[key] = options[key];

    return acc;
  }, {});
}
