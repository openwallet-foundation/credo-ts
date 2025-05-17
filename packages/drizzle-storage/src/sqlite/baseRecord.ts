import { SQLiteColumn, integer, primaryKey, text } from 'drizzle-orm/sqlite-core'

export const baseRecordTable = {
  contextCorrelationId: text('context_correlation_id').notNull(),

  id: text(),

  // createdAt is set in credo, to avoid having to query the
  // value from the database after creation
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),

  // updatedAt is updated in credo, to avoid having to query the updated
  // value from the database after an update
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),

  metadata: text({ mode: 'json' }).$type<Record<string, Record<string, unknown> | undefined>>(),
  customTags: text('custom_tags', { mode: 'json' }).$type<
    Record<string, string | number | boolean | null | string[]>
  >(),
} as const

// Define common base indexes that all tables should have
export const sqliteBaseRecordIndexes = <
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  Table extends { contextCorrelationId: SQLiteColumn<any>; id: SQLiteColumn<any> },
>(
  table: Table,
  // Keeping it here in case we want to add indexes later
  _tableName: string
) => [primaryKey({ columns: [table.contextCorrelationId, table.id] })]
