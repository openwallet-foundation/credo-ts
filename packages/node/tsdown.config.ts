import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

export default defineConfig(
  config.map((e) => ({
    ...e,
    entry: ['src/index.ts', 'src/express/index.ts', 'src/http/index.ts', 'src/websocket/index.ts'],
    platform: 'node' as const,
    dts: {
      ...(typeof e.dts === 'object' ? e.dts : {}),
      // We have overridden the tsconfig for node module
      tsconfig: 'tsconfig.build.json',
    },
  }))
)
