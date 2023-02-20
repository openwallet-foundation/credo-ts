import type { IndySdk } from '../../types'
import type { TagsBase } from '@aries-framework/core'

import { RecordDuplicateError, RecordNotFoundError, SigningProviderRegistry } from '@aries-framework/core'
import * as indySdk from 'indy-sdk'

import { TestRecord } from '../../../../core/src/storage/__tests__/TestRecord'
import { getAgentConfig, getAgentContext } from '../../../../core/tests/helpers'
import { IndySdkWallet } from '../../wallet/IndySdkWallet'
import { IndySdkStorageService } from '../IndySdkStorageService'

const agentConfig = getAgentConfig('IndySdkStorageServiceTest')
const wallet = new IndySdkWallet(indySdk, agentConfig.logger, new SigningProviderRegistry([]))

const agentContext = getAgentContext({
  wallet,
  agentConfig,
})

const storageService = new IndySdkStorageService<TestRecord>(indySdk)
const startDate = Date.now()

describe('IndySdkStorageService', () => {
  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await wallet.createAndOpen(agentConfig.walletConfig!)
  })

  afterEach(async () => {
    await wallet.delete()
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
          // booleans are stored as '1' and '0' so we store the string values '1' and '0' as 'n__1' and 'n__0'
          someStringNumberValue: '1',
          anotherStringNumberValue: '0',
        },
      })

      const retrieveRecord = await indySdk.getWalletRecord(wallet.handle, record.type, record.id, {
        retrieveType: true,
        retrieveTags: true,
      })

      expect(retrieveRecord.tags).toEqual({
        someBoolean: '1',
        someOtherBoolean: '0',
        someStringValue: 'string',
        'anArrayValue:foo': '1',
        'anArrayValue:bar': '1',
        someStringNumberValue: 'n__1',
        anotherStringNumberValue: 'n__0',
      })
    })

    it('should correctly transform tag values from string after retrieving', async () => {
      await indySdk.addWalletRecord(wallet.handle, TestRecord.type, 'some-id', '{}', {
        someBoolean: '1',
        someOtherBoolean: '0',
        someStringValue: 'string',
        'anArrayValue:foo': '1',
        'anArrayValue:bar': '1',
        // booleans are stored as '1' and '0' so we store the string values '1' and '0' as 'n__1' and 'n__0'
        someStringNumberValue: 'n__1',
        anotherStringNumberValue: 'n__0',
      })

      const record = await storageService.getById(agentContext, TestRecord, 'some-id')

      expect(record.getTags()).toEqual({
        someBoolean: true,
        someOtherBoolean: false,
        someStringValue: 'string',
        anArrayValue: expect.arrayContaining(['bar', 'foo']),
        someStringNumberValue: '1',
        anotherStringNumberValue: '0',
      })
    })
  })

  describe('save()', () => {
    it('should throw RecordDuplicateError if a record with the id already exists', async () => {
      const record = await insertRecord({ id: 'test-id' })

      return expect(() => storageService.save(agentContext, record)).rejects.toThrowError(RecordDuplicateError)
    })

    it('should save the record', async () => {
      const record = await insertRecord({ id: 'test-id' })
      const found = await storageService.getById(agentContext, TestRecord, 'test-id')

      expect(record).toEqual(found)
    })

    it('After a save the record should have update the updatedAt property', async () => {
      const time = startDate
      const record = await insertRecord({ id: 'test-updatedAt' })
      expect(record.updatedAt?.getTime()).toBeGreaterThan(time)
    })
  })

  describe('getById()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      return expect(() => storageService.getById(agentContext, TestRecord, 'does-not-exist')).rejects.toThrowError(
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

      return expect(() => storageService.update(agentContext, record)).rejects.toThrowError(RecordNotFoundError)
    })

    it('should update the record', async () => {
      const record = await insertRecord({ id: 'test-id' })

      record.replaceTags({ ...record.getTags(), foo: 'bar' })
      record.foo = 'foobaz'
      await storageService.update(agentContext, record)

      const retrievedRecord = await storageService.getById(agentContext, TestRecord, record.id)
      expect(retrievedRecord).toEqual(record)
    })

    it('After a record has been updated it should have updated the updatedAT property', async () => {
      const time = startDate
      const record = await insertRecord({ id: 'test-id' })

      record.replaceTags({ ...record.getTags(), foo: 'bar' })
      record.foo = 'foobaz'
      await storageService.update(agentContext, record)

      const retrievedRecord = await storageService.getById(agentContext, TestRecord, record.id)
      expect(retrievedRecord.createdAt.getTime()).toBeGreaterThan(time)
    })
  })

  describe('delete()', () => {
    it('should throw RecordNotFoundError if the record does not exist', async () => {
      const record = new TestRecord({
        id: 'test-id',
        foo: 'test',
        tags: { some: 'tag' },
      })

      return expect(() => storageService.delete(agentContext, record)).rejects.toThrowError(RecordNotFoundError)
    })

    it('should delete the record', async () => {
      const record = await insertRecord({ id: 'test-id' })
      await storageService.delete(agentContext, record)

      return expect(() => storageService.getById(agentContext, TestRecord, record.id)).rejects.toThrowError(
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
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, { myTag: 'foobar' })

      expect(records.length).toBe(1)
      expect(records[0]).toEqual(expectedRecord)
    })

    it('finds records using $and statements', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foo', anotherTag: 'bar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $and: [{ myTag: 'foo' }, { anotherTag: 'bar' }],
      })

      expect(records.length).toBe(1)
      expect(records[0]).toEqual(expectedRecord)
    })

    it('finds records using $or statements', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foo' } })
      const expectedRecord2 = await insertRecord({ tags: { anotherTag: 'bar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $or: [{ myTag: 'foo' }, { anotherTag: 'bar' }],
      })

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord, expectedRecord2]))
    })

    it('finds records using $not statements', async () => {
      const expectedRecord = await insertRecord({ tags: { myTag: 'foo' } })
      const expectedRecord2 = await insertRecord({ tags: { anotherTag: 'bar' } })
      await insertRecord({ tags: { myTag: 'notfoobar' } })

      const records = await storageService.findByQuery(agentContext, TestRecord, {
        $not: { myTag: 'notfoobar' },
      })

      expect(records.length).toBe(2)
      expect(records).toEqual(expect.arrayContaining([expectedRecord, expectedRecord2]))
    })

    it('correctly transforms an advanced query into a valid WQL query', async () => {
      const indySpy = jest.fn()
      const storageServiceWithoutIndySdk = new IndySdkStorageService<TestRecord>({
        openWalletSearch: indySpy,
        fetchWalletSearchNextRecords: jest.fn(() => ({ records: undefined })),
        closeWalletSearch: jest.fn(),
      } as unknown as IndySdk)

      await storageServiceWithoutIndySdk.findByQuery(agentContext, TestRecord, {
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
              { theNumber: 'n__0', $and: undefined, $or: undefined, $not: undefined },
              { theNumber: 'n__1', $and: undefined, $or: undefined, $not: undefined },
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
        $not: { myTag: 'notfoobar', $and: undefined, $or: undefined, $not: undefined },
      }

      expect(indySpy).toBeCalledWith(expect.anything(), expect.anything(), expectedQuery, expect.anything())
    })
  })
})
