import type { DidDocumentKey, DidDocumentRole } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

const didRoles = exhaustiveArray({} as DidDocumentRole, ['created', 'received'] as const)
export const didRoleEnum = pgEnum('didRole', didRoles)

export const did = pgTable(
  'Did',
  {
    ...getPostgresBaseRecordTable(),

    did: text().notNull(),
    role: didRoleEnum().notNull(),
    didDocument: jsonb('did_document'),
    keys: jsonb().$type<DidDocumentKey[]>(),

    // Default Tags
    recipientKeyFingerprints: jsonb('recipient_key_fingerprints'),
    method: text().notNull(),
    methodSpecificIdentifier: text('method_specific_identifier').notNull(),
    // Not adding this here, since it's legacy
    // legacyUnqualifiedDid

    // Custom Tags
    alternativeDids: text('alternative_dids').array(),
  },
  (table) => postgresBaseRecordIndexes(table, 'did')
)
