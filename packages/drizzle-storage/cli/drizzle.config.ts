import { type Config, defineConfig } from 'drizzle-kit'

const drizzleDatabaseUrl = process.env.DRIZZLE_DATABASE_URL

const drizzleDialect = process.env.DRIZZLE_DIALECT
if (!drizzleDialect || (drizzleDialect !== 'sqlite' && drizzleDialect !== 'postgres')) {
  throw new Error("The DRIZZLE_DIALECT environment variable must be set to 'postgres' or 'sqlite'")
}

const drizzleSchemaFile = process.env.DRIZZLE_SCHEMA_FILE
const drizzleMigrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER
const drizzleMigrationsTable = process.env.DRIZZLE_MIGRATIONS_TABLE

let drizzleConfig: Config

if (drizzleDialect === 'sqlite') {
  drizzleConfig = defineConfig({
    dialect: drizzleDialect,
    // We don't want to provide a schema when migrating, as it requires a custom bundler that supports
    // emitting decorator metadata. Drizzle is built on esbuild which doesn't support this
    // We only need this for migration generation
    schema: drizzleSchemaFile,
    out: drizzleMigrationsFolder,
    migrations: drizzleMigrationsTable
      ? {
          table: drizzleMigrationsTable,
        }
      : undefined,
    ...(drizzleDatabaseUrl
      ? {
          dbCredentials: { url: drizzleDatabaseUrl },
        }
      : {
          driver: 'expo',
        }),
  })
} else {
  drizzleConfig = defineConfig({
    dialect: 'postgresql',
    schema: drizzleSchemaFile,
    out: drizzleMigrationsFolder,
    migrations: drizzleMigrationsTable
      ? {
          table: drizzleMigrationsTable,
        }
      : undefined,
    ...(drizzleDatabaseUrl
      ? {
          dbCredentials: { url: drizzleDatabaseUrl },
        }
      : {}),
  })
}

export default drizzleConfig
