import { spawnSync } from 'child_process'
import { Dialect } from './generate-migrations'
import { getDrizzleConfigPath, getMigrationsDirectory, log, resolveBundle } from './utils'

interface RunMigrationsOptions {
  database: {
    dialect: Dialect
    url: string
  }
  bundles: string[]
  directory?: string
}

export async function runMigrations({ database, bundles }: RunMigrationsOptions): Promise<void> {
  const drizzleConfigPath = getDrizzleConfigPath()

  for (const bundleModule of bundles) {
    const bundle = await resolveBundle(bundleModule)
    const dialectBundle = bundle.migrations[database.dialect]
    const drizzleMigrationsFolder = getMigrationsDirectory(dialectBundle.migrationsPath)

    const migrateResult = spawnSync('drizzle-kit', ['migrate', '--config', drizzleConfigPath], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        DRIZZLE_DATABASE_URL: database.url,
        DRIZZLE_DIALECT: database.dialect,
        DRIZZLE_MIGRATIONS_FOLDER: drizzleMigrationsFolder,
        DRIZZLE_MIGRATIONS_TABLE: `credo_migrations__${bundle.name.replace('@', '').replace('/', '_').replace('-', '_')}`,
      },
    })

    if (migrateResult.status !== 0) {
      throw new Error(
        `Error applying migrations for bundle ${bundleModule} with dialect ${database.dialect}. Error: ${migrateResult.stderr || migrateResult.stdout}`
      )
    }

    log(`Migrated bundle ${bundleModule} for dialect ${database.dialect}:`)
    log(migrateResult.stdout)
  }
}
