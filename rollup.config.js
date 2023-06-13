import path from 'path';

import babel from '@rollup/plugin-babel';
import builtins from 'rollup-plugin-node-builtins';
import cleanup from 'rollup-plugin-cleanup';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const FOLDER_DIST = 'lib';
const FOLDER_INPUT = 'src';
const MODULE_NAME = 'CirclesCore';

function rollupPlugins(isUglified = false) {
  const plugins = [
    json(),
    builtins(),
    resolve({
      extensions: ['.js', '.json'],
      preferBuiltins: true,
    }),
    commonjs(),
    babel({
      babelHelpers: 'runtime',
      skipPreflightCheck: 'true',
    }),
    cleanup(),
  ];

  return isUglified ? plugins.concat(terser()) : plugins;
}

function buildOptions(customOptions = {}) {
  const { file, isUglified } = customOptions;

  const defaultOptions = {
    input: path.join(FOLDER_INPUT, 'index.js'),
    external: ['isomorphic-fetch'],
    plugins: isUglified ? rollupPlugins(true) : rollupPlugins(),
    output: {
      file: file
        ? path.join(FOLDER_DIST, file)
        : path.join(FOLDER_DIST, 'index.js'),
      name: MODULE_NAME,
      format: 'umd',
      sourcemap: isUglified || false,
      globals: {
        'isomorphic-fetch': 'fetch',
      },
    },
  };

  return defaultOptions;
}

export default [
  buildOptions(),
  buildOptions({
    file: 'index.min.js',
    isUglified: true,
  }),
];
