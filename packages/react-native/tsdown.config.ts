import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

export default defineConfig(
  config.map((e) => ({
    ...e,
    dts: {
      ...e.dts,
      // We have overridden the tsconfig for react-native module
      tsconfig: 'tsconfig.build.json',
    },
  }))
)
