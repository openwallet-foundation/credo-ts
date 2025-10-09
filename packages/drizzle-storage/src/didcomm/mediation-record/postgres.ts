import type { DidCommMediationRole, DidCommMediationState, DidCommMediatorPickupStrategy } from '@credo-ts/didcomm'
import { boolean, foreignKey, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'
import { didcommConnection } from '../connection-record/postgres'

const didcommMediationStates = exhaustiveArray({} as DidCommMediationState, ['requested', 'granted', 'denied'] as const)
export const didcommMediationStateEnum = pgEnum('DidcommMediationState', didcommMediationStates)

const didcommMediationRoles = exhaustiveArray({} as DidCommMediationRole, ['MEDIATOR', 'RECIPIENT'] as const)
export const didcommMediationRoleEnum = pgEnum('DidcommMediationRole', didcommMediationRoles)

export const didcommMediationPickupStrategies = exhaustiveArray(
  {} as DidCommMediatorPickupStrategy,
  ['PickUpV1', 'PickUpV2', 'PickUpV2LiveMode', 'Implicit', 'None'] as const
)
export const didcommMediationPickupStrategyEnum = pgEnum(
  'DidcommMediationPickupStrategry',
  didcommMediationPickupStrategies
)

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
