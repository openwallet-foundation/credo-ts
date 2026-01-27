import { DrizzleQueryError } from 'drizzle-orm'

export enum DrizzleSqliteErrorCode {
  SQLITE_CONSTRAINT_PRIMARYKEY = 1555,
}

export enum DrizzlePostgresErrorCode {
  CONSTRAINT_UNIQUE_KEY = 23505,
}

// TODO: we should support other SQLite libraries here as well
export function extractSqliteErrorCode(error: DrizzleQueryError): DrizzleSqliteErrorCode | undefined {
  // libsql - LibsqError
  if (error.cause?.name === 'LibsqlError' && 'code' in error.cause && 'rawCode' in error.cause) {
    if (Object.values(DrizzleSqliteErrorCode).includes(error.cause.rawCode as DrizzleSqliteErrorCode))
      return error.cause.rawCode as DrizzleSqliteErrorCode
  }

  return undefined
}

// TODO: we should support other Postgres libraries here as well
export function extractPostgresErrorCode(error: DrizzleQueryError): DrizzlePostgresErrorCode | undefined {
  // pg - DatabaseError
  if (error.cause?.constructor?.name === 'DatabaseError' && 'code' in error.cause) {
    if (Object.values(DrizzlePostgresErrorCode).includes(Number(error.cause.code) as DrizzlePostgresErrorCode))
      return Number(error.cause.code).valueOf() as DrizzlePostgresErrorCode
  }

  return undefined
}
