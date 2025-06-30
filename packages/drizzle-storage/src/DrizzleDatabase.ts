import { PgDatabase } from 'drizzle-orm/pg-core'
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
// Import that we only import as type to not load the driver
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

export type DrizzleSqliteDatabase<Schema extends Record<string, unknown> = Record<string, unknown>> =
  | LibSQLDatabase<Schema>
  | ExpoSQLiteDatabase<Schema>

export type DrizzlePostgresDatabase<Schema extends Record<string, unknown> = Record<string, unknown>> =
  | NodePgDatabase<Schema>
  | PgliteDatabase<Schema>

export type DrizzleDatabase<
  PostgresSchema extends Record<string, unknown> = Record<string, unknown>,
  SqliteSchema extends Record<string, unknown> = Record<string, unknown>,
> = DrizzlePostgresDatabase<PostgresSchema> | DrizzleSqliteDatabase<SqliteSchema>

export function isDrizzlePostgresDatabase(database: DrizzleDatabase): database is DrizzlePostgresDatabase {
  return database instanceof PgDatabase
}

export function isDrizzleSqliteDatabase(database: DrizzleDatabase): database is DrizzleSqliteDatabase {
  return database instanceof BaseSQLiteDatabase
}

export function getDrizzleDatabaseType(database: DrizzleDatabase): 'sqlite' | 'postgres' {
  return isDrizzlePostgresDatabase(database) ? 'postgres' : 'sqlite'
}
