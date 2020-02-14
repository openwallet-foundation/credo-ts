import { Repository } from './Repository';
import { IndyStorageService } from './IndyStorageService';
import { IndyWallet } from '../wallet/IndyWallet';
import { BaseRecord, RecordType } from './BaseRecord';
import uuid from 'uuid/v4';
import indy from 'indy-sdk';

interface TestRecordProps {
  id?: string;
  tags: { [keys: string]: string };
  foo: string;
}

class TestRecord extends BaseRecord {
  foo: string;

  static type: RecordType = RecordType.BaseRecord;
  type: RecordType = RecordType.BaseRecord;

  constructor(props: TestRecordProps) {
    super(props.id ? props.id : uuid());
    this.foo = props.foo;
    this.tags = props.tags;
  }
}

describe('connection repository', () => {
  let wallet: IndyWallet;
  let tr: Repository<TestRecord>;

  beforeEach(async () => {
    wallet = new IndyWallet({ id: 'testWallet' }, { key: 'asbdabsd' }, indy);
    const storageService = new IndyStorageService(wallet);
    tr = new Repository<TestRecord>(TestRecord, storageService);
    await wallet.init();
  });

  afterEach(async () => {
    await wallet.close();
    await wallet.delete();
  });

  const insertRecord = async () => {
    const props = {
      foo: 'bar',
      tags: { myTag: 'foobar' },
    };
    const record = new TestRecord(props);
    await tr.save(record);
    return record;
  };

  test('it is able to save messages', async () => {
    await insertRecord();
  });

  test('it is able to get the record', async () => {
    const record = await insertRecord();
    const found = await tr.find(record.id);
    expect(found.id).toStrictEqual(record.id);
  });

  test('it is able to find all records', async () => {
    for (let i = 0; i < 10; i++) {
      const props = {
        foo: `123123_${i}`,
        tags: {},
      };
      const rec = new TestRecord(props);
      await tr.save(rec);
    }

    const records = await tr.findAll();
    expect(records.length).toStrictEqual(10);
  });

  test('it is able to update records', async () => {
    const record = await insertRecord();
    record.tags = { ...record.tags, foo: 'bar' };
    record.foo = 'foobaz';
    await tr.update(record);
    const got = await tr.find(record.id);
    expect(got.foo).toStrictEqual(record.foo);
    expect(got.tags).toStrictEqual(record.tags);
  });

  test('it is able to delete a record', async () => {
    const record = await insertRecord();
    await tr.delete(record);
    expect(async () => {
      await tr.find(record.id);
    }).rejects;
  });

  test('it is able to query a record', async () => {
    await insertRecord();
    const result = await tr.findByQuery({ myTag: 'foobar' });
    expect(result.length).toBe(1);
  });
});
