import { ClaimFormat, DidDocumentKey, DidDocumentRole } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { baseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const didClaimFormat = pgEnum('W3cClaimFormat', [ClaimFormat.LdpVc, ClaimFormat.JwtVc])

const didRole = pgEnum('didRole', [DidDocumentRole.Created, DidDocumentRole.Received])

export const did = pgTable(
  'Did',
  {
    ...baseRecordTable,

    did: text().notNull(),
    role: didRole().notNull(),
    didDocument: jsonb('did_document'),
    keys: jsonb().$type<DidDocumentKey[]>(),

    // Default Tags
    recipientKeyFingerprints: jsonb('recipient_key_fingerprints'),
    method: text(),
    methodSpecificIdentifier: text('method_specific_identifier'),
    // Not adding this here, since it's legacy
    // legacyUnqualifiedDid

    // Custom Tags
    alternativeDids: text('alternative_dids').array(),
  },
  (table) => postgresBaseRecordIndexes(table, 'did')
)
