import { inject, scoped, Lifecycle } from 'tsyringe'
import type { WalletQuery, WalletRecord } from 'indy-sdk'

import { StorageService } from './StorageService'
import { BaseRecord } from './BaseRecord'
import { Wallet } from '../wallet/Wallet'
import { JsonTransformer } from '../utils/JsonTransformer'
import { Constructor } from '../utils/mixins'
import { Symbols } from '../symbols'

export interface BaseRecordConstructor<T> extends Constructor<T> {
  type: string
}

@scoped(Lifecycle.ContainerScoped)
export class IndyStorageService<T extends BaseRecord> implements StorageService<T> {
  private wallet: Wallet
  private static DEFAULT_QUERY_OPTIONS = {
    retrieveType: true,
    retrieveTags: true,
  }

  public constructor(@inject(Symbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  private recordToInstance(record: WalletRecord, typeClass: BaseRecordConstructor<T>): T {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const instance = JsonTransformer.deserialize<T>(record.value!, typeClass)
    instance.id = record.id
    instance.tags = record.tags || {}

    return instance
  }

  public async save(record: T) {
    const value = JsonTransformer.serialize(record)

    return this.wallet.addWalletRecord(record.type, record.id, value, record.tags)
  }

  public async update(record: T): Promise<void> {
    const value = JsonTransformer.serialize(record)

    await this.wallet.updateWalletRecordValue(record.type, record.id, value)
    await this.wallet.updateWalletRecordTags(record.type, record.id, record.tags)
  }

  public async delete(record: T) {
    return this.wallet.deleteWalletRecord(record.type, record.id)
  }

  public async find(typeClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    const record = await this.wallet.getWalletRecord(typeClass.type, id, IndyStorageService.DEFAULT_QUERY_OPTIONS)

    return this.recordToInstance(record, typeClass)
  }

  public async findAll(typeClass: BaseRecordConstructor<T>, type: string): Promise<T[]> {
    const recordIterator = await this.wallet.search(type, {}, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(this.recordToInstance(record, typeClass))
    }
    return records
  }

  public async findByQuery(typeClass: BaseRecordConstructor<T>, type: string, query: WalletQuery): Promise<T[]> {
    const recordIterator = await this.wallet.search(type, query, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(this.recordToInstance(record, typeClass))
    }
    return records
  }
}
