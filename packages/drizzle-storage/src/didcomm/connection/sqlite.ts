import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// TODO: package dependencies
import { DidExchangeRole, DidExchangeState, HandshakeProtocol } from '@credo-ts/didcomm'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

// Dynamic extension
// - need to dynamically load them in the schema file
//   - create a custom schema file where you import them all
// - need to provide them to the create drizzle
//   - custom schema file? but how do we make the custom drizzle take the custom schema file
// - need to create a type where they are present
//   - good one
//
// for the main packages i think we should add them all to the drizzle package
// but have `@credo-ts/drizzle-storage/anoncreds`, etc.. so you don't bundle
// code you don't use, but we also won't have to create 10 packages

export const didcommConnection = sqliteTable(
  'DidcommConnection',
  {
    ...sqliteBaseRecordTable,

    state: text('state').$type<DidExchangeState>().notNull(),
    role: text('role').$type<DidExchangeRole>().notNull(),

    did: text('did'),
    theirDid: text('their_did'),
    theirLabel: text('their_label'),
    alias: text('alias'),
    autoAcceptConnection: integer('auto_accept_connection', { mode: 'boolean' }),
    imageUrl: text('image_url'),
    threadId: text('thread_id').unique(),
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
  (table) => sqliteBaseRecordIndexes(table, 'didcommConnection')
)
