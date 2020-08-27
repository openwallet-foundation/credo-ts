/* eslint-disable @typescript-eslint/no-unused-vars */
import { BaseRecord } from '../../../storage/BaseRecord';
import { StorageService } from '../../../storage/StorageService';

export class StubStorageService<T extends BaseRecord> implements StorageService<T> {
  records: T[] = [];
  save(record: T): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  update(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  delete(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  find(typeClass: new (...args: any[]) => T, id: string, type: string): Promise<T> {
    throw new Error('Method not implemented.');
  }
  findAll(typeClass: new (...args: any[]) => T, type: string): Promise<T[]> {
    return Promise.resolve(this.records);
  }
  findByQuery(typeClass: new (...args: any[]) => T, type: string, query: {}): Promise<T[]> {
    throw new Error('Method not implemented.');
  }
}
