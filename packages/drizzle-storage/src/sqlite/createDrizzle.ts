// TODO: we need to support different drivers, not sure how to achieve that yet
import { drizzle } from 'drizzle-orm/libsql'

export interface CreateDrizzleSqliteOptions<Schema extends Record<string, unknown> = Record<string, never>> {
  type: 'sqlite'

  /**
   * The sqlite database url
   */
  databaseUrl: string

  /**
   * The schema of the database
   */
  schema: Schema
}

export function createDrizzleSqlite<Schema extends Record<string, unknown> = Record<string, never>>({
  databaseUrl,
  schema,
}: CreateDrizzleSqliteOptions<Schema>): DrizzleSqliteDatabase<Schema> {
  const db = drizzle({
    schema,
    connection: {
      url: databaseUrl,
    },
  })

  //@ts-ignore
  db.type = 'sqlite'
  return db as DrizzleSqliteDatabase<Schema>
}

export type DrizzleSqliteDatabase<Schema extends Record<string, unknown> = Record<string, never>> = ReturnType<
  typeof drizzle<Schema>
> & { type: 'sqlite' }
