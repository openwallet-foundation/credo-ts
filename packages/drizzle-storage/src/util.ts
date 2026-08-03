import { and, eq, gt, lt, or } from 'drizzle-orm'
import type { ExtraConfigColumn } from 'drizzle-orm/pg-core'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { DrizzleRecordBundle } from './DrizzleRecord'

export const dirname = import.meta.dirname

export const rootDirectory = `${dirname}/..`

const addSchemaExtension = (path: string) => (dirname.endsWith('/src') ? `${path}.ts` : `${path}.mjs`)

export const bundleMigrationDefinition = (bundle: string): DrizzleRecordBundle['migrations'] => ({
  postgres: {
    schemaPath: addSchemaExtension(`${dirname}/${bundle}/postgres`),
    migrationsPath: `${rootDirectory}/migrations/${bundle}/postgres`,
  },
  sqlite: {
    schemaPath: addSchemaExtension(`${dirname}/${bundle}/sqlite`),
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

export function cursorAfterCondition<
  Table extends // biome-ignore lint/suspicious/noExplicitAny: no explanation
    | { id: SQLiteColumn<any>; createdAt: SQLiteColumn<any> }
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    | { id: ExtraConfigColumn<any>; createdAt: ExtraConfigColumn<any> },
>(table: Table, cursor: { createdAt: Date; id: string }) {
  return or(
    // This condition is purposefully less than because we have sorted the records in order of latest records first
    lt(table.createdAt, cursor.createdAt),
    and(eq(table.createdAt, cursor.createdAt), gt(table.id, cursor.id))
  )
}

export function cursorBeforeCondition<
  Table extends // biome-ignore lint/suspicious/noExplicitAny: no explanation
    | { id: SQLiteColumn<any>; createdAt: SQLiteColumn<any> }
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    | { id: ExtraConfigColumn<any>; createdAt: ExtraConfigColumn<any> },
>(table: Table, cursor: { createdAt: Date; id: string }) {
  return or(
    // This condition is purposefully great than because we have sorted the records in order of latest records first
    gt(table.createdAt, cursor.createdAt),
    and(eq(table.createdAt, cursor.createdAt), lt(table.id, cursor.id))
  )
}
