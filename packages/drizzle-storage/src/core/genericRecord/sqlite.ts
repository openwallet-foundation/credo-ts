import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const genericRecord = sqliteTable(
  'GenericRecord',
  {
    ...sqliteBaseRecordTable,

    content: text({ mode: 'json' }).notNull().$type<Record<string, unknown>>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'genericRecord')
)
