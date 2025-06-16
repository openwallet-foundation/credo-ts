import { SingleContextLruCacheItem } from '@credo-ts/core'
import { jsonb, pgTable } from 'drizzle-orm/pg-core'
import { baseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const singleContextLruCache = pgTable(
  'SingleContextLruCache',
  {
    ...baseRecordTable,
    entries: jsonb().notNull().$type<Record<string, SingleContextLruCacheItem>>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'singleContextLruCache')
)
