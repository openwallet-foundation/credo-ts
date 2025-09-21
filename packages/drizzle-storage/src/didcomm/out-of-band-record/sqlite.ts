import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type {
  DidCommOutOfBandInlineServiceKey,
  DidCommOutOfBandRole,
  DidCommOutOfBandState,
  DidCommPlaintextMessage,
} from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommOutOfBand = sqliteTable(
  'DidcommOutOfBand',
  {
    ...getSqliteBaseRecordTable(),

    outOfBandInvitation: text('out_of_band_invitation', { mode: 'json' }).$type<DidCommPlaintextMessage>().notNull(),
    role: text().$type<DidCommOutOfBandRole>().notNull(),
    state: text().$type<DidCommOutOfBandState>().notNull(),
    alias: text(),
    reusable: integer({ mode: 'boolean' }).notNull(),
    autoAcceptConnection: integer('auto_accept_connection', { mode: 'boolean' }),
    mediatorId: text('mediator_id'),
    reuseConnectionId: text('reuse_connection_id'),
    invitationInlineServiceKeys: text('invitation_inline_service_keys', { mode: 'json' }).$type<
      DidCommOutOfBandInlineServiceKey[]
    >(),

    // Tags not in record
    threadId: text('thread_id').notNull(),
    invitationRequestsThreadIds: text('invitation_requests_thread_ids', { mode: 'json' }).$type<string[]>(),

    // Custom tags
    recipientKeyFingerprints: text('recipient_key_fingerprints', { mode: 'json' }).$type<string[]>(),
    recipientRoutingKeyFingerprint: text('recipient_routing_key_fingerprint'),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommOutOfBand'),
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
