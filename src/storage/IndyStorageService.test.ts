import { Repository } from './Repository'
import { IndyStorageService } from './IndyStorageService'
import { IndyWallet } from '../wallet/IndyWallet'
import { BaseRecord, RecordType } from './BaseRecord'
import { v4 as uuid } from 'uuid'
import indy from 'indy-sdk'
import { AgentConfig } from '../agent/AgentConfig'

interface TestRecordProps {
  id?: string
  createdAt?: number
  tags: { [keys: string]: string }
  foo: string
}

class TestRecord extends BaseRecord {
  public foo: string

  public static readonly type: RecordType = RecordType.BaseRecord
  public readonly type = TestRecord.type

  public constructor(props: TestRecordProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.foo = props.foo
    this.tags = props.tags
  }
}

describe('IndyStorageService', () => {
  let wallet: IndyWallet
  let testRepository: Repository<TestRecord>

  beforeEach(async () => {
    wallet = new IndyWallet(
      new AgentConfig({
        indy,
        label: 'test',
        walletConfig: { id: 'testWallet' },
        walletCredentials: { key: 'asbdabsd' },
      })
    )
    const storageService = new IndyStorageService(wallet)
    testRepository = new Repository<TestRecord>(TestRecord, storageService)
    await wallet.init()
  })

  afterEach(async () => {
    await wallet.close()
    await wallet.delete()
  })

  const insertRecord = async () => {
    const props = {
      foo: 'bar',
      tags: { myTag: 'foobar' },
    }
    const record = new TestRecord(props)
    await testRepository.save(record)
    return record
  }

  test('it is able to save messages', async () => {
    await insertRecord()
  })

  test('does not change id, createdAt attributes', async () => {
    const record = await insertRecord()
    const found = await testRepository.find(record.id)
    expect(found.id).toEqual(record.id)
    expect(found.createdAt).toEqual(record.createdAt)
  })

  test('it is able to get the record', async () => {
    const record = await insertRecord()
    const found = await testRepository.find(record.id)
    expect(found.id).toStrictEqual(record.id)
  })

  test('it is able to find all records', async () => {
    for (let i = 0; i < 10; i++) {
      const props = {
        foo: `123123_${i}`,
        tags: {},
      }
      const rec = new TestRecord(props)
      await testRepository.save(rec)
    }

    const records = await testRepository.findAll()
    expect(records.length).toStrictEqual(10)
  })

  test('it is able to update records', async () => {
    const record = await insertRecord()
    record.tags = { ...record.tags, foo: 'bar' }
    record.foo = 'foobaz'
    await testRepository.update(record)
    const got = await testRepository.find(record.id)
    expect(got.foo).toStrictEqual(record.foo)
    expect(got.tags).toStrictEqual(record.tags)
  })

  test('it is able to delete a record', async () => {
    const record = await insertRecord()
    await testRepository.delete(record)
    expect(async () => {
      await testRepository.find(record.id)
    }).rejects
  })

  test('it is able to query a record', async () => {
    await insertRecord()
    const result = await testRepository.findByQuery({ myTag: 'foobar' })
    expect(result.length).toBe(1)
  })
})
