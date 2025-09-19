import { SQLiteColumn, foreignKey, integer, primaryKey, text } from 'drizzle-orm/sqlite-core'
import { context } from '../core/context-record/sqlite'

export const getSqliteBaseRecordTable = () =>
  ({
    contextCorrelationId: text('context_correlation_id').notNull(),

    id: text().notNull(),

    // createdAt is set in credo, to avoid having to query the
    // value from the database after creation
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),

    // updatedAt is updated in credo, to avoid having to query the updated
    // value from the database after an update
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),

    metadata: text({ mode: 'json' }).$type<Record<string, Record<string, unknown> | undefined>>(),
    customTags: text('custom_tags', { mode: 'json' }).$type<
      Record<string, string | number | undefined | boolean | null | string[]>
    >(),
  }) as const

// Define common base indexes that all tables should have
export const sqliteBaseRecordIndexes = <
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  Table extends { contextCorrelationId: SQLiteColumn<any>; id: SQLiteColumn<any> },
>(
  table: Table,
  tableName: string
) => [
  primaryKey({ columns: [table.contextCorrelationId, table.id], name: `${tableName}_pk` }),
  foreignKey({
    columns: [table.contextCorrelationId],
    foreignColumns: [context.contextCorrelationId],
    name: `${tableName}_fk_context`,
  }).onDelete('cascade'),
]
