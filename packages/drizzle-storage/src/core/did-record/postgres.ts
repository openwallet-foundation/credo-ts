import type { DidDocumentKey, DidDocumentRole, DidRecordStatus } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

const didRoles = exhaustiveArray({} as DidDocumentRole, ['created', 'received'] as const)
export const didRoleEnum = pgEnum('didRole', didRoles)

const didStatuses = exhaustiveArray({} as DidRecordStatus, ['active', 'deactivated'] as const)
export const didStatusEnum = pgEnum('didStatus', didStatuses)

export const did = pgTable(
  'Did',
  {
    ...getPostgresBaseRecordTable(),

    did: text().notNull(),
    role: didRoleEnum().notNull(),
    status: didStatusEnum(),
    didDocument: jsonb('did_document'),
    keys: jsonb().$type<DidDocumentKey[]>(),

    // Default Tags
    recipientKeyFingerprints: jsonb('recipient_key_fingerprints'),
    method: text().notNull(),
    methodSpecificIdentifier: text('method_specific_identifier').notNull(),

    // Custom Tags
    alternativeDids: text('alternative_dids').array(),
  },
  (table) => postgresBaseRecordIndexes(table, 'did')
)
