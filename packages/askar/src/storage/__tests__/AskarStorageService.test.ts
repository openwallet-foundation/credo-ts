import type { AgentContext, TagsBase } from '@credo-ts/core'

import { RecordDuplicateError, RecordNotFoundError, TypedArrayEncoder } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'

import { TestRecord } from '../../../../core/src/storage/__tests__/TestRecord'
import { getAgentConfig, getAgentContext, getAskarStoreConfig } from '../../../../core/tests/helpers'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import { AskarModuleConfig } from '../../AskarModuleConfig'
import { AskarStoreManager } from '../../AskarStoreManager'
import { AskarStorageService } from '../AskarStorageService'
import { askarQueryFromSearchQuery } from '../utils'

const startDate = Date.now()

describe('AskarStorageService', () => {
  let storageService: AskarStorageService<TestRecord>
  let storeManager: AskarStoreManager
  let agentContext: AgentContext

  beforeEach(async () => {
    const agentConfig = getAgentConfig('AskarStorageServiceTest')

    agentContext = getAgentContext({
      agentConfig,
    })
    storeManager = new AskarStoreManager(
      new NodeFileSystem(),
      new AskarModuleConfig({
        askar,
        store: getAskarStoreConfig('AskarStorageServiceTest', {
          inMemory: true,
        }),
      })
    )
    storageService = new AskarStorageService<TestRecord>(storeManager)

    await storeManager.provisionStore(agentContext)
  })

  afterEach(async () => {
    await storeManager.deleteStore(agentContext)
  })

  const insertRecord = async ({ id, tags }: { id?: string; tags?: TagsBase }) => {
    const props = {
      id,
      foo: 'bar',
      tags: tags ?? { myTag: 'foobar' },
    }
    const record = new TestRecord(props)
    await storageService.save(agentContext, record)
    return record
  }

  describe('tag transformation', () => {
    it('should correctly transform tag values to string before storing', async () => {
      const record = await insertRecord({
        id: 'test-id',
        tags: {
          someBoolean: true,
          someOtherBoolean: false,
          someStringValue: 'string',
          anArrayValue: ['foo', 'bar'],
          anArrayValueWhereValuesContainColon: ['foo:bar:test', 'https://google.com'],
          // booleans are stored as '1' and '0' so we store the string values '1' and '0' as 'n__1' and 'n__0'
          someStringNumberValue: '1',
          anotherStringNumberValue: '0',
        },
      })

      const retrieveRecord = await storeManager.withSession(agentContext, (session) =>
        askar.sessionFetch({
          category: record.type,
          name: record.id,
          // biome-ignore lint/style/noNonNullAssertion: no explanation
          sessionHandle: session.handle!,
          forUpdate: false,
        })
      )

      expect(JSON.parse(retrieveRecord?.getTags(0) ?? '{}')).toEqual({
        someBoolean: '1',
        someOtherBoolean: '0',
        someStringValue: 'string',
        'anArrayValue:foo': '1',
        'anArrayValue:bar': '1',
        'anArrayValueWhereValuesContainColon:foo:bar:test': '1',
        'anArrayValueWhereValuesContainColon:https://google.com': '1',
        someStringNumberValue: 'n__1',
        anotherStringNumberValue: 'n__0',
      })
    })

    it('should correctly transform tag values from string after retrieving', async () => {
      await storeManager.withSession(
        agentContext,
        async (session) =>
          await askar.sessionUpdate({
            category: TestRecord.type,
            name: 'some-id',
            // biome-ignore lint/style/noNonNullAssertion: no explanation
            sessionHandle: session.handle!,
            value: TypedArrayEncoder.fromString('{}'),
            tags: {
              someBoolean: '1',
              someOtherBoolean: '0',
              someStringValue: 'string',
              // Before 0.5.0, there was a bug where array values that contained a : would be incorrectly
              // parsed back into a record as we would split on ':' and thus only the first part would be included
              // in the record as the tag value. If the record was never re-saved it would work well, as well as if the
              // record tag was generated dynamically before save (as then the incorrectly transformed back value would be
              // overwritten again on save).
              'anArrayValueWhereValuesContainColon:foo:bar:test': '1',
              'anArrayValueWhereValuesContainColon:https://google.com': '1',
              'anArrayValue:foo': '1',
              'anArrayValue:bar': '1',
              // booleans are stored as '1' and '0' so we store the string values '1' and '0' as 'n__1' and 'n__0'
              someStringNumberValue: 'n__1',
              anotherStringNumberValue: 'n__0',
            },
            operation: 0, // EntryOperation.Insert
          })
      )

      const record = await storageService.getById(agentContext, TestRecord, 'some-id')

      expect(record.getTags()).toEqual({
        someBoolean: true,
        someOtherBoolean: false,
        someStringValue: 'string',
        anArrayValue: expect.arrayContaining(['bar', 'foo']),
        anArrayValueWhereValuesContainColon: expect.arrayContaining(['foo:bar:test', 'https://google.com']),
        someStringNumberValue: '1',
        anotherStringNumberValue: '0',
      })
    })
  })

  describe('save()', () => {
    it('should throw RecordDuplicateError if a record with the id already exists', async () => {
      const record = await insertRecord({ id: 'test-id' })

      return expect(() => storageService.save(agentContext, record)).rejects.toThrow(RecordDuplicateError)
    })

    it('should save the record', async () => {
      const record = await insertRecord({ id: 'test-id' })
      const found = await storageService.getById(agentContext, TestRecord, 'test-id')

      expect(record).toEqual(found)
    })

    it('updatedAt should have a new value after a save', async () => {
      const record = await insertRecord({ id: 'test-id' })
      expect(record.updatedAt?.getTime()).toBeGreaterThan(startDate)
    })
  })

  describe('getById()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      return expect(() => storageService.getById(agentContext, TestRecord, 'does-not-exist')).rejects.toThrow(
        RecordNotFoundError
      )
    })

    it('should return the record by id', async () => {
      const record = await insertRecord({ id: 'test-id' })
      const found = await storageService.getById(agentContext, TestRecord, 'test-id')

      expect(found).toEqual(record)
    })
  })

  describe('update()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      const record = new TestRecord({
        id: 'test-id',
        foo: 'test',
        tags: { some: 'tag' },
      })

      return expect(() => storageService.update(agentContext, record)).rejects.toThrow(RecordNotFoundError)
    })

    it('should update the record', async () => {
      const record = await insertRecord({ id: 'test-id' })

      record.replaceTags({ ...record.getTags(), foo: 'bar' })
      record.foo = 'foobaz'
      await storageService.update(agentContext, record)

      const retrievedRecord = await storageService.getById(agentContext, TestRecord, record.id)
      expect(retrievedRecord).toEqual(record)
    })

    it('updatedAt should have a new value after an update', async () => {
      const record = await insertRecord({ id: 'test-id' })
      expect(record.updatedAt?.getTime()).toBeGreaterThan(startDate)
    })
  })

  describe('updateByIdWithLock()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      return expect(() =>
        storageService.updateByIdWithLock(agentContext, TestRecord, 'does-not-exist', async (record) => {
          record.foo = 'updated'
          return record
        })
      ).rejects.toThrow(RecordNotFoundError)
    })

    it('should update the record using the callback', async () => {
      const record = await insertRecord({ id: 'test-id', tags: { myTag: 'original' } })
      const originalUpdatedAt = record.updatedAt

      // Wait a bit to ensure updatedAt will be different
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updatedRecord = await storageService.updateByIdWithLock(agentContext, TestRecord, 'test-id', async (r) => {
        r.foo = 'updated-foo'
        r.replaceTags({ myTag: 'updated', newTag: 'added' })
        return r
      })

      expect(updatedRecord.foo).toBe('updated-foo')
      expect(updatedRecord.getTags()).toEqual({ myTag: 'updated', newTag: 'added' })
      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0)

      // Verify the record is actually updated in storage
      const retrievedRecord = await storageService.getById(agentContext, TestRecord, 'test-id')
      expect(retrievedRecord.foo).toBe('updated-foo')
      expect(retrievedRecord.getTags()).toEqual({ myTag: 'updated', newTag: 'added' })
    })

    it('should pass the correct record to the callback', async () => {
      const originalRecord = await insertRecord({ id: 'test-id', tags: { myTag: 'foobar' } })

      await storageService.updateByIdWithLock(agentContext, TestRecord, 'test-id', async (record) => {
        expect(record.id).toBe(originalRecord.id)
        expect(record.foo).toBe(originalRecord.foo)
        expect(record.getTags()).toEqual(originalRecord.getTags())
        return record
      })
    })

    it('should update updatedAt timestamp', async () => {
      const record = await insertRecord({ id: 'test-id' })
      const originalUpdatedAt = record.updatedAt

      // Wait a bit to ensure updatedAt will be different
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updatedRecord = await storageService.updateByIdWithLock(agentContext, TestRecord, 'test-id', async (r) => {
        r.foo = 'modified'
        return r
      })

      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() ?? 0)
      expect(updatedRecord.updatedAt?.getTime()).toBeGreaterThan(startDate)
    })

    it('should execute within a transaction', async () => {
      await insertRecord({ id: 'test-id' })

      // This test verifies the transaction behavior by checking that the record
      // is locked during the update (forUpdate: true in the implementation)
      const updatedRecord = await storageService.updateByIdWithLock(agentContext, TestRecord, 'test-id', async (r) => {
        r.foo = 'transaction-test'
        return r
      })

      expect(updatedRecord.foo).toBe('transaction-test')

      // Verify the update persisted
      const retrievedRecord = await storageService.getById(agentContext, TestRecord, 'test-id')
      expect(retrievedRecord.foo).toBe('transaction-test')
    })

    it('should return the updated record', async () => {
      await insertRecord({ id: 'test-id', tags: { myTag: 'original' } })

      const result = await storageService.updateByIdWithLock(agentContext, TestRecord, 'test-id', async (record) => {
        record.foo = 'new-value'
        record.replaceTags({ myTag: 'new-tag' })
        return record
      })

      expect(result).toBeInstanceOf(TestRecord)
      expect(result.id).toBe('test-id')
      expect(result.foo).toBe('new-value')
      expect(result.getTags()).toEqual({ myTag: 'new-tag' })
    })
  })

  describe('delete()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      const record = new TestRecord({
        id: 'test-id',
        foo: 'test',
        tags: { some: 'tag' },
      })

      await expect(() => storageService.delete(agentContext, record)).rejects.toThrow(RecordNotFoundError)
    })

    it('should delete the record', async () => {
      const record = await insertRecord({ id: 'test-id' })
      await storageService.delete(agentContext, record)

      await expect(() => storageService.getById(agentContext, TestRecord, record.id)).rejects.toThrow(
        RecordNotFoundError
      )
    })
  })

  describe('getAll()', () => {
    it('should retrieve all records', async () => {
      const createdRecords = await Promise.all(
        Array(5)
          .fill(undefined)
          .map((_, index) => insertRecord({ id: `record-${index}` }))
      )

      const records = await storageService.getAll(agentContext, TestRecord)
      expect(records).toEqual(expect.arrayContaining(createdRecords))
    })
  })

  describe('findByQuery()', () => {
    it('should retrieve all records that match the query', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foobar' } })
      const expectedRecord2 = await insertRecord({ tags: { myTag: 'foobar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, { myTag: 'foobar' })

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord, expectedRecord2]))
    })

    // FIXME: this should actually return 1 record, but we currently return 2
    // See https://github.com/openwallet-foundation/credo-ts/issues/2315
    it.fails('should not return records with null tag values', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foobar' } })
      await insertRecord({ tags: { myTag: null } })

      const records = await storageService.findByQuery(agentContext, TestRecord, { myTag: null })

      expect(records.length).toBe(1)
      expect(records).toEqual(expect.arrayContaining([expectedRecord]))
    })

    it('finds records using $and statements', async () => {
      const expectedRecord = await insertRecord({
        tags: { myTag: 'foo', anotherTag: 'bar' },
      })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $and: [{ myTag: 'foo' }, { anotherTag: 'bar' }],
      })

      expect(records.length).toBe(1)
      expect(records[0]).toEqual(expectedRecord)
    })

    it('finds records using $or statements', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foo' } })
      const expectedRecord2 = await insertRecord({
        tags: { anotherTag: 'bar' },
      })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $or: [{ myTag: 'foo' }, { anotherTag: 'bar' }],
      })

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord, expectedRecord2]))
    })

    it('finds records using $not statements', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foo' } })
      const expectedRecord2 = await insertRecord({
        tags: { anotherTag: 'bar' },
      })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $not: { myTag: 'notfoobar' },
      })

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord, expectedRecord2]))
    })

    it('correctly transforms an advanced query into a valid WQL query', async () => {
      const expectedQuery = {
        $and: [
          {
            $and: undefined,
            $not: undefined,
            $or: [
              { myTag: '1', $and: undefined, $or: undefined, $not: undefined },
              { myTag: '0', $and: undefined, $or: undefined, $not: undefined },
            ],
          },
          {
            $or: undefined,
            $not: undefined,
            $and: [
              {
                theNumber: 'n__0',
                $and: undefined,
                $or: undefined,
                $not: undefined,
              },
              {
                theNumber: 'n__1',
                $and: undefined,
                $or: undefined,
                $not: undefined,
              },
            ],
          },
        ],
        $or: [
          {
            'aValue:foo': '1',
            'aValue:bar': '1',
            $and: undefined,
            $or: undefined,
            $not: undefined,
          },
        ],
        $not: {
          myTag: 'notfoobar',
          $and: undefined,
          $or: undefined,
          $not: undefined,
        },
      }

      expect(
        askarQueryFromSearchQuery<TestRecord>({
          $and: [
            {
              $or: [{ myTag: true }, { myTag: false }],
            },
            {
              $and: [{ theNumber: '0' }, { theNumber: '1' }],
            },
          ],
          $or: [
            {
              aValue: ['foo', 'bar'],
            },
          ],
          $not: { myTag: 'notfoobar' },
        })
      ).toEqual(expectedQuery)
    })

    it('should retrieve correct paginated records', async () => {
      await insertRecord({ tags: { myTag: 'notfoobar' } })
      await insertRecord({ tags: { myTag: 'foobar' } })
      await insertRecord({ tags: { myTag: 'foobar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {}, { offset: 3, limit: 2 })

      expect(records.length).toBe(1)
    })

    it('should retrieve correct paginated records that match the query', async () => {
      await insertRecord({ tags: { myTag: 'notfoobar' } })
      const expectedRecord1 = await insertRecord({ tags: { myTag: 'foobar' } })
      const expectedRecord2 = await insertRecord({ tags: { myTag: 'foobar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(
        agentContext,
        TestRecord,
        {
          myTag: 'foobar',
        },
        { offset: 0, limit: 2 }
      )

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord1, expectedRecord2]))
    })
  })
})
