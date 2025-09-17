import { DrizzleRecordBundle } from './DrizzleRecord'

export const rootDirectory = `${__dirname}/..`

export const bundleMigrationDefinition = (bundle: string): DrizzleRecordBundle['migrations'] => ({
  postgres: {
    schemaSourcePath: `${rootDirectory}/build/${bundle}/postgres.js`,
    migrationsPath: `${rootDirectory}/migrations/${bundle}/postgres`,
  },
  sqlite: {
    schemaSourcePath: `${rootDirectory}/build/${bundle}/sqlite.js`,
    migrationsPath: `${rootDirectory}/migrations/${bundle}/sqlite`,
  },
})
