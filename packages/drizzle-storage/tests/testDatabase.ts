import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { pushSQLiteSchema, pushSchema } from 'drizzle-kit/api'
import { LibSQLDatabase } from 'drizzle-orm/libsql'
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/pglite'
import { DrizzleRecord, DrizzleStorageModule } from '../src'
import { isDrizzlePostgresDatabase } from '../src/DrizzleDatabase'
import { AnyDrizzleDatabase } from '../src/DrizzleStorageModuleConfig'

type DatabaseType = 'postgres' | 'sqlite'

export async function setupDrizzleRecordTest(databaseType: 'postgres' | 'sqlite', drizzleRecord: DrizzleRecord) {
  const drizzleModule = new DrizzleStorageModule({
    database: inMemoryDatabase(databaseType),
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
  return agent
}

export async function pushDrizzleSchema(drizzleModule: DrizzleStorageModule) {
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
      drizzleModule.config.database as LibSQLDatabase<any>
    )
    await apply()
  }
}

export function inMemoryDatabase(type: DatabaseType): AnyDrizzleDatabase {
  return type === 'postgres' ? drizzlePostgres('memory://') : drizzleSqlite(':memory:')
}
