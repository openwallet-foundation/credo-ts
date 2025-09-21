import type {
  OpenId4VcVerificationSessionState,
  OpenId4VpAuthorizationRequestPayload,
  OpenId4VpAuthorizationResponsePayload,
} from '@credo-ts/openid4vc'
import { jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'
import { openid4vcVerifier } from '../postgres'

export const openId4VcVerificationSessionStates = exhaustiveArray(
  {} as OpenId4VcVerificationSessionState,
  ['Error', 'RequestCreated', 'RequestUriRetrieved', 'ResponseVerified'] as const
)
export const openId4VcVerificationSessionStateEnum = pgEnum(
  'OpenId4VcVerificationSessionState',
  openId4VcVerificationSessionStates
)

export const openId4VcVerificationSession = pgTable(
  'OpenId4VcVerificationSession',
  {
    ...getPostgresBaseRecordTable(),

    verifierId: text('verifier_id')
      .notNull()
      .references(() => openid4vcVerifier.verifierId, { onDelete: 'cascade' }),

    state: openId4VcVerificationSessionStateEnum().notNull(),
    errorMessage: text('error_message'),

    authorizationRequestJwt: text('authorization_request_jwt'),
    authorizationRequestPayload: jsonb('authorization_request_payload').$type<OpenId4VpAuthorizationRequestPayload>(),
    authorizationRequestUri: text('authorization_request_uri'),
    authorizationResponseRedirectUri: text('authorization_response_redirect_uri'),
    authorizationRequestId: text('authorization_request_id'),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      precision: 3,
    }),
    authorizationResponsePayload: jsonb(
      'authorization_response_payload'
    ).$type<OpenId4VpAuthorizationResponsePayload>(),
    presentationDuringIssuanceSession: text('presentation_during_issuance_session'),

    // These tags may be encoded in a JWT, so we need to duplicate them
    nonce: text().notNull(),
    payloadState: text('payload_state'),
  },
  (table) => postgresBaseRecordIndexes(table, 'openId4VcVerificationSession')
)
