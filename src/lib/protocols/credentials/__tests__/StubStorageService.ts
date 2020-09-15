/* eslint-disable @typescript-eslint/no-unused-vars */
import { BaseRecord } from '../../../storage/BaseRecord';
import { StorageService } from '../../../storage/StorageService';

export class StubStorageService<T extends BaseRecord> implements StorageService<T> {
  private records: T[] = [];
  public save(record: T): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  public update(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public delete(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public find(typeClass: new (...args: any[]) => T, id: string, type: string): Promise<T> {
    const r = this.records.find(r => (r.id = id));
    if (!r) {
      throw new Error();
    }
    return Promise.resolve(r);
  }
  public findAll(typeClass: new (...args: any[]) => T, type: string): Promise<T[]> {
    return Promise.resolve(this.records);
  }
  public findByQuery(typeClass: new (...args: any[]) => T, type: string, query: WalletQuery): Promise<T[]> {
    throw new Error('Method not implemented.');
  }
}
