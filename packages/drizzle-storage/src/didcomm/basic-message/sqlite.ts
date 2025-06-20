import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { BasicMessageRole } from '@credo-ts/didcomm'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { didcommConnection } from '../sqlite'

export const didcommBasicMessage = sqliteTable(
  'DidcommBasicMessage',
  {
    ...sqliteBaseRecordTable,

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
