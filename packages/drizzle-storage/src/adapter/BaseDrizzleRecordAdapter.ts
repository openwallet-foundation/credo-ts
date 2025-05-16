/**
 * Adapter between a specific Record class and the record Type
 */

import { BaseRecord, CredoError, Query, QueryOptions, RecordNotFoundError } from '@credo-ts/core'
import { Simplify, eq } from 'drizzle-orm'
import { PgColumn, PgTable, pgTable } from 'drizzle-orm/pg-core'
import { SQLiteColumn, SQLiteTable as _SQLiteTable, sqliteTable } from 'drizzle-orm/sqlite-core'
import { DrizzleDatabase } from '../createDrizzle'
import { CredoDrizzleColumnDoesNotExistError, CredoDrizzleStorageError } from '../error'
import { postgresBaseRecordTable } from '../postgres'
import { sqliteBaseRecordTable } from '../sqlite'
import { queryToDrizzlePostgres } from './queryToDrizzlePostgres'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyDrizzleAdapter = BaseDrizzleRecordAdapter<any, any, any, any, any>

export type DrizzleAdapterValues<Table extends _SQLiteTable> = Simplify<{
  [Key in keyof Table['$inferInsert']]: Table['$inferInsert'][Key]
}>
export abstract class BaseDrizzleRecordAdapter<
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  CredoRecord extends BaseRecord<any, any, any>,
  PostgresTable extends ReturnType<typeof pgTable<string, typeof postgresBaseRecordTable>>,
  PostgresSchema extends Record<string, unknown>,
  SQLiteTable extends ReturnType<typeof sqliteTable<string, typeof sqliteBaseRecordTable>>,
  SQLiteSchema extends Record<string, unknown>,
