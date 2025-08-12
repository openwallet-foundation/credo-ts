import { pgTable, text } from 'drizzle-orm/pg-core'

export const context = pgTable('Context', {
  contextCorrelationId: text('context_correlation_id').primaryKey(),
})
