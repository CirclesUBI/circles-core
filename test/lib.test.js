import CirclesCore from '~';

import core from './helpers/core';

describe('CirclesCore', () => {
  it('should be instantiable', () => {
    expect(core).toBeInstanceOf(CirclesCore);
  });

  it('should throw an error when missing options', () => {
    expect(() => {
      new CirclesCore({});
    }).toThrow(core.CoreError);
  });
});
