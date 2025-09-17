import { DidDocumentKey, DidDocumentRole } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const did = sqliteTable(
  'Did',
  {
    ...getSqliteBaseRecordTable(),

    did: text().notNull(),
    role: text().$type<DidDocumentRole.Created | DidDocumentRole.Received>().notNull(),
    didDocument: text('did_document', { mode: 'json' }),
    keys: text({ mode: 'json' }).$type<DidDocumentKey[]>(),

    // Default Tags
    recipientKeyFingerprints: text('recipient_key_fingerprints', { mode: 'json' }).$type<string[]>(),
    method: text().notNull(),
    methodSpecificIdentifier: text('method_specific_identifier').notNull(),
    // Not adding this here, since it's legacy
    // legacyUnqualifiedDid

    // Custom Tags
    alternativeDids: text('alternative_dids', { mode: 'json' }).$type<string[]>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'did')
)
