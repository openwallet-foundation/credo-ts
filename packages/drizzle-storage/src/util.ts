import type { DrizzleRecordBundle } from './DrizzleRecord'

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

// NOTE: due to us using legacy decorators it's not really possible
// to import the credo modules, since it causes parser errors
// the exhaustive array method does type-checking (not runtime checking)
// that all the enum values are present
export function exhaustiveArray<U extends string, T extends readonly string[]>(
  _type: U,
  arr: T &
    (T[number] extends `${U}`
      ? `${U}` extends T[number]
        ? T
        : `Expected array to contain '${U}'`
      : `Expect array to contain '${U}'`)
): T {
  return arr
}
