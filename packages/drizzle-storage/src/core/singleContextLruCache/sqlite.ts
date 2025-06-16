import { SingleContextLruCacheItem } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { baseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const singleContextLruCache = sqliteTable(
  'SingleContextLruCache',
  {
    ...baseRecordTable,

    entries: text({ mode: 'json' }).notNull().$type<Record<string, SingleContextLruCacheItem>>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'singleContextLruCache')
)
