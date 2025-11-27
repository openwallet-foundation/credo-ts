import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

export default defineConfig(
  config.map((item) => ({
    ...item,
    entry: ['./src/index.ts', './src/modules/vc/data-integrity/libraries/nativeDocumentLoader.native.ts'],
    plugins: [
      ...(Array.isArray(item.plugins) ? item.plugins : []),
      {
        // Adds reflect-metadata import to top of core package src/index file
        // because the imports are reordered and that causes issues since
        // reflect metadata needs to be imported first
        // See: https://github.com/rolldown/rolldown/issues/6436
        name: 'import-reflect-metadata-at-top',
        banner: (chunk: { fileName: string }) => {
          if (chunk.fileName === 'index.mjs') return "import 'reflect-metadata'"
          return ''
        },
      },
    ],
  }))
)
