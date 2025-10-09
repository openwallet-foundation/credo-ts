import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

export default defineConfig(
  config.map((item) => ({
    ...item,
    // We have a custom entry point for react native
    entry: ['./src/index.ts', './src/shared/router/express.native.ts'],
  }))
)
