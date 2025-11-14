import { ExtraConfigColumn, foreignKey, jsonb, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { context } from '../core/context-record/postgres'

export const getPostgresBaseRecordTable = () =>
  ({
    contextCorrelationId: text('context_correlation_id').notNull(),
    id: text().notNull(),

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
  }) as const

// Define common base indexes that all tables should have
export const postgresBaseRecordIndexes = <
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  Table extends { contextCorrelationId: ExtraConfigColumn<any>; id: ExtraConfigColumn<any> },
>(
  table: Table,
  tableName: string
) => {
  return [
    // Composite primary key on each table with id + context correlation id
    primaryKey({ columns: [table.contextCorrelationId, table.id], name: `${tableName}_pk` }),
    foreignKey({
      columns: [table.contextCorrelationId],
      foreignColumns: [context.contextCorrelationId],
      name: `${tableName}_fk_context`,
    }).onDelete('cascade'),
  ]
}
