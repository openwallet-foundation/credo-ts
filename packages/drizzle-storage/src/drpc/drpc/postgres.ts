import { DrpcRequest, DrpcResponse, DrpcRole, DrpcState } from '@credo-ts/drpc'
import { foreignKey, jsonb, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection/postgres'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommDrpcStateEnum = pgEnum('DidcommDrpcState', DrpcState)
export const didcommDrpcRoleEnum = pgEnum('DidcommDrpcRole', DrpcRole)

export const didcommDrpc = pgTable(
  'DidcommDrpc',
  {
    ...getPostgresBaseRecordTable(),

    request: jsonb().$type<DrpcRequest>(),
    response: jsonb().$type<DrpcResponse>(),

    state: didcommDrpcStateEnum().notNull(),
    role: didcommDrpcRoleEnum().notNull(),

    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommDrpc'),
    unique().on(table.contextCorrelationId, table.threadId),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
