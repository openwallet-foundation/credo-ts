import type { WalletQuery } from 'indy-sdk'

import { StorageService } from './StorageService'
import { BaseRecord } from './BaseRecord'
import { Wallet } from '../wallet/Wallet'

export class IndyStorageService<T extends BaseRecord> implements StorageService<T> {
  private wallet: Wallet
  private static DEFAULT_QUERY_OPTIONS = {
    retrieveType: true,
    retrieveTags: true,
  }

  public constructor(wallet: Wallet) {
    this.wallet = wallet
  }

  public async save(record: T) {
    const { type, id, tags } = record
    const value = record.getValue()
    return this.wallet.addWalletRecord(type, id, value, tags)
  }

  public async update(record: T): Promise<void> {
    const { type, id, tags } = record
    const value = record.getValue()
    await this.wallet.updateWalletRecordValue(type, id, value)
    await this.wallet.updateWalletRecordTags(type, id, tags)
  }

  public async delete(record: T) {
    const { id, type } = record
    return this.wallet.deleteWalletRecord(type, id)
  }

  public async find<T>(typeClass: { new (...args: unknown[]): T }, id: string, type: string): Promise<T> {
    const record = await this.wallet.getWalletRecord(type, id, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    return BaseRecord.fromPersistence<T>(typeClass, record)
  }

  public async findAll<T>(typeClass: { new (...args: unknown[]): T }, type: string): Promise<T[]> {
    const recordIterator = await this.wallet.search(type, {}, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(BaseRecord.fromPersistence<T>(typeClass, record))
    }
    return records
  }

  public async findByQuery<T>(
    typeClass: { new (...args: unknown[]): T },
    type: string,
    query: WalletQuery
  ): Promise<T[]> {
    const recordIterator = await this.wallet.search(type, query, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(BaseRecord.fromPersistence<T>(typeClass, record))
    }
    return records
  }
}
