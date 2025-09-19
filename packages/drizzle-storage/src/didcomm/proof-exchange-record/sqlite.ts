import { foreignKey, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import type { AutoAcceptProof, ProofRole, ProofState } from '@credo-ts/didcomm'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { didcommConnection } from '../sqlite'

export const didcommProofExchange = sqliteTable(
  'DidcommProofExchange',
  {
    ...getSqliteBaseRecordTable(),

    connectionId: text('connection_id'),
    threadId: text('thread_id').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    parentThreadId: text('parent_thread_id'),
    isVerified: integer('is_verified', { mode: 'boolean' }),
    state: text().$type<ProofState>().notNull(),
    role: text().$type<ProofRole>().notNull(),
    autoAcceptProof: text('auto_accept_proof').$type<AutoAcceptProof>(),
    errorMessage: text('error_message'),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommProofExchange'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
