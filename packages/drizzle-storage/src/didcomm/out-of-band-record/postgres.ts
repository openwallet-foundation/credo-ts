import type { DidCommOutOfBandInlineServiceKey, DidCommOutOfBandRole, DidCommOutOfBandState, DidCommPlaintextMessage } from '@credo-ts/didcomm'
import { boolean, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const didcommOutOfBandRoles = exhaustiveArray({} as DidCommOutOfBandRole, ['sender', 'receiver'] as const)
export const didcommOutOfBandRoleEnum = pgEnum('DidcommOutOfBandRole', didcommOutOfBandRoles)

export const didcommOutOfBandStates = exhaustiveArray(
  {} as DidCommOutOfBandState,
  ['initial', 'await-response', 'prepare-response', 'done'] as const
)
export const didcommOutOfBandStateEnum = pgEnum('DidcommOutOfBandState', didcommOutOfBandStates)

export const didcommOutOfBand = pgTable(
  'DidcommOutOfBand',
  {
    ...getPostgresBaseRecordTable(),

    outOfBandInvitation: jsonb('out_of_band_invitation').$type<DidCommPlaintextMessage>().notNull(),
    role: didcommOutOfBandRoleEnum().notNull(),
    state: didcommOutOfBandStateEnum().notNull(),
    alias: text(),
    reusable: boolean().notNull(),
    autoAcceptConnection: boolean('auto_accept_connection'),
    mediatorId: text('mediator_id'),
    reuseConnectionId: text('reuse_connection_id'),
    invitationInlineServiceKeys: jsonb('invitation_inline_service_keys').$type<DidCommOutOfBandInlineServiceKey[]>(),

    // Tags not on record
    threadId: text('thread_id').notNull(),
    invitationRequestsThreadIds: text('invitation_requests_thread_ids').array(),

    // Custom tags
    recipientKeyFingerprints: text('recipient_key_fingerprints').array(),
    recipientRoutingKeyFingerprint: text('recipient_routing_key_fingerprint'),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommOutOfBand'),
    // foreignKey({
    //   columns: [table.reuseConnectionId, table.contextCorrelationId],
    //   foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    // }).onDelete('set default'),

    // Do we want to delete connections when the mediator is removed?
    // Or do we want to restrict it, and first require all connections
    // to be removed?
    // foreignKey({
    //   columns: [table.mediatorId, table.contextCorrelationId],
    //   foreignColumns: [didcommMediator.id, didcommMediator.contextCorrelationId],
    // }).onDelete('cascade'),
  ]
)
