import { Agent } from '@credo-ts/core'
import {
  DidCommProofExchangeRecord,
  DidCommProofExchangeRepository,
  DidCommProofRole,
  DidCommProofState,
} from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { DrizzleStorageModule } from '../src'
import { actionMenuBundle } from '../src/action-menu/bundle'
import { anoncredsBundle } from '../src/anoncreds/bundle'
import { coreBundle } from '../src/core/bundle'
import { didcommBundle } from '../src/didcomm/bundle'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from './testDatabase'

describe.each(['postgres', 'sqlite'] as const)('Drizzle storage with %s', (type) => {
  let agent: Agent
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined

  beforeAll(async () => {
    if (type === 'postgres') {
      postgresDatabase = await createDrizzlePostgresTestDatabase()
    }

    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase()),
      bundles: [coreBundle, didcommBundle, actionMenuBundle, anoncredsBundle],
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

  test('store and retrieve a didcomm proof exchange record in every state', async () => {
    const repository = agent.dependencyManager.resolve(DidCommProofExchangeRepository)

    for (const state of Object.values(DidCommProofState)) {
      const record = new DidCommProofExchangeRecord({
        threadId: `thread-${state}`,
        protocolVersion: 'v2',
        role: DidCommProofRole.Verifier,
        state,
      })
      await repository.save(agent.context, record)

      const retrieved = await repository.getById(agent.context, record.id)
      expect(retrieved.state).toEqual(state)
      expect(retrieved.role).toEqual(DidCommProofRole.Verifier)
    }
  })
})
