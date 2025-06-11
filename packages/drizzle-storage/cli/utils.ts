import { spawnSync } from 'child_process'
import path from 'path'

export async function resolveBundle(bundle: string) {
  const options = [`@credo-ts/drizzle-storage/${bundle}`, bundle]

  for (const option of options) {
    try {
      const module = require(option)

      if (!module.default) {
        throw new Error(`Expected bundle ${bundle} to export default object defining the bundle.`)
      }
      return module.default as {
        name: string
        migrations: {
          sqlite: {
            schemaModule: string
            migrationsPath: string
          }
          postgres: {
            schemaModule: string
            migrationsPath: string
          }
        }
      }
    } catch {
      // no-op
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

export function getMigrationsDirectory(schemaFile: string, migrationsPath: string) {
  const schemaDirectory = path.dirname(schemaFile)

  const drizzleMigrationsFolder = path.join(schemaDirectory, migrationsPath)
  const schemaMigrationsDirectory = path.relative(process.cwd(), drizzleMigrationsFolder)

  return schemaMigrationsDirectory
}

export async function getDrizzleKitCliPath() {
  // Find drizzle-kit CLI path
  const result = spawnSync(
    'npx',
    ['--package', 'which', '--package', 'drizzle-kit', '-c', 'node -p "require.resolve(\'drizzle-kit\')"'],
    {
      encoding: 'utf-8',
    }
  )

  if (result.status !== 0) {
    throw new Error(`Expected command to return status 0, received ${result.status}. Error: ${result.stderr}`)
  }

  const drizzleKitCliPath = path.join(path.dirname(result.stdout.trim()), 'bin.cjs')
  return drizzleKitCliPath
}

export function log(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log(message, ...optionalParams)
}

export function errorLog(message: string, ...optionalParams: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.error(message, ...optionalParams)
}
