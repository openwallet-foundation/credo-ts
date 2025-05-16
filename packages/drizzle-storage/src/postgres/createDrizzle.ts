// FIXME: import this requires the driver, need to think about that
import { drizzle } from 'drizzle-orm/node-postgres'

export interface CreateDrizzlePostgresOptions<Schema extends Record<string, unknown> = Record<string, never>> {
  type: 'postgres'

  /**
   * The postgres database url
   */
  databaseUrl: string

  /**
   * The schema of the database
   */
  schema: Schema
}

export function createDrizzlePostgres<Schema extends Record<string, unknown> = Record<string, never>>({
  databaseUrl,
  schema,
}: CreateDrizzlePostgresOptions<Schema>): DrizzlePostgresDatabase<Schema> {
  const db = drizzle({
    schema,
    connection: {
      url: databaseUrl,
    },
  })

  // @ts-ignore
  db.type = 'postgres'
  return db as DrizzlePostgresDatabase<Schema>
}

export type DrizzlePostgresDatabase<Schema extends Record<string, unknown> = Record<string, never>> = ReturnType<
  typeof drizzle<Schema>
> & { type: 'postgres' }
