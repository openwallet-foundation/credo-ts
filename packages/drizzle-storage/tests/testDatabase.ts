import { pushSQLiteSchema, pushSchema } from 'drizzle-kit/api'
import { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/pglite'
import { DrizzleStorageModule } from '../src'
import { AnyDrizzleDatabase } from '../src/DrizzleStorageModuleConfig'

type DatabaseType = 'postgres' | 'sqlite'

export async function pushDrizzleSchema(drizzleModule: DrizzleStorageModule, type: DatabaseType) {
  if (type === 'postgres') {
    const { apply } = await pushSchema(
      drizzleModule.config.schemas,
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      drizzleModule.config.database as PgDatabase<any>
    )
    await apply()
  } else {
    const { apply } = await pushSQLiteSchema(
      drizzleModule.config.schemas,
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      drizzleModule.config.database as LibSQLDatabase<any>
    )
    await apply()
  }
}

export function inMemoryDatabase(type: DatabaseType): AnyDrizzleDatabase {
  return type === 'postgres' ? drizzlePostgres('memory://') : drizzleSqlite(':memory:')
}
