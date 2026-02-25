import type {
  OpenId4VcVerificationSessionState,
  OpenId4VpAuthorizationRequestPayload,
  OpenId4VpAuthorizationResponsePayload,
} from '@credo-ts/openid4vc'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { openid4vcVerifier } from '../openid4vc-verifier-record/sqlite'

export const openId4VcVerificationSession = sqliteTable(
  'OpenId4VcVerificationSession',
  {
    ...getSqliteBaseRecordTable(),

    verifierId: text('verifier_id')
      .notNull()
      .references(() => openid4vcVerifier.verifierId, { onDelete: 'cascade' }),

    state: text().$type<OpenId4VcVerificationSessionState>().notNull(),
    errorMessage: text('error_message'),

    authorizationRequestJwt: text('authorization_request_jwt'),
    authorizationRequestPayload: text('authorization_request_payload', {
      mode: 'json',
    }).$type<OpenId4VpAuthorizationRequestPayload>(),
    authorizationRequestUri: text('authorization_request_uri'),
    authorizationResponseRedirectUri: text('authorization_response_redirect_uri'),
    authorizationRequestId: text('authorization_request_id'),

    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    authorizationResponsePayload: text('authorization_response_payload', {
      mode: 'json',
    }).$type<OpenId4VpAuthorizationResponsePayload>(),
    presentationDuringIssuanceSession: text('presentation_during_issuance_session'),

    // These tags may be encoded in a JWT, so we need to duplicate them
    nonce: text().notNull(),
    payloadState: text('payload_state'),
  },
  (table) => sqliteBaseRecordIndexes(table, 'openId4VcVerificationSession')
)
