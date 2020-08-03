import { BaseRecord } from './BaseRecord';

export interface StorageService<T extends BaseRecord> {
  save(record: T): Promise<void>;

  update(record: T): Promise<void>;

  delete(record: T): Promise<void>;

  find<T>(typeClass: { new (...args: any[]): T }, id: string, type: string): Promise<T>;

  findAll<T>(typeClass: { new (...args: any[]): T }, type: string): Promise<T[]>;

  // eslint-disable-next-line @typescript-eslint/ban-types
  findByQuery<T>(typeClass: { new (...args: any[]): T }, type: string, query: {}): Promise<T[]>;
}
