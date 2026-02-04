import {
  AgentContext,
  BaseRecord,
  type BaseRecordConstructor,
  CredoError,
  decodeCursor,
  type Query,
  type QueryOptions,
  RecordDuplicateError,
  RecordNotFoundError,
} from '@credo-ts/core'
import { and, asc, DrizzleQueryError, desc, eq, type Simplify } from 'drizzle-orm'
import { PgTransaction as _PgTransaction, PgTable, pgTable } from 'drizzle-orm/pg-core'
import {
  SQLiteTable as _SQLiteTable,
  SQLiteTransaction as _SQLiteTransaction,
  sqliteTable,
} from 'drizzle-orm/sqlite-core'
import { type DrizzleDatabase, isDrizzlePostgresDatabase, isDrizzleSqliteDatabase } from '../DrizzleDatabase'
import { CredoDrizzleStorageError } from '../error'
import { getPostgresBaseRecordTable } from '../postgres'
import { getSqliteBaseRecordTable } from '../sqlite'
import { cursorAfterCondition, cursorBeforeCondition } from '../util'
import {
  DrizzlePostgresErrorCode,
  DrizzleSqliteErrorCode,
  extractPostgresErrorCode,
  extractSqliteErrorCode,
} from './drizzleError'
import { type DrizzleCustomTagKeyMapping, queryToDrizzlePostgres } from './queryToDrizzlePostgres'
import { queryToDrizzleSqlite } from './queryToDrizzleSqlite'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export type AnyDrizzleAdapter = BaseDrizzleRecordAdapter<any, any, any, any, any>
// biome-ignore lint/suspicious/noExplicitAny: no explanation
type SQLiteTransaction = _SQLiteTransaction<any, any, any, any>
// biome-ignore lint/suspicious/noExplicitAny: no explanation
type PgTransaction = _PgTransaction<any>

type Transaction<T extends AnyDrizzleAdapter> = Parameters<Parameters<T['database']['transaction']>[0]>[0]

export type DrizzleAdapterValues<Table extends _SQLiteTable> = Simplify<
  Omit<
    { [Key in keyof Table['$inferInsert']]: Table['$inferInsert'][Key] },
    Exclude<keyof ReturnType<typeof getSqliteBaseRecordTable>, 'customTags'>
  >
>

export type DrizzleAdapterRecordValues<Table extends _SQLiteTable> = Simplify<
  Omit<{ [Key in keyof Table['$inferInsert']]: Table['$inferInsert'][Key] }, 'contextCorrelationId'>
>

/**
 * Adapter between a specific Record class and the record Type
 */
export abstract class BaseDrizzleRecordAdapter<
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  CredoRecord extends BaseRecord<any, any, any>,
  PostgresTable extends ReturnType<typeof pgTable<string, ReturnType<typeof getPostgresBaseRecordTable>>>,
  PostgresSchema extends Record<string, unknown>,
  SQLiteTable extends ReturnType<typeof sqliteTable<string, ReturnType<typeof getSqliteBaseRecordTable>>>,
  SQLiteSchema extends Record<string, unknown>,
