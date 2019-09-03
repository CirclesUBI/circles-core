const DEFAULT_TYPE = 'string';

const validators = {
  number: value => {
    return typeof value === 'number';
  },
  string: value => {
    return typeof value === 'string';
  },
  object: value => {
    return typeof value === 'object';
  },
};

export default function checkOptions(options, fields) {
  if (!options || typeof options !== 'object') {
    throw new Error('Options missing');
  }

  return Object.keys(fields).reduce((acc, key) => {
    const type =
      fields[key] && 'type' in fields[key] && fields[key].type in validators
        ? fields[key].type
        : DEFAULT_TYPE;

    const validatorFn = typeof type === 'function' ? type : validators[type];

    const defaultValue =
      fields[key] && 'default' in fields[key] ? fields[key].default : null;

    if (defaultValue !== null && !validatorFn(defaultValue)) {
      throw new Error(`Field "${key}" has invalid default type`);
    }

    if (!(key in options) || !options[key]) {
      if (defaultValue === null) {
        throw new Error(`"${key}" is missing in options`);
      }

      acc[key] = defaultValue;
    } else if (validatorFn(options[key])) {
      acc[key] = options[key];
    } else {
      throw new Error(`"${key}" has invalid type`);
    }

    return acc;
  }, {});
}
