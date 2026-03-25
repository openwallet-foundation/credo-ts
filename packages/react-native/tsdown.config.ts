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
      // Remove the rolldown runtime import that defines __require
      const withoutImport = code.replace(
        /import\s*\{\s*__require\s*\}\s*from\s*"[^"]*\/_virtual\/_rolldown\/runtime\.mjs"\s*;?\n?/g,
        ''
      )
      // Replace __require() calls with standard require()
      return withoutImport.replace(/__require\(/g, 'require(')
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
