import { AgentContext, BaseRecord, CredoError, Query, QueryOptions, RecordNotFoundError } from '@credo-ts/core'
import { Simplify, and, eq } from 'drizzle-orm'
import { PgTable, pgTable } from 'drizzle-orm/pg-core'
import { SQLiteTable as _SQLiteTable, sqliteTable } from 'drizzle-orm/sqlite-core'
import { DrizzleDatabase, isDrizzlePostgresDatabase, isDrizzleSqliteDatabase } from '../DrizzleDatabase'
import { CredoDrizzleStorageError } from '../error'
import { getPostgresBaseRecordTable } from '../postgres'
import { getSqliteBaseRecordTable } from '../sqlite'
import { DrizzleCustomTagKeyMapping, queryToDrizzlePostgres } from './queryToDrizzlePostgres'
import { queryToDrizzleSqlite } from './queryToDrizzleSqlite'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyDrizzleAdapter = BaseDrizzleRecordAdapter<any, any, any, any, any>

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
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  CredoRecord extends BaseRecord<any, any, any>,
  PostgresTable extends ReturnType<typeof pgTable<string, ReturnType<typeof getPostgresBaseRecordTable>>>,
  PostgresSchema extends Record<string, unknown>,
  SQLiteTable extends ReturnType<typeof sqliteTable<string, ReturnType<typeof getSqliteBaseRecordTable>>>,
  SQLiteSchema extends Record<string, unknown>,
> {
  public recordType: CredoRecord['type']

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
    recordType: CredoRecord['type']
  ) {
    this.table = table
    this.recordType = recordType
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
    if (isDrizzlePostgresDatabase(this.database)) {
      let queryResult = this.database.select().from(this.table.postgres as PgTable)

      if (query) {
        queryResult = queryResult.where(
          and(
            // Always filter based on context correlation id
            eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId),
            queryToDrizzlePostgres(query ?? {}, this.table.postgres, this.tagKeyMapping)
          )
        ) as typeof queryResult
      }

      if (queryOptions?.limit !== undefined) {
        queryResult = queryResult.limit(queryOptions.limit) as typeof queryResult
      }

      if (queryOptions?.offset !== undefined) {
        queryResult = queryResult.offset(queryOptions.offset ?? 0) as typeof queryResult
      }

      const result = await queryResult
      return result.map(({ contextCorrelationId, ...item }) =>
        this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
      )
    }

    if (isDrizzleSqliteDatabase(this.database)) {
      let queryResult = this.database.select().from(this.table.sqlite as SQLiteTable)

      if (query) {
        queryResult = queryResult.where(
          and(
            // Always filter based on context correlation id
            eq(this.table.sqlite.contextCorrelationId, agentContext.contextCorrelationId),
            queryToDrizzleSqlite(query ?? {}, this.table.sqlite, this.tagKeyMapping)
          )
        ) as unknown as typeof queryResult
      }

      if (queryOptions?.limit !== undefined) {
        queryResult = queryResult.limit(queryOptions.limit) as unknown as typeof queryResult
      }

      if (queryOptions?.offset !== undefined) {
        queryResult = queryResult.offset(queryOptions.offset ?? 0) as unknown as typeof queryResult
      }

      const result = await queryResult
      return result.map(({ contextCorrelationId, ...item }) =>
        this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
      )
    }

    throw new CredoError('Unsupported database type')
  }

  public async getById(agentContext: AgentContext, id: string) {
    if (isDrizzlePostgresDatabase(this.database)) {
      const [result] = await this.database
        .select()
        .from(this.table.postgres as PgTable)
        .where(
          and(
            eq(this.table.postgres.id, id),
            eq(this.table.postgres.contextCorrelationId, agentContext.contextCorrelationId)
          )
        )
        .limit(1)

      if (!result) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: this.recordType,
        })
      }

      const { contextCorrelationId, ...item } = result
      return this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
    }

    if (isDrizzleSqliteDatabase(this.database)) {
      const [result] = await this.database
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
          recordType: this.recordType,
        })
      }

      const { contextCorrelationId, ...item } = result
      return this._toRecord(item as DrizzleAdapterRecordValues<SQLiteTable>)
    }

    throw new CredoError('Unsupported database type')
  }

  public async insert(agentContext: AgentContext, record: CredoRecord) {
    if (isDrizzlePostgresDatabase(this.database)) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await this.database.insert(this.table.postgres).values(this.getValuesWithBase(agentContext, record) as any)
      return
    }

    if (isDrizzleSqliteDatabase(this.database)) {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await this.database.insert(this.table.sqlite).values(this.getValuesWithBase(agentContext, record) as any)
      return
    }

    throw new CredoError('Unsupported database type')
  }

  public async update(agentContext: AgentContext, record: CredoRecord) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!record.id) {
      throw new CredoDrizzleStorageError(`Record of type ${record.type}' is missing 'id' column.`)
    }

    if (isDrizzlePostgresDatabase(this.database)) {
      const updated = await this.database
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
          recordType: this.recordType,
        })
      }

      return
    }

    if (isDrizzleSqliteDatabase(this.database)) {
      const updated = await this.database
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
          recordType: this.recordType,
        })
      }

      return
    }

    throw new CredoError('Unsupported database type')
  }

  public async delete(agentContext: AgentContext, id: string) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!id) {
      throw new CredoDrizzleStorageError(`Missing required 'id' for delete.`)
    }

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
          recordType: this.recordType,
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
          recordType: this.recordType,
        })
      }

      return
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }
}
