import { spawnSync } from 'child_process'
import path from 'path'
import { getDrizzleKitCliPath, getMigrationsDirectory, log, resolveBundle, resolveSchemaFile } from './utils'

export type Dialect = 'sqlite' | 'postgres'

interface GenerateMigrationOptions {
  name?: string
  dialects: readonly Dialect[]
  bundles: string[]
}

export async function generateMigrations({ dialects, bundles, name }: GenerateMigrationOptions): Promise<void> {
  const tsconfig = path.resolve(__dirname, '..', 'tsconfig.json')
  const drizzleKitCliPath = await getDrizzleKitCliPath()
  const configPath = path.join(__dirname, '..', 'cli', 'drizzle.config.ts')

  for (const bundleModule of bundles) {
    const bundle = await resolveBundle(bundleModule)

    for (const dialect of dialects) {
      const dialectBundle = bundle.migrations[dialect]
      const schemaFile = await resolveSchemaFile(dialectBundle.schemaModule)
      const drizzleMigrationsFolder = getMigrationsDirectory(schemaFile, dialectBundle.migrationsPath)

      const migrateResult = spawnSync(
        'npx',
        [
          'ts-node',
          '--project',
          tsconfig,
          drizzleKitCliPath,
          'generate',
          '--config',
          configPath,
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

      if (migrateResult.status !== 0) {
        throw new Error(
          `Error generating migrations for schema ${dialectBundle.schemaModule} with dialect ${dialect}. Error: ${migrateResult.stderr || migrateResult.stdout}`
        )
      }

      log(`Generated migrations for ${dialectBundle.schemaModule} with dialect ${dialect}:`)
      log(migrateResult.stdout)
    }
  }
}
