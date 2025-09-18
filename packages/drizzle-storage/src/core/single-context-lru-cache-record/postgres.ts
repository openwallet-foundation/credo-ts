import type { SingleContextLruCacheItem } from '@credo-ts/core'
import { jsonb, pgTable } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const singleContextLruCache = pgTable(
  'SingleContextLruCache',
  {
    ...getPostgresBaseRecordTable(),
    entries: jsonb().notNull().$type<Record<string, SingleContextLruCacheItem>>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'singleContextLruCache')
)
