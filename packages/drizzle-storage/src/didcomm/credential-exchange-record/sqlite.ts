import type { JsonObject } from '@credo-ts/core'
import type {
  CredentialRecordBinding,
  DidCommAutoAcceptCredential,
  DidCommCredentialRole,
  DidCommCredentialState,
} from '@credo-ts/didcomm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const didcommCredentialExchange = sqliteTable(
  'DidcommCredentialExchange',
  {
    ...getSqliteBaseRecordTable(),

    connectionId: text('connection_id'),
    threadId: text('thread_id').notNull(),
    parentThreadId: text('parent_thread_id'),

    state: text().$type<DidCommCredentialState>().notNull(),
    role: text().$type<DidCommCredentialRole>().notNull(),
    autoAcceptCredential: text('auto_accept_credential').$type<DidCommAutoAcceptCredential>(),
    revocationNotification: text('revocation_notification', { mode: 'json' }).$type<JsonObject>(),
    errorMessage: text('error_message'),
    protocolVersion: text('protocol_version'),

    credentials: text({ mode: 'json' }).$type<CredentialRecordBinding[]>(),
    credentialIds: text('credential_ids', { mode: 'json' }).$type<string[]>(), // same as credentials, but queryable

    credentialAttributes: text('credential_attributes', { mode: 'json' }).$type<JsonObject[]>(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'didcommCredentialExchange'),
    // TODO: we only want to set the `connectionId` to null on delete of
    // the associated connection, but that's not possible with composite foreign keys
    // so we need to add a custom trigger for that.
    // foreignKey({
    //   columns: [table.connectionId, table.contextCorrelationId],
    //   foreignColumns: [didcommConnection.id, didcommConnection.contextCorrelationId],
    // }).onDelete('cascade'),
  ]
)
