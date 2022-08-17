import type { TagsBase } from '../BaseRecord'
import type { RecordDeletedEvent, RecordSavedEvent, RecordUpdatedEvent } from '../RepositoryEvents'

import { getAgentConfig, mockFunction } from '../../../tests/helpers'
import { EventEmitter } from '../../agent/EventEmitter'
import { AriesFrameworkError, RecordDuplicateError, RecordNotFoundError } from '../../error'
import { IndyStorageService } from '../IndyStorageService'
import { Repository } from '../Repository'
import { RepositoryEventTypes } from '../RepositoryEvents'

import { TestRecord } from './TestRecord'

jest.mock('../IndyStorageService')

const StorageMock = IndyStorageService as unknown as jest.Mock<IndyStorageService<TestRecord>>

describe('Repository', () => {
  let repository: Repository<TestRecord>
  let storageMock: IndyStorageService<TestRecord>
  let eventEmitter: EventEmitter

  beforeEach(async () => {
    storageMock = new StorageMock()
    eventEmitter = new EventEmitter(getAgentConfig('RepositoryTest'))
    repository = new Repository(TestRecord, storageMock, eventEmitter)
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
      await repository.save(record)

      expect(storageMock.save).toBeCalledWith(record)
    })

    it(`should emit saved event`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<RecordSavedEvent<TestRecord>>(RepositoryEventTypes.RecordSaved, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.save(record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordSaved',
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
      await repository.update(record)

      expect(storageMock.update).toBeCalledWith(record)
    })

    it(`should emit updated event`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<RecordUpdatedEvent<TestRecord>>(RepositoryEventTypes.RecordUpdated, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.update(record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordUpdated',
        payload: {
          record: expect.objectContaining({
            id: 'test-id',
          }),
        },
      })
    })
  })

  describe('delete()', () => {
    it('should delete the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      await repository.delete(record)

      expect(storageMock.delete).toBeCalledWith(record)
    })

    it(`should emit deleted event`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<RecordDeletedEvent<TestRecord>>(RepositoryEventTypes.RecordDeleted, eventListenerMock)

      // given
      const record = getRecord({ id: 'test-id' })

      // when
      await repository.delete(record)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'RecordDeleted',
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
      await repository.deleteById('test-id')

      expect(storageMock.deleteById).toBeCalledWith(TestRecord, 'test-id')
    })
  })

  describe('getById()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.getById).mockReturnValue(Promise.resolve(record))

      const returnValue = await repository.getById('test-id')

      expect(storageMock.getById).toBeCalledWith(TestRecord, 'test-id')
      expect(returnValue).toBe(record)
    })
  })

  describe('findById()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.getById).mockReturnValue(Promise.resolve(record))

      const returnValue = await repository.findById('test-id')

      expect(storageMock.getById).toBeCalledWith(TestRecord, 'test-id')
      expect(returnValue).toBe(record)
    })

    it('should return null if the storage service throws RecordNotFoundError', async () => {
      mockFunction(storageMock.getById).mockReturnValue(
        Promise.reject(new RecordNotFoundError('Not found', { recordType: TestRecord.type }))
      )

      const returnValue = await repository.findById('test-id')

      expect(storageMock.getById).toBeCalledWith(TestRecord, 'test-id')
      expect(returnValue).toBeNull()
    })

    it('should return null if the storage service throws an error that is not RecordNotFoundError', async () => {
      mockFunction(storageMock.getById).mockReturnValue(Promise.reject(new AriesFrameworkError('Not found')))

      expect(repository.findById('test-id')).rejects.toThrowError(AriesFrameworkError)
      expect(storageMock.getById).toBeCalledWith(TestRecord, 'test-id')
    })
  })

  describe('getAll()', () => {
    it('should get the records using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.getAll).mockReturnValue(Promise.resolve([record, record2]))

      const returnValue = await repository.getAll()

      expect(storageMock.getAll).toBeCalledWith(TestRecord)
      expect(returnValue).toEqual(expect.arrayContaining([record, record2]))
    })
  })

  describe('findByQuery()', () => {
    it('should get the records using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      const returnValue = await repository.findByQuery({ something: 'interesting' })

      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
      expect(returnValue).toEqual(expect.arrayContaining([record, record2]))
    })
  })

  describe('findSingleByQuery()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record]))

      const returnValue = await repository.findSingleByQuery({ something: 'interesting' })

      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
      expect(returnValue).toBe(record)
    })

    it('should return null if the no records are returned by the storage service', async () => {
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([]))

      const returnValue = await repository.findSingleByQuery({ something: 'interesting' })

      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
      expect(returnValue).toBeNull()
    })

    it('should throw RecordDuplicateError if more than one record is returned by the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      expect(repository.findSingleByQuery({ something: 'interesting' })).rejects.toThrowError(RecordDuplicateError)
      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
    })
  })

  describe('getSingleByQuery()', () => {
    it('should get the record using the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record]))

      const returnValue = await repository.getSingleByQuery({ something: 'interesting' })

      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
      expect(returnValue).toBe(record)
    })

    it('should throw RecordNotFoundError if no records are returned by the storage service', async () => {
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([]))

      expect(repository.getSingleByQuery({ something: 'interesting' })).rejects.toThrowError(RecordNotFoundError)
      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
    })

    it('should throw RecordDuplicateError if more than one record is returned by the storage service', async () => {
      const record = getRecord({ id: 'test-id' })
      const record2 = getRecord({ id: 'test-id2' })
      mockFunction(storageMock.findByQuery).mockReturnValue(Promise.resolve([record, record2]))

      expect(repository.getSingleByQuery({ something: 'interesting' })).rejects.toThrowError(RecordDuplicateError)
      expect(storageMock.findByQuery).toBeCalledWith(TestRecord, { something: 'interesting' })
    })
  })
})
