import { AutoAcceptProof, ProofRole, ProofState } from '@credo-ts/didcomm'
import { boolean, foreignKey, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { didcommConnection } from '../postgres'

export const didcommProofExchangeRoleEnum = pgEnum('DidcommProofExchangeRole', ProofRole)
export const didcommProofExchangeStateEnum = pgEnum('DidcommProofExchangeState', ProofState)
export const didcommProofExchangeAutoAcceptEnum = pgEnum('DidcommProofExchangeAutoAccept', AutoAcceptProof)

export const didcommProofExchange = pgTable(
  'DidcommProofExchange',
  {
    ...getPostgresBaseRecordTable(),

    connectionId: text('connection_id'),
    threadId: text('thread_id').notNull(),
    protocolVersion: text('protocol_version').notNull(),
    parentThreadId: text('parent_thread_id'),
    isVerified: boolean('is_verified'),
    state: didcommProofExchangeRoleEnum().notNull(),
    role: didcommProofExchangeRoleEnum().notNull(),
    autoAcceptProof: didcommProofExchangeAutoAcceptEnum('auto_accept_proof'),
    errorMessage: text('error_message'),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommProofExchange'),
    foreignKey({
      columns: [table.connectionId, table.contextCorrelationId],
      foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    }).onDelete('cascade'),
    unique().on(table.contextCorrelationId, table.threadId, table.role),
  ]
)
