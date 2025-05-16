import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { pushSQLiteSchema, pushSchema } from 'drizzle-kit/api'
import { LibSQLDatabase, drizzle as drizzleSqlite } from 'drizzle-orm/libsql'
import { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePostgres } from 'drizzle-orm/pglite'
import { DrizzleStorageModule } from '../src'
import { didcommDrizzleRecords } from '../src/didcomm'

describe.each(['postgres', 'sqlite'] as const)('Drizzle storage with %s', (type) => {
  let agent: Agent

  beforeAll(async () => {
    const drizzleModule = new DrizzleStorageModule({
      database: type === 'postgres' ? drizzlePostgres('memory://') : drizzleSqlite(':memory:'),
      records: [...didcommDrizzleRecords],
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

  afterAll(async () => {
    // Doesn't do anything yet, but we use in memory so ok
    // await agent.dependencyManager.deleteAgentContext(agent.context)
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
