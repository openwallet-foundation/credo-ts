import type { DidCommAutoAcceptProof, DidCommProofRole, DidCommProofState } from '@credo-ts/didcomm'
import { boolean, foreignKey, pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'
import { didcommConnection } from '../connection-record/postgres'

export const didcommProofExchangeRoles = exhaustiveArray({} as DidCommProofRole, ['verifier', 'prover'] as const)
export const didcommProofExchangeRoleEnum = pgEnum('DidcommProofExchangeRole', didcommProofExchangeRoles)

export const didcommProofExchangeStates = exhaustiveArray(
  {} as DidCommProofState,
  [
    'proposal-sent',
    'proposal-received',
    'request-sent',
    'request-received',
    'presentation-sent',
    'presentation-received',
    'declined',
    'abandoned',
    'done',
  ] as const
)
export const didcommProofExchangeStateEnum = pgEnum('DidcommProofExchangeState', didcommProofExchangeStates)

export const didcommProofExchangeAutoAccepts = exhaustiveArray(
  {} as DidCommAutoAcceptProof,
  ['always', 'contentApproved', 'never'] as const
)
export const didcommProofExchangeAutoAcceptEnum = pgEnum(
  'DidcommProofExchangeAutoAccept',
  didcommProofExchangeAutoAccepts
)

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
