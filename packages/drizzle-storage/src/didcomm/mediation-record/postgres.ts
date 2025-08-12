import { MediationRole, MediationState, MediatorPickupStrategy } from '@credo-ts/didcomm'
import { boolean, foreignKey, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { didcommConnection } from '../postgres'

export const didcommMediationStateEnum = pgEnum('DidcommMediationState', MediationState)
export const didcommMediationRoleEnum = pgEnum('DidcommMediationRole', MediationRole)
export const didcommMediationPickupStrategyEnum = pgEnum('DidcommMediationPickupStrategry', MediatorPickupStrategy)

export const didcommMediation = pgTable(
  'DidcommMediation',
  {
    ...getPostgresBaseRecordTable(),
    state: didcommMediationStateEnum().notNull(),
    role: didcommMediationRoleEnum().notNull(),
    connectionId: text('connection_id').notNull(),
    threadId: text('thread_id').notNull(),
    endpoint: text(),

    recipientKeys: text('recipient_keys').array().notNull(),
    routingKeys: text('routing_keys').array().notNull(),
    pickupStrategy: didcommMediationPickupStrategyEnum('pickup_strategy'),

    default: boolean(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommMediation'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
