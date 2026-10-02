import MagicString from 'magic-string'
import { defineConfig } from 'tsdown'
import config from '../../tsdown.config.base'

/**
 * Rolldown transforms `require()` calls into `__require()` in ESM output.
 * React Native's Metro bundler relies on statically tracing `require()` calls
 * to resolve and include modules in the bundle. The `__require()` wrapper is
 * opaque to Metro, causing optional peer dependencies (e.g. react-native-fs)
 * to be missing from the bundle at runtime.
 *
 * This plugin restores `require()` in the output so Metro (used by both
 * React Native and Expo) can properly discover and bundle these dependencies.
 */
function preserveRequirePlugin() {
  return {
    name: 'preserve-require',
    renderChunk(code: string) {
      const transformed = new MagicString(code)
      const runtimeImport = /import\s*\{\s*__require\s*\}\s*from\s*"[^"]*\/_virtual\/_rolldown\/runtime\.mjs"\s*;?\n?/g

      for (const match of code.matchAll(runtimeImport)) {
        transformed.remove(match.index, match.index + match[0].length)
      }

      for (const match of code.matchAll(/__require\(/g)) {
        transformed.overwrite(match.index, match.index + match[0].length, 'require(')
      }

      return {
        code: transformed.toString(),
        map: transformed.generateMap({ hires: true }),
      }
    },
  }
}

export default defineConfig(
  config.map((e) => ({
    ...e,
    plugins: [...(Array.isArray(e.plugins) ? e.plugins : e.plugins ? [e.plugins] : []), preserveRequirePlugin()],
    dts: {
      ...(typeof e.dts === 'object' ? e.dts : {}),
      // We have overridden the tsconfig for react-native module
      tsconfig: 'tsconfig.build.json',
    },
  }))
)
