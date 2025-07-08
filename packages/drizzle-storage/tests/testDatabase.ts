import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { PgDatabase } from 'drizzle-orm/pg-core'
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

export function inMemoryDatabase(type: DatabaseType): AnyDrizzleDatabase {
  if (type === 'postgres') {
    return require('drizzle-orm/pglite').drizzle('memory://')
  }

  return require('drizzle-orm/libsql').drizzle(':memory:')
}
