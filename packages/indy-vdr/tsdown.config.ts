import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

export default defineConfig(
  config.map((item) => ({
    ...item,
    entry: ['./src/index.ts', './src/anoncreds/index.ts'],
  }))
)
