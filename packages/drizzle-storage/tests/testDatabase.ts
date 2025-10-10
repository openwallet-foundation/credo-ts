import { Agent, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { Client as ClientType, Pool as PoolType } from 'pg'
import { type DrizzleRecord, DrizzleStorageModule } from '../src'
import { type DrizzlePostgresDatabase, isDrizzlePostgresDatabase } from '../src/DrizzleDatabase'
import type { AnyDrizzleDatabase } from '../src/DrizzleStorageModuleConfig'

export type DrizzlePostgresTestDatabase = {
  pool: PoolType
  drizzle: DrizzlePostgresDatabase
  teardown: () => Promise<void>
  drizzleConnectionString: string
}

export async function createDrizzlePostgresTestDatabase(): Promise<DrizzlePostgresTestDatabase> {
  const { Pool, Client } = await import('pg')
  const databaseName = utils.uuid().replace('-', '')

  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  })

  const drizzleConnectionString = `postgresql://postgres:postgres@localhost:5432/${databaseName}`
  const drizzleClient = new Pool({
    connectionString: drizzleConnectionString,
  })

  await pgClient.connect()
  await pgClient.query(`CREATE DATABASE "${databaseName}";`)

  return {
    pool: drizzleClient,
    drizzle: (await drizzlePostgresDatabase(drizzleClient)) as DrizzlePostgresDatabase,
    drizzleConnectionString,
    teardown: async () => {
      await drizzleClient.end()
      await pgClient.query(`DROP DATABASE "${databaseName}";`)
      await pgClient.end()
    },
  }
}

export type DrizzleRecordTest = Awaited<ReturnType<typeof setupDrizzleRecordTest>>
export async function setupDrizzleRecordTest(databaseType: 'postgres' | 'sqlite', drizzleRecord: DrizzleRecord) {
  const postgresDrizzle = databaseType === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
  const drizzle = postgresDrizzle ? postgresDrizzle.drizzle : await inMemoryDrizzleSqliteDatabase()

  const drizzleModule = new DrizzleStorageModule({
    database: drizzle,
    bundles: [
      {
        name: 'drizzleRecordTest',
        records: [drizzleRecord],
        migrations: {
          sqlite: { migrationsPath: '', schemaPath: '' },
          postgres: { migrationsPath: '', schemaPath: '' },
        },
      },
    ],
  })

  // Push schema during tests (no migrations applied)
  await pushDrizzleSchema(drizzleModule)

  const agent = new Agent({
    dependencies: agentDependencies,
    modules: {
      storage: drizzleModule,
    },
  })

  await agent.initialize()

  return {
    agent,
    teardown: async () => {
      await agent.shutdown()
      await postgresDrizzle?.teardown()
    },
  }
}

export async function pushDrizzleSchema(drizzleModule: DrizzleStorageModule) {
  const { pushSQLiteSchema, pushSchema } = await import('drizzle-kit/api')
  if (isDrizzlePostgresDatabase(drizzleModule.config.database)) {
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
      drizzleModule.config.database as any
    )
    await apply()
  }
}

export async function drizzleSqliteDatabase(path: string): Promise<AnyDrizzleDatabase> {
  const libsql = await import('drizzle-orm/libsql')
  return libsql.drizzle(path)
}

export async function inMemoryDrizzleSqliteDatabase(): Promise<AnyDrizzleDatabase> {
  const libsql = await import('drizzle-orm/libsql')
  return libsql.drizzle(':memory:')
}

export async function drizzlePostgresDatabase(client: ClientType | PoolType): Promise<AnyDrizzleDatabase> {
  const pg = await import('drizzle-orm/node-postgres')

  return pg.drizzle(client)
}
