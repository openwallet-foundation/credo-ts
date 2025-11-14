import { spawnSync } from 'child_process'
import {
  getDrizzleConfigPath,
  getDrizzleKitCliPath,
  getMigrationsDirectory,
  log,
  resolveBundle,
  resolveSchemaFile,
} from './utils'

export type Dialect = 'sqlite' | 'postgres'

interface GenerateMigrationOptions {
  name?: string
  dialects: readonly Dialect[]
  bundles: string[]
  silent?: boolean
}

export async function generateMigrations({ dialects, bundles, name, silent }: GenerateMigrationOptions): Promise<void> {
  const drizzleConfigPath = getDrizzleConfigPath()
  const drizzleKitCliPath = getDrizzleKitCliPath()

  for (const bundleModule of bundles) {
    const bundle = await resolveBundle(bundleModule)

    for (const dialect of dialects) {
      const dialectBundle = bundle.migrations[dialect]
      const schemaFile = await resolveSchemaFile(dialectBundle.schemaPath)
      const drizzleMigrationsFolder = getMigrationsDirectory(dialectBundle.migrationsPath)

      const migrateResult = spawnSync(
        drizzleKitCliPath,
        ['generate', '--config', drizzleConfigPath, ...(name ? ['--name', name] : [])],
        {
          encoding: 'utf-8',
          stdio: 'inherit',
          env: {
            ...process.env,
            DRIZZLE_DIALECT: dialect,
            DRIZZLE_SCHEMA_FILE: schemaFile,
            DRIZZLE_MIGRATIONS_FOLDER: drizzleMigrationsFolder,
          },
        }
      )

      if (migrateResult.status !== 0 || (migrateResult.stderr !== '' && migrateResult.stderr !== null)) {
        throw new Error(
          `Error generating migrations for schema ${dialectBundle.schemaPath} with dialect ${dialect}. Error: ${migrateResult.stderr || migrateResult.stdout}`
        )
      }

      if (!silent) log(`Generated migrations for ${dialectBundle.schemaPath} with dialect ${dialect}:`)
      if (!silent) log(migrateResult.stdout)
    }
  }
}