> {
  public recordClass: BaseRecordConstructor<CredoRecord>

  public table: {
    postgres: PostgresTable
    sqlite: SQLiteTable
  }

  /**
   * Allows overriding top level tags (as used by Credo record classes)
   * to the database structure. For example mapping from the tag `presentationAuthSession`
   * to the nested database json structure `presentation.authSession`.
   */
  public tagKeyMapping?: DrizzleCustomTagKeyMapping

  public constructor(
    public database: DrizzleDatabase<PostgresSchema, SQLiteSchema>,
    table: {
      postgres: PostgresTable
      sqlite: SQLiteTable
    },
    recordClass: BaseRecordConstructor<CredoRecord>
  ) {
    this.table = table
    this.recordClass = recordClass
  }

  public abstract getValues(record: CredoRecord): DrizzleAdapterValues<SQLiteTable>
  public getValuesWithBase(agentContext: AgentContext, record: CredoRecord) {
    return {
      ...this.getValues(record),

      // Always store based on context correlation id
      contextCorrelationId: agentContext.contextCorrelationId,

      id: record.id,
      metadata: record.metadata.data,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private _toRecord(values: DrizzleAdapterRecordValues<SQLiteTable>): CredoRecord {
    const filteredValues = Object.fromEntries(
      Object.entries(values).filter(([_key, value]) => value !== null)
    ) as DrizzleAdapterRecordValues<SQLiteTable>

    return this.toRecord(filteredValues)
  }

  public abstract toRecord(values: DrizzleAdapterRecordValues<SQLiteTable>): CredoRecord

  public async query(agentContext: AgentContext, query?: Query<CredoRecord>, queryOptions?: QueryOptions) {
    try {
      if (isDrizzlePostgresDatabase(this.database)) {
        const cursor = queryOptions?.cursor

        const hasAfter = !!cursor?.after
        const hasBefore = !!cursor?.before

        // Backward pagination ONLY when we have before but NOT after
        const isBackward = hasBefore && !hasAfter

        const whereConditions = [
          // Always filter by context
          eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId),

          // Existing query filters
          query ? queryToDrizzlePostgres(query, this.table.postgres, this.tagKeyMapping) : undefined,
        ]

        // AFTER cursor (lower bound)
        if (cursor?.after) {
          const afterCursor = decodeCursor(cursor.after)
          whereConditions.push(cursorAfterCondition(this.table.postgres, afterCursor))
        }

        // BEFORE cursor (upper bound)
        if (cursor?.before) {
          const beforeCursor = decodeCursor(cursor.before)
          whereConditions.push(cursorBeforeCondition(this.table.postgres, beforeCursor))
        }

        const filteredWhere = whereConditions.filter(Boolean)

        // Order must flip ONLY for backward pagination
        const orderBy = isBackward
          ? [asc(this.table.postgres.createdAt), asc(this.table.postgres.id)]
          : [desc(this.table.postgres.createdAt), asc(this.table.postgres.id)]

        let queryResult = this.database
          .select()
          .from(this.table.postgres as PgTable)
          .where(and(...filteredWhere))
          .orderBy(...orderBy)

        // TODO: I think since we are adding the cursor based pagination it makes more sense to add default limit even if no limit is passed
        // This way we take the limit passed or the default limit. Maybe '100'
        // Or we can add it as a default limit in the storageService itself
        if (queryOptions?.limit !== undefined) {
          queryResult = queryResult.limit(queryOptions.limit) as typeof queryResult
        }

        // Note: Offset should NOT be used with cursor pagination
        // PS: This is also mentioned in the drizzle docs at the end of the page(search 'offset'):
        // https://orm.drizzle.team/docs/guides/cursor-based-pagination
        // So we skip offset in case we have cursor passed
        if (!cursor && queryOptions?.offset !== undefined) {
          queryResult = queryResult.offset(queryOptions.offset ?? 0) as typeof queryResult
        }

        let result = await queryResult

        // Restore canonical order for backward pagination
        if (isBackward) {
          result = result.reverse()
        }

        return result.map(({ contextCorrelationId, ...item }) =>
          this._toRecord(item as DrizzleAdapterRecordValues<PostgresTable>)
        )
      }

      if (isDrizzleSqliteDatabase(this.database)) {
        const cursor = queryOptions?.cursor

        const hasAfter = !!cursor?.after
        const hasBefore = !!cursor?.before

        // Backward pagination ONLY when we have before but NOT after
        const isBackward = hasBefore && !hasAfter

        const whereConditions = [
          // Always filter by context
          eq(this.table.sqlite.contextCorrelationId, agentContext.contextCorrelationId),

          // Existing query filters
          query ? queryToDrizzleSqlite(query, this.table.sqlite, this.tagKeyMapping) : undefined,
        ]

        // AFTER cursor (lower bound)
        if (cursor?.after) {
          const afterCursor = decodeCursor(cursor.after)
          whereConditions.push(cursorAfterCondition(this.table.sqlite, afterCursor))
        }

        // BEFORE cursor (upper bound)
        if (cursor?.before) {
          const beforeCursor = decodeCursor(cursor.before)
          whereConditions.push(cursorBeforeCondition(this.table.sqlite, beforeCursor))
        }

        const filteredWhere = whereConditions.filter(Boolean)

        // Flip ordering ONLY for backward pagination
        const orderBy = isBackward
          ? [asc(this.table.sqlite.createdAt), asc(this.table.sqlite.id)]
          : [desc(this.table.sqlite.createdAt), asc(this.table.sqlite.id)]

        let queryResult = this.database
          .select()
          .from(this.table.sqlite as SQLiteTable)
          .where(and(...filteredWhere))
          .orderBy(...orderBy)

        // TODO: I think since we are adding the cursor based pagination it makes more sense to add default limit even if no limit is passed
        // This way we take the limit passed or the default limit. Maybe '100'
        // Or we can add it as a default limit in the storageService itself
        if (queryOptions?.limit !== undefined) {
          queryResult = queryResult.limit(queryOptions.limit) as typeof queryResult
        }

        // Note: Offset should NOT be used with cursor pagination
        // PS: This is also mentioned in the drizzle docs at the end of the page(search 'offset'):
        // https://orm.drizzle.team/docs/guides/cursor-based-pagination
        // So we skip offset in case we have cursor passed
        if (!cursor && queryOptions?.offset !== undefined) {
          queryResult = queryResult.offset(queryOptions.offset ?? 0) as typeof queryResult
        }

        let result = await queryResult

        // Restore canonical order for backward pagination
        if (isBackward) {
          result = result.reverse()
        }

        return result.map(({ contextCorrelationId, ...item }) =>
          this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
        )
      }
    } catch (error) {
      if (error instanceof CredoError) throw error

      throw new CredoDrizzleStorageError(`Error querying '${this.recordClass.type}' record with query`)
    }

    throw new CredoDrizzleStorageError('Unsupported database type')
  }

  public async getById(agentContext: AgentContext, id: string, tx?: Transaction<this>, forUpdate?: boolean) {
    try {
      if (isDrizzlePostgresDatabase(this.database)) {
        const session = (tx as PgTransaction) ?? this.database

        let queryResult = session
          .select()
          .from(this.table.postgres as PgTable)
          .where(
            and(
              eq(this.table.postgres.id, id),
              eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .limit(1)

        if (forUpdate) {
          queryResult = queryResult.for('no key update') as typeof queryResult
        }

        const [result] = await queryResult

        if (!result) {
          throw new RecordNotFoundError(`record with id ${id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        const { contextCorrelationId, ...item } = result
        return this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
      }

      if (isDrizzleSqliteDatabase(this.database)) {
        const session = (tx as SQLiteTransaction) ?? this.database

        const [result] = await session
          .select()
          .from(this.table.sqlite)
          .where(
            and(
              eq(this.table.sqlite.id, id),
              eq(this.table.sqlite.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .limit(1)

        if (!result) {
          throw new RecordNotFoundError(`record with id ${id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        const { contextCorrelationId, ...item } = result
        return this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
      }
    } catch (error) {
      if (error instanceof CredoError) throw error

      throw new CredoDrizzleStorageError(`Error retrieving '${this.recordClass.type}' record with id '${id}'`, {
        cause: error,
      })
    }

    throw new CredoDrizzleStorageError('Unsupported database type')
  }

  public async insert(agentContext: AgentContext, record: CredoRecord) {
    try {
      if (isDrizzlePostgresDatabase(this.database)) {
        // biome-ignore lint/suspicious/noExplicitAny: no explanation
        await this.database.insert(this.table.postgres).values(this.getValuesWithBase(agentContext, record) as any)
        return
      }

      if (isDrizzleSqliteDatabase(this.database)) {
        // biome-ignore lint/suspicious/noExplicitAny: no explanation
        await this.database.insert(this.table.sqlite).values(this.getValuesWithBase(agentContext, record) as any)
        return
      }
    } catch (error) {
      if (error instanceof DrizzleQueryError) {
        const sqliteErrorCode = extractSqliteErrorCode(error)
        const postgresErrorCode = extractPostgresErrorCode(error)

        if (
          sqliteErrorCode === DrizzleSqliteErrorCode.SQLITE_CONSTRAINT_PRIMARYKEY ||
          postgresErrorCode === DrizzlePostgresErrorCode.CONSTRAINT_UNIQUE_KEY
        ) {
          throw new RecordDuplicateError(`Record with id '${record.id}' already exists`, {
            recordType: record.type,
            cause: error,
          })
        }
      }

      throw new CredoDrizzleStorageError(`Error saving '${record.type}' record with id '${record.id}'`, {
        cause: error,
      })
    }

    throw new CredoDrizzleStorageError('Unsupported database type')
  }

  public async updateByIdWithLock(
    agentContext: AgentContext,
    id: string,
    updateCallback: (record: CredoRecord) => Promise<CredoRecord>
  ) {
    // SQLite  does not support locking, so there's no need to create a transaction
    if (isDrizzleSqliteDatabase(this.database)) {
      const record = await this.getById(agentContext, id)
      const updatedRecord = await updateCallback(record)
      updatedRecord.updatedAt = new Date()
      await this.update(agentContext, updatedRecord)

      return updatedRecord
    }

    return await this.database.transaction(async (tx) => {
      const record = await this.getById(agentContext, id, tx, true)
      const updatedRecord = await updateCallback(record)
      updatedRecord.updatedAt = new Date()
      await this.update(agentContext, updatedRecord, tx)

      return updatedRecord
    })
  }

  public async update(agentContext: AgentContext, record: CredoRecord, tx?: Transaction<this>) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!record.id) {
      throw new CredoDrizzleStorageError(`Record of type ${record.type}' is missing 'id' column.`)
    }

    try {
      if (isDrizzlePostgresDatabase(this.database)) {
        const session = (tx as PgTransaction) ?? this.database
        const updated = await session
          .update(this.table.postgres)
          // biome-ignore lint/suspicious/noExplicitAny: generics really don't play well here
          .set(this.getValuesWithBase(agentContext, record) as any)
          .where(
            and(
              eq(this.table.postgres.id, record.id),
              eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .returning({ id: this.table.postgres.id })

        if (updated.length === 0) {
          throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        return
      }

      if (isDrizzleSqliteDatabase(this.database)) {
        const session = (tx as SQLiteTransaction) ?? this.database
        const updated = await session
          .update(this.table.sqlite)
          // biome-ignore lint/suspicious/noExplicitAny: generics really don't play well here
          .set(this.getValuesWithBase(agentContext, record) as any)
          .where(
            and(
              eq(this.table.sqlite.id, record.id),
              eq(this.table.sqlite.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .returning({
            id: this.table.sqlite.id,
          })

        if (updated.length === 0) {
          throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        return
      }
    } catch (error) {
      if (error instanceof CredoError) throw error

      throw new CredoDrizzleStorageError(`Error updating '${record.type}' record with id '${record.id}'`, {
        cause: error,
      })
    }

    throw new CredoDrizzleStorageError('Unsupported database type')
  }

  public async delete(agentContext: AgentContext, id: string) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!id) {
      throw new CredoDrizzleStorageError(`Missing required 'id' for delete.`)
    }

    try {
      if (isDrizzlePostgresDatabase(this.database)) {
        const deleted = await this.database
          .delete(this.table.postgres)
          .where(
            and(
              eq(this.table.postgres.id, id),
              eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .returning({
            id: this.table.postgres.id,
          })

        if (deleted.length === 0) {
          throw new RecordNotFoundError(`record with id ${id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        return
      }

      if (isDrizzleSqliteDatabase(this.database)) {
        const deleted = await this.database
          .delete(this.table.sqlite)
          .where(
            and(
              eq(this.table.sqlite.id, id),
              eq(this.table.sqlite.contextCorrelationId, agentContext.contextCorrelationId)
            )
          )
          .returning({
            id: this.table.sqlite.id,
          })

        if (deleted.length === 0) {
          throw new RecordNotFoundError(`record with id ${id} not found.`, {
            recordType: this.recordClass.type,
          })
        }

        return
      }
    } catch (error) {
      if (error instanceof CredoError) throw error

      throw new CredoDrizzleStorageError(`Error deleting record '${this.recordClass.type}' with id '${id}'`, {
        cause: error,
      })
    }

    throw new CredoDrizzleStorageError('Unsupported database type')
  }
}
