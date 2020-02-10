import { BaseRecord, RecordTypes } from './BaseRecord';
import { StorageService } from './StorageService';

export class Repository<T extends BaseRecord> {
  storageService: StorageService<T>;
  recordType: { new (...args: any[]): T; type: RecordTypes };

  constructor(recordType: { new (...args: any[]): T; type: RecordTypes }, storageService: StorageService<T>) {
    this.storageService = storageService;
    this.recordType = recordType;
  }

  async save(record: T): Promise<void> {
    this.storageService.save(record);
  }

  async update(record: T): Promise<void> {
    return this.storageService.update(record);
  }

  async delete(record: T): Promise<void> {
    return this.storageService.delete(record);
  }

  async find(id: string): Promise<T> {
    return this.storageService.find<T>(this.recordType, id, this.recordType.type);
  }

  async findAll(): Promise<T[]> {
    return this.storageService.findAll<T>(this.recordType, this.recordType.type);
  }

  async findByQuery(query: {}): Promise<T[]> {
    return this.storageService.findByQuery<T>(this.recordType, this.recordType.type, query);
  }
}
