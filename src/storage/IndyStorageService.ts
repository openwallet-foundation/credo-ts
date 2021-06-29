import type { BaseRecord, TagsBase } from './BaseRecord'
import type { StorageService, BaseRecordConstructor } from './StorageService'
import type { WalletQuery, WalletRecord } from 'indy-sdk'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { RecordNotFoundError, RecordDuplicateError } from '../error'
import { JsonTransformer } from '../utils/JsonTransformer'
import { handleIndyError, isIndyError } from '../utils/indyError'
import { isBoolean } from '../utils/type'
import { Wallet } from '../wallet/Wallet'

@scoped(Lifecycle.ContainerScoped)
export class IndyStorageService<T extends BaseRecord> implements StorageService<T> {
  private wallet: Wallet
  private static DEFAULT_QUERY_OPTIONS = {
    retrieveType: true,
    retrieveTags: true,
  }

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  private transformToRecordTagValues(tags: { [key: number]: string | undefined }): TagsBase {
    const transformedTags: TagsBase = {}

    for (const [key, value] of Object.entries(tags)) {
      // If the value is a boolean string ('1' or '0')
      // use the boolean val
      if (value === '1' || value === '0') {
        transformedTags[key] = value === '1'
      }
      // Otherwise just use the value
      else {
        transformedTags[key] = value
      }
    }

    return transformedTags
  }

  private transformFromRecordTagValues(tags: TagsBase): { [key: number]: string | undefined } {
    const transformedTags: TagsBase = {}

    for (const [key, value] of Object.entries(tags)) {
      // If the value is a boolean use the indy
      // '1' or '0' syntax
      if (isBoolean(value)) {
        transformedTags[key] = value ? '1' : '0'
      }
      // Otherwise just use the value
      else {
        transformedTags[key] = value
      }
    }

    return transformedTags
  }

  private recordToInstance(record: WalletRecord, recordClass: BaseRecordConstructor<T>): T {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const instance = JsonTransformer.deserialize<T>(record.value!, recordClass)
    instance.id = record.id

    const tags = record.tags ? this.transformToRecordTagValues(record.tags) : {}
    instance.replaceTags(tags)

    return instance
  }

  /** @inheritDoc {StorageService#save} */
  public async save(record: T) {
    const value = JsonTransformer.serialize(record)
    const tags = this.transformFromRecordTagValues(record.getTags())

    try {
      await this.wallet.addWalletRecord(record.type, record.id, value, tags)
    } catch (error) {
      // Record already exists
      if (isIndyError(error, 'WalletItemAlreadyExists')) {
        throw new RecordDuplicateError(`Record with id ${record.id} already exists`, { recordType: record.type })
      } // Other indy error
      else if (isIndyError(error)) {
        handleIndyError(error)
      }

      throw error
    }
  }

  /** @inheritDoc {StorageService#update} */
  public async update(record: T): Promise<void> {
    const value = JsonTransformer.serialize(record)
    const tags = this.transformFromRecordTagValues(record.getTags())

    try {
      await this.wallet.updateWalletRecordValue(record.type, record.id, value)
      await this.wallet.updateWalletRecordTags(record.type, record.id, tags)
    } catch (error) {
      // Record does not exist
      if (isIndyError(error, 'WalletItemNotFound')) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      } // Other indy error
      else if (isIndyError(error)) {
        handleIndyError(error)
      }

      throw error
    }
  }

  /** @inheritDoc {StorageService#delete} */
  public async delete(record: T) {
    try {
      await this.wallet.deleteWalletRecord(record.type, record.id)
    } catch (error) {
      // Record does not exist
      if (isIndyError(error, 'WalletItemNotFound')) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      } // Other indy error
      else if (isIndyError(error)) {
        handleIndyError(error)
      }

      throw error
    }
  }

  /** @inheritDoc {StorageService#getById} */
  public async getById(recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    try {
      const record = await this.wallet.getWalletRecord(recordClass.type, id, IndyStorageService.DEFAULT_QUERY_OPTIONS)
      return this.recordToInstance(record, recordClass)
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
          cause: error,
        })
      } else if (isIndyError(error)) {
        handleIndyError(error)
      }

      throw error
    }
  }

  /** @inheritDoc {StorageService#getAll} */
  public async getAll(recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    const recordIterator = await this.wallet.search(recordClass.type, {}, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(this.recordToInstance(record, recordClass))
    }
    return records
  }

  /** @inheritDoc {StorageService#findByQuery} */
  public async findByQuery(recordClass: BaseRecordConstructor<T>, query: WalletQuery): Promise<T[]> {
    const recordIterator = await this.wallet.search(recordClass.type, query, IndyStorageService.DEFAULT_QUERY_OPTIONS)
    const records = []
    for await (const record of recordIterator) {
      records.push(this.recordToInstance(record, recordClass))
    }
    return records
  }
}
