import type { JsonObject } from '@credo-ts/core'
import type { AutoAcceptCredential, CredentialRecordBinding, CredentialRole, CredentialState } from '@credo-ts/didcomm'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const didcommCredentialExchangeStates = exhaustiveArray(
  {} as CredentialState,
  [
    'proposal-sent',
    'proposal-received',
    'offer-sent',
    'offer-received',
    'declined',
    'request-sent',
    'request-received',
    'credential-issued',
    'credential-received',
    'done',
    'abandoned',
  ] as const
)
export const didcommCredentialExchangeStateEnum = pgEnum(
  'DidcommCredentialExchangeState',
  didcommCredentialExchangeStates
)

export const didcommCredentialExchangeRoles = exhaustiveArray({} as CredentialRole, ['issuer', 'holder'] as const)
export const didcommCredentialExchangeRoleEnum = pgEnum('DidcommCredentialExchangeRole', didcommCredentialExchangeRoles)

export const didcommCredentialExchangeAutoAccepts = exhaustiveArray(
  {} as AutoAcceptCredential,
  ['always', 'contentApproved', 'never'] as const
)
export const didcommCredentialExchangeAutoAcceptEnum = pgEnum(
  'DidcommCredentialExchangeAutoAccept',
  didcommCredentialExchangeAutoAccepts
)

export const didcommCredentialExchange = pgTable(
  'DidcommCredentialExchange',
  {
    ...getPostgresBaseRecordTable(),

    connectionId: text('connection_id'),
    threadId: text('thread_id').notNull(),
    parentThreadId: text('parent_thread_id'),

    state: didcommCredentialExchangeStateEnum().notNull(),
    role: didcommCredentialExchangeRoleEnum().notNull(),
    autoAcceptCredential: didcommCredentialExchangeAutoAcceptEnum('auto_accept_credential'),
    revocationNotification: jsonb('revocation_notification').$type<JsonObject>(),
    errorMessage: text('error_message'),
    protocolVersion: text('protocol_version'),

    credentials: jsonb().$type<CredentialRecordBinding[]>(),
    credentialIds: text('credential_ids').array(), // same as credentials, but queryable

    credentialAttributes: jsonb('credential_attributes').$type<JsonObject[]>(),
    linkedAttachments: jsonb('linked_attachments').$type<JsonObject[]>(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'didcommCredentialExchange'),
    // TODO: we only want to set the `connectionId` to null on delete of
    // the associated connection, but that's not possible with composite foreign keys
    // so we need to add a custom trigger for that.
    // foreignKey({
    //   columns: [table.connectionId, table.contextCorrelationId],
    //   foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    // }).onDelete('cascade'),
  ]
)
