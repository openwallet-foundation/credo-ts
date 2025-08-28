import { existsSync } from 'fs'
import path from 'path'

export async function resolveBundle(bundle: string) {
  const options = [bundle, path.join(process.cwd(), bundle)]
  if (!bundle.startsWith('/')) {
    options.push(`@credo-ts/drizzle-storage/${bundle}`)
  }

  for (const option of options) {
    try {
      require.resolve(option)
    } catch {
      continue
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    let module: any

    try {
      module = require(option)
    } catch (e) {
      throw new Error(`Error during require of ${option}: ${e}`)
    }

    if (!module.default) {
      throw new Error(`Expected bundle ${bundle} to export default object defining the bundle.`)
    }
    return module.default as {
      name: string
      migrations: {
        sqlite: {
          schemaSourcePath: string
          migrationsPath: string
        }
        postgres: {
          schemaSourcePath: string
          migrationsPath: string
        }
      }
    }
  }

  throw new Error(`Unable to resolve bundle ${bundle}`)
}

export async function resolveSchemaFile(schemaModule: string) {
  try {
    const filePath = require.resolve(schemaModule)
    return filePath.replace('file://', '')
  } catch {
    throw new Error(`Unable to resolve schema module ${schemaModule}`)
  }
}

export function getMigrationsDirectory(migrationsPath: string) {
  const schemaMigrationsDirectory = path.relative(process.cwd(), migrationsPath)
  return schemaMigrationsDirectory
}

export function getDrizzleConfigPath() {
  return existsSync(path.join(__dirname, 'drizzle.config.ts'))
    ? path.join(__dirname, 'drizzle.config.ts')
    : path.join(__dirname, 'drizzle.config.js')
}

export function getDrizzleKitCliPath() {
  return path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs')
}

export function getTsNodeCliPath() {
  return path.join(path.dirname(require.resolve('ts-node')), 'bin.js')
}

export function log(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log(message, ...optionalParams)
}

export function errorLog(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.error(message, ...optionalParams)
}
