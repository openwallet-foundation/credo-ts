import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { DidCommMessageRole, DidCommPlaintextMessage } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommMessage = sqliteTable(
  'DidcommMessage',
  {
    ...getSqliteBaseRecordTable(),

    message: text({ mode: 'json' }).$type<DidCommPlaintextMessage>().notNull(),
    role: text().$type<DidCommMessageRole>().notNull(),

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
  (table) => sqliteBaseRecordIndexes(table, 'didcommMessage')
)
