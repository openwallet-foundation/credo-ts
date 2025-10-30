import type {
  OpenId4VcIssuanceSessionAuthorization,
  OpenId4VcIssuanceSessionChainedIdentity,
  OpenId4VcIssuanceSessionDpop,
  OpenId4VcIssuanceSessionPkce,
  OpenId4VcIssuanceSessionPresentation,
  OpenId4VcIssuanceSessionRecordTransaction,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionWalletAttestation,
  OpenId4VciCredentialOfferPayload,
} from '@credo-ts/openid4vc'
import { boolean, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'
import { openid4vcIssuer } from '../openid4vc-issuer-record/postgres'

const openId4VcIssuanceSessionStates = exhaustiveArray(
  {} as OpenId4VcIssuanceSessionState,
  [
    'OfferCreated',
    'OfferUriRetrieved',
    'AuthorizationInitiated',
    'AuthorizationGranted',
    'AccessTokenRequested',
    'AccessTokenCreated',
    'CredentialRequestReceived',
    'CredentialsPartiallyIssued',
    'Completed',
    'Error',
  ] as const
)
export const openId4VcIssuanceSessionStateEnum = pgEnum('OpenId4VcIssuanceSessionState', openId4VcIssuanceSessionStates)

export const openId4VcIssuanceSession = pgTable(
  'OpenId4VcIssuanceSession',
  {
    ...getPostgresBaseRecordTable(),

    issuerId: text('issuer_id')
      .notNull()
      .references(() => openid4vcIssuer.issuerId, { onDelete: 'cascade' }),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      precision: 3,
    }),

    state: openId4VcIssuanceSessionStateEnum().notNull(),
    issuedCredentials: text('issued_credentials').array(),

    // Pre-authorized flow
    preAuthorizedCode: text('pre_authorized_code'),
    userPin: text('user_pin'),

    // Client and authentication
    clientId: text('client_id'),

    pkce: jsonb().$type<OpenId4VcIssuanceSessionPkce>(),
    walletAttestation: jsonb('wallet_attestation').$type<OpenId4VcIssuanceSessionWalletAttestation>(),
    dpop: jsonb().$type<OpenId4VcIssuanceSessionDpop>(),
    authorization: jsonb().$type<
      Omit<OpenId4VcIssuanceSessionAuthorization, 'codeExpiresAt'> & { codeExpiresAt?: string }
    >(),
    presentation: jsonb().$type<OpenId4VcIssuanceSessionPresentation>(),

    // Metadata and error handling
    issuanceMetadata: jsonb('issuance_metadata').$type<Record<string, unknown>>(),

    transactions: jsonb().$type<OpenId4VcIssuanceSessionRecordTransaction[]>(),

    chainedIdentity: jsonb().$type<
      Omit<OpenId4VcIssuanceSessionChainedIdentity, 'requestUriExpiresAt'> & { requestUriExpiresAt?: string }
    >(),

    // Credential offer
    credentialOfferUri: text('credential_offer_uri'),
    credentialOfferId: text('credential_offer_id'),
    credentialOfferPayload: jsonb('credential_offer_payload').$type<OpenId4VciCredentialOfferPayload>().notNull(),

    generateRefreshTokens: boolean('generate_refresh_tokens'),

    errorMessage: text('error_message'),
  },
  (table) => postgresBaseRecordIndexes(table, 'openId4VcIssuanceSession')
)
