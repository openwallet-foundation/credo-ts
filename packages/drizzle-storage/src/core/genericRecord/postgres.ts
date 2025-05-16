import { jsonb, pgTable } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const genericRecord = pgTable(
  'GenericRecord',
  {
    ...postgresBaseRecordTable,

    content: jsonb().notNull().$type<Record<string, unknown>>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'storageVersion')
)
