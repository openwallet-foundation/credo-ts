import { DidCommMessageRole, PlaintextMessage } from '@credo-ts/didcomm'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didcommMessageRoleEnum = pgEnum('DidcommMessageRole', DidCommMessageRole)

export const didcommMessage = pgTable(
  'DidcommMessage',
  {
    ...postgresBaseRecordTable,

    message: jsonb().$type<PlaintextMessage>().notNull(),
    role: didcommMessageRoleEnum().notNull(),

    // We can't really put a foreign key on this...
    // in that case we need to create a separate column for each possible record
    associatedRecordId: text('associated_record_id'),

    // Tags we can't query directy
    threadId: text('thread_id').notNull(),
    protocolName: text('protocol_name').notNull(),
    messageName: text('message_name').notNull(),
    protocolMajorVersion: text('protocol_major_version').notNull(),
    protocolMinorVersion: text('protocol_minor_version').notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'didcommMessage')
)
