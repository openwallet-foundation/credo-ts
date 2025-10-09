import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { BasicMessageRole } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { didcommConnection } from '../sqlite'

export const didcommBasicMessage = sqliteTable(
  'DidcommBasicMessage',
  {
    ...getSqliteBaseRecordTable(),

    content: text().notNull(),

    // Not stored as date in Credo?
    sentTime: text('sent_time').notNull(),

    connectionId: text('connection_id'),
    role: text().$type<BasicMessageRole>().notNull(),
    threadId: text('thread_id'),
    parentThreadId: text('parent_thread_id'),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommBasicMessage'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
