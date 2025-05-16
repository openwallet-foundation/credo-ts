import { CredoError } from '@credo-ts/core'
import { CreateDrizzlePostgresOptions, DrizzlePostgresDatabase, createDrizzlePostgres } from './postgres'
import { CreateDrizzleSqliteOptions, DrizzleSqliteDatabase, createDrizzleSqlite } from './sqlite'

export type CreateDrizzleOptions<Schema extends Record<string, unknown> = Record<string, never>> =
  | CreateDrizzlePostgresOptions<Schema>
  | CreateDrizzleSqliteOptions<Schema>

export function createDrizzle<
  PostgresSchema extends Record<string, unknown> = Record<string, unknown>,
  SqliteSchema extends Record<string, unknown> = Record<string, unknown>,
>(options: CreateDrizzlePostgresOptions<PostgresSchema> | CreateDrizzleSqliteOptions<SqliteSchema>) {
  if (options.type === 'postgres') {
    return createDrizzlePostgres<PostgresSchema>(options)
  }

  if (options.type === 'sqlite') {
    return createDrizzleSqlite<SqliteSchema>(options)
  }

  // @ts-expect-error
  throw new CredoError(`Unsupported database type ${options.type}`)
}

export type DrizzleDatabase<
  PostgresSchema extends Record<string, unknown> = Record<string, unknown>,
  SqliteSchema extends Record<string, unknown> = Record<string, unknown>,
> = DrizzlePostgresDatabase<PostgresSchema> | DrizzleSqliteDatabase<SqliteSchema>
