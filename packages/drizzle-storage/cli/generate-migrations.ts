import { spawnSync } from 'child_process'
import path from 'path'
import {
  getDrizzleConfigPath,
  getDrizzleKitCliPath,
  getMigrationsDirectory,
  getTsNodeCliPath,
  log,
  resolveBundle,
  resolveSchemaFile,
} from './utils'

export type Dialect = 'sqlite' | 'postgres'

interface GenerateMigrationOptions {
  name?: string
  dialects: readonly Dialect[]
  bundles: string[]
}

export async function generateMigrations({ dialects, bundles, name }: GenerateMigrationOptions): Promise<void> {
  const tsconfig = path.resolve(__dirname, '..', 'tsconfig.drizzle.json')

  const drizzleKitCliPath = getDrizzleKitCliPath()
  const drizzleConfigPath = getDrizzleConfigPath()
  const tsNodeCliPath = getTsNodeCliPath()

  for (const bundleModule of bundles) {
    const bundle = await resolveBundle(bundleModule)

    for (const dialect of dialects) {
      const dialectBundle = bundle.migrations[dialect]
      const schemaFile = await resolveSchemaFile(dialectBundle.schemaSourcePath)
      const drizzleMigrationsFolder = getMigrationsDirectory(dialectBundle.migrationsPath)

      const migrateResult = spawnSync(
        tsNodeCliPath,
        [
          '--project',
          tsconfig,
          drizzleKitCliPath,
          'generate',
          '--config',
          drizzleConfigPath,
          ...(name ? ['--name', name] : []),
        ],
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
          `Error generating migrations for schema ${dialectBundle.schemaSourcePath} with dialect ${dialect}. Error: ${migrateResult.stderr || migrateResult.stdout}`
        )
      }

      log(`Generated migrations for ${dialectBundle.schemaSourcePath} with dialect ${dialect}:`)
      log(migrateResult.stdout)
    }
  }
}
