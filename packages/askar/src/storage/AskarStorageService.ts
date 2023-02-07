import type { BaseRecordConstructor, AgentContext, BaseRecord, Query, StorageService } from '@aries-framework/core'

import {
  RecordDuplicateError,
  WalletError,
  RecordNotFoundError,
  injectable,
  JsonTransformer,
} from '@aries-framework/core'
import { Scan } from '@hyperledger/aries-askar-shared'

import { askarErrors, isAskarError } from '../utils/askarError'
import { assertAskarWallet } from '../utils/assertAskarWallet'

import { askarQueryFromSearchQuery, recordToInstance, transformFromRecordTagValues } from './utils'

@injectable()
export class AskarStorageService<T extends BaseRecord> implements StorageService<T> {
  /** @inheritDoc */
  public async save(agentContext: AgentContext, record: T) {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    const value = JsonTransformer.serialize(record)
    const tags = transformFromRecordTagValues(record.getTags()) as Record<string, string>

    try {
      await session.insert({ category: record.type, name: record.id, value, tags })
    } catch (error) {
      if (isAskarError(error) && error.code === askarErrors.Duplicate) {
        throw new RecordDuplicateError(`Record with id ${record.id} already exists`, { recordType: record.type })
      }

      throw new WalletError('Error saving record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async update(agentContext: AgentContext, record: T): Promise<void> {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    const value = JsonTransformer.serialize(record)
    const tags = transformFromRecordTagValues(record.getTags()) as Record<string, string>

    try {
      await session.replace({ category: record.type, name: record.id, value, tags })
    } catch (error) {
      if (isAskarError(error) && error.code === askarErrors.NotFound) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      }

      throw new WalletError('Error updating record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async delete(agentContext: AgentContext, record: T) {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    try {
      await session.remove({ category: record.type, name: record.id })
    } catch (error) {
      if (isAskarError(error) && error.code === askarErrors.NotFound) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: record.type,
          cause: error,
        })
      }
      throw new WalletError('Error deleting record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async deleteById(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    id: string
  ): Promise<void> {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    try {
      await session.remove({ category: recordClass.type, name: id })
    } catch (error) {
      if (isAskarError(error) && error.code === askarErrors.NotFound) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
          cause: error,
        })
      }
      throw new WalletError('Error deleting record', { cause: error })
    }
  }

  /** @inheritDoc */
  public async getById(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>, id: string): Promise<T> {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    try {
      const record = await session.fetch({ category: recordClass.type, name: id })
      if (!record) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
        })
      }
      return recordToInstance(record, recordClass)
    } catch (error) {
      if (
        isAskarError(error) &&
        (error.code === askarErrors.NotFound ||
          // FIXME: this is current output from askar wrapper but does not describe specifically a not found scenario
          error.message === 'Received null pointer. The native library could not find the value.')
      ) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
          cause: error,
        })
      }
      throw new WalletError(`Error getting record`, { cause: error })
    }
  }

  /** @inheritDoc */
  public async getAll(agentContext: AgentContext, recordClass: BaseRecordConstructor<T>): Promise<T[]> {
    assertAskarWallet(agentContext.wallet)
    const session = agentContext.wallet.session

    const records = await session.fetchAll({ category: recordClass.type })

    const instances = []
    for (const record of records) {
      instances.push(recordToInstance(record, recordClass))
    }
    return instances
  }

  /** @inheritDoc */
  public async findByQuery(
    agentContext: AgentContext,
    recordClass: BaseRecordConstructor<T>,
    query: Query<T>
  ): Promise<T[]> {
    assertAskarWallet(agentContext.wallet)
    const store = agentContext.wallet.store

    const askarQuery = askarQueryFromSearchQuery(query)

    const scan = new Scan({
      category: recordClass.type,
      store,
      tagFilter: askarQuery,
    })

    const instances = []
    try {
      const records = await scan.fetchAll()
      for (const record of records) {
        instances.push(recordToInstance(record, recordClass))
      }
      return instances
    } catch (error) {
      if (
        isAskarError(error) && // FIXME: this is current output from askar wrapper but does not describe specifically a 0 length scenario
        error.message === 'Received null pointer. The native library could not find the value.'
      ) {
        return instances
      }
      throw new WalletError(`Error executing query`, { cause: error })
    }
  }
}
