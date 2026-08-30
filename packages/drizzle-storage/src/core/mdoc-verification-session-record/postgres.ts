import type { MdocVerificationSessionState, MdocVerificationSessionTranscript } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const mdocVerificationSessionStates = exhaustiveArray(
  {} as MdocVerificationSessionState,
  ['Error', 'RequestCreated', 'ResponseVerified'] as const
)
export const mdocVerificationSessionStateEnum = pgEnum('MdocVerificationSessionState', mdocVerificationSessionStates)

export const mdocVerificationSessionTranscriptTypes = exhaustiveArray(
  {} as MdocVerificationSessionTranscript['type'],
  ['isoMdocDcApi'] as const
)
export const mdocVerificationSessionTranscriptTypeEnum = pgEnum(
  'MdocVerificationSessionTranscriptType',
  mdocVerificationSessionTranscriptTypes
)

export const mdocVerificationSession = pgTable(
  'MdocVerificationSession',
  {
    ...getPostgresBaseRecordTable(),

    state: mdocVerificationSessionStateEnum().notNull(),
    errorMessage: text('error_message'),

    deviceRequestBase64Url: text('device_request_base64_url').notNull(),
    sessionTranscript: jsonb('session_transcript').$type<MdocVerificationSessionTranscript>().notNull(),
    sessionTranscriptType: mdocVerificationSessionTranscriptTypeEnum('session_transcript_type').notNull(),
    nonce: text(),

    sessionKeyId: text('session_key_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 3 }).notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'mdocVerificationSession')
)
