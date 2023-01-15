import type { AskarWallet } from '../wallet/AskarWallet'
import type {
  BaseRecordConstructor,
  AgentContext,
  BaseRecord,
  TagsBase,
  Query,
  StorageService,
} from '@aries-framework/core'
import type { EntryObject } from 'aries-askar-test-shared'

import {
  RecordDuplicateError,
  WalletError,
  RecordNotFoundError,
  injectable,
  JsonTransformer,
} from '@aries-framework/core'
import { Scan } from 'aries-askar-test-shared'

import { askarErrors, isAskarError } from '../utils/askarError'
import { assertAskarWallet } from '../utils/assertAskarWallet'

@injectable()
export class AskarStorageService<T extends BaseRecord> implements StorageService<T> {
  private transformToRecordTagValues(tags: Record<string, unknown>): TagsBase {
    const transformedTags: TagsBase = {}

    for (const [key, value] of Object.entries(tags)) {
      // If the value is a boolean string ('1' or '0')
      // use the boolean val
      if (value === '1' && key?.includes(':')) {
        const [tagName, tagValue] = key.split(':')

        const transformedValue = transformedTags[tagName]

        if (Array.isArray(transformedValue)) {
          transformedTags[tagName] = [...transformedValue, tagValue]
        } else {
          transformedTags[tagName] = [tagValue]
        }
      }
      // Transform '1' and '0' to boolean
      else if (value === '1' || value === '0') {
        transformedTags[key] = value === '1'
      }
      // If 1 or 0 is prefixed with 'n__' we need to remove it. This is to prevent
      // casting the value to a boolean
      else if (value === 'n__1' || value === 'n__0') {
        transformedTags[key] = value === 'n__1' ? '1' : '0'
      }
      // Otherwise just use the value
      else {
        transformedTags[key] = value as string
      }
    }

    return transformedTags
  }

  private transformFromRecordTagValues(tags: TagsBase): { [key: string]: string | undefined } {
    const transformedTags: { [key: string]: string | undefined } = {}

    for (const [key, value] of Object.entries(tags)) {
      // If the value is of type null we use the value undefined
      // Indy doesn't support null as a value
      if (value === null) {
        transformedTags[key] = undefined
      }
      // If the value is a boolean use the indy
      // '1' or '0' syntax
      else if (typeof value === 'boolean') {
        transformedTags[key] = value ? '1' : '0'
      }
      // If the value is 1 or 0, we need to add something to the value, otherwise
      // the next time we deserialize the tag values it will be converted to boolean
      else if (value === '1' || value === '0') {
        transformedTags[key] = `n__${value}`
      }
      // If the value is an array we create a tag for each array
      // item ("tagName:arrayItem" = "1")
      else if (Array.isArray(value)) {
        value.forEach((item) => {
          const tagName = `${key}:${item}`
          transformedTags[tagName] = '1'
        })
      }
      // Otherwise just use the value
      else {
        transformedTags[key] = value
      }
    }

    return transformedTags
  }

  /**
   * Transforms the search query into a wallet query compatible with indy WQL.
   *
   * The format used by AFJ is almost the same as the indy query, with the exception of
   * the encoding of values, however this is handled by the {@link IndyStorageService.transformToRecordTagValues}
   * method.
   */
  // TODO: Transform to Askar format
  private askarQueryFromSearchQuery(query: Query<T>): Record<string, unknown> {
    // eslint-disable-next-line prefer-const
    let { $and, $or, $not, ...tags } = query

    $and = ($and as Query<T>[] | undefined)?.map((q) => this.askarQueryFromSearchQuery(q))
    $or = ($or as Query<T>[] | undefined)?.map((q) => this.askarQueryFromSearchQuery(q))
    $not = $not ? this.askarQueryFromSearchQuery($not as Query<T>) : undefined

    const indyQuery = {
      ...this.transformFromRecordTagValues(tags as unknown as TagsBase),
      $and,
      $or,
      $not,
    }

    return indyQuery
  }

  private recordToInstance(record: EntryObject, recordClass: BaseRecordConstructor<T>): T {
    const instance = JsonTransformer.deserialize<T>(record.value as string, recordClass)
    instance.id = record.name

    const tags = record.tags ? this.transformToRecordTagValues(record.tags) : {}
    instance.replaceTags(tags)

    return instance
  }

  /** @inheritDoc */
  public async save(agentContext: AgentContext, record: T) {
    assertAskarWallet(agentContext.wallet)
    const session = (agentContext.wallet as AskarWallet).session

    const value = JsonTransformer.serialize(record)
    const tags = this.transformFromRecordTagValues(record.getTags()) as Record<string, string>

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
    const session = (agentContext.wallet as AskarWallet).session

    const value = JsonTransformer.serialize(record)
    const tags = this.transformFromRecordTagValues(record.getTags()) as Record<string, string>

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
    const session = (agentContext.wallet as AskarWallet).session

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
    const session = (agentContext.wallet as AskarWallet).session

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
    const session = (agentContext.wallet as AskarWallet).session

    try {
      const record = await session.fetch({ category: recordClass.type, name: id })
      if (!record) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: recordClass.type,
        })
      }
      return this.recordToInstance(record, recordClass)
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
    const session = (agentContext.wallet as AskarWallet).session

    const records = await session.fetchAll({ category: recordClass.type })

    const instances = []
    for (const record of records) {
      instances.push(this.recordToInstance(record, recordClass))
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
    const store = agentContext.wallet.handle

    const askarQuery = this.askarQueryFromSearchQuery(query)

    const scan = new Scan({
      category: recordClass.type,
      store,
      tagFilter: askarQuery,
    })

    const records = await scan.fetchAll()

    const instances = []
    for (const record of records) {
      instances.push(this.recordToInstance(record, recordClass))
    }
    return instances
  }
}
