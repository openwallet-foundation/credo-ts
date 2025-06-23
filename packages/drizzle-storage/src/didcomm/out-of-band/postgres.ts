import { OutOfBandInlineServiceKey, OutOfBandRole, OutOfBandState, PlaintextMessage } from '@credo-ts/didcomm'
import { boolean, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommOutOfBandRoleEnum = pgEnum('DidcommOutOfBandRole', OutOfBandRole)
export const didcommOutOfBandStateEnum = pgEnum('DidcommOutOfBandState', OutOfBandState)

export const didcommOutOfBand = pgTable(
  'DidcommOutOfBand',
  {
    ...getPostgresBaseRecordTable(),

    outOfBandInvitation: jsonb('out_of_band_invitation').$type<PlaintextMessage>().notNull(),
    role: didcommOutOfBandRoleEnum().notNull(),
    state: didcommOutOfBandStateEnum().notNull(),
    alias: text(),
    reusable: boolean().notNull(),
    autoAcceptConnection: boolean('auto_accept_connection'),
    mediatorId: text('mediator_id'),
    reuseConnectionId: text('reuse_connection_id'),
    invitationInlineServiceKeys: jsonb('invitation_inline_service_keys').$type<OutOfBandInlineServiceKey[]>(),

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
