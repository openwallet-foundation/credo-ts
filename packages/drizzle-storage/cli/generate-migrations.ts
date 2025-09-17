import { spawnSync } from 'child_process'
import { getDrizzleConfigPath, getMigrationsDirectory, log, resolveBundle, resolveSchemaFile } from './utils'

export type Dialect = 'sqlite' | 'postgres'

interface GenerateMigrationOptions {
  name?: string
  dialects: readonly Dialect[]
  bundles: string[]
}

export async function generateMigrations({ dialects, bundles, name }: GenerateMigrationOptions): Promise<void> {
  const drizzleConfigPath = getDrizzleConfigPath()

  for (const bundleModule of bundles) {
    const bundle = await resolveBundle(bundleModule)

    for (const dialect of dialects) {
      const dialectBundle = bundle.migrations[dialect]
      const schemaFile = await resolveSchemaFile(dialectBundle.schemaPath)
      const drizzleMigrationsFolder = getMigrationsDirectory(dialectBundle.migrationsPath)

      const migrateResult = spawnSync(
        'drizzle-kit',
        ['generate', '--config', drizzleConfigPath, ...(name ? ['--name', name] : [])],
        {
          encoding: 'utf-8',
          env: {
            ...process.env,
            DRIZZLE_DIALECT: dialect,
            DRIZZLE_SCHEMA_FILE: schemaFile,
            DRIZZLE_MIGRATIONS_FOLDER: drizzleMigrationsFolder,
          },
        }
      )

      if (migrateResult.status !== 0 || migrateResult.stderr !== '') {
        throw new Error(
          `Error generating migrations for schema ${dialectBundle.schemaPath} with dialect ${dialect}. Error: ${migrateResult.stderr || migrateResult.stdout}`
        )
      }

      log(`Generated migrations for ${dialectBundle.schemaPath} with dialect ${dialect}:`)
      log(migrateResult.stdout)
    }
  }
}
