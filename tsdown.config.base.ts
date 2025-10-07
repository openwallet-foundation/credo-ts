import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    outDir: 'build',
    unbundle: true,
    format: 'esm',
    target: 'es2020',
    dts: {
      sourcemap: true,
      tsconfig: 'tsconfig.build.json',
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
    dts: {
      sourcemap: true,
      tsconfig: 'tsconfig.build.json',
    },
    platform: 'neutral',
    logLevel: 'error',
  },
])
