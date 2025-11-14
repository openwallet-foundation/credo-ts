import { Agent, GenericRecord, RecordDuplicateError, RecordNotFoundError } from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'
import { GenericRecordsRepository } from '../../../../core/src/modules/generic-records/repository/GenericRecordsRepository'
import {
  createDrizzlePostgresTestDatabase,
  type DrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from '../../../tests/testDatabase'
import { coreBundle } from '../../core/bundle'
import { DrizzleStorageModule } from '../../DrizzleStorageModule'

describe.each(['postgres', 'sqlite'] as const)('DrizzleStorageService with %s', (drizzleDialect) => {
  let postgresDatabase: DrizzlePostgresTestDatabase | undefined
  let agent: Agent

  beforeAll(async () => {
    if (drizzleDialect === 'postgres') {
      postgresDatabase = await createDrizzlePostgresTestDatabase()
    }

    const drizzleModule = new DrizzleStorageModule({
      database: postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase()),
      bundles: [coreBundle],
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

  describe('updateByIdWithLock', () => {
    test('successfully updates a record using the callback', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      const originalRecord = new GenericRecord({
        content: { counter: 0 },
        id: 'update-with-lock-1',
      })
      await genericRecordsRepository.save(agent.context, originalRecord)

      const originalUpdatedAt = originalRecord.updatedAt

      const updatedRecord = await genericRecordsRepository.updateByIdWithLock(
        agent.context,
        'update-with-lock-1',
        async (record) => {
          record.content = { counter: 1 }
          return record
        }
      )

      expect(updatedRecord.content).toEqual({ counter: 1 })
      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt?.getTime() ?? 0)
    })

    test('returns the updated record with new updatedAt timestamp', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      const originalRecord = new GenericRecord({
        content: { value: 'original' },
        id: 'update-with-lock-2',
      })
      await genericRecordsRepository.save(agent.context, originalRecord)

      const originalUpdatedAt = originalRecord.updatedAt

      const updatedRecord = await genericRecordsRepository.updateByIdWithLock(
        agent.context,
        'update-with-lock-2',
        async (record) => {
          record.content = { value: 'modified' }
          return record
        }
      )

      expect(updatedRecord.id).toBe('update-with-lock-2')
      expect(updatedRecord.content).toEqual({ value: 'modified' })
      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt?.getTime() ?? 0)
    })

    test('throws RecordNotFoundError when record does not exist', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      await expect(
        genericRecordsRepository.updateByIdWithLock(agent.context, 'non-existent-id', async (record) => {
          record.content = { modified: true }
          return record
        })
      ).rejects.toThrow(RecordNotFoundError)
    })

    test('handles complex update operations in callback', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      const originalRecord = new GenericRecord({
        content: { items: ['a', 'b'], count: 2 },
        id: 'update-with-lock-3',
      })
      await genericRecordsRepository.save(agent.context, originalRecord)

      const updatedRecord = await genericRecordsRepository.updateByIdWithLock(
        agent.context,
        'update-with-lock-3',
        async (record) => {
          record.content = {
            items: ['a', 'b', 'c'],
            count: 3,
          }
          return record
        }
      )

      expect(updatedRecord.content).toEqual({ items: ['a', 'b', 'c'], count: 3 })
    })

    test('updates updatedAt timestamp', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      const originalRecord = new GenericRecord({
        content: { data: 'test' },
        id: 'update-with-lock-5',
      })
      await genericRecordsRepository.save(agent.context, originalRecord)

      const originalUpdatedAt = originalRecord.updatedAt?.getTime()

      const updatedRecord = await genericRecordsRepository.updateByIdWithLock(
        agent.context,
        'update-with-lock-5',
        async (record) => {
          // timeout to ensure time is updated
          await new Promise((res) => setTimeout(res, 1))
          record.content = { data: 'modified' }
          return record
        }
      )

      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThan(originalUpdatedAt ?? Infinity)
    })

    test('callback receives current record state', async () => {
      const genericRecordsRepository = agent.context.resolve(GenericRecordsRepository)

      const originalRecord = new GenericRecord({
        content: { counter: 5, name: 'test' },
        id: 'update-with-lock-6',
      })
      await genericRecordsRepository.save(agent.context, originalRecord)

      let receivedContent: unknown

      const updatedRecord = await genericRecordsRepository.updateByIdWithLock(
        agent.context,
        'update-with-lock-6',
        async (record) => {
          receivedContent = record.content
          record.content = { ...record.content, counter: 10 }
          return record
        }
      )

      expect(receivedContent).toEqual({ counter: 5, name: 'test' })
      expect(updatedRecord.content).toEqual({ counter: 10, name: 'test' })
    })
  })
})
