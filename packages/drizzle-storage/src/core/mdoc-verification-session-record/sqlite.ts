import type { MdocVerificationSessionState, MdocVerificationSessionTranscript } from '@credo-ts/core'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdocVerificationSession = sqliteTable(
  'MdocVerificationSession',
  {
    ...getSqliteBaseRecordTable(),

    state: text().$type<MdocVerificationSessionState>().notNull(),
    errorMessage: text('error_message'),

    deviceRequestBase64Url: text('device_request_base64_url').notNull(),
    sessionTranscript: text('session_transcript', { mode: 'json' })
      .$type<MdocVerificationSessionTranscript>()
      .notNull(),
    sessionTranscriptType: text('session_transcript_type').$type<MdocVerificationSessionTranscript['type']>().notNull(),
    nonce: text(),

    sessionKeyId: text('session_key_id').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdocVerificationSession')
)
