import path from 'node:path'
import type { UserConfig } from 'tsdown'

export default [
  {
    entry: ['src/index.ts'],
    outDir: 'build',
    unbundle: true,
    format: 'esm',
    target: 'es2020',
    tsconfig: path.join(import.meta.dirname, 'tsconfig.build.json'),
    dts: {
      sourcemap: true,
      tsconfig: path.join(import.meta.dirname, 'tsconfig.build.json'),
    },
    platform: 'neutral',
    logLevel: 'error',
  },
  {
    entry: ['src/index.ts'],
    outDir: 'build',
    unbundle: true,
    format: 'cjs',
    target: 'es2020',
    tsconfig: path.join(import.meta.dirname, 'tsconfig.build.json'),
    dts: {
      sourcemap: true,
      tsconfig: path.join(import.meta.dirname, 'tsconfig.build.json'),
    },
    platform: 'neutral',
    logLevel: 'error',
    plugins: [
      {
        // Updates dynamic imports to require when transpiling for CJS
        // See: https://github.com/rolldown/tsdown/issues/532
        name: 'dynamic-import-to-require',
        transform: (code) => code.split(' await import(').join(' require('),
      },
    ],
  },
] satisfies UserConfig
