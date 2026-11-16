import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentConfig, getAgentContext, mockFunction } from '../../../tests/helpers'
import type { AgentContext } from '../../agent'
import { EventEmitter } from '../../agent/EventEmitter'
import { CredoError, RecordDuplicateError, RecordNotFoundError, ZodValidationError } from '../../error'
import { CacheModuleConfig, InMemoryLruCache } from '../../modules/cache'
import { GenericRecord } from '../../modules/generic-records/repository/GenericRecord'
import type { TagsBase } from '../BaseRecord'
import { Repository } from '../Repository'
import type {
  RecordDeletedEvent,
  RecordSavedEvent,
  RecordsDeletedByQueryEvent,
  RecordUpdatedEvent,
} from '../RepositoryEvents'
import { RepositoryEventTypes } from '../RepositoryEvents'
import type { StorageService } from '../StorageService'
import { TestRecord } from './TestRecord'

vi.mock('../../../../../tests/InMemoryStorageService')

const StorageMock = InMemoryStorageService as unknown as MockedClassConstructor<
  typeof InMemoryStorageService<TestRecord>
>

const config = getAgentConfig('Repository')

describe('Repository', () => {
  let repository: Repository<TestRecord>
  let storageMock: StorageService<TestRecord>
  let agentContext: AgentContext
  let eventEmitter: EventEmitter

  beforeEach(async () => {
    storageMock = new StorageMock()
    eventEmitter = new EventEmitter(config.agentDependencies, new Subject())
    repository = new Repository(TestRecord, storageMock, eventEmitter)
    agentContext = getAgentContext({
      registerInstances: [
        [
          CacheModuleConfig,
          new CacheModuleConfig({
            cache: new InMemoryLruCache({ limit: 500 }),
          }),
        ],
      ],
    })
  })

  const getRecord = ({ id, tags }: { id?: string; tags?: TagsBase } = {}) => {
    return new TestRecord({
      id,
      foo: 'bar',
      tags: tags ?? { myTag: 'foobar' },
    })
  }

  describe('save()', () => {
    it('should save the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      await repository.save(agentContext, record)

      expect(storageMock.save).toHaveBeenCalledWith(agentContext, record)
    })

    it('should emit saved event', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<RecordSavedEvent<TestRecord>>(RepositoryEventTypes.RecordSaved, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.save(agentContext, record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordSaved',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          record: expect.objectContaining({
            id: 'test-id',
          }),
        },
      })
    })
  })

  describe('update()', () => {
    it('should update the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      await repository.update(agentContext, record)

      expect(storageMock.update).toHaveBeenCalledWith(agentContext, record)
    })

    it('should emit updated event', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<RecordUpdatedEvent<TestRecord>>(RepositoryEventTypes.RecordUpdated, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.update(agentContext, record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordUpdated',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          record: expect.objectContaining({
            id: 'test-id',
          }),
        },
      })
    })
  })

  describe('updateByIdWithLock()', () => {
    it('should update the record returned by the callback if the storage service has no lock', async () => {
      const record = getRecord({ id: 'test-id' })
      const updatedRecord = getRecord({ id: 'test-id', tags: { myTag: 'updated' } })
      mockFunction(storageMock.getById).mockReturnValue(Promise.resolve(record))

      const returnValue = await repository.updateByIdWithLock(agentContext, 'test-id', async () => updatedRecord)

      expect(storageMock.update).toHaveBeenCalledWith(agentContext, updatedRecord)
      expect(returnValue).toBe(updatedRecord)
    })
  })

  describe('delete()', () => {
    it('should delete the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      await repository.delete(agentContext, record)

      expect(storageMock.delete).toHaveBeenCalledWith(agentContext, record)
    })

    it('should emit deleted event', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<RecordDeletedEvent<TestRecord>>(RepositoryEventTypes.RecordDeleted, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.delete(agentContext, record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordDeleted',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          record: expect.objectContaining({
            id: 'test-id',
          }),
        },
      })
    })
  })

  describe('deleteById()', () => {
    it('should delete the record by record id', async () => {
      await repository.deleteById(agentContext, 'test-id')

      expect(storageMock.deleteById).toHaveBeenCalledWith(agentContext, TestRecord, 'test-id')
    })

    it('should emit deleted event', async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<RecordDeletedEvent<TestRecord>>(RepositoryEventTypes.RecordDeleted, eventListenerMock)

      const record = getRecord({ id: 'test-id' })

      await repository.deleteById(agentContext, record.id)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordDeleted',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          record: expect.objectContaining({
            id: record.id,
            type: record.type,
          }),
        },
      })
    })
  })

  describe('deleteByQuery()', () => {
    const query = { $or: [{ myTag: 'foo' }, { myTag: 'bar' }] }

    it('should delete the records using deleteByQuery of the storage service', async () => {
      storageMock.deleteByQuery = vi.fn().mockResolvedValue(3)

      expect(await repository.deleteByQuery(agentContext, query)).toBe(3)

      expect(storageMock.deleteByQuery).toHaveBeenCalledWith(agentContext, TestRecord, query)
      expect(storageMock.findByQuery).not.toHaveBeenCalled()
      expect(storageMock.delete).not.toHaveBeenCalled()
    })

    it('should find and delete each record if the storage service does not implement deleteByQuery', async () => {
      storageMock.deleteByQuery = undefined
      const records = [getRecord({ id: 'test-id-1' }), getRecord({ id: 'test-id-2' })]
      mockFunction(storageMock.findByQuery).mockResolvedValue(records)

      expect(await repository.deleteByQuery(agentContext, query)).toBe(2)

      expect(storageMock.findByQuery).toHaveBeenCalledTimes(1)
      expect(storageMock.findByQuery).toHaveBeenCalledWith(agentContext, TestRecord, query, { limit: 100 })
      expect(storageMock.delete).toHaveBeenCalledTimes(2)
      expect(storageMock.delete).toHaveBeenNthCalledWith(1, agentContext, records[0])
      expect(storageMock.delete).toHaveBeenNthCalledWith(2, agentContext, records[1])
    })

    it('should find and delete the records in pages of 100 if the storage service does not implement deleteByQuery', async () => {
      storageMock.deleteByQuery = undefined
      const firstPage = Array.from({ length: 100 }, (_, index) => getRecord({ id: `test-id-${index}` }))
      const secondPage = [getRecord({ id: 'test-id-100' })]
      mockFunction(storageMock.findByQuery).mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

      expect(await repository.deleteByQuery(agentContext, query)).toBe(101)

      expect(storageMock.findByQuery).toHaveBeenCalledTimes(2)
      expect(storageMock.findByQuery).toHaveBeenNthCalledWith(2, agentContext, TestRecord, query, { limit: 100 })
      expect(storageMock.delete).toHaveBeenCalledTimes(101)
      expect(storageMock.delete).toHaveBeenLastCalledWith(agentContext, secondPage[0])
    })

    it.each([
      [
        'with',
        () => {
          storageMock.deleteByQuery = vi.fn().mockResolvedValue(2)
        },
      ],
      [
        'without',
        () => {
          storageMock.deleteByQuery = undefined
          mockFunction(storageMock.findByQuery).mockResolvedValue([getRecord({ id: 'test-id-1' }), getRecord()])
        },
      ],
    ])(
      'should emit one deleted by query event and no deleted events %s deleteByQuery in the storage service',
      async (_, setup) => {
        setup()
        const deletedByQueryListener = vi.fn()
        const deletedListener = vi.fn()
        eventEmitter.on<RecordsDeletedByQueryEvent<TestRecord>>(
          RepositoryEventTypes.RecordsDeletedByQuery,
          deletedByQueryListener
        )
        eventEmitter.on<RecordDeletedEvent<TestRecord>>(RepositoryEventTypes.RecordDeleted, deletedListener)

        await repository.deleteByQuery(agentContext, query)

        expect(deletedByQueryListener).toHaveBeenCalledTimes(1)
        expect(deletedByQueryListener).toHaveBeenCalledWith({
          type: 'RecordsDeletedByQuery',
          metadata: {
            contextCorrelationId: 'mock',
          },
          payload: {
            recordType: TestRecord.type,
            query,
            count: 2,
          },
        })
        expect(deletedListener).not.toHaveBeenCalled()
      }
    )
  })

  describe('getById()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.getById).mockReturnValue(Promise.resolve(record))

      const returnValue = await repository.getById(agentContext, 'test-id')

      expect(storageMock.getById).toHaveBeenCalledWith(agentContext, TestRecord, 'test-id')
      expect(returnValue).toBe(record)
    })
  })

  describe('findById()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.getById).mockReturnValue(Promise.resolve(record))

      const returnValue = await repository.findById(agentContext, 'test-id')

      expect(storageMock.getById).toHaveBeenCalledWith(agentContext, TestRecord, 'test-id')
      expect(returnValue).toBe(record)
    })

    it('should return null if the storage service throws RecordNotFoundError', async () => {
      mockFunction(storageMock.getById).mockReturnValue(
        Promise.reject(new RecordNotFoundError('Not found', { recordType: TestRecord.type }))
      )

      const returnValue = await repository.findById(agentContext, 'test-id')

      expect(storageMock.getById).toHaveBeenCalledWith(agentContext, TestRecord, 'test-id')
      expect(returnValue).toBeNull()
    })

    it('should return null if the storage service throws an error that is not RecordNotFoundError', async () => {
      mockFunction(storageMock.getById).mockReturnValue(Promise.reject(new CredoError('Not found')))

      await expect(repository.findById(agentContext, 'test-id')).rejects.toThrow(CredoError)
      expect(storageMock.getById).toHaveBeenCalledWith(agentContext, TestRecord, 'test-id')
    })
  })

  describe('getAll()', () => {
    it('should get the records using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.getAll).mockReturnValue(Promise.resolve([record, record2]))

      const returnValue = await repository.getAll(agentContext)

      expect(storageMock.getAll).toHaveBeenCalledWith(agentContext, TestRecord)
      expect(returnValue).toEqual(expect.arrayContaining([record, record2]))
    })
  })

  describe('findByQuery()', () => {
    it('should get the records using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      const returnValue = await repository.findByQuery(agentContext, { something: 'interesting' }, { limit: 10 })

      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        { limit: 10 }
      )
      expect(returnValue).toEqual(expect.arrayContaining([record, record2]))
    })
  })

  describe('findSingleByQuery()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record]))

      const returnValue = await repository.findSingleByQuery(agentContext, { something: 'interesting' })

      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
      expect(returnValue).toBe(record)
    })

    it('should return null if the no records are returned by the storage service', async () => {
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([]))

      const returnValue = await repository.findSingleByQuery(agentContext, { something: 'interesting' })

      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
      expect(returnValue).toBeNull()
    })

    it('should throw RecordDuplicateError if more than one record is returned by the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      await expect(repository.findSingleByQuery(agentContext, { something: 'interesting' })).rejects.toThrow(
        RecordDuplicateError
      )
      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
    })
  })

  describe('getSingleByQuery()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record]))

      const returnValue = await repository.getSingleByQuery(agentContext, { something: 'interesting' })

      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
      expect(returnValue).toBe(record)
    })

    it('should throw RecordNotFoundError if no records are returned by the storage service', async () => {
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([]))

      await expect(repository.getSingleByQuery(agentContext, { something: 'interesting' })).rejects.toThrow(
        RecordNotFoundError
      )
      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
    })

    it('should throw RecordDuplicateError if more than one record is returned by the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      await expect(repository.getSingleByQuery(agentContext, { something: 'interesting' })).rejects.toThrow(
        RecordDuplicateError
      )
      expect(storageMock.findByQuery).toHaveBeenCalledWith(
        agentContext,
        TestRecord,
        { something: 'interesting' },
        undefined
      )
    })
  })

  describe('delete() with an invalid record', () => {
    it('should throw before the record is deleted', async () => {
      const genericStorageMock = new StorageMock() as unknown as StorageService<GenericRecord>
      const genericRecordRepository = new Repository(GenericRecord, genericStorageMock, eventEmitter)
      const record = new GenericRecord({
        id: 'test-id',
        content: 'not-an-object' as unknown as Record<string, unknown>,
      })

      await expect(genericRecordRepository.delete(agentContext, record)).rejects.toThrow(ZodValidationError)
      expect(genericStorageMock.delete).not.toHaveBeenCalled()
    })
  })
})
