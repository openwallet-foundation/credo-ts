import { utils } from '@credo-ts/core'
import { ExtraConfigColumn, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

export const baseRecordTable = {
  contextCorrelationId: text('context_correlation_id').notNull(),
  id: text().$defaultFn(() => utils.uuid()),

  // createdAt is set in credo, to avoid having to query the
  // value from the database after creation
  createdAt: timestamp('created_at', {
    withTimezone: true,
    precision: 3,
  }).notNull(),

  // updatedAt is updated in credo, to avoid having to query the updated
  // value from the database after an update
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    precision: 3,
  }).notNull(),

  metadata: jsonb().$type<Record<string, Record<string, unknown> | undefined>>(),
  customTags: jsonb('custom_tags').$type<Record<string, string | number | boolean | null | string[]>>(),
} as const

// Define common base indexes that all tables should have
export const postgresBaseRecordIndexes = <
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  Table extends { contextCorrelationId: ExtraConfigColumn<any>; id: ExtraConfigColumn<any> },
>(
  table: Table,
  // Keeping it here in case we want to add indexes later
  _tableName: string
) => [
  // Composite primary key on each table with id + context correlation id
  primaryKey({ columns: [table.contextCorrelationId, table.id] }),
]
