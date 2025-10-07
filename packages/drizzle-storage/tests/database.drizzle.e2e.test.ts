import { Agent } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { DrizzleStorageModule } from '../src'
import actionMenuDrizzleBundle from '../src/action-menu/bundle'
import anoncredsDrizzleBundle from '../src/anoncreds/bundle'
import coreDrizzleBundle from '../src/core/bundle'
import didcommDrizzleBundle from '../src/didcomm/bundle'
import {
  type DrizzlePostgresTestDatabase,
  createDrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from './testDatabase'

describe.each(['postgres', 'sqlite'] as const)('Drizzle storage with %s', (type) => {
  let agent: Agent
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined = undefined

  beforeAll(async () => {
    if (type === 'postgres') {
      postgresDatabase = await createDrizzlePostgresTestDatabase()
    }

    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase?.drizzle ?? inMemoryDrizzleSqliteDatabase(),
      bundles: [coreDrizzleBundle, didcommDrizzleBundle, actionMenuDrizzleBundle, anoncredsDrizzleBundle],
    })

    agent = new Agent({
      dependencies: agentDependencies,
      modules: {
        storage: drizzleModule,
      },
    })

    await pushDrizzleSchema(drizzleModule)
    await agent.initialize()
  })

  afterAll(async () => {
    await postgresDatabase?.teardown()
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