> {
  public recordType: CredoRecord['type']

  public table: {
    postgres: PostgresTable
    sqlite: SQLiteTable
  }

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
  public abstract toRecord(values: DrizzleAdapterValues<SQLiteTable>): CredoRecord

  protected pgColumn<Column extends string>(column: Column) {
    const columnValue = this.table.postgres._.columns[column as keyof typeof this.table.postgres._.columns]
    if (!columnValue) {
      throw new CredoDrizzleColumnDoesNotExistError({
        column,
        databaseType: this.database.type,
        table: this.table.postgres._.name,
      })
    }

    return columnValue as Column extends keyof typeof this.table.postgres._.columns
      ? (typeof this.table.postgres._.columns)[Column]
      : PgColumn
  }

  protected sqliteColumn<Column extends string>(column: Column) {
    const columnValue = this.table.sqlite._.columns[column as keyof typeof this.table.sqlite._.columns]
    if (!columnValue) {
      throw new CredoDrizzleColumnDoesNotExistError({
        column,
        databaseType: this.database.type,
        table: this.table.sqlite._.name,
      })
    }

    return columnValue as Column extends keyof typeof this.table.sqlite._.columns
      ? (typeof this.table.sqlite._.columns)[Column]
      : SQLiteColumn
  }

  protected column(column: string) {
    if (this.database.type === 'postgres') {
      const columnValue = this.table.postgres._.columns[column as keyof typeof this.table.postgres._.columns]
      if (!columnValue) {
        throw new CredoDrizzleColumnDoesNotExistError({
          column,
          databaseType: this.database.type,
          table: this.table.postgres._.name,
        })
      }

      return columnValue as typeof this.database.type extends 'postgres' ? PgColumn : SQLiteColumn
    }

    if (this.database.type === 'sqlite') {
      const columnValue = this.table.sqlite._.columns[column as keyof typeof this.table.sqlite._.columns]
      if (!columnValue) {
        throw new CredoDrizzleColumnDoesNotExistError({
          column,
          databaseType: this.database.type,
          table: this.table.sqlite._.name,
        })
      }

      return columnValue as typeof this.database.type extends 'postgres' ? PgColumn : SQLiteColumn
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }

  public async query(query?: Query<CredoRecord>, queryOptions?: QueryOptions) {
    if (this.database.type === 'postgres') {
      let queryResult = this.database.select().from(this.table.postgres as PgTable)

      if (query) {
        queryResult = queryResult.where(queryToDrizzlePostgres(query ?? {}, this.table.postgres)) as typeof queryResult
      }

      if (queryOptions?.limit !== undefined) {
        queryResult = queryResult.limit(queryOptions.limit) as typeof queryResult
      }

      if (queryOptions?.offset !== undefined) {
        queryResult = queryResult.offset(queryOptions.offset ?? 0) as typeof queryResult
      }

      const result = await queryResult
      return result.map((item) => this.toRecord(item as DrizzleAdapterValues<SQLiteTable>))
    }

    if (this.database.type === 'sqlite') {
      let queryResult = this.database.select().from(this.table.sqlite as SQLiteTable)

      if (query) {
        queryResult = queryResult.where(queryToDrizzleSqlite(query ?? {}, this.table.sqlite)) as typeof queryResult
      }

      if (queryOptions?.limit !== undefined) {
        queryResult = queryResult.limit(queryOptions.limit) as typeof queryResult
      }

      if (queryOptions?.offset !== undefined) {
        queryResult = queryResult.offset(queryOptions.offset ?? 0) as typeof queryResult
      }

      const result = await queryResult
      return result.map((item) => this.toRecord(item as DrizzleAdapterValues<SQLiteTable>))
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }

  public async getById(id: string) {
    if (this.database.type === 'postgres') {
      const [result] = await this.database
        .select()
        .from(this.table.postgres as PgTable)
        .where(eq(this.column('id'), id))
        .limit(1)

      if (!result) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: this.recordType,
        })
      }

      return this.toRecord(result as DrizzleAdapterValues<SQLiteTable>)
    }

    if (this.database.type === 'sqlite') {
      const [result] = await this.database
        .select()
        .from(this.table.sqlite)
        .where(eq(this.column('id'), id))
        .limit(1)

      if (!result) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: this.recordType,
        })
      }

      return this.toRecord(result as DrizzleAdapterValues<SQLiteTable>)
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }

  public async insert(record: CredoRecord) {
    if (this.database.type === 'postgres') {
      // biome-ignore lint/suspicious/noExplicitAny: generics really don't play well here
      await this.database.insert(this.table.postgres).values(this.getValues(record) as any)
    }

    if (this.database.type === 'sqlite') {
      await this.database.insert(this.table.sqlite).values(this.getValues(record))
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }

  public async update(record: CredoRecord) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!record.id) {
      throw new CredoDrizzleStorageError(`Record of type ${record.type}' is missing 'id' column.`)
    }

    if (this.database.type === 'postgres') {
      const updated = await this.database
        .update(this.table.postgres)
        // biome-ignore lint/suspicious/noExplicitAny: generics really don't play well here
        .set(this.getValues(record) as any)
        .where(eq(this.pgColumn('id'), record.id))
        .returning({ id: this.pgColumn('id') })

      if (updated.length === 0) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: this.recordType,
        })
      }

      return
    }

    if (this.database.type === 'sqlite') {
      const updated = await this.database
        .update(this.table.sqlite)
        // biome-ignore lint/suspicious/noExplicitAny: generics really don't play well here
        .set(this.getValues(record) as any)
        .where(eq(this.sqliteColumn('id'), record.id))
        .limit(1)
        .returning({
          id: this.sqliteColumn('id'),
        })

      if (updated.length === 0) {
        throw new RecordNotFoundError(`record with id ${record.id} not found.`, {
          recordType: this.recordType,
        })
      }

      return
    }

    // @ts-expect-error
    throw new CredoError(`Unsupported database type '${database.type}'`)
  }

  public async delete(id: string) {
    // Although id should always be set, if for some reason it is not set it can be quite impactful
    if (!id) {
      throw new CredoDrizzleStorageError(`Missing required 'id' for delete.`)
    }

    if (this.database.type === 'postgres') {
      const deleted = await this.database
        .delete(this.table.postgres)
        .where(eq(this.pgColumn('id'), id))
        .returning({
          id: this.pgColumn('id'),
        })

      if (deleted.length === 0) {
        throw new RecordNotFoundError(`record with id ${id} not found.`, {
          recordType: this.recordType,
        })
      }

      return
    }

    if (this.database.type === 'sqlite') {
      const deleted = await this.database
        .delete(this.table.postgres)
        .where(eq(this.pgColumn('id'), id))
        .returning({
          id: this.sqliteColumn('id'),
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
