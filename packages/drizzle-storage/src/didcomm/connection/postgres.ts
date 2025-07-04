import { boolean, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommConnectionStateEnum = pgEnum('DidcommConnectionState', [
  'start',
  'invitation-sent',
  'invitation-received',
  'request-sent',
  'request-received',
  'response-sent',
  'response-received',
  'abandoned',
  'completed',
])

export const didcommConnectionRoleEnum = pgEnum('DidcommConnectionRole', ['requester', 'responder'])

export const didcommConnectionHandshakeProtocolEnum = pgEnum('DidcommConnectionHandshakeProtocol', [
  'https://didcomm.org/didexchange/1.x',
  'https://didcomm.org/connections/1.x',
])

export const didcommConnection = pgTable(
  'DidcommConnection',
  {
    ...getPostgresBaseRecordTable(),

    state: didcommConnectionStateEnum().notNull(),
    role: didcommConnectionRoleEnum().notNull(),

    did: text(),
    theirDid: text('their_did'),
    theirLabel: text('their_label'),
    alias: text(),
    autoAcceptConnection: boolean('auto_accept_connection'),
    imageUrl: text('image_url'),
    threadId: text('thread_id'),
    invitationDid: text('invitation_did'),

    // TODO: references mediator/oob record
    mediatorId: text('mediator_id'),
    outOfBandId: text('out_of_band_id'),

    errorMessage: text('error_message'),
    protocol: didcommConnectionHandshakeProtocolEnum(),
    connectionTypes: text('connection_types').array(),

    previousDids: text('previous_dids').array(),
    previousTheirDids: text('previous_their_dids').array(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommConnection'),
    unique().on(table.contextCorrelationId, table.threadId),
  ]
)
