import { Agent, GenericRecord, RecordDuplicateError, RecordNotFoundError } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { GenericRecordsRepository } from '../../../../core/src/modules/generic-records/repository/GenericRecordsRepository'
import {
  type DrizzlePostgresTestDatabase,
  createDrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from '../../../tests/testDatabase'
import { DrizzleStorageModule } from '../../DrizzleStorageModule'
import coreDrizzleBundle from '../../core/bundle'

describe.each(['postgres', 'sqlite'] as const)('DrizzleStorageService with %s', (drizzleDialect) => {
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined = undefined
  let agent: Agent

  beforeAll(async () => {
    if (drizzleDialect === 'postgres') {
      postgresDatabase = await createDrizzlePostgresTestDatabase()
    }

    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase?.drizzle ?? inMemoryDrizzleSqliteDatabase(),
      bundles: [coreDrizzleBundle],
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

  test('throws RecordDuplicateError when record already exists', async () => {
    const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

    await genericRecordsRepository.save(
      agent.context,
      new GenericRecord({
        content: { hey: 'there' },
        id: 'one',
      })
    )

    await expect(
      genericRecordsRepository.save(
        agent.context,
        new GenericRecord({
          content: { hey: 'there' },
          id: 'one',
        })
      )
    ).rejects.toThrow(RecordDuplicateError)
  })

  test('throws RecordNotFound when record does not exist', async () => {
    const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

    await expect(genericRecordsRepository.getById(agent.context, 'not-existent')).rejects.toThrow(RecordNotFoundError)
    await expect(genericRecordsRepository.deleteById(agent.context, 'not-existent')).rejects.toThrow(
      RecordNotFoundError
    )
    await expect(
      genericRecordsRepository.update(agent.context, new GenericRecord({ id: 'not-existent', content: {} }))
    ).rejects.toThrow(RecordNotFoundError)
  })
})
