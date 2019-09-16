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
  array: value => {
    return Array.isArray(value);
  },
};

/**
 * Check for required option fields, validate them and use fallback
 * value when default is given.
 *
 * @param {Object} options - given user options
 * @param {Object} fields - defined option types and default values
 *
 * @return {Object} - cleaned options
 */
export default function checkOptions(options, fields) {
  if (!options || typeof options !== 'object') {
    throw new Error('Options missing');
  }

  return Object.keys(fields).reduce((acc, key) => {
    const type =
      fields[key] && 'type' in fields[key] ? fields[key].type : DEFAULT_TYPE;

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
