import { foreignKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

import { DrpcRequest, DrpcResponse, DrpcRole, DrpcState } from '@credo-ts/drpc'
import { didcommConnection } from '../../didcomm/connection/sqlite'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommDrpc = sqliteTable(
  'DidcommDrpc',
  {
    ...getSqliteBaseRecordTable(),

    request: text({ mode: 'json' }).$type<DrpcRequest>(),
    response: text({ mode: 'json' }).$type<DrpcResponse>(),

    state: text('state').$type<DrpcState>().notNull(),
    role: text('role').$type<DrpcRole>().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommDrpc'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
