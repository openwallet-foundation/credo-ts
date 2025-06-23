import { BasicMessageRole } from '@credo-ts/didcomm'
import { foreignKey, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { didcommConnection } from '../postgres'

export const didcommBasicMessageRoleEnum = pgEnum('DidcommBasicMessageRole', BasicMessageRole)

export const didcommBasicMessage = pgTable(
  'DidcommBasicMessage',
  {
    ...getPostgresBaseRecordTable(),

    content: text().notNull(),

    // Not stored as date in Credo?
    sentTime: text('sent_time').notNull(),

    role: didcommBasicMessageRoleEnum().notNull(),
    connectionId: text('connection_id'),
    threadId: text('thread_id'),
    parentThreadId: text('parent_thread_id'),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommBasicMessage'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
