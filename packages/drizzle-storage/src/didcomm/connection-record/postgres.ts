import type { DidExchangeRole, DidExchangeState, HandshakeProtocol } from '@credo-ts/didcomm'
import { boolean, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const didcommConnectionStates = exhaustiveArray(
  {} as DidExchangeState,
  [
    'start',
    'invitation-sent',
    'invitation-received',
    'request-sent',
    'request-received',
    'response-sent',
    'response-received',
    'abandoned',
    'completed',
  ] as const
)
export const didcommConnectionStateEnum = pgEnum('DidcommConnectionState', didcommConnectionStates)

export const didcommConnectionRoles = exhaustiveArray({} as DidExchangeRole, ['requester', 'responder'] as const)
export const didcommConnectionRoleEnum = pgEnum('DidcommConnectionRole', didcommConnectionRoles)

export const didcommConnectionHandshakeProtocols = exhaustiveArray(
  {} as HandshakeProtocol,
  ['https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x'] as const
)
export const didcommConnectionHandshakeProtocolEnum = pgEnum(
  'DidcommConnectionHandshakeProtocol',
  didcommConnectionHandshakeProtocols
)

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
