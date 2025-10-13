import type { DidCommBasicMessageRole } from '@credo-ts/didcomm'
import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { didcommConnection } from '../connection-record/sqlite'

export const didcommBasicMessage = sqliteTable(
  'DidcommBasicMessage',
  {
    ...getSqliteBaseRecordTable(),

    content: text().notNull(),

    // Not stored as date in Credo?
    sentTime: text('sent_time').notNull(),

    connectionId: text('connection_id'),
    role: text().$type<DidCommBasicMessageRole>().notNull(),
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
