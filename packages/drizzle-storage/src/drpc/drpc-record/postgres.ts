import type { DrpcRequest, DrpcResponse, DrpcRole, DrpcState } from '@credo-ts/drpc'
import { foreignKey, jsonb, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { didcommConnection } from '../../didcomm/connection-record/postgres'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const didcommDrpcStates = exhaustiveArray(
  {} as DrpcState,
  ['request-sent', 'request-received', 'completed'] as const
)
export const didcommDrpcStateEnum = pgEnum('DidcommDrpcState', didcommDrpcStates)

export const didcommDrpcRoles = exhaustiveArray({} as DrpcRole, ['client', 'server'] as const)
export const didcommDrpcRoleEnum = pgEnum('DidcommDrpcRole', didcommDrpcRoles)

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
