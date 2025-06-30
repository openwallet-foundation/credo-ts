import { PgDatabase } from 'drizzle-orm/pg-core'
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export type DrizzleSqliteDatabase<Schema extends Record<string, unknown> = Record<string, unknown>> =
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  BaseSQLiteDatabase<'sync' | 'async', any, Schema>

export type DrizzlePostgresDatabase<Schema extends Record<string, unknown> = Record<string, unknown>> = PgDatabase<
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  any,
  Schema
>

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
