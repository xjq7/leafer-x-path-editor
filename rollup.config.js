import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

// config

const globalName = 'LeaferX.pathEditor';
const basePath = '.';
const supportPlatforms = ['web', 'worker', 'node', 'miniapp'];
const external = {
  '@leafer-ui/core': 'LeaferUI',
  '@leafer-in/editor': 'LeaferIN',
  '@leafer-in/state': 'LeaferIN',
}; // 声明外部依赖，不打进插件包，只引用

const port = 12121; // visit http://localhost:12121

// ------

const isDev = process.env.NODE_ENV === 'development';
const platformName = process.env.PLATFORM;

const platform = {
  all: {
    name: 'index', // output index.esm.js index.js
    path: basePath,
    withFormat: supportPlatforms.includes('node') ? ['cjs'] : false,
    withMin: 'min',
    external,
  },
};

const plugins = [
  nodeResolve({
    browser: true,
    preferBuiltins: false,
  }),
  typescript({
    tsconfig: './tsconfig.json',
  }),
  commonjs(),
];

let // build

  config = [
    {
      // types/index.d.ts
      input: basePath + '/src/index.ts',
      output: {
        file: basePath + '/types/index.d.ts',
      },
      plugins: [dts()],
    },
  ];

let p = platform[platformName];
if (!(p instanceof Array)) p = [p];

const list = [];

p.forEach((c) => {
  if (c.input && c.output) {
    list.push(c);
  } else {
    const input = c.input || c.path + '/src/index.ts';
    const fileBase = c.path + '/dist/' + (c.name || platformName);

    const global = c.withGlobal;
    const min = c.withMin;
    let external = c.external;

    list.push({ external, input, output: fileBase + '.esm.js' });
    if (c.withMin)
      list.push({
        min,
        external,
        input,
        output: fileBase + '.esm.' + min + '.js',
      });

    if (c.withFormat) {
      c.withFormat.forEach((format) => {
        const cjs = format === 'cjs';
        list.push({
          external,
          input,
          output: fileBase + (cjs ? '.cjs' : '.' + format + '.js'),
          format,
        });
        if (c.withMin)
          list.push({
            min,
            external,
            input,
            output:
              fileBase +
              (cjs ? '.' + min + '.cjs' : '.' + format + '.' + min + '.js'),
            format,
          });
      });
    }

    if (global) {
      if (c.fullGlobal) external = null;
      list.push({ global, external, input, output: fileBase + '.js' });
      if (c.withMin)
        list.push({
          global,
          min,
          external,
          input,
          output: fileBase + '.' + min + '.js',
        });
    }
  }
});

list.forEach((c) => {
  const item = {
    external: c.external ? Object.keys(c.external) : null,
    input: c.input,
    plugins: [...plugins],
  };

  if (c.global) {
    item.output = {
      file: c.output,
      name: c.global,
      format: c.format || 'iife',
    };

    if (c.external) item.output.globals = c.external;
  } else {
    item.output = {
      file: c.output,
      format: c.format || 'esm',
    };
  }

  if (c.min) item.plugins.push(terser({ format: { comments: false } }));

  config.push(item);
});

export default config;
