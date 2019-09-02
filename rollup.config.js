import path from 'path';

import babel from 'rollup-plugin-babel';
import cleanup from 'rollup-plugin-cleanup';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import { uglify } from 'rollup-plugin-uglify';

const DIST_FILE = 'index.js';
const DIST_FOLDER = 'lib';

const EXTENSIONS = ['.js', '.json'];

const INPUT_FILE = 'index.js';
const INPUT_FOLDER = 'src';

const MODULE_NAME = 'CirclesCore';

function rollupPlugins(isUglified = false) {
  const plugins = [
    resolve({
      extensions: EXTENSIONS,
    }),
    json(),
    commonjs(),
    babel({
      extensions: EXTENSIONS,
      runtimeHelpers: true,
    }),
    cleanup(),
  ];

  return isUglified ? plugins.concat(uglify()) : plugins;
}

function buildOptions(customOptions = {}) {
  const { file, isUglified } = customOptions;

  const defaultOptions = {
    input: path.join(INPUT_FOLDER, INPUT_FILE),
    external: [],
    plugins: isUglified ? rollupPlugins(true) : rollupPlugins(),
    output: {
      file: file
        ? path.join(DIST_FOLDER, file)
        : path.join(DIST_FOLDER, DIST_FILE),
      name: MODULE_NAME,
      format: 'umd',
      sourcemap: isUglified || false,
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
