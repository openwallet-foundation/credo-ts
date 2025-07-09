import { Agent, utils } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { Client, Pool } from 'pg'
import { DrizzleRecord, DrizzleStorageModule } from '../src'
import { DrizzlePostgresDatabase, isDrizzlePostgresDatabase } from '../src/DrizzleDatabase'
import { AnyDrizzleDatabase } from '../src/DrizzleStorageModuleConfig'

export { Client, Pool }

export type DrizzlePostgresTestDatabase = {
  pool: Pool
  drizzle: DrizzlePostgresDatabase
  teardown: () => Promise<void>
}

export async function createDrizzlePostgresTestDatabase(): Promise<DrizzlePostgresTestDatabase> {
  const databaseName = utils.uuid().replace('-', '')

  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  })
  const drizzleClient = new Pool({
    connectionString: `postgresql://postgres:postgres@localhost:5432/${databaseName}`,
  })

  await pgClient.connect()
  await pgClient.query(`CREATE DATABASE "${databaseName}";`)

  return {
    pool: drizzleClient,
    drizzle: require('drizzle-orm/node-postgres').drizzle(drizzleClient),
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
  const drizzle = postgresDrizzle ? postgresDrizzle.drizzle : inMemoryDrizzleSqliteDatabase()

  const drizzleModule = new DrizzleStorageModule({
    database: drizzle,
    bundles: [
      {
        name: 'drizzleRecordTest',
        records: [drizzleRecord],
        migrations: {
          sqlite: { migrationsPath: '', schemaModule: '' },
          postgres: { migrationsPath: '', schemaModule: '' },
        },
      },
    ],
  })

  // Push schema during tests (no migrations applied)
  await pushDrizzleSchema(drizzleModule)

  const agent = new Agent({
    dependencies: agentDependencies,
    config: {
      label: 'Hello',
    },
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
  const { pushSQLiteSchema, pushSchema } = require('drizzle-kit/api')
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

export function inMemoryDrizzleSqliteDatabase(): AnyDrizzleDatabase {
  return require('drizzle-orm/libsql').drizzle(':memory:')
}

export function drizzlePostgresDatabase(client: Client | Pool): AnyDrizzleDatabase {
  return require('drizzle-orm/node-postgres').drizzle(client)
}
