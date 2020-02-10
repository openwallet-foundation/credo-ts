import { Repository } from './Repository';
import { IndyStorageService } from './IndyStorageService';
import { IndyWallet } from '../wallet/IndyWallet';
import { ConnectionRecord } from './ConnectionRecord';
import { RecordTypes } from './BaseRecord';
import { ConnectionState } from '../protocols/connections/domain/ConnectionState';

describe('connection repository', () => {
  let wallet: IndyWallet;
  let cr: Repository<ConnectionRecord>;

  beforeEach(async () => {
    wallet = new IndyWallet({ id: 'testWallet' }, { key: 'asbdabsd' });
    const storageService = new IndyStorageService(wallet);
    cr = new Repository<ConnectionRecord>(ConnectionRecord, storageService);
    await wallet.init();
  });

  afterEach(async () => {
    await wallet.close();
    await wallet.delete();
  });

  const insertRecord = async () => {
    const props = {
      did: '123123',
      didDoc: {
        '@context': 'diddoccontext',
        service: [],
      },
      verkey: 'myverkey',
      state: ConnectionState.INVITED,
      tags: { myTag: 'foobar' },
    };
    const record = new ConnectionRecord(props);
    await cr.save(record);
    return record;
  };

  test('it is able to save messages', async () => {
    await insertRecord();
  });

  test('it is able to get the record', async () => {
    const record = await insertRecord();
    const found = await cr.find(record.id);
    expect(found.id).toStrictEqual(record.id);
  });

  test('it is able to find all records', async () => {
    for (let i = 0; i < 10; i++) {
      const props = {
        did: `123123_${i}`,
        didDoc: {
          '@context': 'diddoccontext',
          service: [],
        },
        verkey: 'myverkey',
        state: ConnectionState.INVITED,
        tags: {},
      };
      const rec = new ConnectionRecord(props);
      await cr.save(rec);
    }

    const records = await cr.findAll();
    expect(records.length).toStrictEqual(10);
  });

  test('it is able to update records', async () => {
    const record = await insertRecord();
    record.tags = { ...record.tags, foo: 'bar' };
    record.endpoint = 'https://example.com';
    await cr.update(record);
    const got = await cr.find(record.id);
    expect(got.endpoint).toStrictEqual(record.endpoint);
    expect(got.tags).toStrictEqual(record.tags);
  });

  test('it is able to delete a record', async () => {
    const record = await insertRecord();
    await cr.delete(record);
    expect(async () => {
      await cr.find(record.id);
    }).rejects;
  });

  test('it is able to query a record', async () => {
    const record = await insertRecord();
    const result = await cr.findByQuery({ myTag: 'foobar' });
    expect(result.length).toBe(1);
  });
});
