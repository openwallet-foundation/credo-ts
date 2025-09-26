import { foreignKey, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { DidCommMediationRole, DidCommMediationState, DidCommMediatorPickupStrategy } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { didcommConnection } from '../sqlite'

export const didcommMediation = sqliteTable(
  'DidcommMediation',
  {
    ...getSqliteBaseRecordTable(),

    state: text().$type<DidCommMediationState>().notNull(),
    role: text().$type<DidCommMediationRole>().notNull(),
    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),
    endpoint: text(),

    recipientKeys: text('recipient_keys', { mode: 'json' }).$type<string[]>().notNull(),
    routingKeys: text('routing_keys', { mode: 'json' }).$type<string[]>().notNull(),
    pickupStrategy: text('pickup_strategy').$type<DidCommMediatorPickupStrategy>(),

    default: integer({ mode: 'boolean' }),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommMediation'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
