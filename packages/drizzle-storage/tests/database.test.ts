import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { pushSQLiteSchema, pushSchema } from 'drizzle-kit/api'
import { LibSQLDatabase, drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/pglite'
import { DrizzleStorageModule } from '../src'
import actionMenuDrizzleBundle from '../src/action-menu/bundle'
import anoncredsDrizzleBundle from '../src/anoncreds/bundle'
import coreDrizzleBundle from '../src/core/bundle'
import didcommDrizzleBundle from '../src/didcomm/bundle'

describe.each(['postgres', 'sqlite'] as const)('Drizzle storage with %s', (type) => {
  let agent: Agent

  beforeAll(async () => {
    const drizzleModule = new DrizzleStorageModule({
      database: type === 'postgres' ? drizzlePostgres('memory://') : drizzleSqlite(':memory:'),
      bundles: [coreDrizzleBundle, didcommDrizzleBundle, actionMenuDrizzleBundle, anoncredsDrizzleBundle],
    })

    agent = new Agent({
      dependencies: agentDependencies,
      config: {
        label: 'Hello',
      },
      modules: {
        storage: drizzleModule,
      },
    })

    // Usually the actual migrations should be applied beforehand, but for tests we just push the current state
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

    await agent.initialize()
  })

  test('create, retrieve, update, query and delete generic record', async () => {
    const genericRecord = await agent.genericRecords.save({
      content: {
        hey: 'there',
      },
      id: 'something',
      tags: {
        something: 'cool',
      },
    })

    const genericRecord2 = await agent.genericRecords.findById(genericRecord.id)
    expect(genericRecord).toEqual(genericRecord2)

    genericRecord.setTags({
      myCustomTag: 'hello',
      isMorning: false,
    })
    await agent.genericRecords.update(genericRecord)

    const [genericRecord3] = await agent.genericRecords.findAllByQuery({
      myCustomTag: 'hello',
      isMorning: false,
    })
    expect(genericRecord).toEqual(genericRecord3)

    expect(
      await agent.genericRecords.findAllByQuery({
        myCustomTag: 'not-hello',
      })
    ).toHaveLength(0)

    await agent.genericRecords.deleteById(genericRecord.id)

    expect(
      await agent.genericRecords.findAllByQuery({
        myCustomTag: 'hello',
      })
    ).toHaveLength(0)
  })
})
