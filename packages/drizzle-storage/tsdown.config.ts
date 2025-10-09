import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

const bundles = ['didcomm', 'action-menu', 'core', 'drpc', 'tenants', 'openid4vc', 'anoncreds', 'question-answer']
const bundleEntry = (bundle: string) => [
  `src/${bundle}/bundle.ts`,
  `src/${bundle}/sqlite.ts`,
  `src/${bundle}/postgres.ts`,
]

export default defineConfig([
  ...config.map((item) => ({
    ...item,
    entry: ['src/index.ts', ...bundles.flatMap(bundleEntry)],
  })),
  // CLI
  {
    entry: ['cli/bin.ts', 'cli/drizzle.config.ts'],
    outDir: 'cli-build',
    unbundle: true,
    format: 'esm',
    target: 'es2020',
    dts: {
      sourcemap: true,
      tsconfig: '../../tsconfig.build.json',
    },
    platform: 'node',
    logLevel: 'error',
  },
])
