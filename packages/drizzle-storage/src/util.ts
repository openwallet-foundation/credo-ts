import { DrizzleRecordBundle } from './DrizzleRecord'

export const rootDirectory = `${__dirname}/..`

export const bundleMigrationDefinition = (bundle: string): DrizzleRecordBundle['migrations'] => ({
  postgres: {
    schemaSourcePath: `${rootDirectory}/src/${bundle}/postgres.ts`,
    migrationsPath: `${rootDirectory}/migrations/${bundle}/postgres`,
  },
  sqlite: {
    schemaSourcePath: `${rootDirectory}/src/${bundle}/sqlite.ts`,
    migrationsPath: `${rootDirectory}/migrations/${bundle}/sqlite`,
  },
})
