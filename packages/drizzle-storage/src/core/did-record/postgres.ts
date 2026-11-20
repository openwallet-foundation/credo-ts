import type { DidDocumentKey, DidDocumentRole } from '@credo-ts/core'
import { index, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
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

    // Custom Tags
    alternativeDids: text('alternative_dids').array(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'did'),

    // Used to find the did of the keys of each received message, and the did record of each did
    index('did_recipient_key_fingerprints_idx').using('gin', table.recipientKeyFingerprints.op('jsonb_path_ops')),
    index('did_did_idx').on(table.contextCorrelationId, table.did),
  ]
)
