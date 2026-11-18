import type {
  Kms,
  MdocDeviceRequestDefinition,
  MdocVerificationSessionState,
  MdocVerificationSessionTranscript,
} from '@credo-ts/core'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdocVerificationSession = sqliteTable(
  'MdocVerificationSession',
  {
    ...getSqliteBaseRecordTable(),

    state: text().$type<MdocVerificationSessionState>().notNull(),
    errorMessage: text('error_message'),

    deviceRequestBase64Url: text('device_request_base64_url').notNull(),
    deviceRequestDefinition: text('device_request_definition', { mode: 'json' })
      .$type<MdocDeviceRequestDefinition>()
      .notNull(),
    sessionTranscript: text('session_transcript', { mode: 'json' })
      .$type<MdocVerificationSessionTranscript>()
      .notNull(),
    sessionTranscriptType: text('session_transcript_type').$type<MdocVerificationSessionTranscript['type']>().notNull(),
    nonce: text(),

    sessionKey: text('session_key', { mode: 'json' }).$type<Kms.KmsKeyReference>(),
    // No longer written. Rows from before `session_key`, also from servers not yet upgraded, only have this.
    sessionKeyId: text('session_key_id'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdocVerificationSession')
)
