import { existsSync } from 'fs'
import path from 'path'

export async function resolveBundle(bundle: string) {
  const options = [bundle, path.join(process.cwd(), bundle)]
  if (!bundle.startsWith('/') && !bundle.startsWith('.')) {
    options.push(`@credo-ts/drizzle-storage/${bundle}`)
  }

  let lastError: Error | undefined
  for (const option of options) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    let module: any

    try {
      module = await import(option)
    } catch (_e) {
      lastError = _e
      continue
    }

    const bundleValue = Object.values(module).find(
      (value) => value && typeof value === 'object' && 'name' in value && 'records' in value
    )
    if (!bundleValue) {
      throw new Error(`Expected module ${bundle} to export a buundle object defining the bundle.`)
    }
    return bundleValue as {
      name: string
      migrations: {
        sqlite: {
          schemaPath: string
          migrationsPath: string
        }
        postgres: {
          schemaPath: string
          migrationsPath: string
        }
      }
    }
  }

  throw new Error(`Unable to resolve bundle ${bundle}. ${lastError}`)
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

export function getDrizzleKitCliPath() {
  return path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs')
}

const __dirname = path.dirname(import.meta.url.replace('file://', ''))
export function getDrizzleConfigPath() {
  return existsSync(path.join(__dirname, 'drizzle.config.ts'))
    ? path.join(__dirname, 'drizzle.config.ts')
    : path.join(__dirname, 'drizzle.config.mjs')
}

export function log(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log(message, ...optionalParams)
}

export function errorLog(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.error(message, ...optionalParams)
}
