import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

import html from '@rollup/plugin-html';
import copy from 'rollup-plugin-copy';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';

const port = 12121; // visit http://localhost:12121

const isDev = process.env.NODE_ENV === 'development';

const plugins = [
  nodeResolve({
    browser: true,
    preferBuiltins: false,
  }),
  typescript({
    tsconfig: './tsconfig.json',
  }),
  commonjs(),
  terser(),
];

let config;

if (isDev) {
  config = {
    input: 'main.ts',
    output: {
      file: 'dev/bundle.js',
      format: 'esm',
    },
    watch: { exclude: ['node_modules/**'] },
    plugins: [
      ...plugins,
      html({
        title: 'leafer-x-path-editor',
        meta: [
          { charset: 'utf-8' },
          {
            name: 'viewport',
            content:
              'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no',
          },
        ],
      }),
      copy({ targets: [{ src: 'public/*', dest: 'dev/' }] }),
      livereload(),
      serve({ contentBase: ['dev/'], port }),
    ],
  };
} else {
  config = {
    input: 'main.ts',
    output: {
      file: 'dev/bundle.js',
      format: 'esm',
    },
    plugins: [
      ...plugins,
      html({
        title: 'leafer-x-path-editor',
        meta: [
          { charset: 'utf-8' },
          {
            name: 'viewport',
            content:
              'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no',
          },
        ],
      }),
      copy({ targets: [{ src: 'public/*', dest: 'dev/' }] }),
    ],
  };
}

export default config;
