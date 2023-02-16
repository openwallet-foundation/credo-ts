// Generic interface for a database type

import type { Item } from './types'

// e.g. sqlite of postgres
export interface WalletDatabase {
  connect(): Promise<void>
  isConnected(): boolean
  isUpdated(): Promise<boolean>
  preUpgrade(): Promise<void>
  insertProfile(passKey: string, name: string, key: Uint8Array): Promise<void>
  finishUpgrade(): Promise<void>
  fetchOne<T>(sql: string, optional?: boolean): Promise<T | undefined>
  fetchPendingItems<T>(limit: number): Promise<T | undefined>
  updateItems(items: Array<Item>): Promise<void>
  close(): Promise<void>
}
