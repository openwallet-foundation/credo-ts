import type { WalletQuery } from 'indy-sdk'

import { BaseRecord } from './BaseRecord'

export interface StorageService<T extends BaseRecord> {
  save(record: T): Promise<void>

  update(record: T): Promise<void>

  delete(record: T): Promise<void>

  find(typeClass: { new (...args: unknown[]): T }, id: string, type: string): Promise<T>

  findAll(typeClass: { new (...args: unknown[]): T }, type: string): Promise<T[]>

  findByQuery(typeClass: { new (...args: unknown[]): T }, type: string, query: WalletQuery): Promise<T[]>
}
