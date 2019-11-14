import CirclesCore from '~';

import createCore from './helpers/core';

let core;

beforeAll(() => {
  core = createCore();
});

describe('CirclesCore', () => {
  it('should be instantiable', () => {
    expect(core).toBeInstanceOf(CirclesCore);
  });

  it('should throw an error when missing options', () => {
    expect(() => {
      new CirclesCore({});
    }).toThrow();
  });
});
