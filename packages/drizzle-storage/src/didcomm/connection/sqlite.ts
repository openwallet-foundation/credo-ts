import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

import type { DidExchangeRole, DidExchangeState, HandshakeProtocol } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommConnection = sqliteTable(
  'DidcommConnection',
  {
    ...getSqliteBaseRecordTable(),

    state: text('state').$type<DidExchangeState>().notNull(),
    role: text('role').$type<DidExchangeRole>().notNull(),

    did: text('did'),
    theirDid: text('their_did'),
    theirLabel: text('their_label'),
    alias: text('alias'),
    autoAcceptConnection: integer('auto_accept_connection', { mode: 'boolean' }),
    imageUrl: text('image_url'),
    threadId: text('thread_id'),
    invitationDid: text('invitation_did'),

    // TODO: references mediator/oob record
    mediatorId: text('mediator_id'),
    outOfBandId: text('out_of_band_id'),

    errorMessage: text('error_message'),
    protocol: text('protocol').$type<HandshakeProtocol>(),

    // Using JSON for array storage
    connectionTypes: text('connection_types', { mode: 'json' }).$type<string[]>(),
    previousDids: text('previous_dids', { mode: 'json' }).$type<string[]>(),
    previousTheirDids: text('previous_their_dids', { mode: 'json' }).$type<string[]>(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommConnection'),
    unique().on(table.contextCorrelationId, table.threadId),
  ]
)
