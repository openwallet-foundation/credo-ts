import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const context = sqliteTable('Context', {
  contextCorrelationId: text('context_correlation_id').primaryKey(),
})
